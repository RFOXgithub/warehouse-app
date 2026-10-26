# Spesifikasi Teknis: Warehouse Receiving System

## 1. Arsitektur Sistem

### 1.1 Gambaran

```mermaid
flowchart LR
    U[Browser] -->|HTTP :8080| N["frontend (Nginx)<br/>• file Vue hasil build<br/>• proxy /api → backend"]
    N -->|/api/*| B["backend (Next.js)<br/>Route Handlers"]
    B -->|SQL via pg| D[(PostgreSQL)]
```

| Komponen | Teknologi | Tanggung jawab |
|---|---|---|
| **frontend** | Vue 3, Vite, Vue Router, Tailwind CSS 4, disajikan oleh Nginx | Tampilan, form, validasi ringan untuk kenyamanan, menyimpan token, membuat idempotency key. **Tidak** menegakkan aturan bisnis. |
| **backend** | Next.js 15 atau lebih baru (App Router, **hanya** Route Handlers), Node.js 22 LTS | Autentikasi, otorisasi, validasi input, **semua aturan bisnis** (BR-10), transaksi database. |
| **database** | PostgreSQL 17 | Penyimpanan data dan constraint sebagai pengaman terakhir (NFR-03). |

**Kenapa frontend memanggil `/api` lewat Nginx?** Browser hanya berbicara ke satu alamat (`:8080`), jadi tidak perlu konfigurasi CORS. Saat development, peran ini digantikan oleh proxy Vite (`/api` → `localhost:3000`).

### 1.2 Library

| Library | Dipakai di | Kegunaan |
|---|---|---|
| `pg` | backend | Koneksi dan query PostgreSQL. **Tanpa ORM**, supaya SQL terlihat jelas dan mudah dijelaskan |
| `zod` | backend | Validasi isi request |
| `jose` | backend | Membuat dan memeriksa token JWT |
| `bcryptjs` | backend | Hash password |
| `vitest` | backend | Unit dan integration test |
| `ajv`, `ajv-formats`, `js-yaml` | backend (hanya test) | Test kontrak: mencocokkan response dengan skema di `openapi.yaml` (9.4) |
| `vue-router` | frontend | Navigasi antar halaman |
| `@playwright/test` | root | End-to-end test |

Semua kode memakai **JavaScript** (ES Modules). Versi persis dikunci di `package-lock.json`.

### 1.3 Struktur folder

```
/
├─ docs/                         ← dokumen ini, PRD, ERD, OpenAPI, dll.
├─ backend/
│  ├─ app/api/                   ← Route Handlers (lapisan HTTP)
│  │  ├─ health/route.js
│  │  ├─ auth/login/route.js
│  │  ├─ auth/me/route.js
│  │  ├─ products/route.js
│  │  ├─ receiving-documents/route.js
│  │  ├─ receiving-documents/[id]/route.js
│  │  ├─ receiving-documents/[id]/items/route.js
│  │  ├─ receiving-documents/[id]/items/[itemId]/route.js
│  │  ├─ receiving-documents/[id]/submit/route.js
│  │  ├─ receiving-documents/[id]/receipts/route.js
│  │  ├─ receiving-documents/[id]/complete/route.js
│  │  ├─ receiving-documents/[id]/cancel/route.js
│  │  ├─ inventory/route.js
│  │  └─ inventory/transactions/route.js
│  ├─ src/
│  │  ├─ lib/config.js           ← baca & periksa environment variable (saat runtime)
│  │  ├─ lib/db.js               ← Pool koneksi, parser tipe, helper withTransaction()
│  │  ├─ lib/auth.js             ← buat/cek token, requireUser(request, roles)
│  │  ├─ lib/errors.js           ← class AppError + daftar kode error
│  │  ├─ lib/http.js             ← handle(): ubah hasil/error jadi JSON, baca pagination
│  │  ├─ validators/             ← skema zod per fitur
│  │  └─ services/               ← ATURAN BISNIS + query SQL
│  │     ├─ products.js
│  │     ├─ receiving-documents.js
│  │     ├─ receipts.js
│  │     └─ inventory.js
│  ├─ migrations/001_init.sql
│  ├─ scripts/migrate.js, seed.js
│  ├─ tests/
│  │  ├─ setup/                  ← env test & migrasi database test (9.2)
│  │  ├─ helpers/                ← reset data, buat token, panggil route, cek kontrak
│  │  ├─ unit/
│  │  └─ integration/
│  ├─ vitest.config.js
│  ├─ .env.example               ← contoh untuk development (10.4)
│  └─ Dockerfile
├─ frontend/
│  ├─ src/api/client.js          ← fetch + token + format error
│  ├─ src/composables/useAuth.js
│  ├─ src/router/index.js
│  ├─ src/views/                 ← 6 halaman (H1–H6 di PRD 5.3)
│  ├─ src/components/
│  ├─ nginx.conf
│  └─ Dockerfile
├─ e2e/                          ← test Playwright
├─ docker/db-init/01-create-test-db.sql  ← membuat database warehouse_test
├─ package.json                  ← hanya untuk Playwright (9.5)
├─ playwright.config.js
├─ docker-compose.yml
├─ .env.example
└─ README.md
```

### 1.4 Pembagian lapisan di backend

| Lapisan | Boleh | Tidak boleh |
|---|---|---|
| **Route Handler** (`app/api/**/route.js`) | Membaca request, memanggil `requireUser`, memvalidasi dengan zod, memanggil service, mengembalikan JSON | Menulis SQL, berisi aturan bisnis |
| **Service** (`src/services/*.js`) | Aturan bisnis, transaksi, query SQL, melempar `AppError` | Membaca `Request` atau tahu soal HTTP |
| **lib** (`src/lib/*.js`) | Kode bersama: koneksi DB, token, format error | Aturan bisnis |

Dengan pembagian ini, service bisa diuji tanpa HTTP, dan setiap aturan bisnis hanya ada di **satu tempat**.

### 1.5 Catatan khusus Next.js

Versi yang dipakai: **Next.js 16**. Aturan di bawah dicek terhadap dokumentasi bawaan di `backend/node_modules/next/dist/docs/`.

- **Cache Components dimatikan.** Template Next.js 16 mengaktifkan `cacheComponents: true` (dan `partialPrefetching: true`) di `next.config.mjs`; keduanya dihapus. Alasannya: dengan Cache Components, `next build` mencoba *prerender* handler `GET` yang tidak membaca data request, misalnya `/api/health`, yang berarti mencoba terhubung ke database saat build, padahal database belum ada di tahap build Docker. API ini tidak membutuhkan cache.
- **Tanpa Cache Components, route handler tidak di-cache** secara bawaan, jadi tidak perlu `export const dynamic = ...`.
- **Runtime bawaan sudah Node.js** (Edge runtime sudah *deprecated*), jadi tidak perlu `export const runtime = 'nodejs'`. `pg` butuh Node.js, dan itu sudah terpenuhi.
- `params` adalah Promise: `const { id } = await params`.
- Next.js tidak dipakai untuk halaman. Folder `app/` hanya berisi `api/` dan `layout.js` minimal (root layout tetap dibutuhkan untuk halaman 404 bawaan Next.js).
- `next dev` membuat `backend/AGENTS.md` (instruksi Next.js untuk AI agent). File ini dibuat ulang otomatis dan diabaikan oleh `.gitignore`.

## 2. ERD

Diagram di bawah adalah salinan [`erd.mmd`](erd.mmd); jika salah satu diubah, ubah keduanya. File `.mmd` tidak dirender oleh GitHub, sedangkan blok `mermaid` di file `.md` dirender.

Cara membaca: `||` tepat satu, `|o` nol atau satu, `|{` satu atau lebih, `o{` nol atau lebih. Label **(service)** berarti aturannya dijaga kode backend, bukan database (lihat 3.3).

