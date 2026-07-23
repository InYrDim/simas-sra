# Production redeploy

Dokumen ini menjelaskan cara memperbarui SIMAS pada Docker Compose production dengan Cloudflare Tunnel.

## Prasyarat

- Docker Engine dan Docker Compose tersedia.
- Sudah login ke Docker Hub sebagai akun yang dapat push `iyedeh/simas-sra`.
- `monorepo/.env` berisi konfigurasi production.
- `monorepo/compose.cloudflare.yml` dan `monorepo/.env.cloudflare` sudah dibuat melalui `sh/prod.sh` jika Cloudflare Tunnel digunakan.
- Backup database dan volume file aplikasi sudah tersedia sebelum perubahan schema atau deployment berisiko.

Variabel penting dalam `monorepo/.env`:

```dotenv
DB_NAME=simas
DB_USER=replace-me
DB_PASSWORD=replace-me
DB_ROOT_PASSWORD=replace-me

APP_DOMAIN=simas.biz.id
BETTER_AUTH_SECRET=replace-with-a-long-random-secret
BETTER_AUTH_URL=https://simas.biz.id
BETTER_AUTH_TRUSTED_ORIGINS=https://simas.biz.id,https://*.simas.biz.id,http://localhost:3000,http://*.localhost:3000
PROTECTED_FILE_STORAGE_ROOT=/data/protected
```

Jangan commit `.env`, `.env.cloudflare`, token tunnel, atau secret production.

Untuk menjalankan seluruh alur redeploy secara interaktif dari root repository:

```bash
sh sh/redeploy-prod.sh
```

Script mendeteksi mode secara otomatis:

- **Fresh deploy:** jika tidak ada service Compose yang berjalan, backup dan `compose down` dilewati. Service MySQL dibuat terlebih dahulu oleh dependency migrator, ditunggu hingga sehat, lalu migration dan seluruh stack dijalankan.
- **Redeploy:** jika stack sudah berjalan, database dibackup sebelum migration, lalu stack lama dihentikan dan dibuat ulang.

Script membuat backup redeploy di direktori sibling `../simas-backups` secara default. Ubah lokasi dengan environment `SIMAS_BACKUP_DIR` bila diperlukan:

```bash
SIMAS_BACKUP_DIR=/var/backups/simas sh sh/redeploy-prod.sh
```

Production Compose tidak memublikasikan port aplikasi maupun MySQL ke host. Aplikasi hanya dapat dijangkau oleh `cloudflared` melalui `http://app:3000`, sedangkan database hanya dapat dijangkau service pada network `simas-production-net`.

## 1. Validasi sebelum deployment

Jalankan dari root repository:

```bash
sh sh/prod.sh
```

Script memeriksa file, environment, Docker daemon, dan konfigurasi Compose. Jawab sesuai kebutuhan ketika ditanya tentang Cloudflare Tunnel.

Validasi aplikasi:

```bash
pnpm --dir monorepo test
pnpm --dir monorepo typecheck
pnpm --dir monorepo build
```

## 2. Jalankan database migration

Migration harus berhasil sebelum container aplikasi baru diaktifkan. Gunakan image `iyedeh/simas-sra-migrate` melalui profile Compose `tools`; migrator berjalan satu kali pada network Docker internal tanpa memublikasikan port MySQL. Perintah lengkap dijalankan setelah image ditarik pada langkah 5.

Migration bersifat forward-only. Jangan menjalankan `db:push` sebagai pengganti migration pada database production.

Jika migration gagal:

1. Jangan recreate container aplikasi.
2. Simpan output error.
3. Periksa apakah database merupakan database kosong, database existing yang belum memiliki migration history, atau database yang hanya menerapkan sebagian migration.
4. Pulihkan backup hanya berdasarkan prosedur pemulihan yang sudah diuji; jangan menghapus tabel secara manual.

## 3. Build image

Dari root repository:

```bash
docker build \
  --file monorepo/Dockerfile \
  --target runner \
  --tag iyedeh/simas-sra:latest \
  monorepo

docker build \
  --file monorepo/Dockerfile \
  --target migrator \
  --tag iyedeh/simas-sra-migrate:latest \
  monorepo
```

`compose.prod.yml` hanya mendefinisikan `image`, bukan `build`. Karena itu, `docker compose up --build` tidak membangun ulang aplikasi.

## 4. Push ke Docker Hub

```bash
docker push iyedeh/simas-sra:latest
docker push iyedeh/simas-sra-migrate:latest
```

Catat digest yang dicetak oleh Docker setelah push. Digest diperlukan untuk audit dan rollback image.

Untuk deployment yang lebih kuat, gunakan tag immutable selain `latest`, misalnya:

```bash
docker tag iyedeh/simas-sra:latest iyedeh/simas-sra:2026.07.22-1
docker push iyedeh/simas-sra:2026.07.22-1
```

## 5. Pull dan recreate service

### Dengan Cloudflare Tunnel

Jalankan dari root repository:

```bash
docker compose \
  --env-file monorepo/.env \
  -f monorepo/compose.prod.yml \
  -f monorepo/compose.cloudflare.yml \
  --profile tools \
  pull app migrate
```

Jalankan migration satu kali. Hentikan deployment jika perintah ini gagal:

```bash
docker compose \
  --env-file monorepo/.env \
  -f monorepo/compose.prod.yml \
  -f monorepo/compose.cloudflare.yml \
  --profile tools \
  run --rm migrate
```

