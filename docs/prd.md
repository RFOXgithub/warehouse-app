# PRD: Warehouse Receiving System

## 1. Latar Belakang & Tujuan

Gudang saat ini mencatat barang masuk di **spreadsheet**. Akibatnya:

- Angka stok bisa diubah siapa saja tanpa jejak.
- Tidak ada yang mencegah pencatatan barang melebihi pesanan.
- Sisa barang dari kiriman bertahap sulit dilacak.
- Asal-usul perubahan stok tidak bisa ditelusuri.
- Baris yang tersalin dua kali membuat stok lebih besar dari kenyataan.

**Solusi:** aplikasi web untuk mencatat rencana penerimaan, mencatat barang yang benar-benar datang, dan memperbarui stok secara otomatis dengan aturan yang tidak bisa dilanggar.

| No | Tujuan | Ukuran keberhasilan |
|---|---|---|
| T1 | Stok selalu sesuai barang yang diterima | Untuk setiap produk, total transaksi = stok tercatat |
| T2 | Penerimaan berlebih mustahil terjadi | 0 kasus `diterima > diharapkan`, dijaga backend dan database |
| T3 | Setiap perubahan stok bisa ditelusuri | 100% transaksi punya produk, jumlah, dokumen asal, user, dan waktu |
| T4 | Pencatatan lebih cepat | Satu kedatangan truk = satu kali konfirmasi |

## 2. Istilah

| Istilah | Arti |
|---|---|
| **SKU** | Kode unik produk, contoh `FZ-CHK-001` |
| **Dokumen penerimaan** | **Rencana** barang yang akan datang dari supplier. Contoh nomor `RCV-20261026-000001` |
| **Item** | Satu baris di dokumen: produk + **jumlah diharapkan** |
| **Jumlah diterima** | Total yang sudah benar-benar datang untuk item itu |
| **Sisa** | `jumlah diharapkan − jumlah diterima` |
| **Receipt** | Catatan **satu kali kedatangan** (misalnya satu truk). Satu dokumen bisa punya beberapa receipt. Contoh nomor `GR-20261026-000001` |
| **Transaksi stok** | Catatan riwayat setiap perubahan stok |
| **Idempotency key** | Kode unik yang dikirim bersama konfirmasi penerimaan agar request yang terkirim dua kali hanya diproses sekali |

## 3. Pengguna & Hak Akses

- **Operator** (`OPERATOR`): petugas lapangan yang membuat dokumen penerimaan, menghitung barang, dan mencatat penerimaan.
- **Supervisor** (`SUPERVISOR`): penanggung jawab gudang. Bisa semua yang dilakukan operator, ditambah mengelola produk dan menutup atau membatalkan dokumen.

| Aksi | Operator | Supervisor |
|---|:---:|:---:|
| Lihat produk, dokumen, stok, riwayat | ✅ | ✅ |
| Buat dokumen, kelola item (saat DRAFT), submit | ✅ | ✅ |
| Catat penerimaan | ✅ | ✅ |
| Tambah produk | ❌ | ✅ |
| Complete dokumen | ❌ | ✅ |
| Cancel dokumen | ❌ | ✅ |

> Hak akses diperiksa di **backend**. Menyembunyikan tombol di frontend hanya untuk kenyamanan.

## 4. Ruang Lingkup

**Termasuk:**
- Login dengan dua peran.
- Produk: lihat daftar dan tambah.
- Dokumen penerimaan: daftar, buat, detail, kelola item, submit, complete, cancel.
- Pencatatan penerimaan per kedatangan (batch), termasuk penerimaan parsial.
- Pembaruan stok otomatis, daftar stok, dan riwayat transaksi.
- Pencegahan request ganda.
- Health check.

**Tidak termasuk:**

