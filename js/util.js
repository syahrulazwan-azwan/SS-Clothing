/* Fungsi bantu umum */
(function () {
  'use strict';
  const U = {};
  U.$ = (s, r) => (r || document).querySelector(s);
  U.$$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  U.esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  U.num = v => {
    if (typeof v === 'number') return isFinite(v) ? v : 0;
    const s = String(v == null ? '' : v).trim();
    if (!s) return 0;
    const neg = s.startsWith('-');
    const n = Number(s.replace(/[^\d]/g, '')) || 0;
    return neg ? -n : n;
  };
  U.fmt = n => Math.round(Number(n) || 0).toLocaleString('id-ID');
  U.rp = n => { const v = Math.round(Number(n) || 0); return (v < 0 ? '-Rp ' : 'Rp ') + Math.abs(v).toLocaleString('id-ID'); };
  U.uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  U.today = () => { const d = new Date(); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 10); };
  U.nowIso = () => new Date().toISOString();
  U.BULAN = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
  U.BULAN_P = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
  U.fdate = (s, long) => {
    if (!s) return '-';
    const p = String(s).slice(0, 10).split('-');
    if (p.length < 3) return String(s);
    return (+p[2]) + ' ' + (long ? U.BULAN_P : U.BULAN)[(+p[1]) - 1] + ' ' + p[0];
  };
  U.fmonth = ym => { if (!ym || ym === 'all') return 'Semua waktu'; const p = ym.split('-'); return U.BULAN_P[(+p[1]) - 1] + ' ' + p[0]; };
  U.list = s => String(s || '').split(/[,\n]/).map(x => x.trim()).filter(Boolean);
  U.daysLeft = s => {
    if (!s) return null;
    const a = new Date(U.today() + 'T00:00:00'), b = new Date(String(s).slice(0, 10) + 'T00:00:00');
    return Math.round((b - a) / 86400000);
  };

  U.terbilang = function (n) {
    n = Math.floor(Math.abs(Number(n) || 0));
    const h = ['', 'satu', 'dua', 'tiga', 'empat', 'lima', 'enam', 'tujuh', 'delapan', 'sembilan', 'sepuluh', 'sebelas'];
    function t(x) {
      if (x < 12) return h[x];
      if (x < 20) return t(x - 10) + ' belas';
      if (x < 100) return t(Math.floor(x / 10)) + ' puluh ' + t(x % 10);
      if (x < 200) return 'seratus ' + t(x - 100);
      if (x < 1000) return t(Math.floor(x / 100)) + ' ratus ' + t(x % 100);
      if (x < 2000) return 'seribu ' + t(x - 1000);
      if (x < 1e6) return t(Math.floor(x / 1000)) + ' ribu ' + t(x % 1000);
      if (x < 1e9) return t(Math.floor(x / 1e6)) + ' juta ' + t(x % 1e6);
      if (x < 1e12) return t(Math.floor(x / 1e9)) + ' miliar ' + t(x % 1e9);
      return t(Math.floor(x / 1e12)) + ' triliun ' + t(x % 1e12);
    }
    if (n === 0) return 'Nol rupiah';
    const s = t(n).replace(/\s+/g, ' ').trim() + ' rupiah';
    return s.charAt(0).toUpperCase() + s.slice(1);
  };

  U.toast = function (msg, kind) {
    let box = U.$('#toasts');
    const el = document.createElement('div');
    el.className = 'toast ' + (kind || '');
    el.textContent = msg;
    box.appendChild(el);
    setTimeout(() => el.classList.add('out'), 2200);
    setTimeout(() => el.remove(), 2600);
  };

  /** Format input uang saat diketik: 1500000 → 1.500.000 */
  U.bindMoney = function (root) {
    root.addEventListener('input', e => {
      const t = e.target;
      if (!t.classList || !t.classList.contains('money')) return;
      const n = U.num(t.value);
      const f = t.value.trim() === '' ? '' : (n < 0 ? '-' : '') + Math.abs(n).toLocaleString('id-ID');
      if (f !== t.value) {
        const fromEnd = t.value.length - (t.selectionStart || 0);
        t.value = f;
        const pos = Math.max(0, f.length - fromEnd);
        try { t.setSelectionRange(pos, pos); } catch (err) { }
      }
    }, true);
  };
  U.moneyVal = n => (Number(n) ? Math.round(Number(n)).toLocaleString('id-ID') : '');

  /** Dialog serbaguna. onSubmit(form) → return false untuk tetap terbuka */
  U.dialog = function (title, body, onSubmit, opts) {
    opts = opts || {};
    const dlg = U.$('#dlg');
    dlg.classList.toggle('wide', !!opts.wide);
    dlg.innerHTML = '<form method="dialog" class="dlg-form" novalidate>' +
      '<div class="dlg-head"><h3>' + U.esc(title) + '</h3><button type="button" class="icon-btn" data-close aria-label="Tutup">✕</button></div>' +
      '<div class="dlg-body">' + body + '</div>' +
      '<div class="dlg-foot">' + (opts.extra || '') + '<span class="sp"></span>' +
      '<button type="button" class="btn ghost" data-close>' + (onSubmit ? 'Batal' : 'Tutup') + '</button>' +
      (onSubmit ? '<button type="submit" class="btn primary">' + U.esc(opts.ok || 'Simpan') + '</button>' : '') +
      '</div></form>';
    const form = dlg.querySelector('form');
    U.bindMoney(form);
    form.addEventListener('click', e => { if (e.target.closest('[data-close]')) dlg.close(); });
    form.addEventListener('submit', e => {
      e.preventDefault();
      if (onSubmit && onSubmit(form) === false) return;
      dlg.close();
    });
    if (opts.onMount) opts.onMount(form);
    dlg.showModal();
    const first = form.querySelector('[autofocus]');
    if (first) setTimeout(() => first.focus(), 30);
    return form;
  };

  U.confirm = function (msg, okText, onOk) {
    U.dialog('Konfirmasi', '<p>' + U.esc(msg) + '</p>', () => { onOk(); }, { ok: okText || 'Ya' });
  };

  U.download = function (name, text, type) {
    const blob = new Blob([text], { type: type || 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  };

  window.U = U;
})();
