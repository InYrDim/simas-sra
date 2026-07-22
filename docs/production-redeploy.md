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
DB_PORT=3306

APP_DOMAIN=simas.biz.id
BETTER_AUTH_SECRET=replace-with-a-long-random-secret
BETTER_AUTH_URL=https://simas.biz.id
BETTER_AUTH_TRUSTED_ORIGINS=https://simas.biz.id,https://*.simas.biz.id,http://localhost:3000,http://*.localhost:3000
PROTECTED_FILE_STORAGE_ROOT=/data/protected
```

Jangan commit `.env`, `.env.cloudflare`, token tunnel, atau secret production.

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

Migration harus berhasil sebelum container aplikasi baru diaktifkan. Saat ini image aplikasi standalone tidak membawa `pnpm`, `drizzle-kit`, dan migration files, sehingga migration dijalankan dari checkout repository yang memiliki akses ke database production.

Pastikan `DATABASE_URL` menunjuk database production yang benar, lalu jalankan:

```bash
pnpm --dir monorepo db:migrate
```

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
  --tag iyedeh/simas-sra:latest \
  monorepo
```

`compose.prod.yml` hanya mendefinisikan `image`, bukan `build`. Karena itu, `docker compose up --build` tidak membangun ulang aplikasi.

## 4. Push ke Docker Hub

```bash
docker push iyedeh/simas-sra:latest
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
  pull app
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
  pull app

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
  --network simas-sra-production \
  curlimages/curl:latest \
  --fail \
  http://app:3000/
```

Jika origin berhasil tetapi domain publik gagal, periksa konfigurasi dan log Cloudflare. Jika keduanya berhasil tetapi aplikasi mengembalikan 404, periksa `APP_DOMAIN` dan aturan host routing.

## 7. Rollback image

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