| Fitur | Alasan |
|---|---|
| Ubah/hapus produk, manajemen user, master supplier | Tidak diminta. User dari data seed, supplier cukup teks |
| Barang keluar, penyesuaian stok, koreksi receipt | Fokus soal adalah penerimaan (lihat Q2) |
| Menutup dokumen dengan barang kurang | Bertentangan dengan aturan soal (lihat Q1) |
| Multi gudang, lokasi rak, lot/batch, kedaluwarsa, suhu | Kompleksitas besar, tidak diminta (lihat Q3–Q5) |
| Konversi satuan, integrasi PO, laporan/export, notifikasi, pencarian lanjutan | Tidak diminta |

## 5. Alur Kerja

### 5.1 Alur utama

```
1. Supervisor menambah produk (jika belum ada)
2. Operator membuat dokumen                       → DRAFT
3. Operator menambah item + jumlah diharapkan
4. Operator submit                                → OPEN (item terkunci)
5. Truk datang → operator menghitung per item,
   lalu menekan "Konfirmasi Penerimaan" sekali    → receipt dibuat, stok bertambah, IN_PROGRESS
6. Truk berikutnya → ulangi langkah 5 (bisa berkali-kali)
7. Semua item diterima penuh → Supervisor menekan "Complete" → COMPLETED
```

### 5.2 Status dokumen

```
          submit             receipt pertama            complete
 DRAFT ──────────► OPEN ──────────────────► IN_PROGRESS ──────────► COMPLETED
   │                 │                            │
   └──── cancel ─────┴──► CANCELLED               ✗ tidak bisa dibatalkan
```

| Status | Arti | Ubah item | Catat penerimaan | Bisa pindah ke |
|---|---|:---:|:---:|---|
| DRAFT | Menyusun rencana | ✅ | ❌ | **OPEN** lewat Submit (semua user, minimal 1 item) · **CANCELLED** (Supervisor) |
| OPEN | Menunggu barang | ❌ | ✅ | **IN_PROGRESS** otomatis saat receipt pertama · **CANCELLED** (Supervisor) |
| IN_PROGRESS | Barang sebagian/seluruhnya datang | ❌ | ✅ | **COMPLETED** (Supervisor, semua item penuh) |
| COMPLETED | Selesai | ❌ | ❌ | — (akhir) |
| CANCELLED | Dibatalkan | ❌ | ❌ | — (akhir) |

Perpindahan yang tidak ada di tabel ini **ditolak**. Jika fitur Cancel (Sebaiknya) belum dibuat, status CANCELLED tetap disiapkan di database.

### 5.3 Halaman

Semua halaman kecuali Login punya menu navigasi berisi nama, peran, dan tombol Logout.

| No | Halaman | Isi & aksi |
|---|---|---|
| H1 | Login | Form username dan password |
| H2 | Produk | Tabel produk. Tombol "Tambah Produk" (form/modal) hanya untuk Supervisor |
| H3 | Daftar Dokumen | Tabel dokumen. Tombol "Buat Dokumen" (form/modal); setelah tersimpan, langsung ke H4. Klik baris membuka H4 |
| H4 | Detail Dokumen | Data dokumen, tabel item (diharapkan, diterima, sisa), daftar receipt. Aksi sesuai status di bawah |
| H5 | Stok | Tabel stok per produk |
| H6 | Riwayat Transaksi | Tabel transaksi stok, terbaru di atas |

Aksi di H4:
- **DRAFT:** tambah, ubah, dan hapus item; tombol Submit; tombol Cancel (Supervisor).
- **OPEN / IN_PROGRESS:** kolom "Terima sekarang" pada item yang masih ada sisanya, kolom catatan, dan tombol Konfirmasi Penerimaan. Ditambah tombol Cancel (Supervisor, hanya saat OPEN) dan tombol Complete (Supervisor, hanya saat IN_PROGRESS).
- **COMPLETED / CANCELLED:** hanya lihat.

## 6. Kebutuhan Fungsional

Prioritas: **Wajib** = diminta soal atau inti sistem, dikerjakan lebih dulu. **Sebaiknya** = dikerjakan jika waktu cukup; jika tidak, dicatat sebagai keterbatasan.

