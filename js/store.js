/* Penyimpanan data: cache lokal (instan) + antrean sinkron ke Google Sheets (Apps Script). */
(function () {
  'use strict';
  const LS_DATA = 'cp_data_v1', LS_QUEUE = 'cp_queue_v1', LS_CONF = 'cp_conf_v1', LS_SYNC = 'cp_lastsync_v1';

  const DEFAULT_SETTINGS = {
    namaUsaha: 'SS Clothing',
    tagline: 'Jersey • Kaos • Seragam',
    alamat: '',
    hp: '',
    email: '',
    rekening: 'BSI - 7330337197 a.n Shafira Ham Volina',
    logo: 'icons/logo-200.png',
    prefixNota: 'INV',
    dpPersen: '50',
    ukuran: 'XS,S,M,L,XL,XXL,XXXL,XXXXL',
    tambahanUkuran: 'XXL=5000\nXXXL=10000\nXXXXL=10000',
    bulatDp: '50000',
    kategoriProduk: 'Jersey,Kaos,Baju,Kemeja,Jaket,Lainnya',
    kategoriBerukuran: 'Jersey,Kaos,Baju,Kemeja,Jaket',
    kategoriPengeluaran: 'Produksi,Bahan Kain,Sablon/Printing,Jahit,Bordir,Ongkir,Packing,Gaji,Listrik/Internet,Operasional,Lainnya',
    metodeBayar: 'Tunai,Transfer,QRIS',
    catatanNota: 'Terima kasih sudah order di SS Clothing. Pesanan diproses setelah DP diterima.',
    penandatangan: '',
    kertas: 'A4'
  };

  function readJSON(key, fallback) {
    try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; } catch (e) { return fallback; }
  }
  function writeJSON(key, val) {
    try { localStorage.setItem(key, JSON.stringify(val)); return true; } catch (e) { return false; }
  }
  function emptyData() { return { orders: [], items: [], payments: [], expenses: [], settings: {} }; }

  const Store = {
    DEFAULT_SETTINGS: DEFAULT_SETTINGS,
    data: emptyData(),
    queue: [],
    conf: { url: '', pin: '' },
    state: 'lokal',      // lokal | sinkron | tersimpan | antre | gagal
    error: '',
    lastSync: null,
    version: 0,
    _listeners: [],
    _timer: null,
    _busy: false,
    _again: false,
    _retry: 0,

    init() {
      const d = readJSON(LS_DATA, null);
      this.data = Object.assign(emptyData(), d || {});
      this.queue = readJSON(LS_QUEUE, []);
      this.conf = Object.assign({ url: '', pin: '' }, readJSON(LS_CONF, {}));
      this.lastSync = readJSON(LS_SYNC, null);
      this.version++;
      this._setState(this.conf.url ? (this.queue.length ? 'antre' : 'tersimpan') : 'lokal');
      window.addEventListener('online', () => this.sync());
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible' && this.conf.url) {
          const age = Date.now() - (this.lastSync || 0);
          if (age > 30000 || this.queue.length) this.sync();
        }
      });
      if (this.conf.url) this.sync();
      // Ambil data terbaru tiap 60 detik selama aplikasi terbuka (agar HP & laptop tetap sama)
      setInterval(() => {
        if (this.conf.url && document.visibilityState === 'visible' && !this._busy && Date.now() - (this.lastSync || 0) > 55000) this.sync();
      }, 15000);
    },

    get settings() { return Object.assign({}, DEFAULT_SETTINGS, this.data.settings || {}); },

    on(fn) { this._listeners.push(fn); },
    _emit(kind) { this._listeners.forEach(fn => { try { fn(kind); } catch (e) { console.error(e); } }); },
    _setState(s, err) { this.state = s; this.error = err || ''; this._emit('status'); },

    persist() {
      writeJSON(LS_DATA, this.data);
      writeJSON(LS_QUEUE, this.queue);
    },

    setConf(conf) {
      this.conf = Object.assign({}, this.conf, conf);
      writeJSON(LS_CONF, this.conf);
      this._setState(this.conf.url ? 'antre' : 'lokal');
    },

    /** Terapkan perubahan ke data lokal (sama persis dengan logika di server). */
    applyLocal(d, op) {
      const x = op.data || {};
      const byId = (arr, id) => arr.findIndex(r => String(r.id) === String(id));
      const upsert = (arr, obj) => { const i = byId(arr, obj.id); if (i >= 0) arr[i] = obj; else arr.push(obj); };
      switch (op.type) {
        case 'saveOrder':
          upsert(d.orders, x.order);
          d.items = d.items.filter(r => r.orderId !== x.order.id).concat((x.items || []).map(r => Object.assign({}, r, { orderId: x.order.id })));
          d.expenses = d.expenses.filter(r => r.orderId !== x.order.id).concat((x.expenses || []).map(r => Object.assign({}, r, { orderId: x.order.id })));
          break;
        case 'deleteOrder':
          d.orders = d.orders.filter(r => r.id !== x.id);
          d.items = d.items.filter(r => r.orderId !== x.id);
          d.payments = d.payments.filter(r => r.orderId !== x.id);
          d.expenses = d.expenses.filter(r => r.orderId !== x.id);
          break;
        case 'savePayment': upsert(d.payments, x.payment); break;
        case 'deletePayment': d.payments = d.payments.filter(r => r.id !== x.id); break;
        case 'saveExpense': upsert(d.expenses, x.expense); break;
        case 'deleteExpense': d.expenses = d.expenses.filter(r => r.id !== x.id); break;
        case 'saveSettings': d.settings = Object.assign({}, x.settings); break;
      }
      return d;
    },

    /** Simpan perubahan: langsung tampil di layar, lalu dikirim ke Spreadsheet di latar belakang. */
    op(type, data) {
      const op = { type: type, data: JSON.parse(JSON.stringify(data)) };
      this.applyLocal(this.data, op);
      this.version++;
      if (this.conf.url) {
        this.queue.push(op);
        this._setState('antre');
      }
      this.persist();
      this._emit('data');
      this.scheduleSync(500);
    },

    scheduleSync(ms) {
      if (!this.conf.url) return;
      clearTimeout(this._timer);
      this._timer = setTimeout(() => this.sync(), ms || 0);
    },

    async request(payload) {
      const res = await fetch(this.conf.url, {
        method: 'POST',
        body: JSON.stringify(Object.assign({ pin: this.conf.pin }, payload)),
        redirect: 'follow'
      });
      const text = await res.text();
      let js;
      try { js = JSON.parse(text); } catch (e) {
        throw new Error('Respons server tidak valid. Pastikan URL berakhiran /exec dan akses "Siapa saja".');
      }
      if (!js.ok) throw new Error(js.error || 'Gagal');
      return js;
    },

    /** Kirim antrean + ambil data terbaru dalam SATU permintaan. */
    async sync() {
      if (!this.conf.url) { this._setState('lokal'); return; }
      if (this._hold) return;            // sedang menunggu keputusan gabung data
      if (this._busy) { this._again = true; return; }
      if (!navigator.onLine) { this._setState('antre', 'Offline'); return; }
      this._busy = true;
      clearTimeout(this._timer);
      this._setState('sinkron');
      const ops = this.queue.slice();
      try {
        const res = await this.request({ ops: ops, pull: true });
        this.queue.splice(0, ops.length);
        if (res.data) {
          const fresh = Object.assign(emptyData(), res.data);
          this.queue.forEach(op => this.applyLocal(fresh, op));
          const changed = JSON.stringify(fresh) !== JSON.stringify(this.data);
          this.data = fresh;
          if (changed) { this.version++; this._emit('remote'); }
        }
        this.lastSync = Date.now();
        writeJSON(LS_SYNC, this.lastSync);
        this.persist();
        this._retry = 0;
        this._setState(this.queue.length ? 'antre' : 'tersimpan');
      } catch (e) {
        this._retry++;
        const msg = /fetch|network|load failed/i.test(e.message || '') ? 'Koneksi internet terputus — akan dikirim ulang otomatis' : (e.message || String(e));
        this._setState('gagal', msg);
        const wait = Math.min(60000, 5000 * this._retry);
        if (this.queue.length) this.scheduleSync(wait);
      } finally {
        this._busy = false;
        if (this._again) { this._again = false; this.scheduleSync(50); }
      }
    },

    async testConnection(url, pin) {
      const res = await fetch(url, { method: 'POST', body: JSON.stringify({ pin: pin, ops: [], pull: false }) });
      const js = JSON.parse(await res.text());
      if (!js.ok) throw new Error(js.error || 'Gagal');
      return js;
    },

    /** Hubungkan perangkat ini: cek koneksi, lalu cari data yang hanya ada di perangkat ini (belum ada di Spreadsheet). */
    async connect(url, pin) {
      await this.testConnection(url, pin);
      this._hold = true;
      this.setConf({ url: url, pin: pin });
      const remote = Object.assign(emptyData(), (await this.request({ ops: [], pull: true })).data || {});
      const has = (arr, id) => arr.some(r => String(r.id) === String(id));
      const d = this.data;
      const orders = d.orders.filter(o => !has(remote.orders, o.id));
      const oid = {}; orders.forEach(o => { oid[o.id] = 1; });
      const payments = d.payments.filter(p => !has(remote.payments, p.id) && (oid[p.orderId] || has(remote.orders, p.orderId)));
      const expenses = d.expenses.filter(x => !x.orderId && !has(remote.expenses, x.id));
      const settings = !Object.keys(remote.settings || {}).length && Object.keys(d.settings || {}).length ? d.settings : null;
      return { orders: orders, payments: payments, expenses: expenses, settings: settings, count: orders.length + payments.length + expenses.length };
    },

    /** Gabungkan: kirim data yang hanya ada di perangkat ini, lalu muat semua data dari Spreadsheet. */
    mergeUp(diff) {
      const d = this.data, ops = [];
      if (diff.settings) ops.push({ type: 'saveSettings', data: { settings: diff.settings } });
      diff.orders.forEach(o => ops.push({ type: 'saveOrder', data: { order: o, items: d.items.filter(i => i.orderId === o.id), expenses: d.expenses.filter(x => x.orderId === o.id) } }));
      diff.payments.forEach(p => ops.push({ type: 'savePayment', data: { payment: p } }));
      diff.expenses.forEach(x => ops.push({ type: 'saveExpense', data: { expense: x } }));
      this.queue = this.queue.concat(ops);
      this.persist();
      this._hold = false;
      return this.sync();
    },

    /** Unggah seluruh data lokal ke spreadsheet (dipakai saat pertama kali menghubungkan). */
    uploadAll() {
      const d = this.data;
      const ops = [];
      ops.push({ type: 'saveSettings', data: { settings: d.settings || {} } });
      d.orders.forEach(o => ops.push({
        type: 'saveOrder', data: {
          order: o,
          items: d.items.filter(i => i.orderId === o.id),
          expenses: d.expenses.filter(x => x.orderId === o.id)
        }
      }));
      d.payments.forEach(p => ops.push({ type: 'savePayment', data: { payment: p } }));
      d.expenses.filter(x => !x.orderId).forEach(x => ops.push({ type: 'saveExpense', data: { expense: x } }));
      this.queue = this.queue.concat(ops);
      this.persist();
      return this.sync();
    },

    replaceAll(data) {
      this.data = Object.assign(emptyData(), data);
      this.version++;
      this.persist();
      this._emit('data');
    },

    clearLocal() {
      localStorage.removeItem(LS_DATA);
      localStorage.removeItem(LS_QUEUE);
      localStorage.removeItem(LS_SYNC);
      this.data = emptyData();
      this.queue = [];
      this.version++;
      this._emit('data');
    }
  };

  window.Store = Store;
})();
