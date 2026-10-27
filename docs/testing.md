# Testing & Quality Assurance

Dokumen ini merangkum **hasil** test. Strategi dan aturannya ada di technical-spec bagian 9.

## 1. Ringkasan

| Jenis | Alat | Jumlah | Hasil terakhir | Perintah |
|---|---|---|---|---|
| Unit | Vitest 5 | 4 | ✅ lolos | `cd backend && npm test` |
| Integration (route handler + PostgreSQL sungguhan) | Vitest 5 | 88 | ✅ lolos | `cd backend && npm test` |
| End-to-end (browser → nginx → API → database) | Playwright | 1 skenario, 7 langkah | ✅ lolos | `npm run test:e2e` (root) |
| Build produksi | `next build`, `vite build`, `docker compose up --build` | — | ✅ berhasil | — |

Hasil terakhir: 27 Oktober 2026, **92 dari 92** test backend lolos dalam ±40 detik.

Integration test memanggil fungsi `GET`/`POST` dari `route.js` secara langsung, tanpa frontend. Karena itu, setiap penolakan di bawah ini membuktikan bahwa **backend menegakkan aturan sendiri** (BR-10, US-05 AC9).

## 2. Cakupan per file

| File | Test | Yang diuji |
|---|---|---|
| `integration/receipts.test.js` | 21 | US-05 penerimaan: parsial, lanjutan, melebihi sisa, semua-atau-tidak, status salah, format salah (6 variasi), item asing, **dua penerimaan bersamaan**, **deadlock**, tanpa token. US-07 complete: berhasil, masih ada sisa, status salah, operator ditolak, dokumen yang sudah menerima barang tidak bisa dibatalkan |
| `integration/document-workflow.test.js` | 19 | US-03 kelola item saat DRAFT (tambah/ubah/hapus, produk dobel, jumlah tidak valid, 404), US-04 submit, US-08 cancel, BR-03 perubahan di status yang salah |
| `integration/documents.test.js` | 14 | Buat dokumen dan nomor `RCV-<tanggal WIB>-NNNNNN`, detail dengan sisa terhitung, validasi id path (5 variasi), daftar dengan filter status dan progres |
| `integration/products.test.js` | 10 | Daftar, pagination, pencarian tidak peka huruf besar/kecil, `%` dan `_` dicari sebagai teks biasa, SKU disimpan huruf besar, SKU dobel → 409, operator → 403 |
| `integration/idempotency.test.js` | 8 | US-06: request ulang, urutan baris berbeda dianggap sama, isi berbeda → 409, key di dokumen lain → 409, tanpa key → 400, **klik dobel bersamaan**, replay setelah dokumen COMPLETED |
| `integration/auth.test.js` | 8 | Login benar/salah (pesan sama untuk username tidak ada), body bukan JSON → 400, tanpa token, token palsu, token kedaluwarsa |
| `integration/inventory.test.js` | 7 | Daftar stok termasuk yang 0, stok setelah dua penerimaan, riwayat terbaru di atas, filter produk, tidak ada endpoint ubah stok manual |
| `integration/health.test.js` | 1 | `/api/health` → 200 tanpa token |
| `unit/receipt-hash.test.js` | 4 | `request_hash` untuk idempotency: urutan baris dan catatan kosong tidak mengubah hash; isi berbeda → hash berbeda |
| `e2e/receiving.spec.js` | 1 | Operator membuat dokumen → 2 item → submit → terima parsial → terima sisa → operator tidak melihat tombol Selesai → supervisor complete → stok bertambah tepat 10 dan 5 |

Setiap aturan bisnis dan perpindahan status punya test (NFR-11):

| Aturan | Test |
|---|---|
| BR-01 tidak melebihi sisa | `receipts` AC3, AC8 |
| BR-02 complete hanya jika penuh | `receipts` US-07 AC2 |
| BR-03 aksi sesuai status | `receipts` AC5, US-07 AC3, A7; `document-workflow` AC5, BR-03 |
| BR-04 submit butuh item | `document-workflow` US-04 AC2 |
| BR-05 produk tidak dobel | `document-workflow` US-03 AC3 |
| BR-06 semua-atau-tidak | `receipts` AC4 |
| BR-07 idempotency | `idempotency` (8 test) |
| BR-08 penerimaan bersamaan | `receipts` AC8, deadlock |
| BR-09 stok = total transaksi | `assertInventoryConsistent()` setelah setiap test penerimaan, idempotency, dan stok |
| DRAFT → OPEN → IN_PROGRESS → COMPLETED, DRAFT/OPEN → CANCELLED | `document-workflow`, `receipts`, E2E |

