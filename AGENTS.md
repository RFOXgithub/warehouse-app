# AGENTS.md

Instruksi untuk AI coding agent yang bekerja di repository ini.

## Proyek

Warehouse Receiving System: aplikasi web untuk mencatat rencana penerimaan barang, mencatat barang yang datang (bisa bertahap), dan memperbarui stok secara otomatis. Dikerjakan secara **specification-driven**: dokumen di `docs/` adalah input utama, bukan prompt.

## Sumber kebenaran

Baca dokumen yang relevan **sebelum** menulis atau mengubah kode.

| Dokumen                               | Isi                                                                                        | Kapan dibaca        |
| ------------------------------------- | ------------------------------------------------------------------------------------------ | ------------------- |
| `docs/prd.md`                         | Apa & kenapa: aturan bisnis (BR-), kebutuhan (FR-), user story & acceptance criteria (US-) | Setiap fitur        |
| `docs/technical-spec.md`              | Bagaimana: arsitektur, DDL, alur penerimaan, otorisasi, testing, deployment                | Setiap fitur        |
| `docs/openapi.yaml`                   | Kontrak API: endpoint, skema request/response, kode error                                  | Setiap endpoint     |
| `docs/erd.mmd`, `docs/data-flow*.mmd` | Diagram                                                                                    | Jika perlu gambaran |

Aturan saat dokumen tidak cocok:

- **PRD menang** atas technical-spec, dan technical-spec menang atas kode. Jika menemukan konflik, berhenti dan laporkan; jangan memilih sendiri.
- Jika perilaku tidak dijelaskan di dokumen mana pun, **jangan menebak**. Tanyakan, atau usulkan perubahan dokumen lebih dulu.
- Jika implementasi mengubah perilaku, perbarui dokumen terkait di commit yang sama.

## Stack

- Backend: **Next.js 16** (App Router, **hanya** Route Handlers sebagai REST API) di `backend/`. Versi ini punya perubahan besar dibanding versi lama: cek dokumentasi bawaan di `backend/node_modules/next/dist/docs/` sebelum menulis kode Next.js. Cache Components dimatikan (technical-spec 1.5).
- Frontend: **Vue 3 + Vite + Vue Router + Tailwind CSS** di `frontend/`
- Database: **PostgreSQL**, diakses dengan `pg` (SQL langsung, **tanpa ORM**)
- Bahasa: **JavaScript** (ES Modules). Tidak memakai TypeScript.
- Library utama: `zod` (validasi), `jose` (JWT), `bcryptjs` (hash), `vitest` (test), `@playwright/test` (E2E)

Struktur folder lengkap: technical-spec 1.3.

## Aturan kode

**Pembagian lapisan backend** (technical-spec 1.4):

- `app/api/**/route.js`: baca request → `requireUser` → validasi zod → panggil service → kembalikan JSON. **Tanpa SQL, tanpa aturan bisnis.**
- `src/services/*.js`: aturan bisnis dan SQL. Tidak tahu soal `Request`/HTTP; melempar `AppError` untuk error.
- `src/lib/*.js`: kode bersama (db, auth, errors, http, config).

**Wajib:**

- Setiap aksi yang mengubah dokumen: `BEGIN` → `SELECT ... FOR UPDATE` dokumen → cek → ubah → `COMMIT` (technical-spec 6).
- Query selalu berparameter (`$1`, `$2`), tidak pernah menyambung string.
- Tangani jebakan `pg` di technical-spec 3.6: parser tipe `date`, `COUNT(*)::int` / `COALESCE(SUM(...), 0)::int`, escape `ILIKE`.
- Skema zod memakai `.strict()` dan `.trim()` untuk teks (technical-spec 4.1).
- Urutan pengecekan error: 401 → 403 → 400 → 404 → 409 → 422 (technical-spec 4.3).
- Response dan kode error harus sesuai `docs/openapi.yaml`.
- Konfigurasi hanya lewat environment variable, dibaca melalui `getConfig()` saat runtime, bukan di level atas file.

**Dilarang:**

- Menambah fitur di luar PRD. Kerjakan prioritas **Wajib** dulu, baru **Sebaiknya**.
- Mengubah file migrasi yang sudah pernah dijalankan; buat file migrasi baru.
- Menulis rahasia (password, `JWT_SECRET`) ke file yang masuk Git. Gunakan `.env` (di `.gitignore`) dan `.env.example`.
- Mengubah atau menghapus baris `inventory_transactions`.

**Penamaan:**

- Database & JSON API: `snake_case`. Variabel & fungsi JS: `camelCase`.
- Fungsi di `frontend/src/api/client.js` memakai `operationId` dari `openapi.yaml` (misalnya `createReceipt`).
- Teks yang tampil ke pengguna: Bahasa Indonesia.

## Testing

- Setiap aturan bisnis (BR-) dan perpindahan status punya test. Daftar test wajib: technical-spec 9.3.
- Integration test memakai PostgreSQL sungguhan (`warehouse_test`), memanggil route handler langsung.
- Test yang menyentuh stok memanggil `assertInventoryConsistent()` di akhir.
- Sebutkan kode PRD di nama `describe`/`it`, misalnya `it('BR-01: menolak jumlah melebihi sisa', ...)`.
- Setelah mengubah backend, jalankan **`npm test` dan `npm run build`**. Vitest tidak mendeteksi semua kesalahan yang ditolak Next.js: fungsi yang didefinisikan dua kali di satu file lolos test tetapi membuat build gagal dan semua route di file itu error 500.
- Test konkurensi harus dibuat pasti bertabrakan (`runWhileDocumentsLocked`), dan dibuktikan bisa gagal dengan mencabut perlindungannya sementara (technical-spec 9.2).

## Perintah

Detail: technical-spec 10.4.

```bash
docker compose up -d db                       # database untuk development & test
cd backend && npm run migrate && npm run seed # siapkan database
cd backend && npm run dev                     # API di http://localhost:3000/api
cd frontend && npm run dev                    # UI di http://localhost:5173
cd backend && npm test                        # unit + integration test
docker compose up --build                     # aplikasi lengkap di http://localhost:8080
npm run test:e2e                              # E2E (di root, saat Docker berjalan)
```

## Cara kolaborasi

- Developer **mengetik sendiri kode aplikasi** agar memahami setiap baris. Untuk kode aplikasi, agent menjelaskan dan menulis kodenya di chat, kecuali developer meminta agent menulis langsung ke file.
- Dokumen di `docs/` boleh ditulis atau diubah langsung oleh agent, lalu didiskusikan.
- Kerjakan per langkah kecil: jelaskan tujuan → kode → cara menjalankan/menguji → review.
- Commit hanya jika diminta. Format pesan: `jenis(lingkup): deskripsi` dalam Bahasa Indonesia, misalnya `feat(receipts): catat penerimaan batch dengan idempotency key`. Jenis: `feat`, `fix`, `test`, `docs`, `chore`, `refactor`.
