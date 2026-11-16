# SS Clothing — Catatan Penjualan

Aplikasi web untuk mencatat pesanan (jersey, kaos, baju, dan produk lain), DP, pelunasan, modal, pengeluaran, laba, serta mencetak **Invoice**, **Nota DP**, **Nota Pelunasan**, dan **Rincian nama**.

- Tampilan aplikasi: **GitHub Pages** (gratis)
- Penyimpanan data: **Google Spreadsheet** lewat **Google Apps Script**
- Cepat: data disimpan juga di perangkat, jadi perpindahan halaman instan. Perubahan dikirim ke Spreadsheet di latar belakang (lihat tanda **Tersimpan** di pojok kanan atas).
- Bisa dipakai di laptop, tablet, dan HP, serta bisa di-"install" ke layar utama HP.

---

## Langkah 1 — Siapkan Google Spreadsheet + Apps Script

1. Buka <https://sheets.new> untuk membuat Spreadsheet baru. Beri nama, misalnya **Data Penjualan**.
2. Menu **Ekstensi → Apps Script**.
3. Hapus semua isi `Code.gs`, lalu salin-tempel seluruh isi file `apps-script/Code.gs` dari folder ini.
4. Di baris paling atas, ganti `const PIN = 'ganti-pin-ini';` dengan PIN rahasia Anda, misalnya `'urwah2026'`.
5. Klik **Simpan** (ikon disket).
6. Klik **Terapkan (Deploy) → Deployment baru**.
   - Klik ikon roda gigi → pilih **Aplikasi web**.
   - **Jalankan sebagai:** Saya
   - **Yang memiliki akses:** Siapa saja
   - Klik **Terapkan**, lalu **Izinkan akses** (pilih akun Google Anda → *Advanced/Lanjutan* → *Buka … (tidak aman)* → *Izinkan*). Ini normal untuk script milik sendiri.
7. Salin **URL aplikasi web** (berakhiran `/exec`). Simpan, dipakai di Langkah 3.

> Sheet `Pesanan`, `Detail`, `Pembayaran`, `Pengeluaran`, dan `Pengaturan` akan dibuat otomatis saat data pertama dikirim.

**Jika nanti Code.gs diubah**, gunakan **Terapkan → Kelola deployment → ikon pensil → Versi: Versi baru → Terapkan** supaya URL tetap sama.

## Langkah 2 — Publikasikan dengan GitHub Desktop

Repositori Anda: **SS-Clothing** (folder `Documents\GitHub\catatan-penjualan\SS-Clothing`). Semua file aplikasi ada di dalam folder ini.

1. Buka **GitHub Desktop**, pastikan *Current repository* = **SS-Clothing**.
2. Di kiri bawah isi *Summary* (misal: `Aplikasi penjualan`) → **Commit to main** → **Push origin**.
3. Buka <https://github.com/syahrulazwan-azwan/SS-Clothing> → **Settings → Pages**.
   - *Source:* **Deploy from a branch**
   - *Branch:* **main** / **(root)** → **Save**
   - Repositori harus **Public** (Settings → General → Danger Zone → Change visibility) untuk GitHub Pages gratis. Data penjualan tetap aman karena tersimpan di Spreadsheet, bukan di GitHub.
4. Tunggu 1–2 menit. Alamat aplikasi: **https://syahrulazwan-azwan.github.io/SS-Clothing/**

## Langkah 3 — Hubungkan aplikasi ke Spreadsheet

1. Buka alamat aplikasi → menu **Pengaturan**.
2. Tempel **URL aplikasi web** dan isi **PIN** yang sama dengan di `Code.gs` → **Simpan & hubungkan**.
3. Isi **Identitas usaha** (nama, logo, alamat, nomor WA, rekening) → **Simpan pengaturan**.
4. Lakukan langkah 1–2 di setiap perangkat (laptop, tablet, HP) yang akan dipakai. Semua perangkat memakai Spreadsheet yang sama.

> Ingin mencoba dulu? Di Pengaturan ada tombol **Muat data contoh**. Tanpa koneksi Spreadsheet, aplikasi berjalan dalam **Mode lokal** (data hanya di perangkat itu).

## Pasang di HP seperti aplikasi

- **Android (Chrome):** buka alamat aplikasi → menu ⋮ → **Tambahkan ke layar utama / Instal aplikasi**.
- **iPhone (Safari):** tombol Bagikan → **Tambahkan ke Layar Utama**.

