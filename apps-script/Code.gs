/**
 * CATATAN PENJUALAN — Backend Google Apps Script
 * Menyimpan data aplikasi ke Google Spreadsheet.
 *
 * CARA PASANG (ringkas, detail di README.md):
 * 1. Buat Google Spreadsheet baru → menu Ekstensi → Apps Script.
 * 2. Hapus isi Code.gs bawaan, tempel seluruh isi file ini.
 * 3. Ganti PIN di bawah dengan PIN rahasia Anda.
 * 4. Deploy → Deployment baru → Jenis: Aplikasi web
 *      Jalankan sebagai : Saya
 *      Yang memiliki akses : Siapa saja
 * 5. Salin URL aplikasi web (berakhiran /exec) ke menu Pengaturan di aplikasi.
 */

// ====== UBAH DI SINI ======
const PIN = 'ganti-pin-ini';   // PIN yang sama diisi di menu Pengaturan aplikasi
const SPREADSHEET_ID = '';      // Kosongkan jika script dibuat dari menu Ekstensi spreadsheet
// ==========================

const TABLES = {
  Pesanan: ['id', 'noNota', 'tanggal', 'deadline', 'pelanggan', 'hp', 'alamat', 'kategori', 'produk',
    'pakaiUkuran', 'pakaiNomor', 'hargaDasar', 'diskon', 'ongkir', 'dpPersen', 'dpNominal',
    'status', 'catatan', 'dibuat', 'diubah'],
  Detail: ['id', 'orderId', 'urut', 'nama', 'nomor', 'ukuran', 'qty', 'harga', 'ket'],
  Pembayaran: ['id', 'orderId', 'tanggal', 'jenis', 'nominal', 'metode', 'catatan', 'dibuat'],
  Pengeluaran: ['id', 'tanggal', 'orderId', 'kategori', 'keterangan', 'nominal', 'dibuat'],
  Pengaturan: ['key', 'value']
};
const NUM_COLS = { hargaDasar: 1, diskon: 1, ongkir: 1, dpPersen: 1, dpNominal: 1, urut: 1, qty: 1, harga: 1, nominal: 1 };
const KEY_MAP = { orders: 'Pesanan', items: 'Detail', payments: 'Pembayaran', expenses: 'Pengeluaran' };

function doGet() {
  return json_({ ok: true, app: 'catatan-penjualan', time: new Date().toISOString() });
}

function doPost(e) {
  let body;
  try {
    body = JSON.parse((e && e.postData && e.postData.contents) || '{}');
  } catch (err) {
    return json_({ ok: false, error: 'Format permintaan tidak valid' });
  }
  if (PIN && String(body.pin || '') !== String(PIN)) {
    return json_({ ok: false, error: 'PIN salah', code: 'PIN' });
  }
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(25000);
    const db = new Db_();
    const result = { ok: true, applied: 0 };
    (body.ops || []).forEach(function (op) {
      applyOp_(db, op);
      result.applied++;
    });
    db.flush();
    if (body.pull || body.action === 'getAll') result.data = db.all();
    result.time = new Date().toISOString();
    return json_(result);
  } catch (err) {
    return json_({ ok: false, error: String(err && err.message || err) });
  } finally {
    try { lock.releaseLock(); } catch (e2) { }
  }
}

function applyOp_(db, op) {
  const d = op.data || {};
  switch (op.type) {
    case 'saveOrder':
      db.upsert('Pesanan', d.order);
      db.removeWhere('Detail', 'orderId', d.order.id);
      (d.items || []).forEach(function (r) { r.orderId = d.order.id; db.insert('Detail', r); });
      db.removeWhere('Pengeluaran', 'orderId', d.order.id);
      (d.expenses || []).forEach(function (r) { r.orderId = d.order.id; db.insert('Pengeluaran', r); });
      break;
    case 'deleteOrder':
      db.removeWhere('Pesanan', 'id', d.id);
      db.removeWhere('Detail', 'orderId', d.id);
      db.removeWhere('Pembayaran', 'orderId', d.id);
      db.removeWhere('Pengeluaran', 'orderId', d.id);
      break;
    case 'savePayment': db.upsert('Pembayaran', d.payment); break;
    case 'deletePayment': db.removeWhere('Pembayaran', 'id', d.id); break;
    case 'saveExpense': db.upsert('Pengeluaran', d.expense); break;
    case 'deleteExpense': db.removeWhere('Pengeluaran', 'id', d.id); break;
    case 'saveSettings':
      db.setRows('Pengaturan', Object.keys(d.settings || {}).map(function (k) {
        return { key: k, value: d.settings[k] };
      }));
      break;
    default:
      throw new Error('Operasi tidak dikenal: ' + op.type);
  }
}