| Kode | Kebutuhan | Prioritas |
|---|---|---|
| **Autentikasi** | | |
| FR-01 | Login dengan username dan password. Token berlaku **8 jam** (satu shift). Logout menghapus token dari browser. | Wajib |
| FR-02 | Semua fitur kecuali login dan health check membutuhkan token valid, dan peran diperiksa sesuai bagian 3. | Wajib |
| FR-03 | Akun awal dari data seed: minimal 1 operator dan 1 supervisor. | Wajib |
| **Umum** | | |
| FR-04 | Semua daftar memakai pagination: default 20, maksimal 100 per halaman. | Wajib |
| **Produk** | | |
| FR-10 | Daftar produk (SKU, nama, satuan), urut SKU. | Wajib |
| FR-11 | Pencarian produk berdasarkan SKU/nama (sebagian kata, huruf besar/kecil tidak berpengaruh). | Sebaiknya |
| FR-12 | Supervisor menambah produk (SKU, nama, satuan). SKU disimpan huruf besar dan unik. | Wajib |
| **Dokumen** | | |
| FR-20 | Daftar dokumen (nomor, supplier, tanggal rencana, status, jumlah item), terbaru di atas. | Wajib |
| FR-21 | Filter daftar dokumen berdasarkan status. | Sebaiknya |
| FR-22 | Progres di daftar dokumen: total diterima / total diharapkan, contoh `110 / 170`. | Sebaiknya |
| FR-23 | Buat dokumen (supplier, tanggal rencana, catatan opsional), status awal DRAFT. | Wajib |
| FR-24 | Nomor dokumen otomatis `RCV-YYYYMMDD-NNNNNN`: tanggal pembuatan menurut **WIB** + nomor urut 6 digit yang **tidak** diulang setiap hari. | Wajib |
| FR-25 | Detail dokumen: data dokumen, siapa & kapan setiap perubahan status, item (diharapkan, diterima, sisa), dan receipt beserta barisnya. | Wajib |
| FR-26 | Saat DRAFT: tambah item (produk + jumlah diharapkan), ubah jumlah, hapus item. | Wajib |
| FR-27 | Submit (DRAFT → OPEN) dan Complete (IN_PROGRESS → COMPLETED), mencatat siapa dan kapan. | Wajib |
| FR-28 | Cancel (DRAFT/OPEN → CANCELLED) dengan alasan wajib, mencatat siapa dan kapan. | Sebaiknya |
| **Penerimaan** | | |
| FR-30 | Pada dokumen OPEN/IN_PROGRESS, pengguna mengisi jumlah diterima untuk **satu atau beberapa item**, lalu mengonfirmasi **sekali**. Item yang kosong/0 tidak ikut dikirim. | Wajib |
| FR-31 | Satu konfirmasi = satu receipt bernomor `GR-YYYYMMDD-NNNNNN` (aturan sama dengan FR-24), berisi baris barang, penerima, waktu, dan catatan opsional (misalnya nomor polisi truk). | Wajib |
| FR-32 | Jika valid, sistem sekaligus: menambah jumlah diterima per item, menambah stok, mencatat transaksi per baris, dan mengubah OPEN → IN_PROGRESS pada receipt pertama. | Wajib |
| FR-33 | Konfirmasi membawa idempotency key. Key yang sama dengan isi sama → kembalikan receipt lama tanpa mengubah stok, **meskipun status dokumen sudah berubah**. Key sama dengan isi berbeda → ditolak. Isi dianggap sama jika dokumen, item, jumlah, dan catatannya sama persis. | Wajib |
| **Stok** | | |
| FR-40 | Daftar stok per produk (SKU, nama, satuan, stok, terakhir diperbarui), urut SKU. Produk yang belum pernah diterima tampil dengan stok 0. | Wajib |
| FR-41 | Riwayat transaksi (waktu, produk, jumlah, stok setelahnya, nomor receipt, nomor dokumen, user), terbaru di atas. | Wajib |
| FR-42 | Filter riwayat berdasarkan produk. | Sebaiknya |
| FR-43 | Stok tidak bisa diubah manual, hanya lewat penerimaan. | Wajib |
| **Operasional** | | |
| FR-50 | Health check yang menunjukkan aplikasi dan database berjalan normal. | Wajib |

