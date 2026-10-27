# AI Agent Workflow

Dokumen ini menjelaskan **bagaimana** AI coding agent dipakai: dokumen apa yang menjadi input, instruksi proyek apa yang dibaca agent, contoh prompt, dan bagaimana hasil agent diperiksa.

## 1. Agent dan prinsip kerja

- **Agent:** Open Code, dengan akses ke terminal, file proyek.
- **Specification-driven:** dokumen di `docs/` ditulis dan disepakati **lebih dulu**. Setelah itu, prompt implementasi cukup pendek ("lanjut ke fitur penerimaan"), karena agent membaca PRD, technical-spec, dan OpenAPI sebagai sumber kebenaran.

## 2. Instruksi proyek: `AGENTS.md`

[`AGENTS.md`](../AGENTS.md) di root dibaca otomatis oleh agent di setiap sesi. Isinya:

| Bagian           | Isi                                                                                                                                                                            | Kenapa perlu                                                                    |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------- |
| Sumber kebenaran | Tabel dokumen dan kapan dibaca; **PRD menang atas technical-spec, technical-spec menang atas kode**; jika ada konflik, berhenti dan laporkan                                   | Agent tidak memilih sendiri saat dokumen bertentangan                           |
| Stack            | Next.js 16 hanya sebagai API, cek dokumentasi di `node_modules/next/dist/docs/` karena versi ini berbeda dari versi lama                                                       | Pengetahuan agent tentang Next.js versi lama tidak dipakai begitu saja          |
| Aturan kode      | Pembagian lapisan route/service/lib; wajib `BEGIN → FOR UPDATE → cek → ubah → COMMIT`; query berparameter; jebakan `pg`; zod `.strict()`; urutan error 401→403→400→404→409→422 | Aturan teknis yang mudah terlupa ditulis sekali, tidak diulang di setiap prompt |
| Larangan         | Tidak menambah fitur di luar PRD, tidak mengubah migrasi lama, tidak menulis rahasia ke Git, tidak mengubah `inventory_transactions`                                           | Batas yang tegas untuk agent                                                    |
| Testing          | Setiap BR- punya test; kode PRD di nama test; `assertInventoryConsistent()`; **jalankan `npm test` dan `npm run build`**; test konkurensi harus dibuktikan bisa gagal          | Dua baris terakhir ditambahkan setelah kejadian nyata (bagian 5)                |
| Cara kolaborasi  | Developer mengetik kode; kerjakan per langkah kecil; format commit                                                                                                             | Menjaga developer tetap memahami kodenya                                        |

`AGENTS.md` ikut berubah selama proyek berjalan: setiap kali ada pelajaran penting, aturannya ditambahkan supaya tidak terulang.

## 3. Alur kerja

```
1. Diskusi kebutuhan        → keputusan bisnis oleh developer
2. PRD                      → review agent, beri rating, perbaiki, ulangi
3. technical-spec, ERD,     → diturunkan dari PRD; setiap dokumen dicek silang
   OpenAPI, data flow          dan diberi rating sebelum lanjut
4. Implementasi per fitur   → agent membaca dokumen → menulis kode di salinan
                               simulasi → menjalankan test/build/browser →
                               menyerahkan kode → developer mengetik & commit
5. Verifikasi repo          → agent membandingkan hasil ketikan developer dengan
                               versi yang sudah diuji, menjalankan test lagi
```

**Salinan simulasi.** Karena developer yang mengetik kode, agent menguji kodenya lebih dulu di salinan proyek di folder sementara:

- backend di port 3100 dengan database `warehouse_test`;
- frontend di port 5180;
- stack Docker terpisah di port 8090.

Baru setelah lolos, kode diberikan ke developer. Data development milik developer tidak pernah tersentuh.

**Commit** dilakukan oleh developer, satu per kelompok fitur (lihat `git log`). Dokumen di-commit pertama kali sebelum ada kode aplikasi (`docs: tambah PRD, spesifikasi teknis, ERD, OpenAPI, dan data flow`).

## 4. Kesalahan yang ditemukan dan dikoreksi

Bagian ini mencatat output (dari agent maupun developer) yang ternyata salah, cara menemukannya, dan pelajarannya.

