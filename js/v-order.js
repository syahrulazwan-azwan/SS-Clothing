/* Formulir pesanan & halaman detail pesanan */
(function () {
  'use strict';
  const V = window.V = window.V || {};
  const e = U.esc;
  const opt = (arr, val) => arr.map(x => '<option' + (String(x) === String(val) ? ' selected' : '') + '>' + e(x) + '</option>').join('');

  /* ===================== FORMULIR PESANAN (sederhana + kelompok) ===================== */
  V.orderForm = function (el, params) {
    const id = params[0];
    const S = M.S();
    const isNew = !id;
    const src = id ? M.order(id) : null;
    if (id && !src) { el.innerHTML = '<div class="empty">Pesanan tidak ditemukan. <a href="#/pesanan">Kembali</a></div>'; return; }
    const copyFrom = isNew && App.ui.copyFrom ? M.order(App.ui.copyFrom) : null;
    App.ui.copyFrom = null;
    const base = src || copyFrom;
    const kats = U.list(S.kategoriProduk);
    const metode = U.list(S.metodeBayar);
    const kPeng = U.list(S.kategoriPengeluaran);
    const SIZES = M.sizes();
    const SZ = SIZES.concat(M.UNK);
    const isJersey = k => /jersey/i.test(k || '');
    const RX_MODAL = /^Modal (per pcs )?Rp ?([\d.]+)|^Modal \d+ pcs × Rp ?([\d.]+)/;

    /* ---------- Data ---------- */
    const o = base ? Object.assign({}, base) : {
      kategori: kats[0] || 'Lainnya', produk: '', hargaDasar: 0, diskon: 0, ongkir: 0,
      dpPersen: Number(S.dpPersen) || 0, dpNominal: 0, catatan: '', pelanggan: '', hp: '', alamat: '', deadline: ''
    };
    if (isNew) {
      Object.assign(o, { id: U.uid(), noNota: '', tanggal: U.today(), status: 'Baru', dibuat: '' });
      if (!base) { o.pakaiUkuran = M.isBerukuran(o.kategori) ? 'Y' : ''; o.pakaiNomor = isJersey(o.kategori) ? 'Y' : ''; }
    }
    const F = {
      order: o, item: o.pakaiUkuran !== 'Y', groups: [], rows: [],
      expenses: [], modalPcs: 0, modalPcsId: U.uid(),
      pay: 'none', payLain: 0, payMetode: metode[0] || '',
      dpEdited: false, showHarga: false,
      tamb: Object.assign({}, M.tambahan())   // tambahan harga ukuran besar, khusus pesanan ini
    };
    const tKey = u => {
      const k = String(u || '').toUpperCase();
      if (F.tamb[k] != null) return k;
      const n = M.xCount(k); if (n < 2) return null;
      return Object.keys(F.tamb).find(x => M.xCount(x) === n) || null;
    };
    const tambUk = u => { const k = tKey(u); return k ? (F.tamb[k] || 0) : 0; };
    const newGroup = (nama, harga) => ({ nama: nama || '', harga: Number(harga) || 0, mode: 'ukuran', sizeQty: {}, sizeHarga: {}, rows: [] });
    const blankRow = () => ({ nama: '', nomor: '', ukuran: '', qty: 1, harga: 0, _manual: false });
    const blankItem = () => ({ ukuran: '', qty: 1, harga: 0 });

    const oldItems = base ? M.calc(base).items : [];
    if (F.item) {
      F.rows = oldItems.map(i => ({ ukuran: i.ukuran, qty: U.num(i.qty), harga: U.num(i.harga) }));
      if (!F.rows.length) F.rows.push(blankItem());
    } else {
      // Baca ulang tambahan ukuran yang dipakai pesanan ini (bisa beda dari Pengaturan)
      const diffs = {};
      M.byGroup(oldItems).forEach(gr => {
        const c0 = {};
        gr.items.filter(i => !tKey(i.ukuran)).forEach(i => { c0[U.num(i.harga)] = (c0[U.num(i.harga)] || 0) + U.num(i.qty); });
        const bs = Object.keys(c0).sort((a, b) => c0[b] - c0[a])[0];
        if (bs == null) return;
        gr.items.filter(i => tKey(i.ukuran)).forEach(i => {
          const k = tKey(i.ukuran), d = U.num(i.harga) - Number(bs);
          diffs[k] = diffs[k] || {}; diffs[k][d] = (diffs[k][d] || 0) + U.num(i.qty);
        });
      });
      Object.keys(diffs).forEach(k => { F.tamb[k] = Number(Object.keys(diffs[k]).sort((a, b) => diffs[k][b] - diffs[k][a])[0]); });
      M.byGroup(oldItems).forEach(gr => {
        const cnt = {};
        gr.items.forEach(i => { const b = U.num(i.harga) - tambUk(i.ukuran); cnt[b] = (cnt[b] || 0) + U.num(i.qty); });
        const hb = Number(Object.keys(cnt).sort((a, b) => cnt[b] - cnt[a])[0] || o.hargaDasar || 0);
        const g = newGroup(gr.nama, hb);
        g._zero = !hb;
        const named = gr.items.some(i => i.nama || i.nomor);
        const seen = {}; let dup = false, odd = false;
        gr.items.forEach(i => { if (seen[i.ukuran]) dup = true; seen[i.ukuran] = 1; if (SZ.indexOf(i.ukuran) < 0) odd = true; });
        if (named || dup || odd) {
          g.mode = 'nama';
          g.rows = gr.items.map(i => ({ nama: i.nama, nomor: i.nomor, ukuran: i.ukuran, qty: U.num(i.qty), harga: U.num(i.harga), _manual: U.num(i.harga) !== hb + tambUk(i.ukuran) }));
          if (g.rows.some(r => r._manual)) F.showHarga = true;
        } else {
          gr.items.forEach(i => { g.sizeQty[i.ukuran] = U.num(i.qty); if (U.num(i.harga) !== hb + tambUk(i.ukuran)) g.sizeHarga[i.ukuran] = U.num(i.harga); });
        }
        F.groups.push(g);
      });
      if (!F.groups.length) F.groups.push(newGroup('', o.hargaDasar));
    }
    if (src) {
      M.calc(src).exps.forEach(x => {
        const m = String(x.keterangan || '').match(RX_MODAL);
        if (m && !F.modalPcs && x.kategori === (kPeng[0] || 'Produksi')) { F.modalPcs = U.num(m[2] || m[3]); F.modalPcsId = x.id; }
        else F.expenses.push(Object.assign({}, x));
      });
      const auto = M.totals(Object.assign({}, src, { dpNominal: 0 }), oldItems).dpWajib;
      F.dpEdited = U.num(src.dpNominal) > 0 && U.num(src.dpNominal) !== auto;
    }

    const priceFor = (g, u) => g.sizeHarga[u] != null ? g.sizeHarga[u] : g.harga + tambUk(u);
    function groupItems(g) {
      const ket = g.nama.trim();
      if (g.mode === 'ukuran') return SZ.filter(s => U.num(g.sizeQty[s]) > 0).map(s => ({ nama: '', nomor: '', ukuran: s, qty: U.num(g.sizeQty[s]), harga: priceFor(g, s), ket: ket }));
      return g.rows.filter(r => U.num(r.qty) > 0 && (r.nama || r.nomor || r.ukuran)).map(r => ({
        nama: (r.nama || '').trim(), nomor: (r.nomor || '').trim(), ukuran: (r.ukuran || '').trim(), qty: U.num(r.qty), ket: ket,
        harga: r._manual ? U.num(r.harga) : g.harga + tambUk(r.ukuran)
      }));
    }
    function items() {
      if (F.item) return F.rows.filter(r => U.num(r.qty) > 0 && String(r.ukuran || '').trim()).map(r => ({ nama: '', nomor: '', ukuran: (r.ukuran || '').trim(), qty: U.num(r.qty), harga: U.num(r.harga), ket: '' }));
      return F.groups.reduce((a, g) => a.concat(groupItems(g)), []);
    }

    /* ---------- Kerangka ---------- */
    const step = (n, title, body, extra) => '<section class="card step"><div class="card-head"><h2><span class="num">' + n + '</span>' + title + '</h2>' + (extra || '') + '</div>' + body + '</section>';
    const money = (attrs, val, ph) => '<div class="rp"><span>Rp</span><input class="money" inputmode="numeric" ' + attrs + ' value="' + U.moneyVal(val) + '" placeholder="' + (ph || '0') + '"></div>';
    const kList = kats.indexOf(o.kategori) < 0 && o.kategori ? kats.concat(o.kategori) : kats;

    el.innerHTML =
      '<div class="page-head"><div><a class="back" href="' + (isNew ? '#/pesanan' : '#/pesanan/' + e(id)) + '">← Kembali</a>' +
      '<h1>' + (isNew ? 'Pesanan baru' : 'Edit pesanan ' + e(o.noNota)) + '</h1></div></div>' +
      '<form id="of" class="oform simple" autocomplete="off" novalidate>' +

      step(1, 'Pelanggan', '<div class="fgrid">' +
        '<label class="f span2">Nama pesanan / tim / acara<input data-f="pelanggan" value="' + e(o.pelanggan) + '" placeholder="cth. PORSENI AL-HIKMA"></label>' +
        '<label class="f">No. WhatsApp <small class="muted">(boleh kosong)</small><input data-f="hp" inputmode="tel" value="' + e(o.hp) + '" placeholder="08…"></label>' +
        '<label class="f">Target selesai <small class="muted">(boleh kosong)</small><input type="date" data-f="deadline" value="' + e(o.deadline) + '"></label>' +
        '</div>') +

      step(2, 'Produk', '<div class="lbl">Jenis</div><div class="chips wrap" id="kat">' +
        kList.map(k => '<button type="button" class="chip' + (k === o.kategori ? ' on acc' : '') + '" data-kat="' + e(k) + '">' + e(k) + '</button>').join('') + '</div>' +
        '<label class="f">Model & bahan <small class="muted">(boleh kosong)</small><input data-f="produk" value="' + e(o.produk) + '" placeholder="cth. Kerah V Neck Standar + Kain Milano"></label>') +

      step(3, 'Jumlah & harga', '<div id="qtyArea"></div>', '<span class="pill" id="sumQty"></span>') +

      step(4, 'Pembayaran', '<div class="paytotal"><div><small>Total harga</small><b id="tTotal"></b></div>' +
        '<label class="dpbox"><small>DP yang harus dibayar <span id="dpPct"></span></small><div class="rp"><span>Rp</span><input class="money" inputmode="numeric" id="dpNom"></div></label></div>' +
        (isNew
          ? '<div class="lbl">Dibayar sekarang</div><div class="chips wrap" id="payChips">' +
          '<button type="button" class="chip on acc" data-pay="none">Belum bayar</button><button type="button" class="chip" data-pay="dp">Bayar DP</button>' +
          '<button type="button" class="chip" data-pay="lunas">Langsung lunas</button><button type="button" class="chip" data-pay="lain">Nominal lain</button></div>' +
          '<div id="payDetail" hidden><div class="fgrid"><label class="f" id="payLainBox" hidden>Nominal dibayar' + money('id="payLain"', 0) + '</label>' +
          '<div class="f"><span>Metode</span><div class="chips wrap" id="metChips">' + metode.map((m, i) => '<button type="button" class="chip' + (i === 0 ? ' on' : '') + '" data-met="' + e(m) + '">' + e(m) + '</button>').join('') + '</div></div></div>' +
          '<p class="paynote" id="payNote"></p></div>'
          : '<p class="hint">Pembayaran DP / pelunasan dicatat di halaman detail pesanan (tombol <b>+ DP</b> / <b>+ Pelunasan</b>).</p>')) +

      step(5, 'Modal <small class="muted">(boleh kosong)</small>', '<div class="fgrid">' +
        '<label class="f">Modal per pcs' + money('id="modalPcs"', F.modalPcs) + '</label>' +
        '<div class="f"><span>Total modal</span><div class="readout" id="tModal"></div></div>' +
        '<div class="f"><span>Perkiraan laba</span><div class="readout" id="tLaba"></div></div></div>' +
        '<div id="modalRows" class="mrows"></div>' +
        '<button type="button" class="btn sm ghost" data-act="addModal">+ Biaya lain (ongkir vendor, bordir, dll.)</button>') +

      '<details class="card more"' + (o.diskon || o.ongkir || o.catatan || o.alamat || (o.status && o.status !== 'Baru') ? ' open' : '') + '><summary>Opsi lainnya <small class="muted">— tanggal, status, diskon, ongkir, DP %, catatan</small></summary><div class="fgrid">' +
      '<label class="f">Tanggal pesan<input type="date" data-f="tanggal" value="' + e(o.tanggal) + '"></label>' +
      '<label class="f">Status<select data-f="status">' + opt(M.STATUS, o.status) + '</select></label>' +
      '<label class="f">Diskon' + money('data-f="diskon"', o.diskon) + '</label>' +
      '<label class="f">Ongkos kirim' + money('data-f="ongkir"', o.ongkir) + '</label>' +
      '<label class="f">DP (%)<input type="number" min="0" max="100" inputmode="numeric" data-f="dpPersen" value="' + e(o.dpPersen) + '"></label>' +
      '<label class="f span2">Alamat<input data-f="alamat" value="' + e(o.alamat) + '"></label>' +
      '<label class="f span3">Catatan<textarea data-f="catatan" rows="2" placeholder="cth. warna hijau-putih, logo di dada kiri">' + e(o.catatan) + '</textarea></label>' +
      '</div></details>' +

      '<div class="savebar"><div class="sb-tot"><small>Total</small><b id="barTotal"></b></div>' +
      '<button type="button" class="btn ghost" data-act="cancel">Batal</button><button type="submit" class="btn primary big">Simpan</button></div>' +
      '</form>';

    const form = U.$('#of', el);
    App.editing = true;
    const qtyArea = U.$('#qtyArea', el);

    /* ---------- Gambar jumlah & harga ---------- */
    function rowsHtml(g) {
      const no = F.order.pakaiNomor === 'Y';
      return '<div class="nlist' + (no ? ' with-no' : '') + (F.showHarga ? ' with-harga' : '') + '">' + g.rows.map((r, i) =>
        '<div class="nrow" data-r="' + i + '"><span class="ino">' + (i + 1) + '</span>' +
        '<input data-k="nama" placeholder="Nama' + (no ? ' punggung' : '') + '" value="' + e(r.nama) + '" enterkeyhint="next">' +
        (no ? '<input data-k="nomor" class="nomor" placeholder="No." inputmode="numeric" value="' + e(r.nomor) + '">' : '') +
        '<select data-k="ukuran"' + (r.ukuran === M.UNK ? ' class="unk"' : '') + '><option value="">Ukuran</option>' + opt(r.ukuran && SZ.indexOf(r.ukuran) < 0 ? SZ.concat(r.ukuran) : SZ, r.ukuran) + '</select>' +
        '<input data-k="qty" class="qty" type="number" min="0" inputmode="numeric" value="' + e(r.qty) + '" aria-label="Jumlah">' +
        (F.showHarga ? '<input data-k="harga" class="money harga' + (r._manual ? ' manual' : '') + '" inputmode="numeric" value="' + (r._manual && !U.num(r.harga) ? '0' : U.moneyVal(r._manual ? r.harga : g.harga + tambUk(r.ukuran))) + '" placeholder="0" aria-label="Harga">' : '') +
        '<button type="button" class="icon-btn del" data-act="del" aria-label="Hapus">✕</button></div>').join('') + '</div>' +
        '<button type="button" class="btn sm mt" data-act="add">+ Tambah orang</button>';
    }
    function sizesHtml(g) {
      return '<div class="sizes">' + SZ.map(s =>
        '<div class="sz' + (U.num(g.sizeQty[s]) ? ' has' : '') + (s === M.UNK ? ' unk' : '') + '" data-sz="' + e(s) + '"><div class="sz-h"><b>' + e(s) + '</b><small>' + (s === M.UNK ? 'belum tahu' : U.fmt(priceFor(g, s))) + '</small></div>' +
        '<div class="stepper"><button type="button" data-step="-1" aria-label="Kurangi">−</button><input type="number" min="0" inputmode="numeric" value="' + (U.num(g.sizeQty[s]) || '') + '" placeholder="0" aria-label="Jumlah ' + e(s) + '"><button type="button" data-step="1" aria-label="Tambah">+</button></div></div>').join('') + '</div>';
    }
    function groupHtml(g, i) {
      const many = F.groups.length > 1;
      return '<div class="grp" data-g="' + i + '">' +
        '<div class="grp-head">' +
        '<label class="f grow">' + (many ? 'Kelompok ' + (i + 1) : 'Nama kelompok <small class="muted">(boleh kosong)</small>') +
        '<input data-gk="nama" value="' + e(g.nama) + '" placeholder="cth. Lengan Pendek / 1 Set (Atasan + Celana) / Wali Kelas"></label>' +
        '<label class="f price">Harga per pcs' + money('data-gk="harga"', g.harga).replace('value=""', g._zero ? 'value="0"' : 'value=""') + '</label>' +
        (many ? '<button type="button" class="icon-btn del" data-act="delGroup" title="Hapus kelompok" aria-label="Hapus kelompok">✕</button>' : '') +
        '</div>' +
        '<div class="tabs sm"><button type="button" class="tab' + (g.mode === 'ukuran' ? ' on' : '') + '" data-mode="ukuran">Jumlah per ukuran</button>' +
        '<button type="button" class="tab' + (g.mode === 'nama' ? ' on' : '') + '" data-mode="nama">Daftar nama</button></div>' +
        '<div class="gbody">' + (g.mode === 'ukuran' ? sizesHtml(g) : rowsHtml(g)) + '</div>' +
        '<div class="grp-sum"></div></div>';
    }
    function drawQty() {
      if (F.item) {
        qtyArea.innerHTML = '<div class="nlist item">' + F.rows.map((r, i) =>
          '<div class="nrow" data-r="' + i + '"><span class="ino">' + (i + 1) + '</span>' +
          '<input data-k="ukuran" placeholder="Nama barang / varian (cth. Mug putih)" value="' + e(r.ukuran) + '">' +
          '<input data-k="qty" class="qty" type="number" min="0" inputmode="numeric" value="' + e(r.qty) + '" aria-label="Jumlah">' +
          '<div class="rp"><span>Rp</span><input data-k="harga" class="money harga" inputmode="numeric" value="' + (r._manual && !U.num(r.harga) ? '0' : U.moneyVal(r.harga)) + '" placeholder="harga/pcs" aria-label="Harga"></div>' +
          '<button type="button" class="icon-btn del" data-act="del" aria-label="Hapus">✕</button></div>').join('') + '</div>' +
          '<button type="button" class="btn sm mt" data-act="add">+ Tambah barang</button>';
        recalc();
        return;
      }
      const tk = Object.keys(F.tamb);
      qtyArea.innerHTML =
        (tk.length ? '<div class="tamb"><span class="tl">Tambahan harga ukuran besar <small class="muted">(khusus pesanan ini)</small></span>' +
          tk.map(k => '<label>' + e(k) + ' <span class="rp"><span>+</span><input class="money" inputmode="numeric" data-tb="' + e(k) + '" value="' + (F.tamb[k] ? U.moneyVal(F.tamb[k]) : '0') + '"></span></label>').join('') +
          '<button type="button" class="btn sm ghost" data-act="noTamb">Tanpa tambahan</button></div>' : '') +
        '<div class="opts"><label class="inline"><input type="checkbox" id="pakaiNomor"' + (F.order.pakaiNomor === 'Y' ? ' checked' : '') + '> Pakai nomor punggung</label>' +
        '<label class="inline"><input type="checkbox" id="showHarga"' + (F.showHarga ? ' checked' : '') + '> Harga khusus per orang</label></div>' +
        '<div id="groups">' + F.groups.map(groupHtml).join('') + '</div>' +
        '<div class="row-btn wrap mt"><button type="button" class="btn sm" data-act="addGroup">+ Tambah kelompok</button>' +
        '<button type="button" class="btn sm" data-act="paste">📋 Tempel daftar dari WhatsApp</button></div>' +
        '<div id="panel"></div>' +
        '<p class="hint">Kelompok dipakai kalau harganya beda, misalnya <i>Lengan Pendek</i> &amp; <i>Lengan Panjang</i>, atau <i>1 Set</i> &amp; <i>Atasan Saja</i>. ' +
        'Pilih <b>Daftar nama</b> untuk mengisi nama' + ' / nomor punggung — jumlah per ukuran otomatis jadi baris yang tinggal diisi. ' +
        'Nilai bawaan tambahan ukuran besar diatur di <a href="#/pengaturan">Pengaturan</a>.</p>';
      recalc();
    }
    function refreshGroups() {
      const box = U.$('#groups', el);
      if (box) box.innerHTML = F.groups.map(groupHtml).join('');
      recalc();
    }
    function redrawGroup(i) {
      const old = qtyArea.querySelector('.grp[data-g="' + i + '"]');
      if (!old) return drawQty();
      old.outerHTML = groupHtml(F.groups[i], i);
      recalc();
    }
    function drawModal() {
      U.$('#modalRows', el).innerHTML = F.expenses.map((x, i) =>
        '<div class="mrow" data-m="' + i + '"><select data-k="kategori">' + opt(kPeng.indexOf(x.kategori) < 0 && x.kategori ? kPeng.concat(x.kategori) : kPeng, x.kategori) + '</select>' +
        '<input data-k="keterangan" placeholder="Keterangan" value="' + e(x.keterangan) + '">' +
        '<div class="rp"><span>Rp</span><input data-k="nominal" class="money" inputmode="numeric" placeholder="0" value="' + U.moneyVal(x.nominal) + '"></div>' +
        '<button type="button" class="icon-btn del" data-act="delModal" aria-label="Hapus">✕</button></div>').join('');
      recalc();
    }

    /* ---------- Hitung ---------- */
    let T = {};
    function payAmount() {
      if (F.pay === 'dp') return T.dpWajib;
      if (F.pay === 'lunas') return T.total;
      if (F.pay === 'lain') return F.payLain;
      return 0;
    }
    function recalc() {
      const its = items();
      T = M.totals(Object.assign({}, F.order, { dpNominal: F.dpEdited ? F.order.dpNominal : 0 }), its);
      if (!F.dpEdited) {
        F.order.dpNominal = T.dpWajib;
        const d = U.$('#dpNom', el);
        if (d && document.activeElement !== d) d.value = U.moneyVal(T.dpWajib);
      }
      U.$('#dpPct', el).textContent = F.dpEdited ? '(diubah manual)' : T.dpPersen ? '(' + T.dpPersen + '%)' : '';
      const modal = F.modalPcs * T.qty + F.expenses.reduce((s, x) => s + U.num(x.nominal), 0);
      U.$('#sumQty', el).textContent = T.qty + ' pcs';
      U.$('#tTotal', el).textContent = U.rp(T.total);
      U.$('#barTotal', el).textContent = U.rp(T.total) + ' · ' + T.qty + ' pcs';
      U.$('#tModal', el).textContent = U.rp(modal);
      const laba = T.total - modal;
      const lb = U.$('#tLaba', el); lb.textContent = U.rp(laba); lb.className = 'readout ' + (modal ? (laba >= 0 ? 'pos' : 'neg') : '');
      if (!F.item) F.groups.forEach((g, i) => {
        const box = qtyArea.querySelector('.grp[data-g="' + i + '"] .grp-sum');
        if (!box) return;
        const gi = groupItems(g);
        const q = gi.reduce((s, x) => s + x.qty, 0), sub = gi.reduce((s, x) => s + x.qty * x.harga, 0);
        const sc = M.sizeCount(gi);
        box.innerHTML = q ? '<span class="szs">' + sc.map(s => '<span><b>' + e(s.ukuran) + '</b> ' + s.qty + '</span>').join('') + '</span><b>' + q + ' pcs · ' + U.rp(sub) + '</b>' : '<span class="muted">Belum ada jumlah</span>';
      });
      const pn = U.$('#payNote', el);
      if (pn) {
        const a = payAmount();
        pn.innerHTML = F.pay === 'none' ? '' : 'Dicatat sebagai <b>' + (F.pay === 'lunas' || a >= T.total ? 'pelunasan' : 'DP') + ' ' + U.rp(a) + '</b>' + (T.total - a > 0 ? ' · sisa ' + U.rp(T.total - a) : ' · <b class="green-t">LUNAS</b>');
      }
    }

    /* ---------- Aksi kelompok ---------- */
    function toNama(g) {
      const rows = [];
      SZ.forEach(s => { for (let k = 0; k < U.num(g.sizeQty[s]); k++) rows.push({ nama: '', nomor: '', ukuran: s, qty: 1, harga: g.sizeHarga[s] || 0, _manual: g.sizeHarga[s] != null }); });
      g.rows = rows; g.mode = 'nama';
    }
    function setMode(i, m) {
      const g = F.groups[i];
      if (m === g.mode) return;
      if (m === 'nama') {
        toNama(g);
        if (!g.rows.length) g.rows.push(blankRow());
        redrawGroup(i);
        const f = qtyArea.querySelector('.grp[data-g="' + i + '"] [data-k="nama"]'); if (f) f.focus();
      } else {
        const go = () => {
          g.sizeQty = {}; g.sizeHarga = {};
          g.rows.forEach(r => { const u = M.normSize(r.ukuran) || r.ukuran; if (u && U.num(r.qty) > 0) g.sizeQty[u] = U.num(g.sizeQty[u]) + U.num(r.qty); });
          g.mode = 'ukuran'; redrawGroup(i);
        };
        if (g.rows.some(r => r.nama || r.nomor)) U.confirm('Nama & nomor di kelompok ini akan dihapus, hanya jumlah per ukuran yang disimpan. Lanjutkan?', 'Lanjutkan', go); else go();
      }
    }
    function setKategori(k) {
      const wasItem = F.item;
      F.order.kategori = k;
      F.order.pakaiUkuran = M.isBerukuran(k) ? 'Y' : '';
      if (isJersey(k)) F.order.pakaiNomor = 'Y';
      U.$$('#kat .chip', el).forEach(c => { const on = c.dataset.kat === k; c.classList.toggle('on', on); c.classList.toggle('acc', on); });
      F.item = F.order.pakaiUkuran !== 'Y';
      if (F.item && !wasItem) {
        F.rows = [Object.assign(blankItem(), { harga: F.groups[0] ? F.groups[0].harga : 0 })];
      } else if (!F.item && wasItem) {
        F.groups = [newGroup('', F.rows[0] ? U.num(F.rows[0].harga) : 0)];
      }
      drawQty();
    }

    /* ---------- Tempel daftar dari WhatsApp / Excel ---------- */
    function parsePaste(txt) {
      const out = [];
      let cur = null, anyNo = false, title = '';
      const clean = l => String(l || '').replace(/[\u200B-\u200D\u2060\uFEFF]/g, '').trim();
      const LINES = String(txt || '').split(/\r?\n/);
      const isListItem = l => /^\s*(\d+\s*[.)]|[-•])\s*/.test(clean(l).replace(/[*_~]/g, ''));
      const nextNonEmpty = i => { for (let j = i + 1; j < LINES.length; j++) if (clean(LINES[j])) return LINES[j]; return ''; };
      LINES.forEach((raw, idx) => {
        let line = raw.replace(/[​-‍⁠﻿]/g, '').trim();
        if (!line) return;
        const plain = line.replace(/[*_~]/g, '').trim();
        if (/^>/.test(line) || (/^\*[^*]+\*$/.test(line) && !/\|/.test(line))) {
          const name = plain.replace(/^>\s*/, '').trim();
          if (/^daftar\b/i.test(name)) { title = name; return; }
          cur = { nama: name, rows: [] }; out.push(cur); return;
        }
        if (/^daftar\b/i.test(plain)) { title = plain; return; }
        // Baris judul tanpa tanda ">" (cth. "Yang belum list") yang diikuti daftar bernomor/berstrip → kelompok baru
        if (!isListItem(line) && !/[|,;\t]/.test(plain) && !M.normSize(plain) && isListItem(nextNonEmpty(idx)) &&
          !/^(total|jumlah|masih ada|mohon|terima kasih|kalau|catatan|note)\b/i.test(plain)) {
          cur = { nama: plain.replace(/:$/, '').trim(), rows: [] }; out.push(cur); return;
        }
        if (/^(total|jumlah|masih ada|mohon|terima kasih|kalau|catatan|note)\b/i.test(plain)) return;
        if (!/[|,;\t]/.test(plain) && plain.split(/\s+/).length > 6) return;
        line = plain.replace(/^\s*(\d+\s*[.)]|[-•])\s*/, '');
        let tokens = line.split(/\t|;|,|\|/).map(s => s.trim()).filter(Boolean);
        if (tokens.length === 1) tokens = line.split(/\s+/);
        let uk = '', nums = [], words = [], blank = false;
        tokens.forEach(tk => {
          if (/^[._?\-]+$/.test(tk)) { blank = true; return; }
          if (/^menyusul$/i.test(tk)) { uk = M.UNK; return; }
          const s = M.normSize(tk.replace(/^uk(uran)?\.?\s*/i, ''));
          if (!uk && s) uk = s;
          else if (/^\d+$/.test(tk)) nums.push(tk);
          else if (/^(x|pcs)$/i.test(tk)) { /* abaikan */ }
          else words.push(tk);
        });
        if (!uk && !words.length && !nums.length && !blank) return;
        if (!uk && (blank || words.length)) uk = M.UNK;
        const nama = words.join(' ');
        if (/^(nama|name|no|total)$/i.test(nama)) return;
        let nomor = '', qty = 1;
        if (nama) { nomor = nums[0] || ''; if (nums[1]) qty = +nums[1]; } else if (nums[0]) qty = +nums[0];
        if (nomor) anyNo = true;
        if (!cur) { cur = { nama: null, rows: [] }; out.push(cur); }
        cur.rows.push({ nama: nama, nomor: nomor, ukuran: uk, qty: qty || 1, harga: 0, _manual: false });
      });
      return { groups: out.filter(g => g.rows.length || g.nama), anyNo: anyNo, title: title };
    }
    function applyPaste(res) {
      const isEmpty = g => !g.nama.trim() && !groupItems(g).length;
      const replaced = new Set();
      let added = 0;
      res.groups.forEach(pg => {
        let g = null;
        if (pg.nama) g = F.groups.find(x => x.nama.trim().toLowerCase() === pg.nama.toLowerCase());
        if (!g) {
          const empty = F.groups.find(isEmpty);
          if (empty) { g = empty; g.nama = pg.nama || ''; }
          else if (!pg.nama) g = F.groups[F.groups.length - 1];
          else { g = newGroup(pg.nama, F.groups[F.groups.length - 1].harga); F.groups.push(g); }
        }
        if (g.mode === 'ukuran') toNama(g);
        if (res.replace && !replaced.has(g)) { g.rows = []; replaced.add(g); }
        g.rows = g.rows.filter(r => r.nama || r.nomor || r.ukuran).concat(pg.rows);
        if (!g.rows.length) g.rows.push(blankRow());
        added += pg.rows.length;
      });
      if (res.anyNo) F.order.pakaiNomor = 'Y';
      if (res.title && !String(F.order.pelanggan || '').trim()) {
        let t = res.title.replace(/^daftar\s+nama\s*/i, '').trim();
        kats.forEach(k => { t = t.replace(new RegExp('^' + k + '\\s+', 'i'), ''); });
        F.order.pelanggan = t;
        form.querySelector('[data-f="pelanggan"]').value = t;
      }
      drawQty();
      return added;
    }

    /* ---------- Event ---------- */
    form.addEventListener('input', ev => {
      const t = ev.target;
      App.dirty = true;
      const f = t.dataset.f;
      if (f) {
        F.order[f] = t.classList.contains('money') ? U.num(t.value) : t.value;
        if (f === 'dpPersen') F.dpEdited = false;
        recalc(); return;
      }
      if (t.dataset.tb) { F.tamb[t.dataset.tb] = U.num(t.value); refreshGroups(); return; }
      if (t.id === 'dpNom') { F.dpEdited = U.num(t.value) > 0; F.order.dpNominal = U.num(t.value); recalc(); return; }
      if (t.id === 'modalPcs') { F.modalPcs = U.num(t.value); recalc(); return; }
      if (t.id === 'payLain') { F.payLain = U.num(t.value); recalc(); return; }
      const mrow = t.closest('.mrow');
      if (mrow && t.dataset.k) { const x = F.expenses[+mrow.dataset.m]; x[t.dataset.k] = t.dataset.k === 'nominal' ? U.num(t.value) : t.value; recalc(); return; }
      const gEl = t.closest('.grp');
      if (gEl) {
        const g = F.groups[+gEl.dataset.g];
        if (t.dataset.gk === 'nama') { g.nama = t.value; return; }
        if (t.dataset.gk === 'harga') {
          g.harga = U.num(t.value); g.sizeHarga = {}; g._zero = t.value.trim() !== '' && !g.harga;
          U.$$('.sz', gEl).forEach(d => { d.querySelector('small').textContent = U.fmt(priceFor(g, d.dataset.sz)); });
          if (F.showHarga) g.rows.forEach((r, i) => { if (!r._manual) { const h = gEl.querySelector('.nrow[data-r="' + i + '"] [data-k="harga"]'); if (h) h.value = U.moneyVal(g.harga + tambUk(r.ukuran)); } });
          recalc(); return;
        }
        const sz = t.closest('.sz');
        if (sz) { g.sizeQty[sz.dataset.sz] = Math.max(0, U.num(t.value)); sz.classList.toggle('has', g.sizeQty[sz.dataset.sz] > 0); recalc(); return; }
        const row = t.closest('.nrow');
        if (row && t.dataset.k) {
          const r = g.rows[+row.dataset.r], k = t.dataset.k;
          r[k] = (k === 'qty' || k === 'harga') ? U.num(t.value) : t.value;
          if (k === 'harga') { r._manual = true; t.classList.add('manual'); }
          if (k === 'ukuran') t.classList.toggle('unk', t.value === M.UNK);
          if (k === 'ukuran' && F.showHarga && !r._manual) { const h = row.querySelector('[data-k="harga"]'); if (h) h.value = U.moneyVal(g.harga + tambUk(r.ukuran)); }
          recalc();
        }
        return;
      }
      const row = t.closest('.nrow');
      if (row && t.dataset.k && F.item) {
        const r = F.rows[+row.dataset.r];
        r[t.dataset.k] = t.dataset.k === 'ukuran' ? t.value : U.num(t.value);
        if (t.dataset.k === 'harga') r._manual = t.value.trim() !== '';
        recalc();
      }
    });

    form.addEventListener('change', ev => {
      const t = ev.target;
      if (t.id === 'pakaiNomor') { F.order.pakaiNomor = t.checked ? 'Y' : ''; drawQty(); App.dirty = true; }
      if (t.id === 'showHarga') { F.showHarga = t.checked; drawQty(); }
    });

    /* Enter = pindah ke kolom yang sama di baris berikutnya (nama → nama, nomor → nomor, ukuran → ukuran) */
    form.addEventListener('keydown', ev => {
      if (ev.key !== 'Enter' || ev.target.tagName === 'TEXTAREA') return;
      ev.preventDefault();
      const row = ev.target.closest('.nrow');
      if (!row) return;
      const i = +row.dataset.r, k = ev.target.dataset.k;
      const gEl = row.closest('.grp');
      const gi = gEl ? +gEl.dataset.g : -1;
      const list = gEl ? F.groups[gi].rows : F.rows;
      const scope = gEl ? '.grp[data-g="' + gi + '"] ' : '';
      if (i === list.length - 1) {
        const isFirstCol = k === 'nama' || (F.item && k === 'ukuran');
        if (!isFirstCol) { ev.target.blur(); U.toast('Sudah baris terakhir', 'info'); return; }
        if (gEl) { list.push(blankRow()); redrawGroup(gi); } else { list.push(blankItem()); drawQty(); }
        App.dirty = true;
      }
      const next = qtyArea.querySelector(scope + '.nrow[data-r="' + (i + 1) + '"] [data-k="' + k + '"]');
      if (next) { next.focus(); if (next.select && next.tagName === 'INPUT') next.select(); }
    });

    form.addEventListener('click', ev => {
      const kat = ev.target.closest('[data-kat]');
      if (kat) { setKategori(kat.dataset.kat); App.dirty = true; return; }
      const gEl = ev.target.closest('.grp');
      const gi = gEl ? +gEl.dataset.g : -1;
      const md = ev.target.closest('[data-mode]');
      if (md && gEl) { setMode(gi, md.dataset.mode); App.dirty = true; return; }
      const st = ev.target.closest('[data-step]');
      if (st && gEl) {
        const g = F.groups[gi], box = st.closest('.sz'), s = box.dataset.sz;
        g.sizeQty[s] = Math.max(0, U.num(g.sizeQty[s]) + Number(st.dataset.step));
        box.querySelector('input').value = g.sizeQty[s] || '';
        box.classList.toggle('has', g.sizeQty[s] > 0);
        App.dirty = true; recalc(); return;
      }
      const pc = ev.target.closest('[data-pay]');
      if (pc) {
        F.pay = pc.dataset.pay;
        U.$$('#payChips .chip', el).forEach(c => { const on = c === pc; c.classList.toggle('on', on); c.classList.toggle('acc', on); });
        U.$('#payDetail', el).hidden = F.pay === 'none';
        U.$('#payLainBox', el).hidden = F.pay !== 'lain';
        if (F.pay === 'lain') setTimeout(() => U.$('#payLain', el).focus(), 20);
        recalc(); return;
      }
      const mc = ev.target.closest('[data-met]');
      if (mc) { F.payMetode = mc.dataset.met; U.$$('#metChips .chip', el).forEach(c => c.classList.toggle('on', c === mc)); return; }
      const b = ev.target.closest('[data-act]');
      if (!b) return;
      const act = b.dataset.act;
      App.dirty = true;
      if (act === 'add') {
        if (gEl) {
          const g = F.groups[gi]; g.rows.push(blankRow(g.rows[g.rows.length - 1])); redrawGroup(gi);
          const ins = qtyArea.querySelectorAll('.grp[data-g="' + gi + '"] .nrow:last-child input'); if (ins[0]) ins[0].focus();
        } else {
          F.rows.push(blankItem()); drawQty();
          const ins = qtyArea.querySelectorAll('.nrow:last-child input'); if (ins[0]) ins[0].focus();
        }
      } else if (act === 'del') {
        const r = +b.closest('.nrow').dataset.r;
        if (gEl) { const g = F.groups[gi]; g.rows.splice(r, 1); if (!g.rows.length) g.rows.push(blankRow()); redrawGroup(gi); }
        else { F.rows.splice(r, 1); if (!F.rows.length) F.rows.push(blankItem()); drawQty(); }
      } else if (act === 'noTamb') {
        Object.keys(F.tamb).forEach(k => { F.tamb[k] = 0; });
        U.$$('[data-tb]', el).forEach(i => { i.value = '0'; });
        refreshGroups();
        U.toast('Semua ukuran memakai harga yang sama', 'ok');
      } else if (act === 'addGroup') {
        const last = F.groups[F.groups.length - 1];
        F.groups.push(newGroup('', last ? last.harga : 0));
        drawQty();
        const ins = qtyArea.querySelectorAll('.grp:last-child [data-gk="nama"]'); if (ins[0]) ins[0].focus();
      } else if (act === 'delGroup') {
        const g = F.groups[gi];
        const go = () => { F.groups.splice(gi, 1); drawQty(); };
        if (groupItems(g).length) U.confirm('Hapus kelompok "' + (g.nama || 'Kelompok ' + (gi + 1)) + '" beserta isinya?', 'Hapus', go); else go();
      } else if (act === 'paste') {
        const p = U.$('#panel', el);
        if (p.innerHTML) { p.innerHTML = ''; return; }
        p.innerHTML = '<div class="panel"><b>Tempel daftar dari WhatsApp / Excel</b><p class="hint">Salin daftar dari grup WA lalu tempel di sini. Format per baris: <b>Nama | Ukuran | Nomor</b>. ' +
          'Baris berawalan <b>&gt;</b> (cth. <i>&gt; Lengan Panjang</i>) otomatis menjadi kelompok baru.</p>' +
          '<textarea id="pasteTxt" rows="8" placeholder="' + e('*DAFTAR NAMA KAOS PORSENI AL-HIKMA*\n\n> Lengan Pendek\n1. Fahry | L | 06\n2. Alby | XL | 02\n\n> Lengan Panjang\n1. Ainun | M | 07\n\n> Wali Kelas\n- XL') + '"></textarea>' +
          (isNew ? '' : '<label class="inline small"><input type="checkbox" id="pasteReplace" checked> Ganti daftar lama dengan daftar baru (untuk daftar yang sudah dilengkapi pelanggan)</label>') +
          '<div class="row-btn"><button type="button" class="btn primary sm" data-act="pasteAdd">Masukkan</button><button type="button" class="btn ghost sm" data-act="closePanel">Tutup</button></div></div>';
        U.$('#pasteTxt', el).focus();
      } else if (act === 'pasteAdd') {
        const res = parsePaste(U.$('#pasteTxt', el).value);
        const rp = U.$('#pasteReplace', el); res.replace = !!(rp && rp.checked);
        if (!res.groups.length) return U.toast('Tidak ada baris yang terbaca', 'err');
        const n = applyPaste(res);
        U.toast(n + ' baris dimasukkan' + (res.groups.length > 1 ? ' ke ' + res.groups.length + ' kelompok' : '') + '. Cek harga tiap kelompok ya.', 'ok');
      } else if (act === 'closePanel') {
        U.$('#panel', el).innerHTML = '';
      } else if (act === 'addModal') {
        F.expenses.push({ id: U.uid(), tanggal: F.order.tanggal, kategori: kPeng[1] || kPeng[0] || 'Lainnya', keterangan: '', nominal: 0 });
        drawModal();
        const ins = U.$$('.mrow [data-k="keterangan"]', el); if (ins.length) ins[ins.length - 1].focus();
      } else if (act === 'delModal') {
        F.expenses.splice(+b.closest('.mrow').dataset.m, 1); drawModal();
      } else if (act === 'cancel') {
        App.dirty = false;
        history.length > 1 ? history.back() : App.go('#/pesanan');
      }
    });

    /* ---------- Simpan ---------- */
    form.addEventListener('submit', ev => { ev.preventDefault(); trySave(); });

    function trySave() {
      const ord = Object.assign({}, F.order);
      if (!String(ord.pelanggan || '').trim()) {
        U.toast('Nama pesanan / pelanggan belum diisi', 'err');
        const p = form.querySelector('[data-f="pelanggan"]'); p.focus(); p.scrollIntoView({ block: 'center' });
        return;
      }
      const its = items();
      if (!its.length) { U.toast('Isi jumlah pesanan dulu (langkah 3)', 'err'); qtyArea.scrollIntoView({ block: 'center' }); return; }
      const noSize = F.item ? [] : its.filter(i => !i.ukuran);
      if (noSize.length) {
        const nm = noSize.slice(0, 5).map(i => i.nama || ('No. ' + i.nomor)).join(', ') + (noSize.length > 5 ? ', …' : '');
        U.confirm(noSize.length + ' orang belum dipilih ukurannya (' + nm + '). Tandai ukurannya "Menyusul" dan lengkapi nanti?', 'Ya, tandai Menyusul', () => {
          F.groups.forEach(g => g.rows.forEach(r => { if ((r.nama || r.nomor) && !r.ukuran) r.ukuran = M.UNK; }));
          drawQty();
          setTimeout(trySave, 80);
        });
        return;
      }
      const nol = its.filter(i => !i.harga);
      if (nol.length) {
        const ls = M.group(nol).map(g => (g.ket ? g.ket + ' – ' : '') + (g.ukuran !== '-' ? g.ukuran : 'item') + ' (' + g.qty + ' pcs)');
        U.confirm('Ada ' + nol.reduce((s2, i) => s2 + i.qty, 0) + ' pcs dengan harga Rp 0: ' + ls.join(', ') + '. Apakah memang gratis / harga khusus Rp 0? Item ini tetap tampil di invoice & WhatsApp.', 'Ya, simpan', () => doSave(ord, its));
        return;
      }
      doSave(ord, its);
    }

    function doSave(ord, its) {
      const rows = its.map((r, i) => Object.assign({ id: U.uid(), orderId: ord.id, urut: i + 1 }, r));
      const qty = its.reduce((s, r) => s + r.qty, 0);
      const expenses = F.expenses.filter(x => U.num(x.nominal) !== 0).map(x => ({
        id: x.id || U.uid(), tanggal: x.tanggal || ord.tanggal, orderId: ord.id, kategori: x.kategori || '', keterangan: x.keterangan || '', nominal: U.num(x.nominal), dibuat: x.dibuat || U.nowIso()
      }));
      if (F.modalPcs > 0) expenses.unshift({ id: F.modalPcsId, tanggal: ord.tanggal || U.today(), orderId: ord.id, kategori: kPeng[0] || 'Produksi', keterangan: 'Modal per pcs Rp ' + U.fmt(F.modalPcs) + ' × ' + qty + ' pcs', nominal: F.modalPcs * qty, dibuat: U.nowIso() });
      ord.pelanggan = ord.pelanggan.trim();
      ord.hargaDasar = F.item ? U.num((F.rows[0] || {}).harga) : U.num(F.groups[0].harga);
      ord.diskon = U.num(ord.diskon); ord.ongkir = U.num(ord.ongkir);
      ord.dpPersen = Number(ord.dpPersen) || 0; ord.dpNominal = U.num(T.dpWajib);
      ord.tanggal = ord.tanggal || U.today();
      if (isNew) { ord.noNota = M.nextNota(ord.tanggal); ord.dibuat = U.nowIso(); }
      ord.diubah = U.nowIso();
      Store.op('saveOrder', { order: ord, items: rows, expenses: expenses });
      const bayar = isNew ? payAmount() : 0;
      if (bayar > 0) {
        Store.op('savePayment', { payment: { id: U.uid(), orderId: ord.id, tanggal: ord.tanggal, jenis: F.pay === 'lunas' || bayar >= T.total ? 'Pelunasan' : 'DP', nominal: bayar, metode: F.payMetode, catatan: '', dibuat: U.nowIso() } });
      }
      App.editing = false; App.dirty = false;
      U.toast(isNew ? 'Pesanan ' + ord.noNota + ' tersimpan' : 'Perubahan tersimpan', 'ok');
      App.go('#/pesanan/' + ord.id);
    }

    drawQty();
    drawModal();
    if (isNew && !copyFrom) setTimeout(() => form.querySelector('[data-f="pelanggan"]').focus(), 30);
  };

  /* ===================== DETAIL PESANAN ===================== */
  V.payDialog = function (o, p, jenis) {
    const c = M.calc(o);
    const metode = U.list(M.S().metodeBayar);
    const isNew = !p;
    const suggest = j => j === 'DP' ? Math.max(0, Math.min(c.dpWajib - c.dpPaid, c.sisa)) : Math.max(0, c.sisa);
    p = p || { id: U.uid(), orderId: o.id, tanggal: U.today(), jenis: jenis || (c.paid > 0 ? 'Pelunasan' : 'DP'), nominal: 0, metode: metode[0] || '', catatan: '' };
    if (isNew) p.nominal = suggest(p.jenis);
    U.dialog(isNew ? 'Catat pembayaran' : 'Edit pembayaran',
      '<div class="dlg-info">' + e(o.noNota) + ' · ' + e(o.pelanggan) + '<br>Total ' + U.rp(c.total) + ' · Dibayar ' + U.rp(c.paid) + ' · <b>Sisa ' + U.rp(c.sisa) + '</b></div>' +
      '<div class="fgrid two">' +
      '<label class="f">Jenis<select name="jenis">' + opt(M.JENIS_BAYAR, p.jenis) + '</select></label>' +
      '<label class="f">Tanggal<input type="date" name="tanggal" value="' + e(p.tanggal) + '"></label>' +
      '<label class="f">Nominal<input class="money big" inputmode="numeric" name="nominal" value="' + U.moneyVal(p.nominal) + '" autofocus></label>' +
      '<label class="f">Metode<select name="metode">' + opt(metode.indexOf(p.metode) < 0 && p.metode ? metode.concat(p.metode) : metode, p.metode) + '</select></label>' +
      '<label class="f span2">Catatan<input name="catatan" value="' + e(p.catatan) + '"></label></div>',
      form => {
        const n = U.num(form.nominal.value);
        if (!n) { U.toast('Nominal belum diisi', 'err'); return false; }
        Store.op('savePayment', { payment: Object.assign({}, p, { tanggal: form.tanggal.value || U.today(), jenis: form.jenis.value, nominal: n, metode: form.metode.value, catatan: form.catatan.value, dibuat: p.dibuat || U.nowIso() }) });
        U.toast('Pembayaran ' + U.rp(n) + ' dicatat', 'ok');
      },
      {
        onMount: form => {
          if (!isNew) return;
          form.jenis.addEventListener('change', () => { form.nominal.value = U.moneyVal(suggest(form.jenis.value)); });
        }
      });
  };

  V.expenseDialog = function (x, orderId) {
    const kPeng = U.list(M.S().kategoriPengeluaran);
    const isNew = !x;
    x = x || { id: U.uid(), tanggal: U.today(), orderId: orderId || '', kategori: orderId ? (kPeng[0] || '') : (kPeng[kPeng.length - 2] || kPeng[0] || ''), keterangan: '', nominal: 0 };
    const orders = Store.data.orders.slice().sort((a, b) => String(b.tanggal).localeCompare(String(a.tanggal))).slice(0, 200);
    U.dialog(isNew ? 'Catat pengeluaran' : 'Edit pengeluaran',
      '<div class="fgrid two">' +
      '<label class="f span2">Untuk<select name="orderId"><option value="">— Operasional (tidak terkait pesanan) —</option>' +
      orders.map(o => '<option value="' + e(o.id) + '"' + (o.id === x.orderId ? ' selected' : '') + '>Modal: ' + e(o.noNota + ' · ' + o.pelanggan + ' · ' + (o.produk || '')) + '</option>').join('') + '</select></label>' +
      '<label class="f">Tanggal<input type="date" name="tanggal" value="' + e(x.tanggal) + '"></label>' +
      '<label class="f">Kategori<select name="kategori">' + opt(kPeng.indexOf(x.kategori) < 0 && x.kategori ? kPeng.concat(x.kategori) : kPeng, x.kategori) + '</select></label>' +
      '<label class="f span2">Keterangan<input name="keterangan" value="' + e(x.keterangan) + '" placeholder="cth. Beli kain dryfit 20 m" autofocus></label>' +
      '<label class="f span2">Nominal<input class="money big" inputmode="numeric" name="nominal" value="' + U.moneyVal(x.nominal) + '"></label></div>',
      form => {
        const n = U.num(form.nominal.value);
        if (!n) { U.toast('Nominal belum diisi', 'err'); return false; }
        Store.op('saveExpense', { expense: Object.assign({}, x, { orderId: form.orderId.value, tanggal: form.tanggal.value || U.today(), kategori: form.kategori.value, keterangan: form.keterangan.value, nominal: n, dibuat: x.dibuat || U.nowIso() }) });
        U.toast('Pengeluaran dicatat', 'ok');
      });
  };

  V.waDialog = function (o, kind) {
    kind = kind || M.waDefault(o);
    U.dialog('Kirim WhatsApp',
      '<div class="chips wrap" id="waK">' + M.WA_KINDS.map(k => '<button type="button" class="chip' + (k[0] === kind ? ' on acc' : '') + '" data-k="' + k[0] + '">' + k[1] + '</button>').join('') + '</div>' +
      '<textarea id="waTxt" rows="14" class="wa-txt"></textarea>' +
      '<p class="hint">Teks boleh diubah dulu sebelum dikirim.' + (o.hp ? ' Akan dikirim ke ' + e(o.hp) + '.' : ' No. WA pelanggan kosong — pilih kontak/grup di WhatsApp, atau salin teksnya.') + '</p>',
      null,
      {
        wide: true,
        extra: '<button type="button" class="btn" data-copy>Salin teks</button><a class="btn wa" data-open target="_blank" rel="noopener">Buka WhatsApp</a>',
        onMount: form => {
          const ta = form.querySelector('#waTxt'), link = form.querySelector('[data-open]');
          const set = k => { ta.value = M.wa(o, k); upd(); U.$$('#waK .chip', form).forEach(c => { const on = c.dataset.k === k; c.classList.toggle('on', on); c.classList.toggle('acc', on); }); };
          const upd = () => { link.href = M.waLink(o.hp, ta.value); };
          ta.addEventListener('input', upd);
          form.querySelector('#waK').addEventListener('click', ev => { const c = ev.target.closest('[data-k]'); if (c) set(c.dataset.k); });
          form.querySelector('[data-copy]').addEventListener('click', () => {
            const done = () => U.toast('Teks disalin — tinggal tempel di WhatsApp', 'ok');
            if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(ta.value).then(done, () => { ta.select(); document.execCommand('copy'); done(); });
            else { ta.select(); document.execCommand('copy'); done(); }
          });
          set(kind);
        }
      });
  };

  V.orderDetail = function (el, params) {
    const o = M.order(params[0]);
    if (!o) { el.innerHTML = '<div class="empty">Pesanan tidak ditemukan (mungkin sudah dihapus). <a href="#/pesanan">Kembali ke daftar</a></div>'; return; }
    const c = M.calc(o);
    const groups = M.group(c.items);
    const withNo = o.pakaiNomor === 'Y';
    const hasNames = c.items.some(i => i.nama || i.nomor);
    const dl = U.daysLeft(o.deadline);
    const stat = (l, v, cls) => '<div class="stat sm ' + (cls || '') + '"><div class="s-lbl">' + l + '</div><div class="s-val">' + v + '</div></div>';

    el.innerHTML =
      '<div class="page-head"><div><a class="back" href="#/pesanan">← Pesanan</a><h1>' + e(o.pelanggan) + '</h1>' +
      '<div class="muted">' + e(o.noNota) + ' · ' + U.fdate(o.tanggal, true) + ' · ' + e(o.kategori) + (o.produk ? ' · ' + e(o.produk) : '') + '</div></div>' +
      '<div class="row-btn"><a class="btn" href="#/pesanan/' + e(o.id) + '/edit">Edit</a><button class="btn ghost" data-act="dup">Duplikat</button><button class="btn ghost danger" data-act="delete">Hapus</button></div></div>' +

      '<div class="status-row"><label>Status produksi <select id="st">' + opt(M.STATUS, o.status || 'Baru') + '</select></label>' +
      V.badge(c.payStatus) +
      (o.deadline ? '<span class="muted">Target selesai ' + U.fdate(o.deadline) + (['Selesai', 'Diambil', 'Batal'].indexOf(o.status) < 0 && dl !== null ? ' (' + (dl < 0 ? '<span class="late">lewat ' + (-dl) + ' hari</span>' : dl === 0 ? '<span class="late">hari ini</span>' : dl + ' hari lagi') + ')' : '') + '</span>' : '') + '</div>' +

      (M.unkCount(c.items) ? '<div class="warnbar">⚠ <b>' + M.unkCount(c.items) + ' pcs</b> ukurannya belum terdata (Menyusul). Kirim <b>Daftar nama</b> lewat WhatsApp ke pelanggan, lalu lengkapi lewat <a href="#/pesanan/' + e(o.id) + '/edit">Edit</a>.</div>' : '') +
      '<div class="stats six">' +
      stat('Total', U.rp(c.total), 'main') + stat('DP harus dibayar', U.rp(c.dpWajib)) + stat('Sudah dibayar', U.rp(c.paid)) +
      stat('Sisa', U.rp(Math.max(0, c.sisa)), c.sisa > 0 ? 'warn' : 'pos') + stat('Modal', U.rp(c.modal)) + stat('Laba', U.rp(c.laba), c.laba >= 0 ? 'pos' : 'neg') + '</div>' +

      '<section class="card print-card"><div class="card-head"><h2>Cetak / kirim</h2>' +
      (hasNames ? '<label class="inline small"><input type="checkbox" id="withList" checked> Lampirkan rincian nama</label>' : '') + '</div>' +
      '<div class="row-btn wrap">' +
      '<button class="btn" data-print="invoice">🧾 Invoice</button>' +
      '<button class="btn" data-print="dp">Nota DP</button>' +
      '<button class="btn" data-print="lunas">Nota Pelunasan</button>' +
      '<button class="btn" data-print="rincian">Rincian nama</button>' +
      '<button class="btn wa" data-act="wa">Kirim WhatsApp</button>' +
      '</div><p class="hint">Di jendela cetak, pilih "Simpan sebagai PDF" untuk menyimpan file.</p></section>' +

      '<div class="grid2">' +
      '<section class="card"><div class="card-head"><h2>Rekap per ukuran</h2><span class="pill">' + c.qty + ' pcs</span></div>' +
      '<table class="tbl"><thead><tr><th>' + (o.pakaiUkuran === 'Y' ? 'Ukuran' : 'Varian') + '</th><th class="c">Qty</th><th class="r">Harga</th><th class="r">Jumlah</th></tr></thead><tbody>' +
      groups.map((g, n) => (g.ket && (n === 0 || groups[n - 1].ket !== g.ket) ? '<tr class="grow"><td colspan="4">' + e(g.ket) + '</td></tr>' : '') +
        '<tr><td><b>' + e(g.ukuran) + '</b></td><td class="c">' + g.qty + '</td><td class="r">' + U.rp(g.harga) + '</td><td class="r">' + U.rp(g.jumlah) + '</td></tr>').join('') +
      '</tbody><tfoot>' +
      (c.diskon ? '<tr><td colspan="3">Diskon</td><td class="r">-' + U.rp(c.diskon) + '</td></tr>' : '') +
      (c.ongkir ? '<tr><td colspan="3">Ongkos kirim</td><td class="r">' + U.rp(c.ongkir) + '</td></tr>' : '') +
      '<tr><td colspan="3">Total</td><td class="r">' + U.rp(c.total) + '</td></tr></tfoot></table></section>' +

      '<section class="card"><div class="card-head"><h2>Pembayaran</h2><div class="row-btn">' +
      (c.sisa > 0 ? (c.dpPaid < c.dpWajib && c.paid < c.dpWajib ? '<button class="btn sm" data-act="pay" data-j="DP">+ DP</button>' : '') + '<button class="btn sm primary" data-act="pay" data-j="Pelunasan">+ Pelunasan</button>' : '<span class="badge green">LUNAS</span>') +
      '</div></div>' +
      (c.pays.length ? '<div class="plist">' + c.pays.map(p => '<div class="prow"><div><b>' + e(p.jenis) + '</b> · ' + U.fdate(p.tanggal) + ' <span class="muted">' + e(p.metode || '') + (p.catatan ? ' · ' + e(p.catatan) : '') + '</span></div>' +
        '<div class="pr-r"><b>' + U.rp(p.nominal) + '</b><button class="icon-btn" data-act="editPay" data-id="' + e(p.id) + '" aria-label="Edit">✎</button><button class="icon-btn" data-act="delPay" data-id="' + e(p.id) + '" aria-label="Hapus">✕</button></div></div>').join('') + '</div>'
        : '<p class="muted pad">Belum ada pembayaran. DP yang harus dibayar: <b>' + U.rp(c.dpWajib) + '</b></p>') +
      '<div class="sumbox">' + '<div class="sl"><span>Total dibayar</span><b>' + U.rp(c.paid) + '</b></div><div class="sl big"><span>Sisa</span><b>' + U.rp(Math.max(0, c.sisa)) + '</b></div>' + (c.sisa < 0 ? '<div class="sl neg"><span>Kelebihan bayar</span><b>' + U.rp(-c.sisa) + '</b></div>' : '') + '</div></section>' +

      '<section class="card"><div class="card-head"><h2>Rincian ' + (hasNames ? 'nama' : 'pesanan') + '</h2></div>' +
      '<div class="tbl-wrap"><table class="tbl"><thead><tr><th>#</th><th>Nama</th>' + (withNo ? '<th class="c">No.</th>' : '') + '<th class="c">' + (o.pakaiUkuran === 'Y' ? 'Ukuran' : 'Varian') + '</th><th class="c">Qty</th><th class="r">Harga</th></tr></thead><tbody>' +
      M.byGroup(c.items).map(gr => (gr.nama ? '<tr class="grow"><td colspan="' + (withNo ? 6 : 5) + '">' + e(gr.nama) + ' <span class="muted">(' + gr.items.reduce((s, i) => s + U.num(i.qty), 0) + ' pcs)</span></td></tr>' : '') +
        gr.items.map((i, n) => '<tr><td>' + (n + 1) + '</td><td>' + e(i.nama || '-') + '</td>' + (withNo ? '<td class="c"><b>' + e(i.nomor || '-') + '</b></td>' : '') + '<td class="c">' + e(i.ukuran || '-') + '</td><td class="c">' + U.num(i.qty) + '</td><td class="r">' + U.rp(i.harga) + '</td></tr>').join('')).join('') +
      '</tbody></table></div></section>' +

      '<section class="card"><div class="card-head"><h2>Modal & biaya</h2><button class="btn sm" data-act="addExp">+ Biaya</button></div>' +
      (c.exps.length ? '<div class="plist">' + c.exps.map(x => '<div class="prow"><div><b>' + e(x.kategori) + '</b> · ' + U.fdate(x.tanggal) + ' <span class="muted">' + e(x.keterangan || '') + '</span></div>' +
        '<div class="pr-r"><b>' + U.rp(x.nominal) + '</b><button class="icon-btn" data-act="editExp" data-id="' + e(x.id) + '" aria-label="Edit">✎</button><button class="icon-btn" data-act="delExp" data-id="' + e(x.id) + '" aria-label="Hapus">✕</button></div></div>').join('') + '</div>'
        : '<p class="muted pad">Belum ada modal dicatat untuk pesanan ini.</p>') +
      '<div class="sumbox"><div class="sl"><span>Total modal</span><b>' + U.rp(c.modal) + '</b></div><div class="sl big ' + (c.laba >= 0 ? 'pos' : 'neg') + '"><span>Laba pesanan</span><b>' + U.rp(c.laba) + '</b></div></div></section>' +
      '</div>' +

      ((o.hp || o.alamat || o.catatan) ? '<section class="card"><h2>Info</h2><div class="info">' +
        (o.hp ? '<div><span class="muted">HP/WA</span> ' + e(o.hp) + '</div>' : '') + (o.alamat ? '<div><span class="muted">Alamat</span> ' + e(o.alamat) + '</div>' : '') +
        (o.catatan ? '<div><span class="muted">Catatan</span> ' + e(o.catatan) + '</div>' : '') + '</div></section>' : '');

    U.$('#st', el).addEventListener('change', ev => {
      const ord = Object.assign({}, o, { status: ev.target.value, diubah: U.nowIso() });
      Store.op('saveOrder', { order: ord, items: c.items, expenses: c.exps });
      U.toast('Status: ' + ev.target.value, 'ok');
    });

    el.addEventListener('click', ev => {
      const pb = ev.target.closest('[data-print]');
      if (pb) { const w = U.$('#withList', el); Print.print(o, pb.dataset.print, { rincian: w ? w.checked : false }); return; }
      const b = ev.target.closest('[data-act]');
      if (!b) return;
      const act = b.dataset.act, rid = b.dataset.id;
      if (act === 'pay') V.payDialog(o, null, b.dataset.j);
      else if (act === 'editPay') V.payDialog(o, c.pays.find(p => p.id === rid));
      else if (act === 'delPay') U.confirm('Hapus pembayaran ini?', 'Hapus', () => Store.op('deletePayment', { id: rid }));
      else if (act === 'addExp') V.expenseDialog(null, o.id);
      else if (act === 'editExp') V.expenseDialog(c.exps.find(x => x.id === rid));
      else if (act === 'delExp') U.confirm('Hapus biaya ini?', 'Hapus', () => Store.op('deleteExpense', { id: rid }));
      else if (act === 'wa') V.waDialog(o);
      else if (act === 'dup') { App.ui.copyFrom = o.id; App.go('#/pesanan/baru'); }
      else if (act === 'delete') U.confirm('Hapus pesanan ' + o.noNota + ' (' + o.pelanggan + ') beserta pembayaran & modalnya?', 'Hapus', () => {
        Store.op('deleteOrder', { id: o.id });
        U.toast('Pesanan dihapus', 'ok');
        App.go('#/pesanan');
      });
    });
  };
})();