/** Database sederhana: baca sekali per permintaan, tulis ulang tabel yang berubah. */
function Db_() {
  this.ss = SPREADSHEET_ID ? SpreadsheetApp.openById(SPREADSHEET_ID) : SpreadsheetApp.getActiveSpreadsheet();
  this.cache = {};
  this.dirty = {};
  this.tz = this.ss.getSpreadsheetTimeZone() || 'Asia/Makassar';
}

Db_.prototype.sheet = function (name) {
  let sh = this.ss.getSheetByName(name);
  const cols = TABLES[name];
  if (!sh) {
    sh = this.ss.insertSheet(name);
    sh.getRange(1, 1, 1, cols.length).setValues([cols]).setFontWeight('bold').setBackground('#e8f0fe');
    sh.setFrozenRows(1);
  }
  return sh;
};

Db_.prototype.rows = function (name) {
  if (this.cache[name]) return this.cache[name];
  const sh = this.sheet(name);
  const values = sh.getDataRange().getValues();
  const header = (values.shift() || []).map(String);
  const tz = this.tz;
  const rows = values.filter(function (r) { return r.join('') !== ''; }).map(function (r) {
    const o = {};
    header.forEach(function (h, i) {
      if (!h) return;
      let v = r[i];
      if (v instanceof Date) v = Utilities.formatDate(v, tz, 'yyyy-MM-dd');
      o[h] = v;
    });
    return o;
  });
  this.cache[name] = rows;
  return rows;
};

Db_.prototype.upsert = function (name, obj) {
  if (!obj || !obj.id) throw new Error('Data ' + name + ' tanpa id');
  const rows = this.rows(name);
  const i = rows.findIndex(function (r) { return String(r.id) === String(obj.id); });
  if (i >= 0) rows[i] = obj; else rows.push(obj);
  this.dirty[name] = true;
};

Db_.prototype.insert = function (name, obj) {
  this.rows(name).push(obj);
  this.dirty[name] = true;
};

Db_.prototype.removeWhere = function (name, field, value) {
  const rows = this.rows(name);
  const kept = rows.filter(function (r) { return String(r[field]) !== String(value); });
  if (kept.length !== rows.length) {
    this.cache[name] = kept;
    this.dirty[name] = true;
  }
};

Db_.prototype.setRows = function (name, rows) {
  this.cache[name] = rows;
  this.dirty[name] = true;
};

Db_.prototype.flush = function () {
  const self = this;
  Object.keys(this.dirty).forEach(function (name) {
    const sh = self.sheet(name);
    const cols = TABLES[name];
    const rows = self.cache[name];
    sh.getRange(1, 1, 1, cols.length).setValues([cols]);
    const last = sh.getLastRow();
    if (last > 1) sh.getRange(2, 1, last - 1, Math.max(cols.length, sh.getLastColumn())).clearContent();
    if (!rows.length) return;
    const need = rows.length + 1;
    if (sh.getMaxRows() < need) sh.insertRowsAfter(sh.getMaxRows(), need - sh.getMaxRows());
    const values = rows.map(function (r) {
      return cols.map(function (c) {
        const v = r[c];
        if (NUM_COLS[c]) return Number(v) || 0;
        return v === undefined || v === null ? '' : String(v);
      });
    });
    const formats = rows.map(function () {
      return cols.map(function (c) { return NUM_COLS[c] ? '#,##0' : '@'; });
    });
    sh.getRange(2, 1, rows.length, cols.length).setNumberFormats(formats).setValues(values);
  });
  this.dirty = {};
};

Db_.prototype.all = function () {
  const out = {};
  const self = this;
  Object.keys(KEY_MAP).forEach(function (k) {
    out[k] = self.rows(KEY_MAP[k]).map(function (r) {
      const o = {};
      TABLES[KEY_MAP[k]].forEach(function (c) {
        o[c] = NUM_COLS[c] ? (Number(r[c]) || 0) : (r[c] === undefined || r[c] === null ? '' : String(r[c]));
      });
      return o;
    });
  });
  const settings = {};
  this.rows('Pengaturan').forEach(function (r) { if (r.key) settings[r.key] = String(r.value); });
  out.settings = settings;
  return out;
};

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

/** Opsional: jalankan sekali dari editor untuk membuat semua sheet. */
function setup() {
  const db = new Db_();
  Object.keys(TABLES).forEach(function (n) { db.sheet(n); });
  const def = db.ss.getSheetByName('Sheet1') || db.ss.getSheetByName('Lembar1');
  if (def && def.getLastRow() === 0 && db.ss.getSheets().length > 1) db.ss.deleteSheet(def);
  Logger.log('Sheet siap. Sekarang Deploy sebagai Aplikasi web.');
}
