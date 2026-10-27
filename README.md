# Warehouse Receiving System

Aplikasi web untuk gudang: mencatat **rencana penerimaan barang**, mencatat **barang yang benar-benar datang** (boleh bertahap, beberapa truk), dan **memperbarui stok secara otomatis** beserta riwayat transaksinya.

Dikerjakan secara _specification-driven_ dengan AI coding agent. Dokumen di `docs/` adalah input utama implementasi, bukan prompt.

| Kebutuhan                                             | Di mana                                                                                                                                |
| ----------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| Apa & kenapa (aturan bisnis, user story)              | [`docs/prd.md`](docs/prd.md)                                                                                                           |
| Bagaimana (arsitektur, DDL, alur, otorisasi, testing) | [`docs/technical-spec.md`](docs/technical-spec.md)                                                                                     |
| Kontrak REST API                                      | [`docs/openapi.yaml`](docs/openapi.yaml)                                                                                               |
| Diagram ERD & data flow                               | [`docs/erd.mmd`](docs/erd.mmd), [`docs/data-flow.mmd`](docs/data-flow.mmd), [`docs/data-flow-actions.mmd`](docs/data-flow-actions.mmd) |
| Hasil test & bukti stok benar                         | [`docs/testing.md`](docs/testing.md)                                                                                                   |
| Cara kerja dengan AI agent                            | [`docs/ai-workflow.md`](docs/ai-workflow.md), instruksi agent di [`AGENTS.md`](AGENTS.md)                                              |

## Stack

| Bagian         | Teknologi                                                                  |
| -------------- | -------------------------------------------------------------------------- |
| Backend        | Next.js 16 (hanya Route Handlers sebagai REST API), JavaScript             |
| Database       | PostgreSQL 17, SQL langsung dengan `pg` (tanpa ORM)                        |
| Frontend       | Vue 3 + Vite + Vue Router + Tailwind CSS                                   |
| Validasi, auth | zod, JWT (`jose`), `bcryptjs`                                              |
| Test           | Vitest (unit + integration), Playwright (E2E)                              |
| Deployment     | Docker Compose: `db` (PostgreSQL), `backend` (Next.js), `frontend` (nginx) |

```
browser ──► nginx :8080 ──┬─ /        → file statis Vue
                          └─ /api/*   → backend :3000 ──► PostgreSQL
```

## Menjalankan dari kondisi bersih (Docker)

Yang dibutuhkan hanya **Docker** dengan **Docker Compose v2**.

1. Salin contoh konfigurasi lalu isi nilainya:

   ```bash
   cp .env.example .env
   ```

   | Variabel                                             | Isi                                                                           |
   | ---------------------------------------------------- | ----------------------------------------------------------------------------- |
   | `POSTGRES_PASSWORD`                                  | password database (bebas)                                                     |
   | `DATABASE_URL`                                       | samakan passwordnya dengan `POSTGRES_PASSWORD`; host tetap `db`               |
   | `JWT_SECRET`                                         | string acak **minimal 32 karakter**                                           |
   | `SEED_SUPERVISOR_PASSWORD`, `SEED_OPERATOR_PASSWORD` | password akun demo, minimal 8 karakter                                        |
   | `DB_PORT`                                            | port database di komputer Anda. Ganti jika 5432 sudah dipakai PostgreSQL lain |

2. Jalankan:

   ```bash
   docker compose up --build
   ```

   Urutan start dijaga oleh health check: `db` siap → `backend` menjalankan migrasi dan seed, lalu lolos `/api/health` → `frontend` naik.

3. Buka **http://localhost:8080** dan masuk dengan akun demo:

   | Username      | Role       | Password                         |
   | ------------- | ---------- | -------------------------------- |
   | `supervisor1` | Supervisor | nilai `SEED_SUPERVISOR_PASSWORD` |
   | `operator1`   | Operator   | nilai `SEED_OPERATOR_PASSWORD`   |

   Seed juga membuat 3 produk contoh: `FZ-CHK-001` Ayam Fillet, `FZ-SHR-002` Udang Kupas, `FZ-BKS-003` Bakso Sapi.

Cek kesiapan:

```bash
curl http://localhost:8080/api/health
# {"status":"ok","database":"ok"}
```

Menghentikan: `docker compose down`. Tambahkan `-v` **hanya** jika ingin menghapus semua data.

### Migrasi

- File migrasi ada di `backend/migrations/` dan dijalankan otomatis setiap kali container backend start (`scripts/migrate.js`).
- Migrasi yang sudah dijalankan dicatat di tabel `schema_migrations`, jadi aman dijalankan berulang. Advisory lock mencegah dua proses menjalankannya bersamaan.
- Perubahan skema selalu lewat **file migrasi baru**; file lama tidak diubah.
- Seed tidak menimpa user/produk yang sudah ada.

## Alur pemakaian singkat

1. **Operator** membuat dokumen penerimaan (supplier, tanggal rencana) → menambah item & jumlah yang diharapkan → **Ajukan** (DRAFT → OPEN).
2. Saat truk datang, operator mengisi kolom **Terima sekarang** untuk satu atau beberapa item → **Konfirmasi Penerimaan**. Stok langsung bertambah; status menjadi IN_PROGRESS.
3. Setelah semua item diterima penuh, **supervisor** menekan **Tandai Selesai** (IN_PROGRESS → COMPLETED).
4. Stok dan riwayat transaksi bisa dilihat di menu **Stok** dan **Riwayat Stok**.