```mermaid
erDiagram
    users {
        integer id PK
        varchar username UK
        varchar password_hash
        varchar full_name
        varchar role "OPERATOR | SUPERVISOR"
        timestamptz created_at
    }

    products {
        integer id PK
        varchar sku UK "selalu huruf besar"
        varchar name
        varchar unit
        integer created_by FK
        timestamptz created_at
    }

    receiving_documents {
        integer id PK
        varchar doc_number UK "RCV-YYYYMMDD-NNNNNN"
        varchar supplier_name
        date expected_date
        varchar notes
        varchar status "DRAFT | OPEN | IN_PROGRESS | COMPLETED | CANCELLED"
        integer created_by FK
        timestamptz created_at
        integer submitted_by FK "boleh kosong"
        timestamptz submitted_at
        integer completed_by FK "boleh kosong"
        timestamptz completed_at "wajib jika COMPLETED"
        integer cancelled_by FK "boleh kosong"
        timestamptz cancelled_at
        varchar cancel_reason "wajib jika CANCELLED"
        timestamptz updated_at
    }

    receiving_items {
        integer id PK
        integer document_id FK
        integer product_id FK
        integer expected_qty "1 - 1.000.000"
        integer received_qty "0 <= received_qty <= expected_qty"
        timestamptz created_at
        timestamptz updated_at
    }

    receipts {
        integer id PK
        varchar receipt_number UK "GR-YYYYMMDD-NNNNNN"
        integer document_id FK
        varchar idempotency_key UK
        char request_hash "SHA-256 isi request"
        varchar notes
        integer received_by FK
        timestamptz received_at
    }

    inventory_balances {
        integer product_id PK, FK
        integer on_hand_qty ">= 0"
        timestamptz updated_at
    }

    inventory_transactions {
        integer id PK
        integer product_id FK "harus sama dengan produk milik item"
        varchar type "RECEIPT"
        integer quantity "> 0"
        integer balance_after ">= 0"
        integer receipt_id FK
        integer receiving_item_id FK "FK komposit bersama product_id"
        integer created_by FK
        timestamptz created_at
    }

    users ||--o{ products : "created_by"
    users ||--o{ receiving_documents : "created_by"
    users |o--o{ receiving_documents : "submitted_by"
    users |o--o{ receiving_documents : "completed_by"
    users |o--o{ receiving_documents : "cancelled_by"
    users ||--o{ receipts : "received_by"
    users ||--o{ inventory_transactions : "created_by"

    receiving_documents ||--o{ receiving_items : "berisi"
    products ||--o{ receiving_items : "direncanakan di"

    receiving_documents ||--o{ receipts : "diterima lewat"
    receipts ||--|{ inventory_transactions : "berisi baris, min. 1 (service)"
    receiving_items ||--o{ inventory_transactions : "diterima lewat"

    products ||--|| inventory_balances : "punya stok, dibuat bersama (service)"
    products ||--o{ inventory_transactions : "riwayat stok"
```

| Relasi | Arti |
|---|---|
| Dokumen 1 — N Item | Satu dokumen berisi banyak produk yang direncanakan |
| Dokumen 1 — N Receipt | Satu dokumen bisa diterima dalam beberapa kedatangan |
| Receipt 1 — N Transaksi | Satu kedatangan berisi beberapa baris barang |
| Produk 1 — 1 Saldo | Setiap produk punya tepat satu baris stok |

**Kenapa tidak ada tabel `receipt_lines`?** Isinya akan sama persis dengan `inventory_transactions` (barang apa, berapa, dari receipt mana). Dua tabel berarti data ganda yang bisa tidak sinkron, jadi `inventory_transactions` sekaligus berperan sebagai baris receipt.

## 3. Desain Database

### 3.1 Konvensi

- Nama tabel dan kolom memakai `snake_case`, tabel dalam bentuk jamak.
- Primary key memakai `integer GENERATED ALWAYS AS IDENTITY`. Dipilih `integer`, bukan `bigint`, karena `pg` mengembalikan `bigint` sebagai string (lihat juga 3.6 untuk `COUNT`/`SUM`).
- Waktu memakai `timestamptz` (disimpan UTC) dan ditampilkan dalam WIB oleh frontend (NFR-07).
- Jumlah barang memakai `integer` (PRD A2).
- Data tidak pernah dihapus, kecuali item saat dokumen masih DRAFT.

### 3.2 DDL (isi `migrations/001_init.sql`)

```sql
-- ===== Pengguna =====
CREATE TABLE users (
  id            integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  username      varchar(50)  NOT NULL UNIQUE,
  password_hash varchar(100) NOT NULL,
  full_name     varchar(100) NOT NULL,
  role          varchar(20)  NOT NULL CHECK (role IN ('OPERATOR', 'SUPERVISOR')),
  created_at    timestamptz  NOT NULL DEFAULT now()
);

-- ===== Produk =====
CREATE TABLE products (
  id         integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  sku        varchar(50)  NOT NULL UNIQUE CHECK (sku = upper(sku)),   -- FR-12
  name       varchar(150) NOT NULL,
  unit       varchar(20)  NOT NULL,
  created_by integer      NOT NULL REFERENCES users(id),
  created_at timestamptz  NOT NULL DEFAULT now()
);

-- ===== Dokumen penerimaan =====
CREATE SEQUENCE receiving_document_number_seq;

CREATE TABLE receiving_documents (
  id            integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  doc_number    varchar(30)  NOT NULL UNIQUE,                         -- FR-24
  supplier_name varchar(150) NOT NULL,
  expected_date date         NOT NULL,
  notes         varchar(500),
  status        varchar(20)  NOT NULL DEFAULT 'DRAFT'
                CHECK (status IN ('DRAFT', 'OPEN', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED')),
  created_by    integer      NOT NULL REFERENCES users(id),
  created_at    timestamptz  NOT NULL DEFAULT now(),
  submitted_by  integer REFERENCES users(id),
  submitted_at  timestamptz,
  completed_by  integer REFERENCES users(id),
  completed_at  timestamptz,
  cancelled_by  integer REFERENCES users(id),
  cancelled_at  timestamptz,
  cancel_reason varchar(500),
  updated_at    timestamptz  NOT NULL DEFAULT now(),
  CONSTRAINT chk_completed_has_time CHECK (status <> 'COMPLETED' OR completed_at IS NOT NULL),
  CONSTRAINT chk_cancelled_has_reason CHECK (status <> 'CANCELLED' OR cancel_reason IS NOT NULL)
);
CREATE INDEX idx_receiving_documents_created ON receiving_documents (created_at DESC, id DESC);
CREATE INDEX idx_receiving_documents_status  ON receiving_documents (status, created_at DESC);

CREATE TABLE receiving_items (
  id           integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  document_id  integer     NOT NULL REFERENCES receiving_documents(id),
  product_id   integer     NOT NULL REFERENCES products(id),
  expected_qty integer     NOT NULL CHECK (expected_qty BETWEEN 1 AND 1000000),
  received_qty integer     NOT NULL DEFAULT 0 CHECK (received_qty >= 0),
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_receiving_items_document_product UNIQUE (document_id, product_id),  -- BR-05
  CONSTRAINT uq_receiving_items_id_product UNIQUE (id, product_id),                  -- target FK komposit
  CONSTRAINT chk_received_not_exceed_expected CHECK (received_qty <= expected_qty)    -- BR-01
);
CREATE INDEX idx_receiving_items_product ON receiving_items (product_id);

-- ===== Receipt (satu kedatangan) =====
CREATE SEQUENCE receipt_number_seq;

CREATE TABLE receipts (
  id              integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  receipt_number  varchar(30)  NOT NULL UNIQUE,                       -- FR-31
  document_id     integer      NOT NULL REFERENCES receiving_documents(id),
  idempotency_key varchar(100) NOT NULL UNIQUE,                       -- BR-07
  request_hash    char(64)     NOT NULL,                              -- FR-33
  notes           varchar(500),
  received_by     integer      NOT NULL REFERENCES users(id),
  received_at     timestamptz  NOT NULL DEFAULT now()
);
CREATE INDEX idx_receipts_document ON receipts (document_id);

-- ===== Stok =====
CREATE TABLE inventory_balances (
  product_id  integer     PRIMARY KEY REFERENCES products(id),
  on_hand_qty integer     NOT NULL DEFAULT 0 CHECK (on_hand_qty >= 0),  -- BR-09
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE inventory_transactions (
  id                integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  product_id        integer     NOT NULL REFERENCES products(id),
  type              varchar(20) NOT NULL CHECK (type IN ('RECEIPT')),
  quantity          integer     NOT NULL CHECK (quantity > 0),
  balance_after     integer     NOT NULL CHECK (balance_after >= 0),
  receipt_id        integer     NOT NULL REFERENCES receipts(id),
  receiving_item_id integer     NOT NULL,
  created_by        integer     NOT NULL REFERENCES users(id),
  created_at        timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_transactions_receipt_item UNIQUE (receipt_id, receiving_item_id),
  -- product_id wajib sama dengan produk milik item (lihat 3.3)
  CONSTRAINT fk_transactions_item_product FOREIGN KEY (receiving_item_id, product_id)
    REFERENCES receiving_items (id, product_id)
);
CREATE INDEX idx_transactions_created ON inventory_transactions (created_at DESC, id DESC);
CREATE INDEX idx_transactions_product ON inventory_transactions (product_id, created_at DESC);

-- Transaksi stok tidak boleh diubah atau dihapus (NFR-06)
CREATE FUNCTION forbid_transaction_change() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'inventory_transactions bersifat append-only';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_inventory_transactions_append_only
  BEFORE UPDATE OR DELETE ON inventory_transactions
  FOR EACH ROW EXECUTE FUNCTION forbid_transaction_change();
```

