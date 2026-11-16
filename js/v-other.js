/* Keuangan & Pengaturan */
(function () {
  'use strict';
  const V = window.V = window.V || {};
  const e = U.esc;

  /* ===================== KEUANGAN ===================== */
  V.finance = function (el) {
    const ui = App.ui;
    const p = ui.finPeriod;
    const inP = s => p === 'all' || String(s || '').indexOf(p) === 0;
    const d = Store.data;
    const tabs = [['keluar', 'Pengeluaran'], ['masuk', 'Uang masuk'], ['labarugi', 'Laba rugi']];

    el.innerHTML = '<div class="page-head"><h1>Keuangan</h1><div class="row-btn">' + V.periodSelect('fp', p) +
      '<button class="btn primary" data-act="addExp">+ Pengeluaran</button></div></div>' +
      '<div class="tabs">' + tabs.map(t => '<button class="tab' + (ui.finTab === t[0] ? ' on' : '') + '" data-tab="' + t[0] + '">' + t[1] + '</button>').join('') + '</div>' +
      '<div id="fin"></div>';

    const fin = U.$('#fin', el);
    const orderName = id => { const o = M.order(id); return o ? '<a href="#/pesanan/' + e(o.id) + '">' + e(o.noNota + ' · ' + o.pelanggan) + '</a>' : '<span class="muted">(pesanan dihapus)</span>'; };

    if (ui.finTab === 'keluar') {
      let arr = d.expenses.filter(x => inP(x.tanggal));
      if (ui.finType === 'modal') arr = arr.filter(x => x.orderId);
      if (ui.finType === 'ops') arr = arr.filter(x => !x.orderId);
      arr.sort((a, b) => String(b.tanggal).localeCompare(String(a.tanggal)) || String(b.dibuat).localeCompare(String(a.dibuat)));
      const total = arr.reduce((s, x) => s + U.num(x.nominal), 0);
      const byK = {};
      arr.forEach(x => { byK[x.kategori || 'Lainnya'] = (byK[x.kategori || 'Lainnya'] || 0) + U.num(x.nominal); });
      const ks = Object.keys(byK).sort((a, b) => byK[b] - byK[a]);
      const max = Math.max(1, ...ks.map(k => byK[k]));
      fin.innerHTML =
        '<div class="chips">' + [['semua', 'Semua'], ['modal', 'Modal pesanan'], ['ops', 'Operasional']].map(f => '<button class="chip' + (ui.finType === f[0] ? ' on' : '') + '" data-type="' + f[0] + '">' + f[1] + '</button>').join('') + '</div>' +
        '<div class="grid2">' +
        '<section class="card"><div class="card-head"><h2>Per kategori</h2><b>' + U.rp(total) + '</b></div>' +
        (ks.length ? '<div class="bars wide">' + ks.map(k => '<div class="bar"><span>' + e(k) + '</span><div><i style="width:' + (byK[k] / max * 100).toFixed(1) + '%"></i></div><b>' + U.rp(byK[k]) + '</b></div>').join('') + '</div>' : '<p class="muted pad">Belum ada pengeluaran.</p>') +
        '</section>' +
        '<section class="card span2"><div class="card-head"><h2>Daftar pengeluaran</h2><span class="muted">' + arr.length + ' catatan</span></div>' +
        (arr.length ? '<div class="plist">' + arr.map(x => '<div class="prow"><div><b>' + e(x.kategori) + '</b> · ' + U.fdate(x.tanggal) + (x.keterangan ? ' · ' + e(x.keterangan) : '') +
          '<div class="small">' + (x.orderId ? 'Modal ' + orderName(x.orderId) : '<span class="muted">Operasional</span>') + '</div></div>' +
          '<div class="pr-r"><b>' + U.rp(x.nominal) + '</b><button class="icon-btn" data-act="edit" data-id="' + e(x.id) + '" aria-label="Edit">✎</button><button class="icon-btn" data-act="del" data-id="' + e(x.id) + '" aria-label="Hapus">✕</button></div></div>').join('') + '</div>'
          : '<p class="muted pad">Tidak ada data pada periode ini.</p>') + '</section></div>';
    } else if (ui.finTab === 'masuk') {
      const arr = d.payments.filter(x => inP(x.tanggal)).sort((a, b) => String(b.tanggal).localeCompare(String(a.tanggal)));
      const total = arr.reduce((s, x) => s + U.num(x.nominal), 0);
      const byM = {}, byJ = {};
      arr.forEach(x => { byM[x.metode || '-'] = (byM[x.metode || '-'] || 0) + U.num(x.nominal); byJ[x.jenis] = (byJ[x.jenis] || 0) + U.num(x.nominal); });
      fin.innerHTML = '<div class="stats">' +
        '<div class="stat main"><div class="s-lbl">Total uang masuk</div><div class="s-val">' + U.rp(total) + '</div><div class="s-sub">' + arr.length + ' transaksi</div></div>' +
        Object.keys(byJ).map(k => '<div class="stat"><div class="s-lbl">' + e(k) + '</div><div class="s-val">' + U.rp(byJ[k]) + '</div></div>').join('') +
        Object.keys(byM).map(k => '<div class="stat"><div class="s-lbl">Via ' + e(k) + '</div><div class="s-val">' + U.rp(byM[k]) + '</div></div>').join('') + '</div>' +
        '<section class="card"><div class="card-head"><h2>Daftar uang masuk</h2></div>' +
        (arr.length ? '<div class="plist">' + arr.map(x => '<div class="prow"><div><b>' + e(x.jenis) + '</b> · ' + U.fdate(x.tanggal) + ' <span class="muted">' + e(x.metode || '') + '</span><div class="small">' + orderName(x.orderId) + '</div></div>' +
          '<div class="pr-r"><b>' + U.rp(x.nominal) + '</b></div></div>').join('') + '</div>' : '<p class="muted pad">Tidak ada data pada periode ini.</p>') + '</section>';
    } else {
      const ords = d.orders.filter(o => o.status !== 'Batal' && inP(o.tanggal));
      let omzet = 0, modal = 0, diskon = 0;
      ords.forEach(o => { const c = M.calc(o); omzet += c.total; modal += c.modal; diskon += c.diskon; });
      const ops = d.expenses.filter(x => !x.orderId && inP(x.tanggal));
      const byK = {};
      ops.forEach(x => { byK[x.kategori || 'Lainnya'] = (byK[x.kategori || 'Lainnya'] || 0) + U.num(x.nominal); });
      const opsT = ops.reduce((s, x) => s + U.num(x.nominal), 0);
      const masuk = d.payments.filter(x => inP(x.tanggal)).reduce((s, x) => s + U.num(x.nominal), 0);
      const keluar = d.expenses.filter(x => inP(x.tanggal)).reduce((s, x) => s + U.num(x.nominal), 0);
      const row = (a, b, c) => '<div class="sl ' + (c || '') + '"><span>' + a + '</span><b>' + b + '</b></div>';
      fin.innerHTML = '<div class="grid2">' +
        '<section class="card"><div class="card-head"><h2>Laba rugi</h2><span class="muted">' + U.fmonth(p) + '</span></div><div class="sumbox lr">' +
        row('Pendapatan penjualan (' + ords.length + ' pesanan)', U.rp(omzet)) +
        row('Modal pesanan', '-' + U.rp(modal)) +
        row('Laba kotor', U.rp(omzet - modal), 'big') +
        Object.keys(byK).map(k => row('&nbsp;&nbsp;' + e(k), '-' + U.rp(byK[k]))).join('') +
        row('Total operasional', '-' + U.rp(opsT)) +
        row('Laba bersih', U.rp(omzet - modal - opsT), 'big ' + (omzet - modal - opsT >= 0 ? 'pos' : 'neg')) +
        '</div><p class="hint">Pendapatan dihitung dari tanggal pesanan (termasuk yang belum lunas). Pesanan berstatus Batal tidak dihitung.</p></section>' +
        '<section class="card"><div class="card-head"><h2>Arus kas</h2><span class="muted">' + U.fmonth(p) + '</span></div><div class="sumbox lr">' +
        row('Uang masuk (DP + pelunasan)', U.rp(masuk)) + row('Uang keluar (modal + operasional)', '-' + U.rp(keluar)) +
        row('Selisih kas', U.rp(masuk - keluar), 'big ' + (masuk - keluar >= 0 ? 'pos' : 'neg')) +
        '</div><p class="hint">Arus kas dihitung dari tanggal uang benar-benar diterima/dikeluarkan.</p></section></div>';
    }

    U.$('#fp', el).addEventListener('change', ev => { ui.finPeriod = ev.target.value; App.render(true); });
    el.addEventListener('click', ev => {
      const t = ev.target.closest('[data-tab]');
      if (t) { ui.finTab = t.dataset.tab; App.render(true); return; }
      const ty = ev.target.closest('[data-type]');
      if (ty) { ui.finType = ty.dataset.type; App.render(true); return; }
      const b = ev.target.closest('[data-act]');
      if (!b) return;
      if (b.dataset.act === 'addExp') V.expenseDialog(null);
      else if (b.dataset.act === 'edit') V.expenseDialog(d.expenses.find(x => x.id === b.dataset.id));
      else if (b.dataset.act === 'del') U.confirm('Hapus pengeluaran ini?', 'Hapus', () => Store.op('deleteExpense', { id: b.dataset.id }));
    });
  };

  /* ===================== PENGATURAN ===================== */
  V.settings = function (el) {
    const S = M.S();
    let logo = S.logo || '';
    const f = (key, label, attrs, cls) => '<label class="f ' + (cls || '') + '">' + label + '<input data-s="' + key + '" value="' + e(S[key]) + '" ' + (attrs || '') + '></label>';
    const ta = (key, label, rows, cls, hint) => '<label class="f ' + (cls || '') + '">' + label + '<textarea data-s="' + key + '" rows="' + (rows || 2) + '">' + e(S[key]) + '</textarea>' + (hint ? '<small class="hint">' + hint + '</small>' : '') + '</label>';
    const conn = Store.conf;

    el.innerHTML = '<div class="page-head"><h1>Pengaturan</h1></div>' +
      '<section class="card"><div class="card-head"><h2>Koneksi Google Spreadsheet</h2><span class="badge ' + (conn.url ? 'green' : 'gray') + '">' + (conn.url ? 'Terhubung' : 'Mode lokal') + '</span></div>' +
      '<div class="fgrid">' +
      '<label class="f span2">URL Aplikasi Web Apps Script<input id="cUrl" value="' + e(conn.url) + '" placeholder="https://script.google.com/macros/s/…/exec"></label>' +
      '<label class="f">PIN<input id="cPin" type="password" value="' + e(conn.pin) + '" placeholder="PIN di Code.gs"></label></div>' +
      '<div class="row-btn wrap"><button class="btn primary" data-act="connect">Simpan & hubungkan</button>' +
      (conn.url ? '<button class="btn" data-act="syncNow">Sinkron sekarang</button><button class="btn" data-act="upload">Unggah ulang semua data lokal</button><button class="btn ghost danger" data-act="disconnect">Putuskan</button>' : '') + '</div>' +
      '<p class="hint">' + (Store.lastSync ? 'Sinkron terakhir: ' + new Date(Store.lastSync).toLocaleString('id-ID') + '. ' : '') +
      (Store.queue.length ? '<b>' + Store.queue.length + ' perubahan menunggu dikirim.</b> ' : '') +
      (Store.error ? '<span class="red-t">' + e(Store.error) + '</span> ' : '') +
      'Semua perubahan langsung tampil di layar, lalu dikirim otomatis ke Spreadsheet di latar belakang.</p></section>' +

      '<form id="sf">' +
      '<section class="card"><h2>Identitas usaha (kop nota)</h2><div class="fgrid">' +
      '<div class="f logo-f"><span>Logo</span><div class="logo-box">' + (logo ? '<img id="logoImg" src="' + e(logo) + '">' : '<span id="logoImg" class="muted">Belum ada</span>') + '</div>' +
      '<div class="row-btn"><label class="btn sm">Pilih gambar<input type="file" accept="image/*" id="logoFile" hidden></label><button type="button" class="btn sm ghost" data-act="noLogo">Hapus</button></div></div>' +
      f('namaUsaha', 'Nama usaha', '', 'span2') + f('tagline', 'Tagline / bidang usaha', '', 'span2') +
      f('hp', 'No. HP / WA', 'inputmode="tel"') + f('email', 'Email') + f('alamat', 'Alamat', '', 'span2') +
      ta('rekening', 'Rekening pembayaran', 3, 'span2', 'Tampil di invoice & nota DP. Boleh lebih dari satu baris.') +
      ta('catatanNota', 'Catatan kaki nota', 3, 'span2') +
      f('penandatangan', 'Nama penandatangan') + f('prefixNota', 'Awalan nomor nota', 'placeholder="INV"') +
      '<label class="f">Ukuran kertas<select data-s="kertas"><option' + (S.kertas !== 'A5' ? ' selected' : '') + '>A4</option><option' + (S.kertas === 'A5' ? ' selected' : '') + '>A5</option></select></label>' +
      '</div></section>' +

      '<details class="card more"><summary>Pengaturan lanjutan <small class="muted">— DP default, daftar ukuran, harga tambahan ukuran, kategori</small></summary><div class="fgrid">' +
      f('dpPersen', 'DP default (%)', 'type="number" min="0" max="100"') +
      '<label class="f">Pembulatan DP<select data-s="bulatDp">' + [['0', 'Tidak dibulatkan'], ['1000', 'Ke ribuan'], ['10000', 'Ke 10 ribu'], ['50000', 'Ke 50 ribu'], ['100000', 'Ke 100 ribu']].map(x => '<option value="' + x[0] + '"' + (String(S.bulatDp) === x[0] ? ' selected' : '') + '>' + x[1] + '</option>').join('') + '</select></label>' +
      f('ukuran', 'Daftar ukuran (urut)', 'placeholder="S,M,L,XL"', 'span2') +
      ta('tambahanUkuran', 'Tambahan harga ukuran besar (bawaan)', 4, '', 'Format: UKURAN=nominal, satu per baris. cth. XXL=5000. Isi 0 jika tidak ada tambahan. Bisa diubah lagi di setiap pesanan.') +
      ta('kategoriProduk', 'Kategori produk', 2, '', 'Pisahkan dengan koma.') +
      ta('kategoriBerukuran', 'Kategori yang memakai ukuran', 2, '', 'Otomatis mencentang "Pakai ukuran".') +
      ta('kategoriPengeluaran', 'Kategori pengeluaran / modal', 3, 'span2') +
      f('metodeBayar', 'Metode pembayaran', 'placeholder="Tunai,Transfer,QRIS"', 'span2') +
      '</div></details>' +
      '<div class="savebar"><span class="sp"></span><button type="submit" class="btn primary">Simpan pengaturan</button></div>' +
      '</form>' +

      '<section class="card"><h2>Data & cadangan</h2><div class="row-btn wrap">' +
      '<button class="btn" data-act="export">Unduh cadangan (JSON)</button>' +
      '<label class="btn">Pulihkan dari cadangan<input type="file" accept=".json,application/json" id="impFile" hidden></label>' +
      '<button class="btn" data-act="csv">Unduh pesanan (CSV/Excel)</button>' +
      (Store.data.orders.length === 0 ? '<button class="btn" data-act="demo">Muat data contoh</button>' : '') +
      '<button class="btn ghost danger" data-act="clear">Hapus data di perangkat ini</button></div>' +
      '<p class="hint">Data utama tersimpan di Google Spreadsheet. "Hapus data di perangkat ini" hanya membersihkan cache lokal; data akan dimuat ulang dari Spreadsheet.</p></section>' +
      '<p class="muted small center">Catatan Penjualan v1.0</p>';

    const sf = U.$('#sf', el);
    sf.addEventListener('input', () => { App.dirty = true; });
    App.editing = true;

    sf.addEventListener('submit', ev => {
      ev.preventDefault();
      const s = Object.assign({}, Store.data.settings || {});
      U.$$('[data-s]', sf).forEach(i => { s[i.dataset.s] = i.value.trim(); });
      s.logo = logo;
      Store.op('saveSettings', { settings: s });
      App.dirty = false;
      U.toast('Pengaturan tersimpan', 'ok');
      App.editing = false;
      App.render(true);
    });

    U.$('#logoFile', el).addEventListener('change', ev => {
      const file = ev.target.files[0]; if (!file) return;
      const img = new Image();
      img.onload = () => {
        let out = '';
        for (const size of [220, 180, 140, 100]) {
          const cv = document.createElement('canvas');
          const r = Math.min(1, size / Math.max(img.width, img.height));
          cv.width = Math.round(img.width * r); cv.height = Math.round(img.height * r);
          cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
          out = cv.toDataURL('image/png');
          if (out.length > 45000) out = cv.toDataURL('image/webp', 0.85);
          if (out.length <= 45000) break;
        }
        if (out.length > 45000) return U.toast('Gambar terlalu besar, gunakan logo yang lebih sederhana', 'err');
        logo = out;
        U.$('.logo-box', el).innerHTML = '<img id="logoImg" src="' + logo + '">';
        App.dirty = true;
        U.toast('Logo siap, klik Simpan pengaturan', 'info');
      };
      img.src = URL.createObjectURL(file);
    });

    U.$('#impFile', el).addEventListener('change', ev => {
      const file = ev.target.files[0]; if (!file) return;
      file.text().then(t => {
        let js;
        try { js = JSON.parse(t); } catch (err) { return U.toast('File tidak valid', 'err'); }
        const data = js.data || js;
        if (!data.orders) return U.toast('File bukan cadangan Catatan Penjualan', 'err');
        U.confirm('Ganti data di perangkat ini dengan isi cadangan (' + data.orders.length + ' pesanan)?' + (Store.conf.url ? ' Data juga akan diunggah ke Spreadsheet.' : ''), 'Pulihkan', () => {
          Store.replaceAll(data);
          if (Store.conf.url) Store.uploadAll();
          U.toast('Data dipulihkan', 'ok');
        });
      });
    });

    el.addEventListener('click', async ev => {
      const b = ev.target.closest('[data-act]');
      if (!b) return;
      const act = b.dataset.act;
      if (act === 'noLogo') { logo = ''; U.$('.logo-box', el).innerHTML = '<span class="muted">Belum ada</span>'; App.dirty = true; }
      else if (act === 'connect') {
        const url = U.$('#cUrl', el).value.trim(), pin = U.$('#cPin', el).value.trim();
        if (!/^https:\/\/script\.google(usercontent)?\.com\/.+/.test(url)) return U.toast('URL harus dari script.google.com dan berakhiran /exec', 'err');
        b.disabled = true; b.textContent = 'Menghubungkan…';
        try {
          const res = await Store.testConnection(url, pin);
          const prev = Store.conf.url;
          Store.setConf({ url: url, pin: pin });
          const remote = (await Store.request({ ops: [], pull: true })).data;
          const remoteEmpty = !remote.orders.length && !Object.keys(remote.settings || {}).length;
          const localHas = Store.data.orders.length || Object.keys(Store.data.settings || {}).length;
          if (remoteEmpty && localHas && prev !== url) {
            App.editing = false;
            U.confirm('Terhubung! Spreadsheet masih kosong. Unggah data yang sudah ada di perangkat ini (' + Store.data.orders.length + ' pesanan) ke Spreadsheet?', 'Unggah', () => {
              Store.uploadAll().then(() => U.toast('Data terunggah ke Spreadsheet', 'ok'));
            });
          } else {
            await Store.sync();
            U.toast('Terhubung ke Spreadsheet', 'ok');
          }
          App.editing = false;
          App.render(true);
          void res;
        } catch (err) {
          U.toast('Gagal terhubung: ' + (err.message || err), 'err');
          b.disabled = false; b.textContent = 'Simpan & hubungkan';
        }
      }
      else if (act === 'syncNow') { await Store.sync(); U.toast(Store.state === 'tersimpan' ? 'Sinkron selesai' : (Store.error || 'Belum selesai'), Store.state === 'tersimpan' ? 'ok' : 'err'); App.editing = false; App.render(true); }
      else if (act === 'upload') U.confirm('Kirim ulang seluruh data di perangkat ini ke Spreadsheet? (data yang sama akan ditimpa, tidak dobel)', 'Kirim', () => Store.uploadAll().then(() => U.toast('Selesai', 'ok')));
      else if (act === 'disconnect') U.confirm('Putuskan koneksi Spreadsheet? Data tetap ada di perangkat ini.', 'Putuskan', () => { Store.setConf({ url: '', pin: '' }); App.editing = false; App.render(true); });
      else if (act === 'export') {
        U.download('cadangan-penjualan-' + U.today() + '.json', JSON.stringify({ app: 'catatan-penjualan', exported: U.nowIso(), data: Store.data }, null, 1));
      }
      else if (act === 'csv') exportCsv();
      else if (act === 'demo') { loadDemo(); App.editing = false; App.go('#/'); }
      else if (act === 'clear') U.confirm(Store.queue.length ? 'PERHATIAN: masih ada ' + Store.queue.length + ' perubahan yang belum terkirim dan akan hilang. Tetap hapus?' : 'Hapus cache data di perangkat ini?', 'Hapus', () => {
        Store.clearLocal(); if (Store.conf.url) Store.sync(); U.toast('Cache dihapus', 'ok');
      });
    });
  };

  function exportCsv() {
    const rows = [['No Nota', 'Tanggal', 'Pelanggan', 'HP', 'Kategori', 'Produk', 'Qty', 'Total', 'DP Wajib', 'Dibayar', 'Sisa', 'Modal', 'Laba', 'Status Bayar', 'Status']];
    Store.data.orders.slice().sort((a, b) => String(a.tanggal).localeCompare(String(b.tanggal))).forEach(o => {
      const c = M.calc(o);
      rows.push([o.noNota, o.tanggal, o.pelanggan, o.hp, o.kategori, o.produk, c.qty, c.total, c.dpWajib, c.paid, c.sisa, c.modal, c.laba, c.payStatus, o.status]);
    });
    const csv = rows.map(r => r.map(v => { const s = String(v == null ? '' : v); return /[";\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; }).join(';')).join('\r\n');
    U.download('pesanan-' + U.today() + '.csv', '﻿' + csv, 'text/csv');
  }

  function loadDemo() {
    const t = U.today();
    const addDays = n => { const d = new Date(t + 'T00:00:00'); d.setDate(d.getDate() + n); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 10); };
    const mk = (o, items, exps, pays) => {
      o = Object.assign({ id: U.uid(), status: 'Proses', diskon: 0, ongkir: 0, dpPersen: 50, dpNominal: 0, alamat: '', catatan: '', dibuat: U.nowIso(), diubah: U.nowIso() }, o);
      o.noNota = M.nextNota(o.tanggal);
      items = items.map((i, n) => Object.assign({ id: U.uid(), orderId: o.id, urut: n + 1, nama: '', nomor: '', ket: '', qty: 1 }, i, { harga: i.harga || M.hargaUkuran(o.hargaDasar, i.ukuran) }));
      o.dpNominal = Math.round(M.totals(Object.assign({}, o, { dpNominal: 0 }), items).dpWajib);
      Store.op('saveOrder', { order: o, items: items, expenses: exps.map(x => Object.assign({ id: U.uid(), orderId: o.id, tanggal: o.tanggal, dibuat: U.nowIso() }, x)) });
      pays.forEach(p => Store.op('savePayment', { payment: Object.assign({ id: U.uid(), orderId: o.id, tanggal: o.tanggal, metode: 'Transfer', catatan: '', dibuat: U.nowIso() }, p) }));
    };
    const tim = [['Abdullah', '1', 'M'], ['Hamzah', '4', 'L'], ['Bilal', '5', 'L'], ['Khalid', '7', 'XL'], ['Umar', '8', 'M'], ['Ali', '10', 'S'], ['Utsman', '11', 'L'], ['Zaid', '14', 'XXL'], ['Saad', '17', 'M'], ['Salman', '19', 'XL'], ['Mush\'ab', '22', 'L'], ['Anas', '99', 'XXXL']];
    mk({ tanggal: addDays(-6), deadline: addDays(4), pelanggan: 'Tim Futsal Al-Fatih', hp: '081234567890', kategori: 'Jersey', produk: 'Kerah V Neck Standar + Kain Milano', pakaiUkuran: 'Y', pakaiNomor: 'Y', hargaDasar: 135000 },
      tim.map((r, n) => n < 9 ? { nama: r[0], nomor: r[1], ukuran: r[2], ket: 'Lengan Pendek' } : { nama: r[0], nomor: r[1], ukuran: r[2], ket: 'Lengan Panjang', harga: M.hargaUkuran(155000, r[2]) }),
      [{ kategori: 'Produksi', keterangan: 'Printing + jahit 12 pcs × Rp 70.000', nominal: 840000 }, { kategori: 'Ongkir', keterangan: 'Kirim dari vendor', nominal: 35000 }],
      [{ jenis: 'DP', nominal: 850000 }]);
    mk({ tanggal: addDays(-15), deadline: addDays(-3), status: 'Diambil', pelanggan: 'Panitia Milad Pondok', hp: '085298765432', kategori: 'Kaos', produk: 'Kaos Panitia Milad (sablon)', pakaiUkuran: 'Y', pakaiNomor: '', hargaDasar: 65000, diskon: 50000 },
      [{ ukuran: 'S', qty: 8 }, { ukuran: 'M', qty: 20 }, { ukuran: 'L', qty: 18 }, { ukuran: 'XL', qty: 10 }, { ukuran: 'XXL', qty: 4 }],
      [{ kategori: 'Bahan Kain', keterangan: 'Cotton combed 30s', nominal: 1500000 }, { kategori: 'Sablon/Printing', keterangan: 'Sablon 2 warna 60 pcs', nominal: 900000 }],
      [{ jenis: 'DP', nominal: 2000000 }, { jenis: 'Pelunasan', nominal: 1890000, tanggal: addDays(-3) }]);
    mk({ tanggal: addDays(-1), deadline: addDays(10), status: 'Baru', pelanggan: 'Ustadz Hasan', hp: '082111222333', kategori: 'Lainnya', produk: 'Mug custom wisuda', pakaiUkuran: '', pakaiNomor: '', hargaDasar: 25000 },
      [{ ukuran: 'Mug putih', qty: 20 }, { ukuran: 'Mug warna', qty: 10, harga: 30000 }], [], []);
    Store.op('saveExpense', { expense: { id: U.uid(), tanggal: addDays(-2), orderId: '', kategori: 'Listrik/Internet', keterangan: 'Bayar internet bulanan', nominal: 350000, dibuat: U.nowIso() } });
    U.toast('Data contoh dimuat', 'ok');
  }
})();
