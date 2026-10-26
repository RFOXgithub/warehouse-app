import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { POST as completeRoute } from "@/app/api/receiving-documents/[id]/complete/route.js";
import { POST as cancelRoute } from "@/app/api/receiving-documents/[id]/cancel/route.js";
import { POST as createDocumentRoute } from "@/app/api/receiving-documents/route.js";
import { query } from "@/src/lib/db.js";
import { callRoute } from "../helpers/http.js";
import { tokenFor } from "../helpers/db.js";
import {
  createOpenDocument,
  receive,
  getDocument,
} from "../helpers/documents.js";
import { assertInventoryConsistent, stockBySku } from "../helpers/inventory.js";
import { runWhileDocumentsLocked } from "../helpers/concurrency.js";

let operatorToken;
let supervisorToken;
let documentId;
let ayam;
let udang;
let bakso;

beforeEach(async () => {
  operatorToken = await tokenFor("operator1");
  supervisorToken = await tokenFor("supervisor1");
  const created = await createOpenDocument(operatorToken, {
    "FZ-CHK-001": 100,
    "FZ-SHR-002": 50,
    "FZ-BKS-003": 20,
  });
  documentId = created.documentId;
  ayam = created.itemIds["FZ-CHK-001"];
  udang = created.itemIds["FZ-SHR-002"];
  bakso = created.itemIds["FZ-BKS-003"];
});

afterEach(assertInventoryConsistent);

function remainingBySku(document) {
  return Object.fromEntries(
    document.items.map((item) => [item.sku, item.remaining_qty]),
  );
}

function complete(id, token = supervisorToken) {
  return callRoute(completeRoute, { method: "POST", token, params: { id } });
}

function todayWib() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta" })
    .format(new Date())
    .replaceAll("-", "");
}