---

## Cara pakai singkat

| Kebutuhan | Caranya |
|---|---|
| Pesanan baru | Tombol **+ Pesanan**. Isi pelanggan, kategori, harga dasar. |
| Pesanan jersey/kaos dengan nama & nomor punggung | Centang **Pakai nama & nomor punggung**, lalu isi per baris, atau **Tempel daftar nama** (format `Nama, Nomor, Ukuran, Qty` — bisa disalin dari Excel/WhatsApp). Tekan **Enter** untuk menambah baris berikutnya. |
| Pesanan kaos massal tanpa nama | **Isi cepat per ukuran** → isi jumlah S, M, L, dst. |
| Harga beda per ukuran | Atur di Pengaturan → *Tambahan harga per ukuran* (cth. `XXL=10000`). Harga per baris juga bisa diubah manual. |
| Produk lain (mug, stiker, dll.) | Pilih kategori **Lainnya** → kolom ukuran berubah jadi **Varian**. |
| DP | Persentase DP otomatis menghitung **DP yang harus dibayar**. DP yang diterima bisa diisi langsung saat membuat pesanan, atau lewat tombol **+ DP** di detail pesanan. |
| Pelunasan | Detail pesanan → **+ Pelunasan** (nominal sisa terisi otomatis). |
| Modal pesanan | Di formulir: **Modal per pcs × jumlah pcs**, atau **+ Biaya lain** (bahan, sablon, jahit, ongkir vendor). |
| Pengeluaran operasional | Menu **Keuangan → + Pengeluaran** → pilih *Operasional*. |
| Laba | **Beranda** & **Keuangan → Laba rugi** (per bulan atau semua waktu). |
| Cetak / PDF | Detail pesanan → **Invoice / Nota DP / Nota Pelunasan / Rincian nama** → di jendela cetak pilih *Simpan sebagai PDF*. |
| Kirim ke pelanggan | Tombol **Kirim WhatsApp** (ringkasan tagihan otomatis). |

**Isi dokumen cetak**

- **Invoice** — dikelompokkan per ukuran: *Ukuran S — 5 pcs × harga satuan = jumlah*, lalu total, DP/terbayar, dan sisa tagihan.
- **Nota DP** — total, DP yang harus dibayar, DP diterima, sisa pelunasan, terbilang.
- **Nota Pelunasan** — riwayat pembayaran, total dibayar, stempel **LUNAS**.
- **Rincian nama** — daftar nama, nomor punggung, ukuran, dan rekap jumlah per ukuran (untuk produksi). Bisa dilampirkan otomatis di halaman kedua invoice/nota.

---

## Struktur file

```
index.html              Halaman utama aplikasi
css/style.css           Tampilan (layar & cetak)
js/util.js              Fungsi bantu (format rupiah, terbilang, dialog)
js/store.js             Penyimpanan lokal + sinkron ke Spreadsheet
js/model.js             Perhitungan total, DP, sisa, modal, laba, rekap ukuran
js/print.js             Format Invoice, Nota DP, Nota Pelunasan, Rincian
js/v-home.js            Halaman Beranda & daftar Pesanan
js/v-order.js           Formulir & detail pesanan
js/v-other.js           Keuangan & Pengaturan
icons/                  Logo SS Clothing & ikon aplikasi
sw.js                   Cache aplikasi agar terbuka instan / offline
apps-script/Code.gs     Backend Google Apps Script (disalin ke Spreadsheet)
```

Setelah mengubah file aplikasi, naikkan `VERSION` di `sw.js` (misal `cp-v1.1.1`), lalu Commit + **Push origin** di GitHub Desktop. Perangkat akan memakai versi baru setelah aplikasi dibuka ulang.

## Tanya jawab

- **Status "Gagal kirim"?** Periksa URL (harus berakhiran `/exec`), PIN, dan akses deployment *Siapa saja*. Data tidak hilang; perubahan tetap menunggu dan dikirim ulang otomatis.
- **Bolehkah mengedit Spreadsheet langsung?** Boleh untuk melihat/merekap. Untuk mengubah data, sebaiknya lewat aplikasi agar perhitungan tetap konsisten. Jangan mengganti nama kolom di baris pertama.
- **Cadangan data:** Pengaturan → **Unduh cadangan (JSON)** atau **Unduh pesanan (CSV/Excel)**.