## 3. Bukti stok tetap benar setelah penerimaan

**a. Pemeriksaan otomatis setelah setiap test.** `receipts.test.js`, `idempotency.test.js`, dan `inventory.test.js` menjalankan `afterEach(assertInventoryConsistent)`. Helper ini memeriksa langsung di database:

1. Untuk setiap produk: `stok saat ini = SUM(quantity transaksi)` (BR-09).
2. Untuk setiap item: `received_qty = SUM(quantity transaksi item itu)`.
3. Untuk setiap item: `received_qty ≤ expected_qty`.
4. Tidak ada transaksi yang receipt-nya milik dokumen lain dari item-nya.

Jadi tidak hanya skenario yang diharapkan yang dicek. **Setiap** test yang ditolak (422, 409, 400) juga dibuktikan tidak meninggalkan perubahan stok.

**b. Angka eksplisit di test.** Contoh dari US-05:

| Langkah | Ayam (diharapkan 100) | Udang (50) | Bakso (20) | Stok Ayam |
|---|---|---|---|---|
| AC1: terima Ayam 60 + Udang 50 | sisa 40 | sisa 0 | sisa 20 | 60 |
| AC3: coba Ayam 41 → **422** | sisa 40 (tidak berubah) | | | 60 |
| AC4: coba Ayam 10 + Bakso 25 → **422** | sisa 40 (Ayam juga tidak berubah) | | sisa 20 | 60 |
| AC2: terima Ayam 40 + Bakso 20 | sisa 0 | | sisa 0 | 100 |

**c. E2E di aplikasi yang berjalan di Docker.** Test membaca stok dari halaman Stok sebelum dan sesudah alur, lalu memastikan selisihnya tepat +10 (Ayam) dan +5 (Udang). Test juga dibuktikan bisa gagal: jika harapan diubah menjadi +11, test gagal dengan `Expected: 41, Received: 40`.

## 4. Bukti operasi ganda atau tidak valid tidak merusak stok

| Ancaman | Perlindungan | Test |
|---|---|---|
| Tombol Konfirmasi diklik dua kali, atau jaringan putus lalu dikirim ulang | `Idempotency-Key` disimpan unik per receipt; request ulang dengan isi sama mengembalikan receipt lama (200) | `idempotency` AC1; **dua request dengan key sama dikirim bersamaan → hanya 1 receipt, stok bertambah sekali** |
| Key lama dipakai untuk isi berbeda | `request_hash` dibandingkan → 409 | `idempotency` AC2, key di dokumen lain |
| Dua operator menerima item yang sama bersamaan | `SELECT ... FOR UPDATE` pada dokumen: request kedua menunggu, lalu dicek terhadap sisa terbaru | `receipts` AC8: sisa 40, dua request Ayam 30 → satu 201, satu 422, stok +30 |
| Dua dokumen dengan produk sama diterima bersamaan | Baris diproses urut `product_id` | `receipts` deadlock |
| Satu baris salah di antara baris yang benar | Seluruh receipt dalam satu transaksi database | `receipts` AC4 |
| Data tidak valid (0, negatif, desimal, teks, item dobel, item asing) | Validasi zod `.strict()` + pemeriksaan service | `receipts` AC6 (6 variasi), AC7 |
| Bug di service yang lolos dari test | Lapisan terakhir di database: `CHECK (received_qty <= expected_qty)`, `CHECK (on_hand_qty >= 0)`, FK komposit item–produk, trigger yang menolak `UPDATE`/`DELETE` pada `inventory_transactions` | Terbukti saat uji mutasi (bagian 5) |

**Kenapa test konkurensi bisa dipercaya.** Versi awal test BR-08 memakai `Promise.all` dan tetap lolos walaupun `FOR UPDATE` dihapus. Request kedua kebetulan menunggu koneksi database baru, sehingga tidak pernah benar-benar bersamaan. Test lalu diganti dengan helper `runWhileDocumentsLocked()`:
- koneksi "penghalang" mengunci dokumen lebih dulu;
- semua request dijalankan dan dipastikan antre (`settledWhileLocked = 0`);
- kunci dilepas sekaligus.

## 5. Uji mutasi: memastikan test bisa gagal