describe("US-05: mencatat penerimaan", () => {
  it("AC1: penerimaan parsial → receipt 2 baris, sisa & stok benar, status IN_PROGRESS", async () => {
    const res = await receive(
      operatorToken,
      documentId,
      [
        { item_id: ayam, quantity: 60 },
        { item_id: udang, quantity: 50 },
      ],
      { notes: "Truk B 1234 XY" },
    );

    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({
      receipt_number: `GR-${todayWib()}-000001`,
      document_id: documentId,
      notes: "Truk B 1234 XY",
      received_by: { full_name: "Operator Satu" },
    });
    expect(
      res.body.data.lines.map((l) => [l.sku, l.quantity, l.balance_after]),
    ).toEqual([
      ["FZ-CHK-001", 60, 60],
      ["FZ-SHR-002", 50, 50],
    ]);

    const document = await getDocument(operatorToken, documentId);
    expect(document.status).toBe("IN_PROGRESS");
    expect(remainingBySku(document)).toEqual({
      "FZ-CHK-001": 40,
      "FZ-SHR-002": 0,
      "FZ-BKS-003": 20,
    });
    expect(await stockBySku()).toMatchObject({
      "FZ-CHK-001": 60,
      "FZ-SHR-002": 50,
      "FZ-BKS-003": 0,
    });
  });

  it("AC2: penerimaan lanjutan → receipt kedua, semua sisa 0, stok Ayam 100", async () => {
    await receive(operatorToken, documentId, [
      { item_id: ayam, quantity: 60 },
      { item_id: udang, quantity: 50 },
    ]);

    const res = await receive(operatorToken, documentId, [
      { item_id: ayam, quantity: 40 },
      { item_id: bakso, quantity: 20 },
    ]);

    expect(res.status).toBe(201);
    expect(res.body.data.receipt_number).toBe(`GR-${todayWib()}-000002`);
    const ayamLine = res.body.data.lines.find((l) => l.sku === "FZ-CHK-001");
    expect(ayamLine.balance_after).toBe(100);

    const document = await getDocument(operatorToken, documentId);
    expect(document.status).toBe("IN_PROGRESS");
    expect(Object.values(remainingBySku(document))).toEqual([0, 0, 0]);
    expect(document.receipts).toHaveLength(2);
  });

  it("AC3 (BR-01): melebihi sisa → 422 dengan detail baris, data tidak berubah", async () => {
    await receive(operatorToken, documentId, [{ item_id: ayam, quantity: 60 }]);

    const res = await receive(operatorToken, documentId, [
      { item_id: ayam, quantity: 41 },
    ]);

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe("QUANTITY_EXCEEDS_REMAINING");
    expect(res.body.error.details).toEqual([
      {
        line: 1,
        item_id: ayam,
        sku: "FZ-CHK-001",
        remaining: 40,
        requested: 41,
        message: "Ayam Fillet: maksimal 40, diminta 41.",
      },
    ]);
    expect((await stockBySku())["FZ-CHK-001"]).toBe(60);
  });

  it("AC4 (BR-06): satu baris salah → semua ditolak, Ayam tidak berubah", async () => {
    const res = await receive(operatorToken, documentId, [
      { item_id: ayam, quantity: 10 },
      { item_id: bakso, quantity: 25 },
    ]);

    expect(res.status).toBe(422);
    expect(res.body.error.details.map((d) => d.line)).toEqual([2]);

    const document = await getDocument(operatorToken, documentId);
    expect(document.status).toBe("OPEN");
    expect(document.receipts).toEqual([]);
    expect(remainingBySku(document)["FZ-CHK-001"]).toBe(100);
    expect((await stockBySku())["FZ-CHK-001"]).toBe(0);
  });

  it("AC5 (BR-03): dokumen DRAFT, COMPLETED, atau CANCELLED → 409", async () => {
    const draft = await callRoute(createDocumentRoute, {
      method: "POST",
      token: operatorToken,
      body: { supplier_name: "PT Draft", expected_date: "2026-10-27" },
    });
    const cancelled = await createOpenDocument(operatorToken, {
      "FZ-CHK-001": 10,
    });
    await callRoute(cancelRoute, {
      method: "POST",
      token: supervisorToken,
      params: { id: cancelled.documentId },
      body: { reason: "Batal" },
    });
    const completed = await createOpenDocument(operatorToken, {
      "FZ-SHR-002": 5,
    });
    await receive(operatorToken, completed.documentId, [
      { item_id: completed.itemIds["FZ-SHR-002"], quantity: 5 },
    ]);
    await complete(completed.documentId);

    const results = [
      await receive(operatorToken, draft.body.data.id, [
        { item_id: ayam, quantity: 1 },
      ]),
      await receive(operatorToken, cancelled.documentId, [
        { item_id: cancelled.itemIds["FZ-CHK-001"], quantity: 1 },
      ]),
      await receive(operatorToken, completed.documentId, [
        { item_id: completed.itemIds["FZ-SHR-002"], quantity: 1 },
      ]),
    ];

    for (const res of results) {
      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe("INVALID_DOCUMENT_STATUS");
    }
  });

  it.each([
    ["lines kosong", []],
    ["quantity 0", [{ quantity: 0 }]],
    ["quantity negatif", [{ quantity: -5 }]],
    ["quantity desimal", [{ quantity: 1.5 }]],
    ["quantity berupa teks", [{ quantity: "10" }]],
    ["item yang sama dua kali", [{ quantity: 1 }, { quantity: 1 }]],
  ])("AC6: %s → 400, tidak ada data berubah", async (_label, lines) => {
    const res = await receive(
      operatorToken,
      documentId,
      lines.map((line) => ({ item_id: ayam, ...line })),
    );

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
    expect((await getDocument(operatorToken, documentId)).receipts).toEqual([]);
  });

  it("AC7: item milik dokumen lain → 422 ITEM_NOT_IN_DOCUMENT", async () => {
    const other = await createOpenDocument(operatorToken, { "FZ-CHK-001": 10 });

    const res = await receive(operatorToken, documentId, [
      { item_id: other.itemIds["FZ-CHK-001"], quantity: 1 },
    ]);

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe("ITEM_NOT_IN_DOCUMENT");
    expect(res.body.error.details[0]).toMatchObject({ line: 1 });
  });

  it("item asing dan jumlah berlebih sekaligus → kode ITEM_NOT_IN_DOCUMENT, keduanya dilaporkan", async () => {
    const res = await receive(operatorToken, documentId, [
      { item_id: bakso, quantity: 99 },
      { item_id: 999999, quantity: 1 },
    ]);

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe("ITEM_NOT_IN_DOCUMENT");
    expect(res.body.error.details.map((d) => d.line)).toEqual([1, 2]);
  });

  it("AC8 (BR-08): dua penerimaan BERSAMAAN Ayam 30 dengan sisa 40 → satu 201, satu 422, stok +30", async () => {
    await receive(operatorToken, documentId, [{ item_id: ayam, quantity: 60 }]);

    const { results, settledWhileLocked } = await runWhileDocumentsLocked(
      [documentId],
      () => [
        receive(operatorToken, documentId, [{ item_id: ayam, quantity: 30 }]),
        receive(operatorToken, documentId, [{ item_id: ayam, quantity: 30 }]),
      ],
    );

    expect(settledWhileLocked).toBe(0);
    expect(results.map((r) => r.status).sort()).toEqual([201, 422]);
    const rejected = results.find((r) => r.status === 422);
    expect(rejected.body.error.details[0]).toMatchObject({
      remaining: 10,
      requested: 30,
    });
    expect((await stockBySku())["FZ-CHK-001"]).toBe(90);
  });

  it("dua dokumen dengan produk sama diterima bersamaan dalam urutan baris terbalik → tidak deadlock", async () => {
    const other = await createOpenDocument(operatorToken, {
      "FZ-CHK-001": 100,
      "FZ-SHR-002": 100,
    });

    const { results } = await runWhileDocumentsLocked(
      [documentId, other.documentId],
      () => [
        receive(operatorToken, documentId, [
          { item_id: ayam, quantity: 1 },
          { item_id: udang, quantity: 1 },
        ]),
        receive(operatorToken, other.documentId, [
          { item_id: other.itemIds["FZ-SHR-002"], quantity: 1 },
          { item_id: other.itemIds["FZ-CHK-001"], quantity: 1 },
        ]),
      ],
    );

    expect(results.map((r) => r.status)).toEqual([201, 201]);
    expect(await stockBySku()).toMatchObject({
      "FZ-CHK-001": 2,
      "FZ-SHR-002": 2,
    });
  });

  it("tanpa token → 401", async () => {
    const res = await receive(undefined, documentId, [
      { item_id: ayam, quantity: 1 },
    ]);

    expect(res.status).toBe(401);
  });
});