Aturan yang ditegakkan **di backend** (tidak bergantung pada frontend):

- Jumlah diterima tidak boleh melebihi sisa (BR-01).
- Dokumen tidak bisa selesai jika masih ada item yang kurang (BR-02).
- Satu konfirmasi diproses semua-atau-tidak-sama-sekali (BR-06), dan konfirmasi ganda tidak menambah stok dua kali (idempotency key, BR-07).

Detail lengkap: PRD bagian 5–7.

## Development (tanpa build Docker)

Yang dibutuhkan: **Node.js ≥ 22.12** dan Docker (untuk database).

```bash
# 1. Database (juga membuat database warehouse_test untuk test)
docker compose up -d db

# 2. Backend → http://localhost:3000/api
cd backend
cp .env.example .env.local     # DATABASE_URL ke localhost:<DB_PORT>, tambah TEST_DATABASE_URL
npm install
npm run migrate
npm run seed
npm run dev

# 3. Frontend → http://localhost:5173 (proxy /api ke localhost:3000)
cd frontend
npm install
npm run dev
```

## Testing

| Jenis                        | Perintah                                                                         | Syarat                                                                   |
| ---------------------------- | -------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| Unit + integration (92 test) | `cd backend && npm test`                                                         | Container `db` berjalan; `backend/.env.local` berisi `TEST_DATABASE_URL` |
| Build backend                | `cd backend && npm run build`                                                    | —                                                                        |
| End-to-end (Playwright)      | `npm install` → `npx playwright install chromium` → `npm run test:e2e` (di root) | Aplikasi berjalan lewat `docker compose up` di port 8080                 |

- Integration test memakai PostgreSQL sungguhan di database terpisah `warehouse_test`. Ada pengaman: test berhenti jika nama database tidak berakhiran `_test`.
- E2E membaca password akun demo dari `.env` dan membuat dokumen dengan nama supplier unik, jadi bisa diulang tanpa reset database.

Hasil test, bukti stok tetap benar, dan daftar keterbatasan: [`docs/testing.md`](docs/testing.md).

## API

- Base URL: `/api` (lewat nginx: `http://localhost:8080/api`; development: `http://localhost:3000/api`).
- Semua endpoint selain `POST /auth/login` dan `GET /health` butuh header `Authorization: Bearer <token>`.
- `POST /receiving-documents/{id}/receipts` wajib membawa header `Idempotency-Key`.
- Kontrak lengkap (17 operasi, skema request/response, kode error): [`docs/openapi.yaml`](docs/openapi.yaml). Bisa dibuka di [Swagger Editor](https://editor.swagger.io/) atau ekstensi OpenAPI di VS Code.

Contoh:

```bash
TOKEN=$(curl -s -X POST http://localhost:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"operator1","password":"<SEED_OPERATOR_PASSWORD>"}' | jq -r .data.token)

curl -s http://localhost:8080/api/inventory -H "Authorization: Bearer $TOKEN"
```

## Struktur folder

```
docs/        PRD, technical spec, ERD, OpenAPI, data flow, testing, ai-workflow
backend/     Next.js API: app/api (route), src/services (aturan bisnis + SQL),
             src/lib, src/validators, migrations, scripts, tests
frontend/    Vue: src/api/client.js, views, components, composables, nginx.conf
e2e/         Test Playwright
docker/      Script inisialisasi database (membuat warehouse_test)
```

Penjelasan per lapisan: technical-spec 1.3–1.4.

## Masalah yang sering muncul

| Gejala                                                  | Penyebab & solusi                                                                                                                                                               |
| ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `password authentication failed` padahal password benar | `.env` tersimpan dengan akhir baris CRLF (Windows). Simpan ulang dengan LF, lalu `docker compose down -v` dan start ulang. `.gitattributes` sudah memaksa LF untuk file di repo |
| Port 5432 sudah dipakai                                 | Ada PostgreSQL lain di komputer. Ganti `DB_PORT` (misalnya `5433`) di `.env`, dan sesuaikan URL di `backend/.env.local`                                                         |
| `npm test` gagal karena `warehouse_test` tidak ada      | Script pembuat database hanya berjalan pada volume baru. Jalankan `docker compose down -v` sekali (menghapus data)                                                              |
| Container backend berhenti saat start                   | Baca `docker compose logs backend`. Konfigurasi yang salah ditolak dengan pesan jelas, misalnya `JWT_SECRET minimal 32 karakter`                                                |

## Keterbatasan

Ringkasannya: dokumen yang kurang kirim tidak bisa ditutup (PRD Q1), salah input tidak bisa dikoreksi (Q2), token tidak bisa dicabut sebelum kedaluwarsa, dan tidak ada rate limiting login. Daftar lengkap beserta rencana perbaikan ada di [`docs/testing.md`](docs/testing.md#7-keterbatasan--isu-yang-belum-selesai).