Kemudian recreate aplikasi dan tunnel bersama-sama:

```bash
docker compose \
  --env-file monorepo/.env \
  -f monorepo/compose.prod.yml \
  -f monorepo/compose.cloudflare.yml \
  up -d --force-recreate app cloudflared
```

Recreate bersama mencegah `cloudflared` mempertahankan kondisi DNS lama ketika container `app` diganti. Service URL Cloudflare harus menggunakan DNS service Compose:

```text
http://app:3000
```

### Tanpa Cloudflare Tunnel

```bash
docker compose \
  --env-file monorepo/.env \
  -f monorepo/compose.prod.yml \
  --profile tools \
  pull app migrate

docker compose \
  --env-file monorepo/.env \
  -f monorepo/compose.prod.yml \
  --profile tools \
  run --rm migrate

docker compose \
  --env-file monorepo/.env \
  -f monorepo/compose.prod.yml \
  up -d --force-recreate app
```

MySQL tidak perlu direcreate untuk deployment kode biasa.

## 6. Verifikasi deployment

Periksa status container:

```bash
docker compose \
  --env-file monorepo/.env \
  -f monorepo/compose.prod.yml \
  -f monorepo/compose.cloudflare.yml \
  ps
```

Periksa environment domain utama:

```bash
docker exec simas-sra-app printenv APP_DOMAIN
```

Hasil production yang diharapkan:

```text
simas.biz.id
```

Periksa log aplikasi dan tunnel:

```bash
docker logs --since 10m simas-sra-app
docker logs --since 10m simas-sra-cloudflared
```

Uji domain utama:

```bash
curl --fail --show-error --location https://simas.biz.id/
```

Uji bahwa endpoint registrasi tidak ditolak oleh routing host:

```bash
curl --include \
  --request POST \
  https://simas.biz.id/api/public-register \
  --header 'content-type: application/json' \
  --data '{}'
```

Respons yang diharapkan adalah `400` dengan `invalid-input`, bukan `404 not-found`. Jangan gunakan data registrasi valid untuk smoke test karena akan membuat akun.

Uji origin langsung dari network Docker jika tunnel bermasalah:

```bash
docker run --rm \
  --network simas-production-net \
  curlimages/curl:latest \
  --fail \
  http://app:3000/
```

Jika origin berhasil tetapi domain publik gagal, periksa konfigurasi dan log Cloudflare. Jika keduanya berhasil tetapi aplikasi mengembalikan 404, periksa `APP_DOMAIN` dan aturan host routing.

## 7. Kelola akun Provider Admin

Akun harus dibuat terlebih dahulu melalui halaman registrasi domain utama, misalnya:

```text
https://simas.biz.id/register
```

Kemudian promosikan akun tersebut dari root repository di VPS. Perintah ini berjalan sebagai container satu kali pada network internal `simas-production-net`, sehingga MySQL tidak perlu diekspos ke host:

```bash
docker compose \
  --env-file monorepo/.env \
  -f monorepo/compose.prod.yml \
  --profile tools \
  run --rm migrate \
  pnpm provider-admin:provision admin@simas.com
```

Jika menggunakan Cloudflare override, file tersebut boleh ikut disertakan agar perintah konsisten dengan stack yang sedang berjalan:

```bash
docker compose \
  --env-file monorepo/.env \
  -f monorepo/compose.prod.yml \
  -f monorepo/compose.cloudflare.yml \
  --profile tools \
  run --rm migrate \
  pnpm provider-admin:provision admin@simas.com
```

Respons berhasil berupa status `created` atau `already-provisioned`. Provisioning juga memverifikasi email secara otomatis, menghapus identitas Applicant dari akun tersebut, dan menolak akun yang sudah terikat ke Tenant.

Untuk mencabut akses Provider Admin tanpa menghapus akun:

```bash
docker compose \
  --env-file monorepo/.env \
  -f monorepo/compose.prod.yml \
  --profile tools \
  run --rm migrate \
  pnpm provider-admin:deprovision admin@simas.com
```

Pastikan image migrator terbaru sudah ditarik sebelum menjalankan perintah administrasi:

```bash
docker compose \
  --env-file monorepo/.env \
  -f monorepo/compose.prod.yml \
  --profile tools \
  pull migrate
```

Jangan mengubah `user.email_verified`, `user.tenant_id`, atau tabel `provider_admin` secara manual karena provisioning menjaga seluruh perubahan tersebut dalam satu transaksi.

## 8. Rollback image

Rollback kode dilakukan dengan menunjuk service `app` ke tag immutable atau digest image sebelumnya, kemudian recreate `app` dan `cloudflared`.

Contoh referensi digest:

```yaml
services:
  app:
    image: iyedeh/simas-sra@sha256:<previous-digest>
```

Setelah mengubah referensi image:

```bash
docker compose \
  --env-file monorepo/.env \
  -f monorepo/compose.prod.yml \
  -f monorepo/compose.cloudflare.yml \
  up -d --force-recreate app cloudflared
```

Rollback image tidak otomatis membatalkan migration database. Perubahan schema harus dirancang kompatibel dengan versi aplikasi lama atau dipulihkan melalui prosedur database yang terpisah dan telah diuji.

## Operasi Cloudflare Tunnel

Untuk menghapus tunnel tanpa menghentikan aplikasi dan MySQL:

```bash
sh sh/remove-cloudflare.sh
```

Script meminta konfirmasi, menghapus container `simas-sra-cloudflared`, serta membersihkan generated override dan file token.