describe("US-07: complete (FR-27, BR-02)", () => {
  async function receiveAll() {
    await receive(operatorToken, documentId, [
      { item_id: ayam, quantity: 100 },
      { item_id: udang, quantity: 50 },
      { item_id: bakso, quantity: 20 },
    ]);
  }

  it("AC1: semua item penuh → COMPLETED, penyelesai dan waktu tercatat", async () => {
    await receiveAll();

    const res = await complete(documentId);

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({
      status: "COMPLETED",
      completed_by: { full_name: "Supervisor Satu" },
      completed_at: expect.any(String),
    });
  });

  it("AC2: masih ada sisa → 422 dengan daftar item yang kurang", async () => {
    await receive(operatorToken, documentId, [
      { item_id: ayam, quantity: 100 },
      { item_id: udang, quantity: 50 },
    ]);

    const res = await complete(documentId);

    expect(res.status).toBe(422);
    expect(res.body.error).toEqual({
      code: "DOCUMENT_NOT_FULLY_RECEIVED",
      message: "Masih ada 1 item yang belum diterima penuh.",
      details: [
        {
          item_id: bakso,
          sku: "FZ-BKS-003",
          expected_qty: 20,
          received_qty: 0,
          remaining_qty: 20,
          message: "Bakso Sapi: kurang 20.",
        },
      ],
    });
    expect((await getDocument(operatorToken, documentId)).status).toBe(
      "IN_PROGRESS",
    );
  });

  it("AC3: dokumen OPEN (belum ada penerimaan) → 409", async () => {
    const res = await complete(documentId);

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("INVALID_DOCUMENT_STATUS");
  });

  it("AC4: operator → 403", async () => {
    await receiveAll();

    const res = await complete(documentId, operatorToken);

    expect(res.status).toBe(403);
  });

  it("A7: dokumen yang sudah menerima barang tidak bisa dibatalkan → 409", async () => {
    await receive(operatorToken, documentId, [{ item_id: ayam, quantity: 1 }]);

    const res = await callRoute(cancelRoute, {
      method: "POST",
      token: supervisorToken,
      params: { id: documentId },
      body: { reason: "Batal" },
    });

    expect(res.status).toBe(409);
    const { rows } = await query(
      "SELECT on_hand_qty FROM inventory_balances b JOIN products p ON p.id = b.product_id WHERE p.sku = 'FZ-CHK-001'",
    );
    expect(rows[0].on_hand_qty).toBe(1);
  });
});
