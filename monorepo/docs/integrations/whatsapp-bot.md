# WhatsApp Bot (OpenWA) — Integrasi

## Ringkasan

SIMAS terhubung ke instance OpenWA provider untuk mengotomasi kehadiran via
WhatsApp. Pembuatan *session* dilakukan oleh **Provider** di sisi OpenWA; tenant
tidak pernah memegang/mengetik kredensial. Tenant hanya menekan **Hubungkan**
(atau **Putuskan**), lalu SIMAS mendaftarkan webhook ke session OpenWA tenant.

Alur per tenant:

1. Provider membuat session WhatsApp di OpenWA untuk tenant tersebut.
2. Provider mengisi *OpenWA credentials* per tenant di halaman Provider
   (`Session Key` + `API Key`, serta base URL override opsional).
3. Tenant membuka halaman Integrasi → WhatsApp Bot → **Hubungkan**.
   SIMAS membaca session dari OpenWA, memeriksa statusnya (`ready`), membuat
   webhook, dan menyimpan koneksi lokal.
4. OpenWA mengirim `POST /api/integrations/whatsapp-bot/webhook` untuk setiap
   pesan masuk; SIMAS memverifikasi signature, menduplikasi idempotency, dan
   mencatat pesan sebagai acuan kehadiran.

## Variabel lingkungan

| Variabel | Wajib | Deskripsi |
| --- | --- | --- |
| `OPENWA_API_BASE_URL` | ya | Origin instance OpenWA tanpa trailing slash dan tanpa `/api` (contoh `https://openwa.example.com`). Menjadi default base URL untuk semua tenant; bisa di-override per tenant. |
| `OPENWA_CREDENTIALS_KEY` | ya | Kunci enkripsi API key per tenant. Hex 64 karakter atau base64 dari 32 byte. Hilangnya kunci = kredensial tidak bisa didekripsi; tidak ada fallback. |

`OPENWA_API_KEY` global **tidak digunakan** — API key selalu per tenant dan
dienkripsi saat disimpan. Webhook URL dibangun dari `APP_URL` /
`NEXT_PUBLIC_APP_URL` / domaain aplikasi (`readOpenWaWebhookUrl`).

## Penyimpanan kredensial

Tabel `tenant_openwa_credential` (satu baris per tenant):

- `tenant_id` — PK, FK ke `tenant`.
- `api_base_url` — override nullable; bentuk `origin` tanpa `/api`. Jika kosong
  dipakai `OPENWA_API_BASE_URL`.
- `api_key_ciphertext` — ciphertext AES-256-GCM hex (`SIMASSC1` + IV 12B + tag
  16B + payload). Enkripsi memakai AAD = `tenant_id`, sehingga ciphertext hanya
  valid untuk tenant tersebut. Lihat `lib/platform/secret-cipher.ts`.
- `session_key` — nama session di OpenWA (misal `HadirBot`), plaintext.

Siapa pun yang punya `OPENWA_CREDENTIALS_KEY` dapat menurunkan *semua* API key
tenant; kunci harus dijaga seperti secret root. Tidak ada server yang
menampilkan ulang API key setelah disimpan (form Provider menampilkannya
kembali).

## Flow Hubungkan / Putuskan

`connectWhatsAppBot(domain, tenantId)`:

1. `resolveTenantOpenWaCredential(tenantId)` — dekripsi API key; kegagalan
   dekripsi atau baris tidak ada → `unconfigured`.
2. `resolveSession` via OpenWA API dengan `apiKey`. Error network/auth =
   `openwa-unreachable`; session tak ditemukan = `session-not-found`;
   `session.status !== "ready"` juga `session-not-found` (tenant harus menunggu
   session *ready* di OpenWA).
3. Session sudah dipakai tenant lain → `session-in-use`.
4. Jika tenant sudah punya koneksi ke session lain, webhook lama dihapus.
5. `createWebhook(url, secret)` → simpan koneksi lokal (`tenant_id`,
   `openwa_session_id/name`, `openwa_webhook_id`, status, `bot_phone`,
   `bot_push_name`).

`disconnectWhatsAppBot(domain, tenantId)`: hapus webhook di OpenWA lalu hapus
baris lokal. Jika Provider sudah menghapus kredensial, webhook tidak bisa
dihapus dari OpenWA — baris lokal tetap dibuang.

Catatan: menghapus kredensial **tidak** menghapus webhook yang sudah terdaftar.
Provider harus melakukan **Putuskan** terlebih dahulu sebelum mengganti/menghapus
kredensial, agar webhook lama tidak terus mengirim event dengan session yang tak
tertanggung satu koneksi lokal.

## Keamanan webhook

- Postingan webhook memakai `X-OpenWA-Signature` (verify dengan HMAC dari
  `X-OpenWA-Idempotency-Key`); verifikasi selalu dilakukan, termasuk sebelum
  memeriksa idempotency.
- Pesan yang dikirim dari akun sendiri (`fromMe: true`) → `ignored-event`
  (diterima, tidak dicatat) demi menghindari loop.
- Event selain `message.received` → `ignored-event`; body kosong / tanpa header
  wajib → error 4xx; session tak dikenal / signature salah → `unauthorized`.
- `media.data` (byte mentah) dipisahkan dari metadata pesan agar tidak tersimpan.

### Otorisasi

- Akses halaman & aksi tenant: fitur `integrasi.whatsapp-bot` (parent
  `integrasi`) + operasi `integrasi.whatsapp-bot.update`.
- Penyimpanan/hapus kredensial (Provider): `requireProviderActionAccess`.
- Webhook route bersifat publik (harus bisa menerima dari OpenWA).

## Konvensi payload OpenWA (v0.23.4)

Versi ini menaruh `status`/`phone`/`pushName` di level atas DTO session
(warisan sebelumnya menaruhnya di `client`). `parseSession` membaca top-level
dengan fallback `client`. Chat id delivery: `data.chatId` (fallback
`data.from`); `fromWa` = `data.from`; `toWa` = `data.to`.