| Masalah                                                                                                                                                                                        | Cara ditemukan                                                    | Perbaikan & pelajaran                                                                                                                                                     |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Test konkurensi BR-08 memakai `Promise.all` dan tetap lolos walaupun `FOR UPDATE` dihapus.** Request kedua kebetulan menunggu koneksi database baru, jadi tidak pernah benar-benar bersamaan | Uji mutasi: perlindungan dicabut, tetapi test tetap hijau         | Helper `runWhileDocumentsLocked()` membuat tabrakan pasti terjadi. Aturan "test konkurensi harus dibuktikan bisa gagal" ditambahkan ke `AGENTS.md` dan technical-spec 9.2 |
| **Fungsi `lockDocument` didefinisikan dua kali** setelah refactor. Vitest lolos, tetapi `next build` gagal dan semua route dokumen mengembalikan 500                                           | Agent menjalankan backend di simulasi dan melihat error 500       | Aturan "jalankan `npm test` **dan** `npm run build`" ditambahkan ke `AGENTS.md`                                                                                           |
| `cancel/route.js` ternyata salinan `submit/route.js` (salah salin saat mengetik)                                                                                                               | Integration test cancel gagal                                     | Contoh nyata bahwa test per perpindahan status itu penting                                                                                                                |
| Pesan error zod muncul dalam bahasa Inggris                                                                                                                                                    | Pemeriksaan respons API                                           | Setiap skema memakai pesan `{ error: ... }` berbahasa Indonesia                                                                                                           |
| `.env` tersimpan dengan CRLF, sehingga password database tidak cocok                                                                                                                           | Login PostgreSQL gagal padahal password benar                     | `.gitattributes` memaksa LF; dicatat di README                                                                                                                            |
| Form pembatalan bisa terkirim dua kali lewat Enter; pesan error dan pesan sukses tampil bersamaan                                                                                              | Pengujian di browser dengan request yang lambat                   | `runAction` menolak aksi saat `busy`; tombol `disabled` saja tidak cukup                                                                                                  |
| Selector E2E `getByLabel("Produk", { exact: true })` tidak cocok dengan elemen apa pun, tetapi pengecekan `not.toHaveCount(1)` tetap lolos karena jumlahnya 0                                  | Langkah berikutnya timeout; isi halaman dibaca dari error context | Diganti `getByRole("combobox", { name: "Produk" })`. Assertion juga bisa "lolos untuk alasan yang salah", sama seperti kasus `Promise.all`                                |
| Ketidaksesuaian kecil antar dokumen, misalnya technical-spec 9.3 masih menyebut `Promise.all` setelah test diganti                                                                             | Review silang saat menulis dokumen akhir                          | Dokumen diperbarui. Perubahan perilaku harus ikut mengubah dokumen di commit yang sama                                                                                    |

## 5. Cara memverifikasi output agent

| Lapisan                     | Pemeriksaan                                                                                                                        |
| --------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| Dokumen                     | Rating dan review silang terhadap soal tes dan antar dokumen; ketertelusuran kode PRD; OpenAPI divalidasi sebagai OpenAPI 3.1      |
| Backend                     | 92 test dengan PostgreSQL sungguhan; `next build`; uji mutasi untuk perlindungan penting; respons dicocokkan dengan `openapi.yaml` |
| Frontend                    | `vite build`; pemeriksaan di browser untuk alur sukses dan penolakan, per role                                                     |
| Deployment                  | `docker compose up --build` dari kondisi bersih; health check; restart; konfigurasi salah                                          |
| Alur utuh                   | E2E Playwright terhadap aplikasi di Docker                                                                                         |
| Kode yang diketik developer | Agent membandingkan file di repo dengan versi yang sudah diuji (`diff`), lalu menjalankan test lagi                                |

## 6. Pembagian keputusan

| Diputuskan developer                                                                                | Dikerjakan / diusulkan agent                                                 |
| --------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| Stack (Next.js API + Vue + PostgreSQL, JavaScript penuh), bahasa dokumen                            | Struktur dokumen, draft PRD dan technical-spec, diagram, OpenAPI             |
| Penerimaan batch per kedatangan, nama status, complete manual oleh supervisor                       | Pilihan beserta konsekuensinya, misalnya pessimistic lock vs optimistic lock |
| Fitur yang masuk scope dan prioritasnya                                                             | Penanda prioritas Wajib/Sebaiknya; peringatan saat sesuatu di luar PRD       |
| Mengetik dan meng-commit kode, frekuensi commit                                                     | Kode beserta penjelasan, cara menguji, dan saran pesan commit                |
| Menerima atau menolak usulan (misalnya tidak memakai halaman dokumentasi API, cukup `openapi.yaml`) | Review, rating, dan daftar perbaikan                                         |