### 3.3 Constraint penting dan aturan yang dijaganya

| Constraint | Menjaga | Kapan berguna |
|---|---|---|
| `chk_received_not_exceed_expected` | BR-01 | Jika ada bug di service, database tetap menolak penerimaan berlebih |
| `uq_receiving_items_document_product` | BR-05 | Mencegah produk dobel di satu dokumen walau dua request datang bersamaan |
| `receipts.idempotency_key UNIQUE` | BR-07 | Pengaman terakhir untuk request ganda |
| `inventory_balances.on_hand_qty >= 0` | BR-09 | Stok tidak pernah negatif |
| `products.sku UNIQUE` + `CHECK (sku = upper(sku))` | FR-12 | SKU unik tanpa membedakan huruf besar/kecil |
| Trigger append-only | NFR-06 | Riwayat stok tidak bisa dimanipulasi |
| `fk_transactions_item_product` (FK komposit) | BR-09 | Mencegah transaksi yang `product_id`-nya berbeda dengan produk milik item. Contoh: item Ayam Fillet tercatat menambah stok Udang |
| `chk_completed_has_time`, `chk_cancelled_has_reason` | FR-27, FR-28 | Dokumen COMPLETED pasti punya waktu selesai; CANCELLED pasti punya alasan |

**Kenapa `product_id` disimpan ulang di `inventory_transactions`?** Produknya sebenarnya bisa diketahui lewat `receiving_item_id`. Kolom ini sengaja disimpan ulang (denormalisasi) supaya riwayat per produk bisa difilter langsung dengan index `idx_transactions_product`, tanpa `JOIN`. Risikonya, nilainya bisa tidak cocok dengan item. Karena itu FK komposit di atas mewajibkan pasangan `(receiving_item_id, product_id)` benar-benar ada di `receiving_items`.

**Aturan yang dijaga service, bukan database:**

| Aturan | Kenapa tidak di database | Penjaganya |
|---|---|---|
| Receipt dan item di satu baris transaksi harus milik **dokumen yang sama** | Butuh kolom `document_id` tambahan di tabel transaksi dan FK komposit ganda; terlalu rumit untuk manfaatnya | Langkah 8 di 6.2 (`ITEM_NOT_IN_DOCUMENT`) + helper test `assertInventoryConsistent()` (9.2) |
| Setiap receipt punya **minimal 1** baris transaksi | Database tidak bisa mewajibkan "minimal satu baris anak" tanpa trigger yang rumit | Validasi `lines` minimal 1 (6.2 langkah 2), semua dalam satu transaksi |
| Setiap produk punya **tepat 1** baris saldo | Sama seperti di atas | Produk dan saldo dibuat dalam satu transaksi (3.4) |

### 3.4 Aturan data turunan

- **Baris `inventory_balances` dibuat bersamaan dengan produk**, dalam transaksi yang sama, dengan stok 0. Akibatnya, saat penerimaan cukup memakai `UPDATE`, dan halaman stok otomatis menampilkan produk berstok 0 (FR-40).
- **Penomoran** dibuat di SQL saat `INSERT`:
  ```sql
  'RCV-' || to_char(now() AT TIME ZONE 'Asia/Jakarta', 'YYYYMMDD')
         || '-' || lpad(nextval('receiving_document_number_seq')::text, 6, '0')
  ```
  Receipt memakai pola yang sama dengan prefix `GR-` dan `receipt_number_seq`. Nomor bisa **melompat** (misalnya 000003 lalu 000005) jika ada transaksi yang dibatalkan, karena sequence tidak ikut di-rollback. Ini normal dan dicatat di keterbatasan.
- **`request_hash`** adalah SHA-256 dari JSON berikut, dengan `lines` diurutkan berdasarkan `item_id`:
  ```json
  { "document_id": 15, "notes": "Truk B 1234 XY", "lines": [[101, 60], [102, 50]] }
  ```
  Hash dihitung dari data **setelah** divalidasi dan dinormalisasi oleh zod:
  - `notes` dipangkas spasinya; jika kosong atau tidak dikirim, nilainya `null`. Jadi `"notes": ""`, `"notes": "  "`, dan tanpa `notes` menghasilkan hash yang sama.
  - `lines` diurutkan berdasarkan `item_id`, jadi urutan baris di request tidak memengaruhi hash.

  Data yang sama hasil normalisasi inilah yang disimpan ke database, sehingga hash selalu sesuai dengan isi receipt.

### 3.5 Strategi migrasi

- Migrasi berupa file SQL bernomor di `backend/migrations/`: `001_init.sql`, `002_...sql`, dan seterusnya. File yang sudah dijalankan **tidak boleh diubah**; perubahan selalu dibuat di file baru.
- `scripts/migrate.js`:
  1. Membuat tabel `schema_migrations (version varchar PRIMARY KEY, applied_at timestamptz)` jika belum ada.
  2. Mengambil *advisory lock* (`pg_advisory_lock`), supaya dua container yang start bersamaan tidak menjalankan migrasi dua kali.
  3. Menjalankan setiap file yang belum tercatat, masing-masing dalam **satu transaksi**, lalu mencatatnya.
  4. Aman dijalankan berulang kali: file yang sudah tercatat dilewati (NFR-10).
- `scripts/seed.js` (FR-03) membuat supervisor `supervisor1`, operator `operator1`, lalu 3 produk contoh (dengan `created_by` = supervisor, beserta baris saldonya). Aturannya:
  - Memakai `ON CONFLICT DO NOTHING`, jadi aman dijalankan ulang.
  - Password diambil dari `SEED_SUPERVISOR_PASSWORD` dan `SEED_OPERATOR_PASSWORD`, tidak pernah ditulis di kode.
  - Jika salah satunya kosong atau kurang dari 8 karakter, seed **berhenti dengan pesan error yang jelas** (exit code 1), dan container tidak lanjut start.
  - User yang sudah ada tidak diubah. Mengganti password di `.env` setelah seed pertama tidak berpengaruh (dicatat di keterbatasan).
- Urutan saat container backend start: `migrate` → `seed` → `next start`.

### 3.6 Catatan library `pg`

Tiga jebakan yang wajib ditangani:

| Masalah | Akibat jika tidak ditangani | Penanganan |
|---|---|---|
| Kolom `date` diubah menjadi objek `Date` JavaScript pada jam 00:00 **waktu lokal** | Di komputer berzona WIB, `2026-10-27` terkirim sebagai `2026-10-26T17:00:00Z` (mundur satu hari) | Di `lib/db.js`: `types.setTypeParser(1082, (v) => v)`. Kolom `date` dikembalikan sebagai teks `YYYY-MM-DD` apa adanya |
| `COUNT(*)` dan `SUM(...)` menghasilkan `bigint`, yang dikembalikan `pg` sebagai **string** | `total` pagination dan progres menjadi `"110"`, bukan `110` (melanggar OpenAPI) | Selalu tulis `COUNT(*)::int` dan `COALESCE(SUM(...), 0)::int` |
| Input pencarian berisi `%` atau `_` | Karakter itu dianggap wildcard oleh `ILIKE`, jadi hasil pencarian salah | Escape `\`, `%`, `_` dengan backslash sebelum dipakai: `WHERE sku ILIKE $1 ESCAPE '\' OR name ILIKE $1 ESCAPE '\'` dengan `$1 = '%' + teksYangSudahDiEscape + '%'` |

## 4. Kontrak API

Spesifikasi lengkap (request, response, contoh) ada di [`openapi.yaml`](openapi.yaml) (NFR-12). Bagian ini merangkum aturannya.

### 4.1 Konvensi