## 7. Aturan Bisnis & Validasi

### 7.1 Aturan bisnis

| Kode | Aturan |
|---|---|
| **BR-01** | **Jumlah diterima tidak boleh melebihi sisa**: untuk setiap baris, `jumlah sekarang ≤ diharapkan − sudah diterima`. *(wajib dari soal)* |
| **BR-02** | **Dokumen tidak boleh di-complete jika masih ada item yang belum penuh.** *(wajib dari soal)* |
| BR-03 | Perubahan status, perubahan item, dan pencatatan penerimaan hanya boleh sesuai tabel status di 5.2. |
| BR-04 | Dokumen harus punya minimal 1 item untuk di-submit. |
| BR-05 | Satu produk hanya boleh muncul sekali dalam satu dokumen. |
| BR-06 | Satu konfirmasi penerimaan bersifat **semua-atau-tidak-sama-sekali**: satu baris salah → seluruhnya ditolak, tidak ada yang tersimpan, dan pesan error menyebut baris yang salah. |
| BR-07 | Satu idempotency key menghasilkan maksimal satu receipt (FR-33). |
| BR-08 | Penerimaan bersamaan pada dokumen yang sama diproses **satu per satu**; yang kedua dicek terhadap sisa setelah yang pertama tersimpan. |
| BR-09 | Stok tidak boleh negatif. Setiap perubahan stok wajib punya transaksi, dan untuk setiap produk **total transaksi = stok saat ini**. |
| BR-10 | Semua aturan ditegakkan **backend** (dan constraint database jika memungkinkan), tidak bergantung pada frontend. |

### 7.2 Validasi input

| Data | Aturan |
|---|---|
| Produk | `sku` wajib, 3–50 karakter, hanya huruf/angka/`-`, unik tanpa membedakan huruf besar/kecil · `name` wajib, 1–150 · `unit` wajib, 1–20 (contoh `KARTON`, `KG`) |
| Dokumen | `supplier_name` wajib, 1–150 · `expected_date` wajib, `YYYY-MM-DD` · `notes` opsional, maks 500 |
| Item | `product_id` wajib, produk harus ada · `expected_qty` wajib, bilangan bulat 1–1.000.000 |
| Penerimaan | idempotency key wajib, 8–100 karakter · `lines` minimal 1 · `item_id` milik dokumen ini dan tidak dobel dalam satu request · `quantity` bilangan bulat ≥ 1 · `notes` opsional, maks 500 |
| Cancel | `reason` wajib, 1–500 |

Teks dibersihkan dari spasi di awal/akhir sebelum divalidasi.

### 7.3 Jenis kesalahan

| HTTP | Arti | Contoh |
|---|---|---|
| 400 | Format/isi request tidak valid | Quantity bukan bilangan bulat positif, `lines` kosong, item dobel dalam request, tanpa idempotency key |
| 401 | Belum login / token tidak valid | |
| 403 | Peran tidak diizinkan | Operator mencoba complete |
| 404 | Data di URL tidak ditemukan | Dokumen id 999 |
| 409 | Status tidak cocok / data bentrok | Penerimaan pada dokumen COMPLETED, SKU sudah dipakai, produk sudah ada di dokumen, idempotency key dipakai dengan isi berbeda |
| 422 | Melanggar aturan bisnis | Melebihi sisa, complete belum penuh, submit tanpa item, `product_id`/`item_id` tidak ada atau bukan milik dokumen |

Setiap error berisi pesan yang mudah dipahami dan kode error tetap (misalnya `QUANTITY_EXCEEDS_REMAINING`). Urutan pengecekan dan daftar lengkap kode error ada di `technical-spec.md`.

## 8. User Story & Acceptance Criteria

Format: **Diberikan** (kondisi awal) → **Ketika** (aksi) → **Maka** (hasil).

