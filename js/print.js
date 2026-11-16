/* Cetak: Invoice, Nota DP, Nota Pelunasan, Rincian Pesanan */
(function () {
  'use strict';
  const e = U.esc;
  const P = {};
  P.TYPES = {
    invoice: 'INVOICE',
    dp: 'NOTA DP',
    lunas: 'NOTA PELUNASAN',
    rincian: 'RINCIAN PESANAN'
  };

  function header(o, type, S) {
    return '<div class="p-head">' +
      '<div class="p-brand">' +
      (S.logo ? '<img src="' + e(S.logo) + '" alt="">' : '') +
      '<div><div class="p-name">' + e(S.namaUsaha) + '</div>' +
      (S.tagline ? '<div class="p-tag">' + e(S.tagline) + '</div>' : '') +
      '<div class="p-addr">' + e([S.alamat, S.hp && ('WA ' + S.hp), S.email].filter(Boolean).join(' · ')) + '</div></div>' +
      '</div>' +
      '<div class="p-title"><div class="p-doc">' + P.TYPES[type] + '</div>' +
      '<table class="p-meta"><tr><td>No.</td><td><b>' + e(o.noNota) + '</b></td></tr>' +
      '<tr><td>Tanggal</td><td>' + U.fdate(type === 'lunas' ? lastPayDate(o) : o.tanggal, true) + '</td></tr>' +
      (o.deadline ? '<tr><td>Selesai</td><td>' + U.fdate(o.deadline, true) + '</td></tr>' : '') +
      '</table></div></div>' +
      '<div class="p-to"><div><div class="p-lbl">Kepada</div><b>' + e(o.pelanggan) + '</b>' +
      (o.hp ? '<div>' + e(o.hp) + '</div>' : '') + (o.alamat ? '<div>' + e(o.alamat) + '</div>' : '') + '</div>' +
      '<div><div class="p-lbl">Pesanan</div><b>' + e(o.kategori || '-') + '</b><div>' + e(o.produk || '') + '</div></div></div>';
  }

  function lastPayDate(o) {
    const c = M.calc(o);
    return c.pays.length ? c.pays[c.pays.length - 1].tanggal : o.tanggal;
  }

  function itemTable(o, c) {
    const rows = M.group(c.items);
    const pakaiUk = o.pakaiUkuran === 'Y';
    return '<table class="p-table"><thead><tr><th class="c">No</th><th>Deskripsi</th><th class="c">Qty</th><th class="r">Harga Satuan</th><th class="r">Jumlah</th></tr></thead><tbody>' +
      rows.map((g, i) => '<tr><td class="c">' + (i + 1) + '</td><td>' + e(g.ket || (pakaiUk ? (o.kategori || 'Item') : '')) +
        (g.ukuran !== '-' ? (g.ket || pakaiUk ? ' — ' : '') + '<b>' + (pakaiUk ? 'Ukuran ' : '') + e(g.ukuran) + '</b>' : '') + '</td>' +
        '<td class="c">' + g.qty + '</td><td class="r">' + (g.harga ? U.rp(g.harga) : 'Rp 0 <small>(gratis)</small>') + '</td><td class="r">' + U.rp(g.jumlah) + '</td></tr>').join('') +
      '</tbody><tfoot><tr><td></td><td><b>Jumlah</b></td><td class="c"><b>' + c.qty + '</b></td><td></td><td class="r"><b>' + U.rp(c.subtotal) + '</b></td></tr></tfoot></table>';
  }

  function sumRows(list) {
    return '<table class="p-sum">' + list.filter(Boolean).map(r =>
      '<tr class="' + (r[2] || '') + '"><td>' + r[0] + '</td><td class="r">' + r[1] + '</td></tr>').join('') + '</table>';
  }

  function baseTotals(c) {
    return [
      ['Subtotal', U.rp(c.subtotal)],
      c.diskon ? ['Diskon', '-' + U.rp(c.diskon)] : null,
      c.ongkir ? ['Ongkos kirim', U.rp(c.ongkir)] : null,
      ['Total', U.rp(c.total), 'big']
    ];
  }

  function payHistory(pays) {
    if (!pays.length) return '';
    return '<div class="p-sub">Riwayat Pembayaran</div><table class="p-table small"><thead><tr><th>Tanggal</th><th>Jenis</th><th>Metode</th><th class="r">Nominal</th></tr></thead><tbody>' +
      pays.map(p => '<tr><td>' + U.fdate(p.tanggal) + '</td><td>' + e(p.jenis) + '</td><td>' + e(p.metode || '-') + '</td><td class="r">' + U.rp(p.nominal) + '</td></tr>').join('') +
      '</tbody></table>';
  }

  function footer(o, S, opts) {
    return '<div class="p-foot">' +
      '<div class="p-notes">' +
      (opts.bank && S.rekening ? '<div class="p-lbl">Pembayaran ke</div><div class="p-bank">' + e(S.rekening).replace(/\n/g, '<br>') + '</div>' : '') +
      (S.catatanNota ? '<div class="p-note">' + e(S.catatanNota).replace(/\n/g, '<br>') + '</div>' : '') +
      '</div>' +
      '<div class="p-signs">' +
      '<div class="p-sign"><div>Penerima,</div><div class="p-line"></div><div>' + e(o.pelanggan) + '</div></div>' +
      '<div class="p-sign"><div>Hormat kami,</div><div class="p-line"></div><div>' + e(S.penandatangan || S.namaUsaha) + '</div></div>' +
      '</div></div>';
  }

  function rincianTable(o, c) {
    const pakaiNo = o.pakaiNomor === 'Y';
    const cols = pakaiNo ? 5 : 4;
    return '<table class="p-table"><thead><tr><th class="c">No</th><th>Nama</th>' + (pakaiNo ? '<th class="c">No. Punggung</th>' : '') +
      '<th class="c">' + (o.pakaiUkuran === 'Y' ? 'Ukuran' : 'Varian') + '</th><th class="c">Qty</th></tr></thead><tbody>' +
      M.byGroup(c.items).map(gr => (gr.nama ? '<tr class="p-grp"><td colspan="' + cols + '">' + e(gr.nama) + ' (' + gr.items.reduce((s, i) => s + U.num(i.qty), 0) + ' pcs)</td></tr>' : '') +
        gr.items.map((i, n) => '<tr><td class="c">' + (n + 1) + '</td><td>' + e(i.nama || '-') + '</td>' +
          (pakaiNo ? '<td class="c"><b>' + e(i.nomor || '-') + '</b></td>' : '') +
          '<td class="c">' + e(i.ukuran || '-') + '</td><td class="c">' + U.num(i.qty) + '</td></tr>').join('')).join('') +
      '</tbody></table>' +
      '<div class="p-sizes">' + M.sizeCount(c.items).map(s => '<span><b>' + e(s.ukuran) + '</b> ' + s.qty + '</span>').join('') +
      '<span class="tot"><b>Total</b> ' + c.qty + ' pcs</span></div>';
  }

  P.build = function (o, type, opts) {
    opts = opts || {};
    const S = M.S(), c = M.calc(o);
    let body = header(o, type, S);

    if (type === 'rincian') {
      body += rincianTable(o, c);
      if (o.catatan) body += '<div class="p-note">Catatan: ' + e(o.catatan) + '</div>';
      return '<div class="p-page">' + body + '</div>';
    }

    body += itemTable(o, c);
    let sums = baseTotals(c), stamp = '', words = '';
    if (type === 'invoice') {
      sums = sums.concat([
        c.paid ? ['Sudah dibayar', U.rp(c.paid)] : ['DP yang harus dibayar (' + (c.dpPersen || 0) + '%)', U.rp(c.dpWajib), 'hl'],
        ['Sisa tagihan', U.rp(Math.max(0, c.sisa)), 'big']
      ]);
      words = c.total;
      if (c.sisa <= 0 && c.total > 0) stamp = 'LUNAS';
    } else if (type === 'dp') {
      sums = sums.concat([
        ['DP yang harus dibayar (' + (c.dpPersen || 0) + '%)', U.rp(c.dpWajib)],
        ['DP diterima', U.rp(c.dpPaid || c.paid), 'hl'],
        ['Sisa pelunasan', U.rp(Math.max(0, c.total - (c.dpPaid || c.paid))), 'big']
      ]);
      words = c.dpPaid || c.paid;
      stamp = (c.dpPaid || c.paid) > 0 ? 'DP' : '';
    } else if (type === 'lunas') {
      sums = sums.concat([
        ['Total dibayar', U.rp(c.paid), 'hl'],
        ['Sisa', U.rp(Math.max(0, c.sisa)), 'big']
      ]);
      words = c.paid;
      stamp = c.sisa <= 0 && c.total > 0 ? 'LUNAS' : '';
    }
    body += '<div class="p-totals"><div class="p-left">' +
      (type === 'lunas' ? payHistory(c.pays) : type === 'dp' ? payHistory(c.pays.filter(p => p.jenis === 'DP')) : '') +
      (words ? '<div class="p-words"><span class="p-lbl">Terbilang' + (type === 'dp' ? ' (DP diterima)' : type === 'lunas' ? ' (total dibayar)' : '') + '</span><i>' + U.terbilang(words) + '</i></div>' : '') +
      (stamp ? '<div class="p-stamp ' + (stamp === 'LUNAS' ? 'ok' : '') + '">' + stamp + '</div>' : '') +
      '</div><div class="p-right">' + sumRows(sums) + '</div></div>';
    if (o.catatan) body += '<div class="p-note">Catatan: ' + e(o.catatan) + '</div>';
    body += footer(o, S, { bank: type !== 'lunas' && c.sisa > 0 });

    let html = '<div class="p-page">' + body + '</div>';
    if (opts.rincian && c.items.some(i => i.nama || i.nomor)) {
      html += '<div class="p-page p-break">' + header(o, 'rincian', S) + rincianTable(o, c) + '</div>';
    }
    return html;
  };

  P.print = function (o, type, opts) {
    const S = M.S();
    const root = U.$('#print-root');
    root.innerHTML = P.build(o, type, opts);
    let st = U.$('#page-style');
    if (!st) { st = document.createElement('style'); st.id = 'page-style'; document.head.appendChild(st); }
    st.textContent = '@page{size:' + (S.kertas === 'A5' ? 'A5' : 'A4') + ' portrait;margin:12mm}';
    document.body.classList.toggle('paper-a5', S.kertas === 'A5');
    const old = document.title;
    document.title = P.TYPES[type].replace(/\s+/g, '_') + '_' + o.noNota + '_' + String(o.pelanggan || '').replace(/[^\w]+/g, '_');
    const imgs = U.$$('img', root).filter(i => !i.complete);
    const go = () => {
      setTimeout(() => {
        window.print();
        document.title = old;
      }, 60);
    };
    if (imgs.length) Promise.all(imgs.map(i => new Promise(r => { i.onload = i.onerror = r; }))).then(go); else go();
  };

  window.Print = P;
})();
