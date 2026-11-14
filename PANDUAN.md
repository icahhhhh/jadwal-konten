# Jadwal Konten: akun & data di Google Sheets (tanpa Firebase)

File: `index.html` (web), `apps-script.gs` (server), `PANDUAN.md` (ini).

## 1. Pasang server di Google Sheets
1. Buat Google Sheet baru (beri nama bebas, misalnya "Database Jadwal Konten").
2. **Ekstensi > Apps Script**, hapus isi bawaan, tempel seluruh isi `apps-script.gs`, lalu simpan.
3. **Deploy > New deployment > Web app**. Execute as: **Me**. Who has access: **Anyone**. Klik Deploy, izinkan akses, lalu salin **URL Web app**.
4. Buka `index.html`, isi `API_URL` di bagian `PENGATURAN` dengan URL tadi.

Setiap kali kamu mengubah `apps-script.gs`, buat deployment versi baru (Deploy > Manage deployments > Edit > New version), kalau tidak perubahannya tidak aktif.

## 2. Hosting
Unggah `index.html` ke hosting statis mana saja: Netlify (app.netlify.com/drop), Vercel, Cloudflare Pages, GitHub Pages, atau `public_html` di hosting biasa.

## Cara kerjanya
- Saat web dibuka, orang bisa **Daftar** (email, nama, kata sandi) lalu **Masuk**. Sesi bertahan 30 hari di browser.
- Sheet **Users** berisi akun (kata sandi disimpan sebagai hash dengan salt, bukan teks asli), **Sesi** berisi sesi login, dan **Konten** berisi semua jadwal, satu baris per konten dengan kolom email pemilik.
- Perubahan tersimpan otomatis sekitar satu detik kemudian. Kamu bisa membuka sheet **Konten** kapan saja sebagai backup atau untuk laporan.
- Tombol Ekspor/Impor CSV tetap ada.

## Lupa kata sandi
- Di layar masuk ada tombol **Lupa kata sandi?**. Pengguna memasukkan email, lalu menerima **kode 6 angka** (berlaku 15 menit) di emailnya, dan memakainya untuk membuat kata sandi baru. Semua sesi lama otomatis keluar.
- Email dikirim lewat `MailApp` dari akun Google pemilik script. Saat deploy versi baru, Google akan meminta izin **mengirim email**: setujui. Batas kirim sekitar 100 email per hari untuk akun Gmail biasa.
- Kode salah 5 kali membuat akun dikunci 10 menit dan kodenya hangus.
- **Cadangan manual**: kalau email tidak bisa terkirim, pemilik sheet bisa menghapus baris orang itu di tab **Users**. Orang itu lalu mendaftar ulang dengan email yang sama, dan data lamanya muncul lagi karena terikat ke email. Lakukan ini hanya setelah kamu yakin orangnya benar.
- Kalau sheet kamu sudah dipakai sebelum update ini, tidak perlu mengubah apa pun: kolom kode ditambahkan otomatis.

## Batasan yang perlu kamu tahu
- **Jaga sheet ini tetap privat.** Jangan dibagikan ke orang lain, karena pemilik sheet bisa melihat email dan semua konten semua akun.
- Keamanannya lebih sederhana daripada Firebase: tidak ada verifikasi email saat daftar, dan hash memakai SHA-256 berulang (bukan bcrypt). Akun dikunci 10 menit setelah 5 kali salah kata sandi. Cocok untuk tim kecil, kurang cocok untuk ribuan pengguna.
- Server Google Apps Script agak lambat (1 sampai 3 detik per aksi) dan punya kuota harian. Maksimal 500 konten per akun.