### US-01 Login — *Pengguna*
- **AC1:** Username & password benar → masuk, nama dan peran tampil.
- **AC2:** Password salah → pesan "Username atau password salah" (tidak menyebut mana yang salah).
- **AC3:** Belum login atau token lewat 8 jam → diarahkan ke halaman login.

### US-02 Produk — *Supervisor menambah, semua pengguna melihat*
- **AC1:** Supervisor menambah SKU `fz-chk-001`, "Ayam Fillet", `KARTON` → tersimpan sebagai `FZ-CHK-001`.
- **AC2:** SKU `fz-chk-001` saat `FZ-CHK-001` sudah ada → **409** "SKU sudah digunakan".
- **AC3:** Operator menambah produk (termasuk lewat API langsung) → **403**. Tombol tidak tampil untuk operator.
- **AC4 (Sebaiknya):** Cari "ayam" → tampil produk yang SKU/namanya mengandung "ayam".

### US-03 Membuat dokumen & menyusun item — *Operator*
- **AC1:** Buat dokumen supplier "PT Sumber Beku", tanggal 2026-10-27 → status DRAFT, nomor `RCV-...`, pembuat tercatat.
- **AC2:** Tambah Ayam Fillet 100 → item tampil dengan diharapkan 100, diterima 0, sisa 100. Ubah menjadi 120 → tersimpan 120. Hapus → item hilang dan produk bisa ditambah lagi.
- **AC3:** Tambah Ayam Fillet saat sudah ada di dokumen → **409**.
- **AC4:** Jumlah 0, negatif, atau desimal → **400**.
- **AC5:** Ubah item pada dokumen selain DRAFT (termasuk lewat API) → **409**.

### US-04 Submit — *Operator*
- **AC1:** DRAFT dengan ≥ 1 item → OPEN, waktu submit tercatat.
- **AC2:** DRAFT tanpa item → **422** "Dokumen harus memiliki minimal 1 item".
- **AC3:** Dokumen bukan DRAFT → **409**.

### US-05 Mencatat penerimaan — *Operator* (inti sistem)

Data awal: dokumen OPEN berisi Ayam Fillet (diharapkan 100), Udang Kupas (50), dan Bakso Sapi (20). Semua stok 0.

- **AC1 — Parsial:** Catat Ayam 60 + Udang 50 → satu receipt dengan 2 baris. Ayam sisa 40, Udang sisa 0, Bakso sisa 20. Stok Ayam +60, stok Udang +50. Ada 2 transaksi. Status menjadi IN_PROGRESS.
- **AC2 — Lanjutan:** Setelah AC1, catat Ayam 40 + Bakso 20 → receipt kedua, semua sisa 0, status tetap IN_PROGRESS.
- **AC3 — Melebihi sisa (BR-01):** Sisa Ayam 40, catat 41 → **422**, pesan menyebut Ayam Fillet dan maksimal 40.
- **AC4 — Semua atau tidak (BR-06):** Sisa Ayam 40 dan Bakso 20, catat Ayam 10 + Bakso 25 → **422**. Jumlah diterima, stok, dan transaksi Ayam **tidak berubah**.
- **AC5 — Status salah:** Dokumen DRAFT, COMPLETED, atau CANCELLED → **409**.
- **AC6 — Format salah:** `lines` kosong, quantity 0/negatif/desimal, atau item dobel → **400**, tidak ada data berubah.
- **AC7 — Item asing:** `item_id` tidak ada atau milik dokumen lain → **422**, tidak ada data berubah.
- **AC8 — Bersamaan (BR-08):** Sisa Ayam 40, dua pengguna bersamaan mencatat Ayam 30 → satu berhasil, satu ditolak **422**. Stok Ayam bertambah **tepat 30**.
- **AC9 — Tanpa frontend:** Semua penolakan di atas tetap terjadi saat API dipanggil langsung.

