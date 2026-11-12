# JAZZZTIP KEDIRI – Website Jastip

React + Vite + Tailwind + Supabase. Tanpa Supabase, website tetap tampil dengan data contoh, tetapi /admin belum bisa dipakai.

## 1. Instalasi lokal
```
npm install
cp .env.example .env     # isi nilai dari Supabase
npm run dev
```
Build: `npm run build`

## 2. Logo
Simpan logo Instagram kamu sebagai `public/logo.png` (kotak, latar transparan lebih bagus).

## 3. Setup Supabase
1. Buat project di supabase.com.
2. Buka **SQL Editor**, tempel isi `supabase/schema.sql`, klik Run. Ini membuat tabel, aturan keamanan (hanya admin yang bisa mengubah), dan bucket foto `product-images`. Lalu tempel dan Run `supabase/orders.sql` untuk fitur keranjang dan pesanan (bagian 6).
3. **Project Settings → API**: salin *Project URL* dan *anon public key* ke `.env`.
4. **Authentication → Users → Add user**: buat email + password admin (centang Auto Confirm).
5. **Authentication → Sign In / Providers**: matikan "Allow new users to sign up" agar orang lain tidak bisa mendaftar.

## 4. Login admin
Buka `https://domainmu.netlify.app/admin`, masuk dengan email dan password dari langkah 3.4. Dari sana ubah produk, foto, harga, status OPEN/CLOSED, jadwal, rute, dan nomor WhatsApp (format 628xxxxxxxxxx, tanpa + atau 0).

## 5. Deploy ke Netlify
1. Upload project ke GitHub, lalu di Netlify: **Add new site → Import from Git**.
2. Build command `npm run build`, publish directory `dist` (sudah di `netlify.toml`).
3. **Site configuration → Environment variables**: tambahkan `VITE_SUPABASE_URL` dan `VITE_SUPABASE_ANON_KEY`.

   Kalau memakai **Vercel**: import repo GitHub, preset **Vite**, isi dua environment variable yang sama sebelum klik Deploy. File `vercel.json` sudah ada supaya `/admin` tidak 404 saat halaman dimuat ulang. Repo boleh private.
4. Deploy. Routing `/admin` sudah ditangani aturan redirect di `netlify.toml`.

## 6. Keranjang, pesanan, dan rekap untuk bot

Pelanggan memilih produk, mengisi keranjang, lalu mengirim pesanan. Pesanan tersimpan di Supabase
(tabel `orders`), lalu pelanggan diarahkan ke WhatsApp admin untuk konfirmasi. Admin melihat dan
mengelola pesanan di **/admin** (ringkasan, daftar belanja, ubah status). Tanpa Supabase, keranjang tetap
jalan dalam mode contoh: pesanan hanya disusun menjadi pesan WhatsApp dan tidak tersimpan.

**Aturan yang perlu diketahui**
- Harga produk harus **satu angka** (contoh `Rp 25.000`). Harga seperti `Tanya admin` atau rentang
  `Rp 10.000 - 15.000` membuat produk tampil dengan tombol "Tanya admin" dan tidak bisa masuk keranjang.
- Status toko `OPEN` / `CLOSED` berlaku sungguhan: saat `CLOSED`, tombol titip hilang dan **server
  menolak pesanan** walau ada yang mencoba melewati tampilan situs.
- Harga total dihitung di database dari tabel produk, bukan dari browser pelanggan. Nomor WA
  dinormalisasi (`0812...`, `+62 812...` menjadi `62812...`), area harus salah satu dari "Area layanan"
  di pengaturan, dan satu nomor dibatasi 5 pesanan per jam.
- Pelanggan tidak bisa membaca atau menulis tabel `orders` langsung, hanya lewat fungsi `create_order`.

### Rekap otomatis lewat bot (opsional, misalnya OpenClaw)

Bot membaca ringkasan lewat fungsi `bot_recap` yang **read-only** dan dilindungi token rahasia. Bot tidak
memegang `service_role` key, tidak bisa mengubah data, tidak melihat catatan pelanggan, dan hanya
melihat 4 digit terakhir nomor WA. Nama pelanggan hanya ikut jika diminta eksplisit.

1. Pastikan `supabase/orders.sql` sudah dijalankan (bagian 3).
2. Buat token sekali di SQL Editor. Salin hasilnya, token tidak bisa ditampilkan lagi:
   ```sql
   with t as (select replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '') as token),
        ins as (insert into bot_tokens (label, token_hash)
                select 'openclaw', sha256(convert_to(token, 'UTF8')) from t)
   select token from t;
   ```
   Mencabut token: `update bot_tokens set revoked = true where label = 'openclaw';`
3. Salin folder `openclaw-skill/jastip-recap` ke folder skill OpenClaw, lalu isi tiga variabel lingkungan
   untuk skill itu: `JASTIP_SUPABASE_URL`, `JASTIP_SUPABASE_ANON_KEY` (anon/publishable key), dan
   `JASTIP_BOT_TOKEN` (token dari langkah 2). Jangan menulis token di file `SKILL.md`.
4. Uji manual dari terminal: `./scripts/recap.sh` (hari ini), `./scripts/recap.sh 2026-12-01 7`.
5. Rekap harian otomatis, contoh (sesuaikan nomor, jam, dan opsi dengan versi OpenClaw Anda; cek
   `openclaw cron --help`):
   ```bash
   openclaw cron add --name "Rekap jastip" --cron "0 21 * * *" --tz "Asia/Jakarta" \
     --session isolated --announce --channel whatsapp --to "+62812xxxxxxxx" \
     --message "Pakai skill jastip-recap: rekap pesanan hari ini. Sebut jumlah pesanan aktif, omzet, daftar belanja, dan pesanan berstatus baru yang perlu dikonfirmasi."
   ```

Keamanan bot: batasi bot hanya untuk nomor admin (`dmPolicy: "allowlist"`), jangan beri akses shell atau email
pada agen yang membaca data pelanggan, dan jangan membuka bot untuk chat dari pelanggan umum.

### Catatan pengujian
SQL (`orders.sql`) diuji di PostgreSQL 16 dengan peran `anon`/`authenticated` ala Supabase, dan alur
situs + admin diuji di Chrome terhadap backend tiruan yang meneruskan ke database yang sama. Belum diuji
pada project Supabase sungguhan maupun instalasi OpenClaw: setelah menjalankan `orders.sql`, buat satu
pesanan percobaan dari situs dan cek di `/admin`.
