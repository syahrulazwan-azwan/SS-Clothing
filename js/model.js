/* Perhitungan pesanan: total, DP, sisa, modal, laba, rekap per ukuran */
(function () {
  'use strict';
  const M = {};
  M.STATUS = ['Baru', 'Proses', 'Selesai', 'Diambil', 'Batal'];
  M.JENIS_BAYAR = ['DP', 'Pelunasan', 'Cicilan'];

  M.S = () => Store.settings;
  M.sizes = () => U.list(M.S().ukuran);
  M.tambahan = () => {
    const m = {};
    String(M.S().tambahanUkuran || '').split(/[\n,]/).forEach(l => {
      const p = l.split('=');
      if (p.length === 2 && p[0].trim()) m[p[0].trim().toUpperCase()] = U.num(p[1]);
    });
    return m;
  };
  M.tambahUk = ukuran => {
    const t = M.tambahan(), k = String(ukuran || '').toUpperCase();
    if (t[k] != null) return t[k];
    const n = M.xCount(k); if (n < 2) return 0;
    const alt = Object.keys(t).find(x => M.xCount(x) === n);
    return alt ? t[alt] : 0;
  };
  M.hargaUkuran = (dasar, ukuran) => (Number(dasar) || 0) + M.tambahUk(ukuran);
  M.isBerukuran = kat => U.list(M.S().kategoriBerukuran).map(s => s.toLowerCase()).indexOf(String(kat || '').toLowerCase()) >= 0;
  M.sizeRank = u => {
    const sz = M.sizes().map(s => s.toUpperCase());
    let i = sz.indexOf(String(u || '').toUpperCase());
    if (i < 0) { const n = M.xCount(u); if (n >= 0) i = sz.findIndex(s => M.xCount(s) === n); }
    return i < 0 ? 999 : i;
  };
  M.roundDp = v => { const r = Number(M.S().bulatDp) || 0; return r > 0 ? Math.round(v / r) * r : Math.round(v); };
  /** Samakan penulisan ukuran: 3XL = XXXL, 2XL = XXL */
  M.xCount = u => { u = String(u || '').toUpperCase().replace(/\s+/g, ''); let m = u.match(/^(\d)XL$/); if (m) return +m[1]; m = u.match(/^(X+)L$/); return m ? m[1].length : (u === 'L' ? 0 : -1); };
  M.normSize = u => {
    const sz = M.sizes(), up = sz.map(s => s.toUpperCase()), U2 = String(u || '').toUpperCase().replace(/\s+/g, '');
    let i = up.indexOf(U2); if (i >= 0) return sz[i];
    const n = M.xCount(U2); if (n < 1) return '';
    i = up.findIndex(s => M.xCount(s) === n); return i >= 0 ? sz[i] : '';
  };
  M.sortSizes = (a, b) => (M.sizeRank(a) - M.sizeRank(b)) || String(a).localeCompare(String(b));

  let IDX = { v: -1 };
  M.idx = function () {
    if (IDX.v === Store.version) return IDX;
    const d = Store.data;
    const by = arr => { const m = {}; arr.forEach(r => { (m[r.orderId] = m[r.orderId] || []).push(r); }); return m; };
    IDX = { v: Store.version, items: by(d.items), pays: by(d.payments), exps: by(d.expenses), calc: {}, orders: {} };
    d.orders.forEach(o => { IDX.orders[o.id] = o; });
    return IDX;
  };
  M.order = id => M.idx().orders[id];

  M.calc = function (o) {
    const I = M.idx();
    if (I.calc[o.id]) return I.calc[o.id];
    const items = (I.items[o.id] || []).slice().sort((a, b) => (a.urut || 0) - (b.urut || 0));
    const pays = (I.pays[o.id] || []).slice().sort((a, b) => String(a.tanggal).localeCompare(String(b.tanggal)) || String(a.dibuat).localeCompare(String(b.dibuat)));
    const exps = (I.exps[o.id] || []).slice().sort((a, b) => String(a.tanggal).localeCompare(String(b.tanggal)));
    const r = M.totals(o, items);
    r.items = items; r.pays = pays; r.exps = exps;
    r.paid = pays.reduce((s, p) => s + U.num(p.nominal), 0);
    r.dpPaid = pays.filter(p => p.jenis === 'DP').reduce((s, p) => s + U.num(p.nominal), 0);
    r.sisa = r.total - r.paid;
    r.modal = exps.reduce((s, x) => s + U.num(x.nominal), 0);
    r.laba = r.total - r.modal;
    r.payStatus = r.total > 0 && r.sisa <= 0 ? 'Lunas' : (r.paid > 0 ? 'DP' : 'Belum Bayar');
    I.calc[o.id] = r;
    return r;
  };

  /** Hitung total dari order + daftar item (dipakai juga di form sebelum disimpan) */
  M.totals = function (o, items) {
    const qty = items.reduce((s, i) => s + U.num(i.qty), 0);
    const subtotal = items.reduce((s, i) => s + U.num(i.qty) * U.num(i.harga), 0);
    const diskon = U.num(o.diskon), ongkir = U.num(o.ongkir);
    const total = subtotal - diskon + ongkir;
    const dpPersen = Number(o.dpPersen) || 0;
    const dpWajib = U.num(o.dpNominal) > 0 ? U.num(o.dpNominal) : M.roundDp(total * dpPersen / 100);
    return { qty, subtotal, diskon, ongkir, total, dpPersen, dpWajib };
  };

  /** Daftar kelompok (Lengan Pendek, 1 Set, dst.) sesuai urutan */
  M.byGroup = function (items) {
    const out = [], idx = {};
    items.forEach(i => {
      const k = String(i.ket || '').trim();
      if (idx[k] == null) { idx[k] = out.length; out.push({ nama: k, items: [] }); }
      out[idx[k]].items.push(i);
    });
    return out;
  };

  /** Kelompokkan item per kelompok + ukuran + harga satuan (untuk invoice) */
  M.group = function (items) {
    const order = {};
    M.byGroup(items).forEach((g, n) => { order[g.nama] = n; });
    const g = {};
    items.forEach(i => {
      const q = U.num(i.qty);
      if (!q) return;
      const ket = String(i.ket || '').trim();
      const u = String(i.ukuran || '').trim() || '-';
      const key = ket + '|' + u.toUpperCase() + '|' + U.num(i.harga);
      if (!g[key]) g[key] = { ket: ket, ukuran: u, harga: U.num(i.harga), qty: 0, jumlah: 0 };
      g[key].qty += q;
      g[key].jumlah += q * U.num(i.harga);
    });
    return Object.values(g).sort((a, b) => (order[a.ket] - order[b.ket]) || M.sortSizes(a.ukuran, b.ukuran) || a.harga - b.harga);
  };

  /** Rekap jumlah per ukuran (tanpa harga) */
  M.sizeCount = function (items) {
    const m = {};
    items.forEach(i => { const u = String(i.ukuran || '').trim() || '-'; m[u] = (m[u] || 0) + U.num(i.qty); });
    return Object.keys(m).sort(M.sortSizes).map(u => ({ ukuran: u, qty: m[u] }));
  };

  M.nextNota = function (tanggal) {
    const prefix = (M.S().prefixNota || 'INV').trim();
    const t = String(tanggal || U.today());
    const ym = t.slice(2, 4) + t.slice(5, 7);
    const head = prefix + '-' + ym + '-';
    let max = 0;
    Store.data.orders.forEach(o => {
      const n = String(o.noNota || '');
      if (n.indexOf(head) === 0) max = Math.max(max, parseInt(n.slice(head.length), 10) || 0);
    });
    return head + String(max + 1).padStart(3, '0');
  };

  M.months = function () {
    const set = {};
    set[U.today().slice(0, 7)] = 1;
    const d = Store.data;
    d.orders.forEach(o => { if (o.tanggal) set[String(o.tanggal).slice(0, 7)] = 1; });
    d.expenses.forEach(o => { if (o.tanggal) set[String(o.tanggal).slice(0, 7)] = 1; });
    d.payments.forEach(o => { if (o.tanggal) set[String(o.tanggal).slice(0, 7)] = 1; });
    return Object.keys(set).sort().reverse();
  };

  M.waLink = function (hp, text) {
    let n = String(hp || '').replace(/\D/g, '');
    if (n.startsWith('0')) n = '62' + n.slice(1);
    return 'https://wa.me/' + n + '?text=' + encodeURIComponent(text);
  };

  M.WA_KINDS = [['daftar', 'Daftar nama'], ['rincian', 'Rincian & DP'], ['dp', 'DP diterima'], ['selesai', 'Selesai / pelunasan'], ['lunas', 'Lunas']];
  M.waDefault = function (o) {
    const c = M.calc(o);
    if (c.sisa <= 0 && c.total > 0) return 'lunas';
    if (o.status === 'Selesai' || o.status === 'Diambil') return 'selesai';
    if (c.paid > 0) return 'dp';
    return c.items.some(i => i.nama || i.nomor) ? 'daftar' : 'rincian';
  };

  /** Template pesan WhatsApp */
  M.wa = function (o, kind) {
    const c = M.calc(o), S = M.S(), L = [];
    const title = String(o.pelanggan || '').toUpperCase();
    const groups = M.byGroup(c.items);
    const n = v => U.fmt(v), R = v => 'Rp. ' + U.fmt(v);
    const rek = String(S.rekening || '').split(/\r?\n/).map(x => x.trim()).filter(Boolean);
    const rekening = () => { if (!rek.length) return; L.push(''); if (rek.length === 1) L.push('Nomor Rekening: ' + rek[0]); else { L.push('Nomor Rekening:'); rek.forEach(r => L.push('- ' + r)); } };
    const ty = 'Terima kasih 🙏🏻';
    if (kind === 'daftar') {
      const kat = o.kategori && o.kategori !== 'Lainnya' && title.indexOf(o.kategori.toUpperCase()) < 0 ? o.kategori.toUpperCase() + ' ' : '';
      L.push('*DAFTAR NAMA ' + kat + title + '*');
      if (o.produk) L.push(o.produk);
      groups.forEach(g => {
        L.push('');
        if (g.nama) L.push('> *' + g.nama + '*');
        let k = 0;
        g.items.forEach(i => {
          const q = U.num(i.qty);
          if (i.nama || i.nomor) {
            k++;
            L.push(k + '. ' + [i.nama || '-', i.ukuran, i.nomor].filter(Boolean).join(' | ') + (q > 1 ? ' | ' + q + ' pcs' : ''));
          } else {
            L.push('- ' + (i.ukuran || '-') + (q > 1 ? ' : ' + q + ' pcs' : ''));
          }
        });
      });
      L.push('');
      L.push('Total: ' + c.qty + ' pcs');
      L.push('');
      L.push('Mohon dicek kembali nama, ukuran' + (o.pakaiNomor === 'Y' || c.items.some(i => i.nomor) ? ', dan nomor punggung' : '') + 'nya ya Kak. Kalau sudah sesuai, balas *OK* supaya bisa langsung kami proses 🙏🏻');
    } else if (kind === 'rincian') {
      L.push('Terima kasih sudah order di ' + S.namaUsaha + ' ✨');
      L.push('');
      L.push('Berikut rincian pesanan *' + title + '*');
      if (o.produk) L.push(o.produk);
      const rows = M.group(c.items);
      groups.forEach(g => {
        L.push('');
        if (g.nama) L.push('> *' + g.nama + '*');
        rows.filter(r => r.ket === g.nama).forEach(r => L.push('- ' + r.ukuran + ' : ' + r.qty + ' x ' + n(r.harga) + ' = ' + n(r.jumlah) + (r.harga ? '' : ' (gratis)')));
      });
      if (c.diskon || c.ongkir) {
        L.push('');
        if (c.diskon) L.push('- Diskon : -' + n(c.diskon));
        if (c.ongkir) L.push('- Ongkos kirim : ' + n(c.ongkir));
      }
      if (c.paid <= 0) {
        L.push('');
        L.push('Biar pesanan kakak bisa langsung kita proses, silahkan lakukan pembayaran DP minimal ' + (c.dpPersen || 50) + '%');
      }
      rekening();
      L.push('');
      L.push('_*Catatan*_');
      L.push('1. Total Keseluruhan: ' + R(c.total));
      if (c.paid > 0) { L.push('2. Sudah dibayar: ' + R(c.paid)); L.push('3. Sisa pembayaran: ' + R(Math.max(0, c.sisa))); }
      else L.push('2. Nominal DP: ' + R(c.dpWajib));
      L.push('');
      L.push('Kalau sudah transfer, jangan lupa kirim bukti transfernya ke sini ya Kak.');
      L.push('');
      L.push(ty);
    } else if (kind === 'dp') {
      L.push('Terima kasih Kak, DP untuk pesanan *' + title + '* sudah kami terima ✅');
      L.push('');
      L.push('_*Rincian Pembayaran*_');
      L.push('1. Total Keseluruhan: ' + R(c.total));
      L.push('2. DP diterima: ' + R(c.paid));
      L.push('3. Sisa pelunasan: ' + R(Math.max(0, c.sisa)));
      L.push('');
      L.push('Pesanan kakak (' + c.qty + ' pcs) segera kami proses' + (o.deadline ? ', estimasi selesai *' + U.fdate(o.deadline, true) + '*' : '') + '.');
      L.push('Sisa pembayaran dilunasi saat pesanan selesai ya Kak.');
      L.push('');
      L.push(ty);
    } else if (kind === 'selesai') {
      L.push('Halo Kak, pesanan *' + title + '* (' + c.qty + ' pcs) sudah selesai dan siap diambil/dikirim ✨');
      L.push('');
      L.push('_*Rincian Pembayaran*_');
      L.push('1. Total Keseluruhan: ' + R(c.total));
      L.push('2. Sudah dibayar: ' + R(c.paid));
      L.push('3. Sisa pelunasan: *' + R(Math.max(0, c.sisa)) + '*');
      if (c.sisa > 0) { rekening(); L.push(''); L.push('Kalau sudah transfer, jangan lupa kirim bukti transfernya ke sini ya Kak.'); }
      L.push('');
      L.push(ty);
    } else {
      L.push('Terima kasih Kak, pembayaran pesanan *' + title + '* sudah *LUNAS* ✅');
      L.push('');
      L.push('Total: ' + R(c.total) + ' (' + c.qty + ' pcs)');
      L.push('');
      L.push('Semoga puas dengan hasilnya, ditunggu orderan berikutnya di ' + S.namaUsaha + ' ✨');
      L.push('');
      L.push(ty);
    }
    return L.join('\n');
  };

  window.M = M;
})();