| Hal | Aturan |
|---|---|
| Base path | `/api` |
| Format | JSON, `Content-Type: application/json` |
| Nama field | `snake_case`, sama dengan kolom database, jadi tidak perlu konversi |
| Autentikasi | Header `Authorization: Bearer <token>` |
| Pagination | Query `page` (default 1) dan `page_size` (default 20, maks 100). Nilai di luar batas → 400 (FR-04). Bersama index di 3.2, ini menjaga daftar tetap cepat untuk ±10.000 baris (NFR-08) |
| Respons satu data | `{ "data": { ... } }` |
| Respons daftar | `{ "data": [ ... ], "pagination": { "page", "page_size", "total", "total_pages" } }` |
| Respons error | `{ "error": { "code", "message", "details": [ ... ] } }`. `details` opsional; bentuknya tergantung `code` (4.3) |
| Tanggal | `expected_date` berformat `YYYY-MM-DD`; timestamp berformat ISO 8601 UTC |
| Field kosong di respons | Semua field di skema respons **selalu dikirim**. Yang belum ada nilainya dikirim sebagai `null` (misalnya `submitted_by` saat DRAFT), bukan dihilangkan |
| Teks di request | Dipangkas spasinya di awal/akhir **sebelum** divalidasi (`z.string().trim()`). `notes` yang kosong setelah dipangkas disimpan sebagai `null` |
| Field tidak dikenal | **Ditolak** dengan 400 `VALIDATION_ERROR` (skema zod memakai `.strict()`). Contoh: `{"expected_quantity": 10}` (salah ketik) langsung ketahuan, bukan diabaikan diam-diam |
| Parameter path | `{id}` dan `{itemId}` harus bilangan bulat positif (`z.coerce.number().int().positive()`). `abc`, `0`, `-5`, `1.5` → 400 `VALIDATION_ERROR` |
| `operationId` | Setiap endpoint punya nama unik di `openapi.yaml` (misalnya `createReceipt`). Nama fungsi di `frontend/src/api/client.js` memakai nama yang sama |

### 4.2 Daftar endpoint

| Method | Path | Fungsi | Role | Sukses | PRD |
|---|---|---|---|---|---|
| GET | `/api/health` | Cek aplikasi & database | Publik | 200 / 503 | FR-50 |
| POST | `/api/auth/login` | Login, dapat token | Publik | 200 | FR-01 |
| GET | `/api/auth/me` | Data user dari token | Semua | 200 | FR-01 |
| GET | `/api/products` | Daftar produk (`q` opsional) | Semua | 200 | FR-10, FR-11 |
| POST | `/api/products` | Tambah produk | Supervisor | 201 | FR-12 |
| GET | `/api/receiving-documents` | Daftar dokumen (`status` opsional) | Semua | 200 | FR-20–22 |
| POST | `/api/receiving-documents` | Buat dokumen | Semua | 201 | FR-23, FR-24 |
| GET | `/api/receiving-documents/{id}` | Detail + item + receipt | Semua | 200 | FR-25 |
| POST | `/api/receiving-documents/{id}/items` | Tambah item | Semua | 201 | FR-26 |
| PATCH | `/api/receiving-documents/{id}/items/{itemId}` | Ubah jumlah diharapkan | Semua | 200 | FR-26 |
| DELETE | `/api/receiving-documents/{id}/items/{itemId}` | Hapus item | Semua | 204 | FR-26 |
| POST | `/api/receiving-documents/{id}/submit` | DRAFT → OPEN | Semua | 200 | FR-27 |
| POST | `/api/receiving-documents/{id}/receipts` | **Catat penerimaan** | Semua | 201 / 200 | FR-30–33 |
| POST | `/api/receiving-documents/{id}/complete` | IN_PROGRESS → COMPLETED | Supervisor | 200 | FR-27 |
| POST | `/api/receiving-documents/{id}/cancel` | DRAFT/OPEN → CANCELLED | Supervisor | 200 | FR-28 |
| GET | `/api/inventory` | Daftar stok | Semua | 200 | FR-40 |
| GET | `/api/inventory/transactions` | Riwayat (`product_id` opsional) | Semua | 200 | FR-41, FR-42 |

Endpoint `receipts` mengembalikan **201** untuk receipt baru, atau **200** dengan header `Idempotent-Replayed: true` jika receipt lama dikembalikan (FR-33).

### 4.3 Kode error

| HTTP | `code` | Kapan |
|---|---|---|
| 400 | `VALIDATION_ERROR` | Isi request, query, header, atau parameter path tidak sesuai skema, termasuk field yang tidak dikenal. `details` berisi field yang salah |
| 401 | `UNAUTHENTICATED` | Token tidak ada, tidak valid, atau kedaluwarsa |
| 401 | `INVALID_CREDENTIALS` | Username atau password salah |
| 403 | `FORBIDDEN` | Role tidak diizinkan |
| 404 | `DOCUMENT_NOT_FOUND` | `{id}` tidak ada |
| 404 | `ITEM_NOT_FOUND` | `{itemId}` tidak ada **di dokumen ini** |
| 409 | `SKU_ALREADY_EXISTS` | SKU sudah dipakai |
| 409 | `PRODUCT_ALREADY_IN_DOCUMENT` | Produk sudah ada di dokumen (BR-05) |
| 409 | `INVALID_DOCUMENT_STATUS` | Aksi tidak diizinkan pada status sekarang (BR-03) |
| 409 | `IDEMPOTENCY_KEY_CONFLICT` | Key sudah dipakai dengan isi berbeda (FR-33) |
| 422 | `PRODUCT_NOT_FOUND` | `product_id` di isi request tidak ada |
| 422 | `DOCUMENT_HAS_NO_ITEMS` | Submit tanpa item (BR-04) |
| 422 | `ITEM_NOT_IN_DOCUMENT` | `item_id` di baris penerimaan tidak ada atau milik dokumen lain |
| 422 | `QUANTITY_EXCEEDS_REMAINING` | Jumlah melebihi sisa (BR-01) |
| 422 | `DOCUMENT_NOT_FULLY_RECEIVED` | Complete padahal ada item yang belum penuh (BR-02) |
| 500 | `INTERNAL_ERROR` | Error tak terduga. Pesan umum saja; detail hanya di log server (NFR-05) |

**Urutan pengecekan** (jika satu request punya beberapa masalah, yang dilaporkan adalah yang pertama ditemukan):

```
401 (token) → 403 (role) → 400 (format) → 404 (data di URL) → 409 (status/bentrok) → 422 (aturan bisnis)
```

**Error per baris.** Untuk `QUANTITY_EXCEEDS_REMAINING` dan `ITEM_NOT_IN_DOCUMENT`, **semua** baris yang salah dilaporkan sekaligus di `details`, supaya operator bisa memperbaiki semuanya dalam satu kali:

```json
{
  "error": {
    "code": "QUANTITY_EXCEEDS_REMAINING",
    "message": "Jumlah yang diterima melebihi sisa pada 1 baris.",
    "details": [
      { "line": 1, "item_id": 103, "sku": "FZ-BKS-003", "remaining": 20, "requested": 25,
        "message": "Bakso Sapi: maksimal 20, diminta 25." }
    ]
  }
}
```

Jika `details` berisi kedua jenis error sekaligus, `code` yang dipakai adalah `ITEM_NOT_IN_DOCUMENT`.

**Bentuk `details` per kode error** (skema lengkap di `openapi.yaml`):

| `code` | Skema | Field |
|---|---|---|
| `VALIDATION_ERROR` | `FieldErrorDetail` | `field` (contoh `lines.0.quantity`), `message` |
| `QUANTITY_EXCEEDS_REMAINING` | `LineErrorDetail` | `line` (nomor baris di request, mulai 1), `item_id`, `sku`, `remaining`, `requested`, `message` |
| `ITEM_NOT_IN_DOCUMENT` | `LineErrorDetail` | `line`, `item_id`, `message` |
| `DOCUMENT_NOT_FULLY_RECEIVED` | `ItemShortageDetail` | `item_id`, `sku`, `expected_qty`, `received_qty`, `remaining_qty`, `message` |
| Kode lain | — | Tidak ada `details` |

## 5. Data Flow

Ada dua diagram yang saling melengkapi. Keduanya adalah salinan file di folder `docs/`; jika salah satu diubah, ubah keduanya. File `.mmd` tidak dirender oleh GitHub, sedangkan blok `mermaid` di file `.md` dirender.

| Diagram | File | Menjawab |
|---|---|---|
| **A. Komponen & jalur request** | [`data-flow.mmd`](data-flow.mmd) | Request berjalan lewat mana saja, dan di mana setiap pengecekan terjadi? |
| **B. Data per aksi** | [`data-flow-actions.mmd`](data-flow-actions.mmd) | Setiap aksi membaca dan menulis tabel apa saja? |