Test yang selalu lolos tidak membuktikan apa-apa. Perlindungan penting dicabut sementara untuk melihat apakah test mendeteksinya:

| Perubahan sementara di kode | Test yang gagal | Pesan |
|---|---|---|
| Hapus `FOR UPDATE` saat mengunci dokumen | `receipts` AC8 | pelanggaran `chk_received_not_exceed_expected` |
| Hapus pengurutan baris berdasarkan `product_id` | `receipts` deadlock | `deadlock detected` |
| Pindahkan cek idempotency ke setelah cek status | `idempotency` replay setelah COMPLETED | 409 bukan 200 |
| Harapan stok E2E diubah dari +10 ke +11 | E2E langkah terakhir | `Expected: 41, Received: 40` |

Semua perubahan dikembalikan setelah dicoba.

## 6. Pemeriksaan manual di browser

Frontend tidak punya unit test. Setiap halaman diperiksa di browser sebelum kodenya di-commit:

| Halaman | Yang diperiksa |
|---|---|
| Login | Password salah, redirect ke halaman asal setelah login, sesi kedaluwarsa, token tidak valid → kembali ke login |
| Produk | Tambah produk, SKU dobel, pesan error di bawah field, menu tambah tersembunyi untuk operator, pencarian tidak tertukar saat mengetik cepat |
| Dokumen | Validasi supplier kosong, tambah/ubah/hapus item, produk yang sudah dipakai hilang dari pilihan, submit tanpa item ditolak, tombol per role, complete ditolak dengan daftar kekurangan, cancel dengan alasan |
| Penerimaan | Isian kosong, **retry setelah respons hilang memakai key yang sama** (stok bertambah sekali), error per baris, sisa basi setelah pengguna lain menerima lebih dulu, tombol nonaktif selama request |
| Docker | Refresh di `/documents/5` tetap tampil, cache `index.html` vs `/assets/`, restart backend tidak menggandakan seed, konfigurasi salah menghentikan container dengan pesan jelas |

Bug yang ditemukan dengan cara ini dan sudah diperbaiki: form pembatalan bisa terkirim dua kali lewat Enter, karena `disabled` hanya mengunci tombolnya (lihat `ai-workflow.md`).

## 7. Keterbatasan & isu yang belum selesai

**Perilaku bisnis yang belum didukung** (PRD bagian 11):
- **Supplier mengirim kurang** dan sisanya tidak akan datang (Q1): dokumen tertahan di IN_PROGRESS, karena tidak bisa complete (BR-02) maupun cancel. Usulan: status `CLOSED_SHORT` oleh supervisor dengan alasan.
- **Salah input jumlah** (Q2): tidak ada cara mengoreksi, karena transaksi stok append-only. Usulan: receipt pembalik (transaksi negatif) dengan persetujuan supervisor.
- Tidak ada lot/kedaluwarsa, multi-gudang, atau integrasi Purchase Order (Q4–Q6).

**Teknis** (technical-spec 12):
- Token disimpan di `localStorage` dan tidak bisa dicabut sebelum kedaluwarsa (8 jam); logout hanya menghapusnya di browser.
- Tidak ada rate limiting pada login.
- Nomor dokumen/receipt bisa melompat karena sequence PostgreSQL tidak di-rollback.
- Seed tidak mengubah user yang sudah ada; mengganti password seed butuh reset database.
- Pilihan produk di form item memuat maksimal 100 produk (batas `page_size` API).
- Image Docker backend sekitar 900 MB.

**Testing:**
- **Test kontrak OpenAPI (technical-spec 9.4, prioritas Sebaiknya) belum dibuat.** Kesesuaian respons dengan `openapi.yaml` saat ini dijaga oleh assertion bentuk respons di integration test dan pemeriksaan manual, belum oleh validasi skema otomatis.
- Frontend belum punya unit/component test; perilakunya diuji lewat E2E dan pemeriksaan manual.
- E2E baru mencakup satu alur utama; skenario penolakan diuji di integration test.

**Yang akan dikerjakan jika ada waktu tambahan**, berurutan:
1. Test kontrak OpenAPI dengan Ajv (9.4), supaya dokumen dan implementasi tidak bisa diam-diam berbeda.
2. Status `CLOSED_SHORT` dan receipt pembalik (Q1, Q2), setelah aturan bisnisnya disepakati dengan tim gudang.
3. E2E untuk penolakan utama (melebihi sisa, retry setelah error jaringan).
4. Rate limiting login dan pencabutan token.
