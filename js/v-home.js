/* Beranda (ringkasan) & Daftar Pesanan */
(function () {
  'use strict';
  const V = window.V = window.V || {};
  const e = U.esc;

  function periodSelect(id, val) {
    return '<select id="' + id + '" class="period">' +
      '<option value="all"' + (val === 'all' ? ' selected' : '') + '>Semua waktu</option>' +
      M.months().map(m => '<option value="' + m + '"' + (m === val ? ' selected' : '') + '>' + U.fmonth(m) + '</option>').join('') +
      '</select>';
  }
  V.periodSelect = periodSelect;

  function badge(st) {
    const cls = { 'Lunas': 'green', 'DP': 'amber', 'Belum Bayar': 'red', 'Baru': 'gray', 'Proses': 'blue', 'Selesai': 'teal', 'Diambil': 'green', 'Batal': 'red' }[st] || 'gray';
    return '<span class="badge ' + cls + '">' + e(st) + '</span>';
  }
  V.badge = badge;

  function orderRow(o) {
    const c = M.calc(o);
    const dl = U.daysLeft(o.deadline);
    const done = ['Selesai', 'Diambil', 'Batal'].indexOf(o.status) >= 0;
    const dlTxt = o.deadline && !done ? (dl < 0 ? '<span class="late">lewat ' + (-dl) + ' hr</span>' : dl === 0 ? '<span class="late">hari ini</span>' : dl + ' hr lagi') : '';
    return '<a class="orow" href="#/pesanan/' + e(o.id) + '">' +
      '<div class="o-main"><div class="o-top"><b>' + e(o.pelanggan) + '</b>' + badge(c.payStatus) + badge(o.status || 'Baru') + (M.unkCount(c.items) ? '<span class="badge amber">' + M.unkCount(c.items) + ' menyusul</span>' : '') + '</div>' +
      '<div class="o-sub">' + e(o.noNota) + ' · ' + U.fdate(o.tanggal) + ' · ' + e(o.produk || o.kategori) + ' · ' + c.qty + ' pcs' + (dlTxt ? ' · ' + dlTxt : '') + '</div></div>' +
      '<div class="o-amt"><b>' + U.rp(c.total) + '</b>' + (c.sisa > 0 ? '<small class="red-t">sisa ' + U.rp(c.sisa) + '</small>' : '<small class="green-t">lunas</small>') + '</div></a>';
  }
  V.orderRow = orderRow;

  V.home = function (el) {
    const p = App.ui.period;
    const inP = s => p === 'all' || String(s || '').indexOf(p) === 0;
    const d = Store.data;
    const orders = d.orders.filter(o => o.status !== 'Batal');
    const ordP = orders.filter(o => inP(o.tanggal));
    let omzet = 0, pcs = 0, modal = 0;
    const sizes = {};
    ordP.forEach(o => {
      const c = M.calc(o);
      omzet += c.total; pcs += c.qty; modal += c.modal;
      if (o.pakaiUkuran === 'Y') c.items.filter(i => i.ukuran !== M.UNK).forEach(i => { const u = (i.ukuran || '-').toUpperCase(); sizes[u] = (sizes[u] || 0) + U.num(i.qty); });
    });
    const operasional = d.expenses.filter(x => !x.orderId && inP(x.tanggal)).reduce((s, x) => s + U.num(x.nominal), 0);
    const masuk = d.payments.filter(x => inP(x.tanggal)).reduce((s, x) => s + U.num(x.nominal), 0);
    const keluar = d.expenses.filter(x => inP(x.tanggal)).reduce((s, x) => s + U.num(x.nominal), 0);
    const unpaid = orders.filter(o => M.calc(o).sisa > 0);
    const piutang = unpaid.reduce((s, o) => s + M.calc(o).sisa, 0);
    const labaKotor = omzet - modal, laba = labaKotor - operasional;
    const active = orders.filter(o => ['Selesai', 'Diambil'].indexOf(o.status) < 0)
      .sort((a, b) => String(a.deadline || '9999').localeCompare(String(b.deadline || '9999'))).slice(0, 8);
    const sz = Object.keys(sizes).sort(M.sortSizes);
    const maxSz = Math.max(1, ...sz.map(k => sizes[k]));

    const card = (lbl, val, sub, cls) => '<div class="stat ' + (cls || '') + '"><div class="s-lbl">' + lbl + '</div><div class="s-val">' + val + '</div>' + (sub ? '<div class="s-sub">' + sub + '</div>' : '') + '</div>';

    el.innerHTML =
      '<div class="page-head"><h1>Ringkasan</h1>' + periodSelect('per', p) + '</div>' +
      (d.orders.length === 0 ? '<div class="empty-hero"><h2>Selamat datang 👋</h2><p>Mulai dengan mencatat pesanan pertama Anda, atau isi identitas usaha di Pengaturan.</p>' +
        '<div class="row-btn"><a class="btn primary" href="#/pesanan/baru">+ Pesanan baru</a><a class="btn" href="#/pengaturan">Pengaturan</a></div></div>' : '') +
      '<div class="stats">' +
      card('Pendapatan (omzet)', U.rp(omzet), ordP.length + ' pesanan · ' + pcs + ' pcs', 'main') +
      card('Laba bersih', U.rp(laba), 'Laba kotor ' + U.rp(labaKotor), laba >= 0 ? 'pos' : 'neg') +
      card('Modal pesanan', U.rp(modal), 'Biaya produksi pesanan') +
      card('Pengeluaran operasional', U.rp(operasional), 'Di luar modal pesanan') +
      card('Uang masuk', U.rp(masuk), 'DP + pelunasan diterima') +
      card('Uang keluar', U.rp(keluar), 'Modal + operasional') +
      card('Belum dibayar pelanggan', U.rp(piutang), unpaid.length + ' pesanan (semua waktu)', piutang > 0 ? 'warn' : '') +
      '</div>' +
      '<div class="grid2">' +
      '<section class="card"><div class="card-head"><h2>Pesanan berjalan</h2><a href="#/pesanan">Semua →</a></div>' +
      (active.length ? '<div class="olist">' + active.map(orderRow).join('') + '</div>' : '<p class="muted pad">Tidak ada pesanan yang sedang berjalan.</p>') + '</section>' +
      '<section class="card"><div class="card-head"><h2>Belum lunas</h2></div>' +
      (unpaid.length ? '<div class="olist">' + unpaid.sort((a, b) => M.calc(b).sisa - M.calc(a).sisa).slice(0, 8).map(orderRow).join('') + '</div>' : '<p class="muted pad">Semua pesanan sudah lunas. Alhamdulillah.</p>') +
      '</section>' +
      '<section class="card"><div class="card-head"><h2>Ukuran terjual</h2><span class="muted">' + U.fmonth(p) + '</span></div>' +
      (sz.length ? '<div class="bars">' + sz.map(k => '<div class="bar"><span>' + e(k) + '</span><div><i style="width:' + (sizes[k] / maxSz * 100).toFixed(1) + '%"></i></div><b>' + sizes[k] + '</b></div>').join('') + '</div>' : '<p class="muted pad">Belum ada data ukuran.</p>') +
      '</section></div>';

    U.$('#per', el).addEventListener('change', ev => { App.ui.period = ev.target.value; App.render(true); });
  };

  V.orders = function (el) {
    const ui = App.ui;
    const filters = [['semua', 'Semua'], ['belum', 'Belum Bayar'], ['dp', 'DP'], ['lunas', 'Lunas'], ['berjalan', 'Berjalan'], ['selesai', 'Selesai'], ['batal', 'Batal']];
    el.innerHTML =
      '<div class="page-head"><h1>Pesanan</h1><a class="btn primary" href="#/pesanan/baru">+ Pesanan baru</a></div>' +
      '<div class="toolbar"><input id="q" type="search" placeholder="Cari nama, no. nota, produk, HP…" value="' + e(ui.q) + '">' + periodSelect('lp', ui.listPeriod) + '</div>' +
      '<div class="chips">' + filters.map(f => '<button class="chip' + (ui.filter === f[0] ? ' on' : '') + '" data-f="' + f[0] + '">' + f[1] + '</button>').join('') + '</div>' +
      '<div id="list"></div>';

    const draw = () => {
      const q = ui.q.trim().toLowerCase();
      let arr = Store.data.orders.slice();
      if (ui.listPeriod !== 'all') arr = arr.filter(o => String(o.tanggal || '').indexOf(ui.listPeriod) === 0);
      if (q) arr = arr.filter(o => [o.pelanggan, o.noNota, o.produk, o.hp, o.kategori].join(' ').toLowerCase().indexOf(q) >= 0);
      arr = arr.filter(o => {
        const c = M.calc(o), st = o.status || 'Baru';
        switch (ui.filter) {
          case 'belum': return st !== 'Batal' && c.payStatus === 'Belum Bayar';
          case 'dp': return st !== 'Batal' && c.payStatus === 'DP';
          case 'lunas': return c.payStatus === 'Lunas';
          case 'berjalan': return st === 'Baru' || st === 'Proses';
          case 'selesai': return st === 'Selesai' || st === 'Diambil';
          case 'batal': return st === 'Batal';
          default: return true;
        }
      });
      arr.sort((a, b) => String(b.tanggal).localeCompare(String(a.tanggal)) || String(b.dibuat).localeCompare(String(a.dibuat)));
      let tot = 0, sisa = 0, qty = 0;
      arr.forEach(o => { const c = M.calc(o); if (o.status !== 'Batal') { tot += c.total; sisa += Math.max(0, c.sisa); qty += c.qty; } });
      const shown = arr.slice(0, 300);
      U.$('#list', el).innerHTML = arr.length
        ? '<div class="list-sum">' + arr.length + ' pesanan · ' + qty + ' pcs · Total ' + U.rp(tot) + ' · Sisa ' + U.rp(sisa) + '</div><div class="olist card">' + shown.map(orderRow).join('') + '</div>' +
        (arr.length > shown.length ? '<p class="muted pad">Menampilkan 300 terbaru. Gunakan pencarian untuk yang lain.</p>' : '')
        : '<div class="empty">Belum ada pesanan' + (q || ui.filter !== 'semua' ? ' yang cocok' : '') + '.</div>';
    };
    draw();
    let t;
    U.$('#q', el).addEventListener('input', ev => { ui.q = ev.target.value; clearTimeout(t); t = setTimeout(draw, 80); });
    U.$('#lp', el).addEventListener('change', ev => { ui.listPeriod = ev.target.value; draw(); });
    U.$('.chips', el).addEventListener('click', ev => {
      const b = ev.target.closest('.chip'); if (!b) return;
      ui.filter = b.dataset.f;
      U.$$('.chip', el).forEach(c => c.classList.toggle('on', c === b));
      draw();
    });
  };
})();