### 5.1 Diagram A — Komponen & jalur request

Cara membaca: garis penuh = request/data berjalan; garis putus = nilai kembali (hasil atau `AppError`) naik ke pemanggil; ①–⑦ = urutan pengecekan, sama dengan urutan kode error di 4.3.

```mermaid
flowchart TD
    subgraph BR [Browser]
        V[Halaman Vue<br/>H1–H6]
        C[api/client.js<br/>• tambah token Authorization<br/>• tambah Idempotency-Key<br/>• ubah error jadi code/message/details]
        LS[(localStorage<br/>token)]
    end

    subgraph FE [Container frontend · :8080]
        NG[Nginx]
        ST[/File statis Vue<br/>HTML · JS · CSS/]
    end

    DEV[Mode development:<br/>Vite :5173 menggantikan Nginx<br/>proxy /api → localhost:3000]

    subgraph BE [Container backend · :3000 internal]
        H["lib/http.js · handle()<br/>membungkus SETIAP route<br/>• hasil → JSON data<br/>• AppError → JSON error<br/>• error lain → 500"]
        RH[route.js<br/>① requireUser: cek tanda tangan JWT,<br/>tanpa query database → 401/403<br/>② validasi zod → 400]
        SV[service<br/>③ BEGIN + kunci dokumen FOR UPDATE → 404<br/>④ khusus penerimaan: cek Idempotency-Key<br/>→ 200 receipt lama / 409<br/>⑤ cek status → 409<br/>⑥ cek aturan bisnis → 422<br/>⑦ tulis data + COMMIT → 201 / 200]
    end

    subgraph DB [Container db · 127.0.0.1:5432]
        PG[(PostgreSQL<br/>detail tabel: Diagram B)]
    end

    V -->|1. buka aplikasi| NG
    NG -->|sajikan| ST
    ST -->|HTML · JS · CSS| V
    V -->|2. aksi pengguna| C
    C <-->|simpan saat login,<br/>baca setiap request| LS
    C -->|3. HTTP JSON /api/*| NG
    NG -->|proxy /api/*| H
    H -->|panggil| RH
    RH -->|panggil| SV
    SV <-->|SQL berparameter| PG
    SV -.->|hasil / AppError| RH
    RH -.->|hasil / AppError| H
    H -->|JSON data / error| NG
    NG -->|respons| C
    C -->|tampilkan data<br/>atau error per field/baris| V
    DEV -.-|menggantikan saat development| NG

    classDef note fill:#f1f5f9,stroke:#94a3b8,color:#334155,stroke-dasharray:4 3
    class DEV note
```

Hal yang perlu diperhatikan:
- **Pemuatan halaman (1):** browser mengambil file Vue dari Nginx satu kali. Setelah itu, perpindahan halaman terjadi di browser (Vue Router) tanpa memuat ulang dari server.
- **Login & token:** token disimpan di `localStorage` saat login, lalu dikirim di setiap request. Tabel `users` **hanya dibaca saat login**. Request berikutnya diperiksa dari tanda tangan JWT saja, tanpa query ke database (*stateless*, lihat 8.1).
- **`handle()` membungkus setiap route:** hasil sukses dan error sama-sama diubah menjadi JSON di satu tempat. `AppError` dari service naik lewat route handler, lalu diubah oleh `handle()` menjadi respons error dengan status yang sesuai. Error lain menjadi 500 dengan pesan umum.
- **Langkah ③–⑦** berlaku untuk aksi yang mengubah dokumen. Langkah ④ (cek `Idempotency-Key`) **khusus** untuk penerimaan. Untuk aksi baca (GET), service langsung menjalankan `SELECT`.
- **Mode development:** Vite (`:5173`) menggantikan Nginx dan meneruskan `/api` ke `localhost:3000` (10.4).

### 5.2 Diagram B — Data per aksi

Cara membaca: garis penuh = **menulis** (INSERT/UPDATE); garis putus = **membaca** (SELECT); kotak tebal = aksi inti; tabel kuning = tabel stok.

```mermaid
flowchart LR
    subgraph AKSI [Aksi]
        L([Login])
        P([Tambah produk<br/>1 transaksi])
        D([Buat dokumen · kelola item<br/>submit · complete · cancel<br/>1 transaksi + kunci dokumen])
        R([CATAT PENERIMAAN<br/>1 transaksi + kunci dokumen])
        V1([Lihat produk & dokumen])
        V2([Lihat stok & riwayat])
    end

    subgraph TABEL [Tabel PostgreSQL]
        users[(users)]
        products[(products)]
        docs[(receiving_documents)]
        items[(receiving_items)]
        receipts[(receipts)]
        bal[(inventory_balances)]
        trx[(inventory_transactions)]
    end

    L -.->|cek password| users

    P -->|produk baru| products
    P -->|baris stok 0| bal

    D -.->|produk ada?| products
    D -->|status, siapa, kapan| docs
    D -->|tambah/ubah/hapus item| items
    D -.->|complete: semua penuh?| items

    R -->|kunci; OPEN → IN_PROGRESS| docs
    R -.->|Idempotency-Key sudah ada?| receipts
    R -->|receipt baru| receipts
    R -.->|sisa cukup?| items
    R -->|received_qty + jumlah| items
    R -->|on_hand_qty + jumlah| bal
    R -->|1 baris per barang| trx

    V1 -.-> products
    V1 -.-> docs
    V1 -.-> items
    V1 -.-> receipts
    V1 -.->|nama user| users

    V2 -.-> bal
    V2 -.-> trx
    V2 -.-> products

    classDef stock fill:#fde68a,stroke:#b45309,color:#000
    classDef core stroke-width:3px,font-weight:bold
    class bal,trx stock
    class R core
```

Ringkasan tulisan per aksi:

| Aksi | Tabel yang ditulis | Transaksi |
|---|---|---|
| Login | — (hanya membaca `users`) | — |
| Tambah produk | `products`, `inventory_balances` (stok 0) | 1 transaksi |
| Buat dokumen / kelola item / submit / complete / cancel | `receiving_documents`, `receiving_items` | 1 transaksi + kunci dokumen |
| **Catat penerimaan** | `receipts`, `receiving_items.received_qty`, `inventory_balances.on_hand_qty`, `inventory_transactions`, dan `receiving_documents.status` (jika receipt pertama) | **1 transaksi** + kunci dokumen |
| Lihat data, health check | — | — |

Tidak ada jalan lain untuk mengubah stok (FR-43).

## 6. API Flow: Mencatat Penerimaan

Ini alur terpenting di sistem (US-05, US-06).

### 6.1 Request

```http
POST /api/receiving-documents/15/receipts
Authorization: Bearer eyJ...
Idempotency-Key: 7f3a2c1e-5b6d-4e8f-9a0b-1c2d3e4f5a6b
Content-Type: application/json

{
  "notes": "Truk B 1234 XY",
  "lines": [
    { "item_id": 101, "quantity": 60 },
    { "item_id": 102, "quantity": 50 }
  ]
}
```

### 6.2 Langkah pemrosesan

| No | Langkah | Gagal → |
|---|---|---|
| 1 | `requireUser`: token valid? | 401 |
| 2 | Validasi zod: `{id}` bilangan bulat positif, header `Idempotency-Key` (8–100 karakter), `lines` minimal 1, `item_id` tidak dobel, `quantity` bilangan bulat ≥ 1, `notes` ≤ 500, tidak ada field asing | 400 |
| 3 | Hitung `request_hash` (3.4) | — |
| 4 | `BEGIN` | — |
| 5 | `SELECT ... FROM receiving_documents WHERE id = $1 FOR UPDATE` → **mengunci dokumen** | 404 jika tidak ada |
| 6 | Cari receipt dengan `idempotency_key` ini. Jika ada: hash sama → `COMMIT`, kembalikan receipt lama (**200**); hash beda → 409 `IDEMPOTENCY_KEY_CONFLICT` | 409 |
| 7 | Status harus `OPEN` atau `IN_PROGRESS` | 409 |
| 8 | Ambil semua item dokumen. Untuk setiap baris: item harus ada di dokumen ini, dan `quantity ≤ expected_qty − received_qty`. Kumpulkan **semua** baris yang salah | 422 |
| 9 | `INSERT INTO receipts` (nomor `GR-...`, key, hash, notes, user) | — |
| 10 | Urutkan baris berdasarkan `product_id`, lalu untuk setiap baris: **(a)** `UPDATE receiving_items SET received_qty = received_qty + $q`, **(b)** `UPDATE inventory_balances SET on_hand_qty = on_hand_qty + $q ... RETURNING on_hand_qty`, **(c)** `INSERT INTO inventory_transactions (..., balance_after)` dengan nilai dari (b) | — |
| 11 | Jika status `OPEN` → `UPDATE ... SET status = 'IN_PROGRESS'` | — |
| 12 | `COMMIT` → **201** dengan data receipt | — |