### US-06 Mencegah penerimaan ganda — *Operator*
- **AC1:** Request dengan key `K1` dikirim ulang dengan isi sama → receipt yang sama dikembalikan. Stok, jumlah diterima, dan transaksi **tidak bertambah**.
- **AC2:** Key `K1` dengan isi berbeda → **409**.
- **AC3:** Tanpa key → **400**.
- **AC4:** Selama request diproses, tombol "Konfirmasi" dinonaktifkan.

### US-07 Complete — *Supervisor*
- **AC1:** IN_PROGRESS dan semua sisa 0 → COMPLETED, siapa dan kapan tercatat.
- **AC2 (BR-02):** Masih ada sisa > 0 → **422**, pesan menyebut item yang belum lengkap.
- **AC3:** Dokumen DRAFT atau OPEN → **409**.
- **AC4:** Dilakukan operator → **403**.

### US-08 Cancel — *Supervisor* (Sebaiknya)
- **AC1:** DRAFT/OPEN dengan alasan "Supplier membatalkan kiriman" → CANCELLED, alasan, siapa, dan kapan tercatat.
- **AC2:** IN_PROGRESS/COMPLETED → **409**. Alasan kosong → **400**. Dilakukan operator → **403**.

### US-09 Melihat dokumen, stok & riwayat — *Pengguna*
- **AC1:** Daftar dokumen tampil terbaru di atas. Detail menampilkan item (diharapkan, diterima, sisa) dan receipt.
- **AC2:** Halaman stok menampilkan semua produk, termasuk yang stoknya 0. Setelah Ayam diterima 60 lalu 40, stok tampil 100.
- **AC3:** Riwayat menampilkan transaksi terbaru di atas, lengkap dengan nomor receipt, nomor dokumen, dan user. Untuk setiap produk, total transaksi = stok (BR-09).
- **AC4 (Sebaiknya):** Filter status dokumen, filter produk di riwayat, dan progres `110 / 170` berfungsi.

## 9. Kebutuhan Non-Fungsional

| Kode | Kebutuhan |
|---|---|
| NFR-01 | **Konsistensi:** semua perubahan dalam satu aksi (item, stok, transaksi, status) tersimpan bersama atau gagal bersama. |
| NFR-02 | **Konkurensi:** aksi bersamaan tidak menghasilkan data salah (BR-08). |
| NFR-03 | **Integritas:** aturan penting juga dijaga constraint database sebagai pengaman terakhir. |
| NFR-04 | **Keamanan:** password disimpan sebagai hash. Rahasia hanya dari environment variable, tidak pernah masuk repository. Input tidak bisa dipakai untuk SQL injection. |
| NFR-05 | **Error aman:** pesan ke pengguna tidak membocorkan detail teknis. |
| NFR-06 | **Jejak audit:** dokumen, receipt, dan transaksi mencatat siapa dan kapan. Transaksi tidak bisa diubah atau dihapus. |
| NFR-07 | **Waktu:** ditampilkan dalam WIB (Asia/Jakarta). |
| NFR-08 | **Performa:** halaman daftar terbuka < 1 detik untuk ±10.000 baris. |
| NFR-09 | **Kegunaan:** antarmuka berbahasa Indonesia, nyaman di desktop dan tablet, error menunjuk field/baris yang salah. |
| NFR-10 | **Deployment:** jalan dengan satu perintah Docker Compose dari kondisi bersih. Migrasi otomatis dan aman dijalankan ulang. |
| NFR-11 | **Kualitas:** BR-01 s.d. BR-09 dan alur status punya test otomatis. |
| NFR-12 | **API:** REST API terdokumentasi (OpenAPI) dengan format response dan error konsisten. |

## 10. Asumsi & Batasan

