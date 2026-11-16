/* Router & kerangka aplikasi */
(function () {
  'use strict';
  const V = window.V;
  const App = window.App = {
    ui: { period: U.today().slice(0, 7), q: '', filter: 'semua', listPeriod: 'all', finPeriod: U.today().slice(0, 7), finTab: 'keluar', finType: 'semua' },
    editing: false,
    dirty: false,
    route: '',
    _skipHash: false
  };

  const routes = [
    [/^\/?$/, () => V.home],
    [/^\/pesanan$/, () => V.orders],
    [/^\/pesanan\/baru$/, () => V.orderForm],
    [/^\/pesanan\/([\w-]+)\/edit$/, () => V.orderForm],
    [/^\/pesanan\/([\w-]+)$/, () => V.orderDetail],
    [/^\/keuangan$/, () => V.finance],
    [/^\/pengaturan$/, () => V.settings]
  ];

  App.go = function (hash) {
    if (location.hash === hash) App.render(); else location.hash = hash;
  };

  App.render = function (keepScroll) {
    const path = (location.hash || '#/').slice(1);
    const old = U.$('#main');
    const main = old.cloneNode(false);
    old.replaceWith(main);
    let view = null, m = null;
    for (const r of routes) { m = path.match(r[0]); if (m) { view = r[1](); break; } }
    if (!view) { location.hash = '#/'; return; }
    const y = window.scrollY;
    App.editing = false;
    App.dirty = false;
    App.route = path;
    view(main, m ? m.slice(1) : []);
    U.$$('.nav a').forEach(a => {
      const t = a.getAttribute('href').slice(1);
      a.classList.toggle('on', t === '/' ? path === '/' || path === '' : path.indexOf(t) === 0);
    });
    if (keepScroll) window.scrollTo(0, y); else window.scrollTo(0, 0);
    const S = M.S();
    U.$('#brand-name').textContent = S.namaUsaha;
    const logo = U.$('#brand-logo');
    if (S.logo) { logo.src = S.logo; logo.hidden = false; } else logo.hidden = true;
  };

  let lastHash = location.hash;
  window.addEventListener('hashchange', () => {
    if (App._skipHash) { App._skipHash = false; lastHash = location.hash; return; }
    if (App.editing && App.dirty && !window.confirm('Perubahan belum disimpan. Tinggalkan halaman ini?')) {
      App._skipHash = true;
      location.hash = lastHash;
      return;
    }
    lastHash = location.hash;
    App.render();
  });
  window.addEventListener('beforeunload', e => {
    if ((App.editing && App.dirty) || Store.queue.length) { e.preventDefault(); e.returnValue = ''; }
  });

  function renderStatus() {
    const el = U.$('#sync');
    const map = {
      lokal: ['Mode lokal', 'gray', 'Data hanya di perangkat ini. Hubungkan Spreadsheet di Pengaturan.'],
      sinkron: ['Menyimpan…', 'blue', 'Mengirim ke Spreadsheet'],
      tersimpan: ['Tersimpan', 'green', 'Semua data sudah di Spreadsheet'],
      antre: [Store.queue.length + ' menunggu', 'amber', Store.error || 'Akan dikirim otomatis'],
      gagal: ['Gagal kirim', 'red', Store.error]
    };
    const s = map[Store.state] || map.lokal;
    el.className = 'sync ' + s[1];
    el.querySelector('span').textContent = s[0];
    el.title = s[2] + (Store.lastSync ? '\nSinkron terakhir: ' + new Date(Store.lastSync).toLocaleString('id-ID') : '');
  }

  Store.on(kind => {
    if (kind === 'status') return renderStatus();
    renderStatus();
    if (!App.editing) App.render(true);
    else if (kind === 'remote') U.toast('Data baru dari Spreadsheet tersedia — simpan dulu formulir ini.', 'info');
  });

  document.addEventListener('DOMContentLoaded', () => {
    U.bindMoney(document.body);
    U.$('#sync').addEventListener('click', () => {
      if (!Store.conf.url) { App.go('#/pengaturan'); return; }
      Store.sync().then(() => { if (Store.state === 'tersimpan') U.toast('Data terbaru sudah dimuat', 'ok'); else if (Store.error) U.toast(Store.error, 'err'); });
    });
    Store.init();
    renderStatus();
    App.render();
    if ('serviceWorker' in navigator && location.protocol === 'https:') {
      navigator.serviceWorker.register('sw.js').catch(() => { });
    }
  });

  window.addEventListener('afterprint', () => { U.$('#print-root').innerHTML = ''; });
})();