Jika terjadi error apa pun di langkah 5–12 → `ROLLBACK`. Tidak ada data yang tersimpan sebagian (BR-06, NFR-01).

### 6.3 Kenapa setiap langkah diperlukan

**Langkah 5: kunci dokumen (`FOR UPDATE`) — BR-08, NFR-02.**
Tanpa kunci, dua request bisa membaca "sisa 40" di waktu yang sama, lalu keduanya menambah 30, sehingga totalnya menjadi 60 dan melebihi sisa. Dengan `FOR UPDATE`, request kedua **menunggu** sampai request pertama selesai, lalu membaca sisa yang sudah diperbarui (10) dan ditolak. Semua aksi yang mengubah dokumen (kelola item, submit, terima, complete, cancel) mengunci baris dokumen dengan cara yang sama, jadi complete juga tidak bisa "menyalip" penerimaan.

**Langkah 6 setelah langkah 5: cek idempotency setelah dokumen terkunci.**
Jika dua request dengan key yang sama datang bersamaan (klik dobel), yang kedua menunggu di langkah 5. Setelah yang pertama selesai, yang kedua menemukan key-nya di langkah 6 dan mengembalikan receipt yang sama. Pengecekan ini dilakukan **sebelum** cek status, supaya request ulang tetap berhasil walau dokumen sudah berubah status (FR-33). Sebagai pengaman terakhir, jika `INSERT` di langkah 9 tetap melanggar `UNIQUE` (kode PostgreSQL `23505`), transaksi di-rollback lalu langkah 6 diulang sekali.

**Langkah 10: urutkan berdasarkan `product_id`.**
Dua dokumen berbeda bisa berisi produk yang sama, sehingga keduanya mengunci baris `inventory_balances` yang sama. Jika urutan kuncinya berbeda (A lalu B vs B lalu A), terjadi *deadlock*. Dengan urutan yang selalu sama, deadlock tidak terjadi.

**Langkah 10b: `on_hand_qty = on_hand_qty + $q`, bukan menghitung di JavaScript.**
Penambahan dilakukan oleh database pada baris yang sudah terkunci, jadi tidak ada nilai lama yang ikut tertimpa. `RETURNING` memberikan `balance_after` yang tepat untuk riwayat.

**Isolation level:** `READ COMMITTED` (default PostgreSQL), ditambah kunci baris eksplisit di atas.

### 6.4 Diagram urutan

```mermaid
sequenceDiagram
    participant FE as Vue (frontend)
    participant RH as receipts/route.js
    participant SV as services/receipts.js
    participant DB as PostgreSQL

    FE->>RH: POST /receipts + Idempotency-Key
    RH->>RH: requireUser, validasi zod
    RH->>SV: createReceipt(documentId, input, key, user)
    SV->>DB: BEGIN
    SV->>DB: SELECT dokumen FOR UPDATE
    SV->>DB: SELECT receipt WHERE idempotency_key
    alt key sudah ada
        SV-->>RH: receipt lama (replayed) / 409
    else key baru
        SV->>DB: cek status & sisa setiap item
        SV->>DB: INSERT receipts
        loop setiap baris (urut product_id)
            SV->>DB: UPDATE receiving_items
            SV->>DB: UPDATE inventory_balances RETURNING
            SV->>DB: INSERT inventory_transactions
        end
        SV->>DB: UPDATE status → IN_PROGRESS (jika OPEN)
        SV->>DB: COMMIT
        SV-->>RH: receipt baru
    end
    RH-->>FE: 201 / 200 / error JSON
```

### 6.5 Alur aksi lain

Semua memakai pola yang sama: `BEGIN` → kunci dokumen `FOR UPDATE` → cek status → cek aturan → ubah → `COMMIT`.

| Aksi | Cek status (409) | Cek aturan (422) |
|---|---|---|
| Tambah item | `DRAFT` | Produk ada (`PRODUCT_NOT_FOUND`). Produk dobel → 409 dari `UNIQUE` |
| Ubah / hapus item | `DRAFT` | — (item bukan milik dokumen → 404) |
| Submit | `DRAFT` | Minimal 1 item (`DOCUMENT_HAS_NO_ITEMS`) |
| Complete | `IN_PROGRESS` | Semua `received_qty = expected_qty` (`DOCUMENT_NOT_FULLY_RECEIVED`, `details` berisi item yang kurang) |
| Cancel | `DRAFT` atau `OPEN` | — |

Tambah produk: `INSERT products` dan `INSERT inventory_balances` dalam satu transaksi. Pelanggaran `UNIQUE(sku)` (kode `23505`) diubah menjadi 409 `SKU_ALREADY_EXISTS`.

## 7. Transisi Status

```mermaid
stateDiagram-v2
    [*] --> DRAFT : buat dokumen
    DRAFT --> OPEN : submit (min. 1 item)
    DRAFT --> CANCELLED : cancel (Supervisor)
    OPEN --> IN_PROGRESS : receipt pertama (otomatis)
    OPEN --> CANCELLED : cancel (Supervisor)
    IN_PROGRESS --> COMPLETED : complete (Supervisor, semua item penuh)
    COMPLETED --> [*]
    CANCELLED --> [*]
```

Di kode, transisi ditulis sebagai satu objek di `services/receiving-documents.js`, supaya aturannya hanya ada di satu tempat:

```js
const ALLOWED = {
  submit:   ['DRAFT'],
  receive:  ['OPEN', 'IN_PROGRESS'],
  complete: ['IN_PROGRESS'],
  cancel:   ['DRAFT', 'OPEN'],
  editItem: ['DRAFT'],
};
```

| Transisi | Kolom yang diisi |
|---|---|
| → OPEN | `submitted_by`, `submitted_at` |
| → IN_PROGRESS | — (waktunya terlihat dari `received_at` receipt pertama) |
| → COMPLETED | `completed_by`, `completed_at` |
| → CANCELLED | `cancelled_by`, `cancelled_at`, `cancel_reason` |

Setiap transisi juga memperbarui `updated_at`.

## 8. Otorisasi

### 8.1 Mekanisme

- **Login:** `bcryptjs.compare` dengan `password_hash`. Gagal → 401 `INVALID_CREDENTIALS` dengan pesan yang sama, entah username atau password yang salah.
- **Token:** JWT HS256 dibuat dengan `jose`. Isi: `sub` (user id), `username`, `full_name`, `role`. Berlaku 8 jam (`JWT_EXPIRES_IN`), kunci dari `JWT_SECRET`.
- **Di setiap route (FR-02):** `const user = await requireUser(request, ['SUPERVISOR'])`. Fungsi ini melempar 401 jika token bermasalah, atau 403 jika role tidak ada di daftar. Tanpa daftar role berarti semua role yang login boleh.
- **Frontend:** token disimpan di `localStorage` dan dikirim di header `Authorization`. Respons 401 → token dihapus dan pengguna diarahkan ke halaman login. Tombol disembunyikan berdasarkan `role`, tapi itu hanya untuk kenyamanan.
- **Password** di-hash dengan bcrypt (cost 10). Semua query memakai parameter (`$1`, `$2`), tidak pernah menyambung string (NFR-04).

> **Trade-off:** token di `localStorage` bisa dicuri jika ada celah XSS. Alternatifnya cookie `httpOnly`, tapi butuh perlindungan CSRF dan menambah kompleksitas. Untuk aplikasi internal dalam scope tugas ini, `localStorage` dipilih dan dicatat di keterbatasan.

### 8.2 Matriks endpoint × role

| Endpoint | Publik | OPERATOR | SUPERVISOR |
|---|:---:|:---:|:---:|
| `GET /health`, `POST /auth/login` | ✅ | ✅ | ✅ |
| `GET /auth/me`, semua `GET` lainnya | ❌ | ✅ | ✅ |
| `POST /products` | ❌ | ❌ | ✅ |
| `POST /receiving-documents`, `.../items` (POST, PATCH, DELETE), `.../submit`, `.../receipts` | ❌ | ✅ | ✅ |
| `.../complete`, `.../cancel` | ❌ | ❌ | ✅ |

## 9. Strategi Testing

### 9.1 Jenis test