| No | Asumsi | Alasan |
|---|---|---|
| A1 | Satu gudang, tanpa lokasi rak, lot/batch, atau kedaluwarsa. | Tidak disebut soal; kompleksitas besar. |
| A2 | Satu satuan per produk, jumlah selalu bilangan bulat. | Gudang menghitung per karton/pcs; tidak ada pembulatan. |
| A3 | Penerimaan dicatat **per kedatangan (batch)**: dihitung per item, dikonfirmasi sekali. | Sesuai proses fisik, data konsisten, riwayat mudah dibaca. |
| A4 | Barang boleh datang bertahap dalam beberapa receipt. | Soal menyebut "partial and full receipts". |
| A5 | Ada status **OPEN** untuk mengunci item sebelum barang diterima. | Rencana tidak boleh berubah diam-diam saat penerimaan berjalan. |
| A6 | **Complete manual** oleh supervisor. | Supervisor sebagai titik kontrol sebelum dokumen ditutup. |
| A7 | Dokumen yang sudah menerima barang **tidak bisa dibatalkan**. | Stok sudah bertambah; membatalkan butuh penyesuaian stok (di luar scope). |
| A8 | Kelebihan barang fisik tidak dicatat dan ditangani di luar sistem. | Soal melarang menerima melebihi sisa. |
| A9 | Hanya supervisor yang menambah produk. | Mencegah SKU dobel atau salah ketik. |
| A10 | Semua pengguna melihat semua dokumen. | Satu truk bisa ditangani operator yang berbeda. |
| A11 | User dari data seed; supplier berupa teks bebas. | Pengguna sedikit dan internal; master supplier tidak diminta. |
| A12 | Stok hanya berubah lewat penerimaan. | Fokus soal adalah penerimaan. |

**Batasan:**
- Waktu 8–12 jam, maksimal 3 hari.
- Stack: Next.js (REST API) + Vue 3 + Tailwind + PostgreSQL, seluruhnya JavaScript.
- Docker Compose dengan konfigurasi lewat environment variable.
- Dikerjakan dengan AI agent secara spec-driven.
- Git dengan commit yang bermakna, tanpa fitur di luar scope.

## 11. Pertanyaan yang Belum Terjawab

Selama belum dikonfirmasi pihak bisnis, sistem mengikuti asumsi di bagian 10.

| No | Pertanyaan | Dampak | Sementara / usulan |
|---|---|---|---|
| Q1 | Supplier mengirim **kurang** dan sisanya tidak akan datang. Bagaimana dokumen ditutup? | Dokumen tertahan di IN_PROGRESS (tidak bisa complete maupun cancel). | Dibiarkan. Usulan: status `CLOSED_SHORT` oleh supervisor dengan alasan. |
| Q2 | Operator **salah input** jumlah. | Stok salah tanpa cara memperbaiki. | Usulan: pembalikan receipt (transaksi negatif) dengan persetujuan supervisor. |
| Q3 | Barang **rusak / suhu tidak sesuai** (cold storage). | Barang rusak bisa tercatat sebagai stok. | Hanya barang layak yang dicatat. |
| Q4 | Perlu **lot/batch dan kedaluwarsa**? | Model stok berubah besar. | Tidak didukung (A1). |
| Q5 | Lebih dari satu gudang/lokasi? | Model stok berubah. | Satu gudang (A1). |
| Q6 | Terhubung dengan **Purchase Order**? | Jumlah diharapkan bisa otomatis. | Diisi manual. |
| Q7 | Operator boleh menambah produk yang belum terdaftar? | Penerimaan bisa tertunda. | Hanya supervisor (A9). |

## 12. Catatan Keputusan

| Keputusan | Alternatif ditolak | Alasan |
|---|---|---|
| Penerimaan **batch per kedatangan** | Satu request per item | Sesuai proses fisik, all-or-nothing, satu idempotency key per konfirmasi. Batch tetap bisa berisi 1 baris. |
| Status **OPEN** | Langsung menerima dari DRAFT | Mengunci rencana sebelum barang masuk. |
| **Complete manual** | Otomatis saat penuh | Titik kontrol supervisor; BR-02 tetap teruji. |
| Stok = **saldo + riwayat transaksi** | Hanya riwayat | Daftar stok cepat, riwayat tetap jadi bukti; diperbarui dalam satu transaksi. |
| **Idempotency key** | Hanya menonaktifkan tombol | Request bisa terkirim ulang oleh jaringan atau dipanggil langsung ke API. |