Strategi ini memenuhi NFR-11: setiap aturan bisnis BR-01 s.d. BR-09 dan setiap perpindahan status punya test otomatis (lihat 9.3).

| Jenis | Alat | Yang diuji | Database |
|---|---|---|---|
| **Unit** | Vitest | Fungsi murni: skema zod, pembuatan `request_hash`, pemeriksaan transisi status | Tidak perlu |
| **Integration** | Vitest | Fungsi `GET`/`POST` dari `route.js` dipanggil langsung dengan `new Request(...)`. Ini menguji HTTP, auth, validasi, service, dan SQL sekaligus, **tanpa** menyalakan server | PostgreSQL sungguhan, database terpisah `warehouse_test` |
| **End-to-end** | Playwright | Satu skenario utama lewat browser terhadap aplikasi yang berjalan di Docker | Database dari Docker Compose |

### 9.2 Aturan integration test

**Persiapan database test:**
- Database `warehouse_test` dibuat otomatis oleh `docker/db-init/01-create-test-db.sql` (`CREATE DATABASE warehouse_test;`), yang di-mount ke `/docker-entrypoint-initdb.d` container `db`.
- Script di folder itu **hanya berjalan saat volume database masih kosong**. Jika volume sudah ada sebelumnya, jalankan `docker compose down -v` sekali.
- Port database dibuka ke `127.0.0.1:5432` (10.2), jadi test yang berjalan di komputer Anda bisa terhubung.

**Konfigurasi Vitest (`vitest.config.js`):**
- Baris pertama: `process.loadEnvFile('.env.local')` (fitur bawaan Node.js 22) untuk memuat `TEST_DATABASE_URL`.
- `setupFiles: ['tests/setup/env.js']`: mengisi `process.env.DATABASE_URL` dengan nilai `TEST_DATABASE_URL`, dan mengisi `JWT_SECRET` dengan nilai khusus test. File ini berjalan **sebelum** file test meng-import kode backend, jadi koneksi otomatis mengarah ke database test.
- `globalSetup: 'tests/setup/global-setup.js'`: menjalankan migrasi ke `warehouse_test` satu kali sebelum semua test.
- `fileParallelism: false`: test berjalan berurutan karena semuanya memakai satu database.

**Setiap test:**
- Sebelum setiap test: `TRUNCATE ... RESTART IDENTITY CASCADE`, lalu isi data dasar (2 user, 3 produk) lewat helper. `TRUNCATE` tidak memicu trigger append-only, jadi aman dipakai.
- Route handler dipanggil langsung sebagai fungsi biasa. Contoh:

  ```js
  import { POST } from '../../app/api/receiving-documents/[id]/receipts/route.js';

  const res = await POST(
    new Request('http://test/api/receiving-documents/1/receipts', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${operatorToken}`,
        'Idempotency-Key': 'test-key-0001',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ lines: [{ item_id: 1, quantity: 60 }] }),
    }),
    { params: Promise.resolve({ id: '1' }) }   // params selalu Promise berisi string
  );
  expect(res.status).toBe(201);
  ```

  Helper `callRoute()` di `tests/helpers/` membungkus pola ini supaya test lebih ringkas.
- Untuk test bersamaan (`Promise.all`), dua pemanggilan memakai koneksi berbeda dari Pool (default maksimal 10 koneksi), jadi kunci baris benar-benar diuji.
- Helper `assertInventoryConsistent()` dipanggil di akhir setiap test penerimaan. Helper ini mengecek empat hal:
  1. Untuk setiap produk: `SUM(inventory_transactions.quantity) = inventory_balances.on_hand_qty` (BR-09).
  2. Untuk setiap item: `received_qty = SUM` transaksi untuk item itu.
  3. Untuk setiap item: `received_qty ≤ expected_qty`.
  4. Untuk setiap transaksi: dokumen milik receipt-nya sama dengan dokumen milik item-nya (aturan yang dijaga service, 3.3).

### 9.3 Daftar test wajib (ketertelusuran ke PRD)

| File test | Skenario | PRD |
|---|---|---|
| `receipts.test.js` | Penerimaan parsial lalu lanjutan; stok, sisa, transaksi, dan status benar; `assertInventoryConsistent()` lolos | US-05 AC1–2, BR-09 |
| | Melebihi sisa → 422, data tidak berubah | BR-01, US-05 AC3 |
| | Satu baris salah → semua ditolak | BR-06, US-05 AC4 |
| | Dokumen DRAFT/COMPLETED/CANCELLED → 409 | BR-03, US-05 AC5 |
| | Format salah → 400; item asing → 422 | US-05 AC6–7 |
| | **Dua request bersamaan** (`Promise.all`) Ayam 30 + 30 dengan sisa 40 → satu 201, satu 422, stok +30 | BR-08, US-05 AC8 |
| `idempotency.test.js` | Key sama + isi sama → 200, receipt sama, stok tidak bertambah | BR-07, US-06 AC1 |
| | Key sama + isi beda → 409; tanpa key → 400 | US-06 AC2–3 |
| | **Key sama dikirim bersamaan** → satu receipt saja | BR-07 |
| | Replay setelah dokumen COMPLETED → tetap 200 | FR-33 |
| `documents.test.js` | Buat, kelola item, produk dobel → 409, ubah item saat OPEN → 409 | US-03, BR-05 |
| | Submit tanpa item → 422; submit bukan DRAFT → 409 | BR-04, US-04 |
| | Complete belum penuh → 422; operator → 403; berhasil → COMPLETED | BR-02, US-07 |
| | Cancel DRAFT/OPEN berhasil; IN_PROGRESS → 409 | US-08 |
| `products.test.js` | Tambah, SKU huruf kecil → huruf besar, SKU dobel → 409, operator → 403 | US-02 |
| `auth.test.js` | Login benar/salah, tanpa token → 401, token kedaluwarsa → 401 | US-01 |
| `inventory.test.js` | Produk baru tampil stok 0; riwayat urut terbaru dan bisa difilter | US-09 |
| `health.test.js` | Database hidup → 200 | FR-50 |
| *(semua file integration)* | Setiap test memanggil route handler langsung, tanpa frontend. Semua penolakan di atas membuktikan backend menegakkan aturan sendiri | BR-10, US-05 AC9 |
| `e2e/receiving.spec.js` | Login operator → buat dokumen → tambah 2 item → submit → terima parsial → terima sisa → login supervisor → complete → cek stok | Alur utama |

Hasil test dan bukti stok tetap benar dirangkum di `docs/testing.md`.

### 9.4 Test kontrak OpenAPI (Sebaiknya)

Tujuannya membuktikan bahwa implementasi benar-benar mengikuti `openapi.yaml`, dan mendeteksi jika keduanya tidak lagi sinkron.

- Helper `expectMatchesSchema(body, 'NamaSkema')` di `tests/helpers/contract.js`:
  1. Membaca `docs/openapi.yaml` dengan `js-yaml` (satu kali, lalu disimpan).
  2. Mendaftarkan semua skema di `components.schemas` ke **Ajv 2020** (`ajv/dist/2020`). Skema OpenAPI 3.1 adalah JSON Schema 2020-12, jadi bisa dipakai langsung. Gunakan opsi `strict: false` agar kata kunci `example` tidak dianggap error, dan `ajv-formats` untuk `date` dan `date-time`.
  3. Menggagalkan test jika `body` tidak sesuai skema, dengan pesan field mana yang salah.
- Dipanggil di integration test untuk response utama: `Product`, `DocumentDetail`, `Receipt`, `Error`, serta daftar dengan `Pagination`.
- Skenario minimal: setiap endpoint dicek sekali untuk response sukses, ditambah satu response `Error`.

### 9.5 End-to-end test

- `package.json` di root proyek hanya berisi `@playwright/test` dan script `test:e2e`.
- `playwright.config.js` memakai `baseURL: 'http://localhost:8080'`. Test dijalankan terhadap aplikasi yang sudah berjalan lewat `docker compose up`, bukan menyalakan server sendiri.
- Login memakai user seed (`supervisor1`, `operator1`). Passwordnya dibaca dari `.env` di root lewat `process.loadEnvFile('.env')` di baris pertama `playwright.config.js`.
- Data yang dibuat test memakai nama supplier unik (misalnya berisi timestamp), supaya test bisa diulang tanpa reset database.

## 10. Konfigurasi & Deployment

### 10.1 Environment variable

Semua konfigurasi berasal dari environment variable. File `.env.example` (tanpa rahasia asli) masuk Git; file `.env` **tidak** (ada di `.gitignore`).

| Variabel | Dipakai | Contoh di `.env.example` |
|---|---|---|
| `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB` | db | `warehouse`, `ganti-password-ini`, `warehouse` |
| `DB_PORT` | db (port di komputer Anda) | `5432` |
| `DATABASE_URL` | backend | `postgres://warehouse:ganti-password-ini@db:5432/warehouse` |
| `JWT_SECRET` | backend | `ganti-dengan-string-acak-minimal-32-karakter` |
| `JWT_EXPIRES_IN` | backend | `8h` |
| `SEED_SUPERVISOR_PASSWORD`, `SEED_OPERATOR_PASSWORD` | backend (seed) | `ganti-password-ini` |
| `TEST_DATABASE_URL` | test (hanya di `backend/.env.local`, lihat 10.4) | `postgres://warehouse:...@localhost:5432/warehouse_test` |

**Pemeriksaan konfigurasi** dilakukan di `src/lib/config.js` lewat fungsi `getConfig()`:
- Memeriksa `DATABASE_URL` tidak kosong, dan `JWT_SECRET` tidak kosong serta minimal 32 karakter. Jika gagal, melempar error dengan pesan jelas.
- Hasilnya disimpan setelah pemeriksaan pertama, jadi hanya dicek sekali.
- **Dipanggil saat dibutuhkan** (saat membuat Pool atau token), bukan di level atas file. Alasannya, `next build` memuat semua file route saat build, ketika environment variable belum tersedia. Jika pemeriksaan ada di level atas file, build Docker akan gagal.
- `scripts/migrate.js` memanggil `getConfig()` paling awal. Karena migrasi berjalan sebelum `next start`, container yang salah konfigurasi tetap **gagal saat start** dengan pesan yang jelas.

### 10.2 Docker Compose

| Service | Image / build | Port | Catatan |
|---|---|---|---|
| `db` | `postgres:17-alpine` | `127.0.0.1:${DB_PORT}:5432` | Volume `pgdata`. Mount `./docker/db-init` ke `/docker-entrypoint-initdb.d`. Healthcheck `pg_isready`. Port hanya dibuka untuk komputer sendiri (`127.0.0.1`), tidak untuk jaringan |
| `backend` | `./backend` (multi-stage: install → `next build` → runtime) | (internal) `3000` | `depends_on: db (healthy)`. Perintah start: `node scripts/migrate.js && node scripts/seed.js && next start`. Healthcheck `wget -qO- http://localhost:3000/api/health` dengan `interval: 10s`, `retries: 5`, dan **`start_period: 30s`** (memberi waktu untuk migrasi dan seed) |
| `frontend` | `./frontend` (multi-stage: `vite build` → `nginx:alpine`) | `8080:80` | `depends_on: backend (healthy)`. `nginx.conf` meneruskan `/api/` ke `http://backend:3000` |

Menjalankan dari kondisi bersih (detail di `README.md`):

```bash
cp .env.example .env      # lalu isi password & JWT_SECRET
docker compose up --build
# buka http://localhost:8080
```

### 10.3 Health check

`GET /api/health` menjalankan `SELECT 1`:
- Berhasil → **200** `{ "status": "ok", "database": "ok" }`.
- Gagal → **503** `{ "status": "error", "database": "error" }`.

Endpoint ini tidak butuh token, dan dipakai oleh healthcheck Docker.

### 10.4 Alur development (tanpa build Docker)

Saat menulis kode, hanya database yang berjalan di Docker. Backend dan frontend dijalankan langsung supaya perubahan kode langsung terlihat.

| Langkah | Perintah | Hasil |
|---|---|---|
| 1. Database | `docker compose up -d db` | PostgreSQL di `localhost:5432`, beserta `warehouse_test` |
| 2. Backend | `cd backend` → `npm run migrate` → `npm run seed` → `npm run dev` | API di `http://localhost:3000/api` |
| 3. Frontend | `cd frontend` → `npm run dev` | Halaman di `http://localhost:5173`. Proxy Vite meneruskan `/api` ke `localhost:3000` |
| 4. Test backend | `cd backend` → `npm test` | Unit + integration test terhadap `warehouse_test` |
| 5. Uji versi Docker penuh | `docker compose up --build` | Aplikasi lengkap di `http://localhost:8080` |
| 6. Test E2E | `npm run test:e2e` (di root, saat langkah 5 berjalan) | Playwright menjalankan alur utama |

Saat development, backend membaca `backend/.env.local`:
- Dibuat dengan menyalin `backend/.env.example`. File `.env.local` **tidak** masuk Git.
- Isinya sama dengan `.env` di root, hanya `DATABASE_URL` mengarah ke `localhost` (bukan `db`), ditambah `TEST_DATABASE_URL`.
- `npm run dev` (Next.js) membacanya otomatis. Script `migrate` dan `seed` memuatnya dengan `node --env-file=.env.local`, dan Vitest dengan `process.loadEnvFile` (9.2).

## 11. Catatan Frontend

**Rute halaman** (Vue Router, sesuai PRD 5.3):

| Rute | Halaman | Akses |
|---|---|---|
| `/login` | H1 Login | Publik. Jika sudah login, diarahkan ke `/documents` |
| `/products` | H2 Produk | Login |
| `/documents` | H3 Daftar Dokumen (halaman awal setelah login) | Login |
| `/documents/:id` | H4 Detail Dokumen | Login |
| `/inventory` | H5 Stok | Login |
| `/inventory/transactions` | H6 Riwayat Transaksi | Login |
| `/` dan rute tidak dikenal | Diarahkan ke `/documents` | — |

*Navigation guard* di router memeriksa token sebelum membuka rute yang butuh login. Jika token tidak ada, pengguna diarahkan ke `/login`.

**Hal lain:**

- `api/client.js` adalah satu-satunya tempat yang memanggil `fetch`. Tugasnya: menambah token, mengubah respons error menjadi objek `{ code, message, details }`, dan menangani 401.
- **Idempotency key** dibuat sekali saat form penerimaan dibuka atau setelah penerimaan berhasil, lalu **dipakai ulang** jika pengguna menekan Konfirmasi lagi setelah error jaringan. Key baru hanya dibuat setelah sukses atau setelah pengguna mengubah isian.
- `crypto.randomUUID()` hanya tersedia di HTTPS atau `localhost`. Untuk akses lewat IP di jaringan lokal (HTTP), sediakan fungsi cadangan berbasis `crypto.getRandomValues()`.
- Tombol Konfirmasi dinonaktifkan selama request berjalan (US-06 AC4).
- Error dengan `details[].line` ditampilkan di baris tabel item yang bersangkutan, dan error validasi di bawah field-nya (NFR-09).
- Tanggal dan waktu ditampilkan dengan `Intl.DateTimeFormat('id-ID', { timeZone: 'Asia/Jakarta' })`.

## 12. Keputusan Teknis & Keterbatasan

| Keputusan | Alternatif | Alasan |
|---|---|---|
| SQL langsung dengan `pg` | ORM (Prisma, Sequelize) | SQL dan kunci baris (`FOR UPDATE`) terlihat jelas dan mudah dijelaskan saat review |
| Kunci baris dokumen (pessimistic lock) | Optimistic lock (kolom `version`) atau isolation `SERIALIZABLE` | Paling sederhana dan tidak perlu logika retry. Konflik jarang terjadi karena satu dokumen biasanya diproses satu tim |
| Nginx sebagai proxy `/api` | CORS di Next.js | Satu alamat untuk browser, tanpa konfigurasi CORS |
| `snake_case` di JSON | `camelCase` | Sama dengan kolom database, tidak perlu lapisan konversi |
| Next.js hanya API | Next.js juga untuk UI | Sesuai keputusan stack; frontend dan backend terpisah membuktikan backend menegakkan aturan sendiri |

**Keterbatasan yang diketahui:**
- Nomor dokumen dan receipt bisa melompat (sequence tidak di-rollback).
- Token di `localStorage` (lihat 8.1). Token tidak bisa dicabut sebelum kedaluwarsa; logout hanya menghapus token di browser.
- Tidak ada rate limiting pada login.
- Seed tidak mengubah user yang sudah ada. Mengganti password seed di `.env` butuh reset database (`docker compose down -v`).
- Database `warehouse_test` hanya dibuat otomatis pada volume baru (lihat 9.2).
- Satu baris saldo per produk bisa menjadi titik antre jika sangat banyak penerimaan bersamaan untuk produk yang sama. Ini tidak relevan pada skala gudang ini.
