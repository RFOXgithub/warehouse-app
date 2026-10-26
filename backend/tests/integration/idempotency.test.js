import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { POST as completeRoute } from "@/app/api/receiving-documents/[id]/complete/route.js";
import { POST as receiptRoute } from "@/app/api/receiving-documents/[id]/receipts/route.js";
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
let documentId;
let ayam;
let udang;

beforeEach(async () => {
  operatorToken = await tokenFor("operator1");
  const created = await createOpenDocument(operatorToken, {
    "FZ-CHK-001": 100,
    "FZ-SHR-002": 50,
  });
  documentId = created.documentId;
  ayam = created.itemIds["FZ-CHK-001"];
  udang = created.itemIds["FZ-SHR-002"];
});

afterEach(assertInventoryConsistent);

const KEY = "7f3a2c1e-5b6d-4e8f-9a0b-1c2d3e4f5a6b";

describe("US-06: mencegah penerimaan ganda (FR-33, BR-07)", () => {
  it("AC1: key & isi sama dikirim ulang → 200, receipt yang sama, stok tidak bertambah", async () => {
    const lines = [{ item_id: ayam, quantity: 60 }];
    const first = await receive(operatorToken, documentId, lines, { key: KEY });
    const retry = await receive(operatorToken, documentId, lines, { key: KEY });

    expect(first.status).toBe(201);
    expect(retry.status).toBe(200);
    expect(retry.headers.get("Idempotent-Replayed")).toBe("true");
    expect(retry.body.data).toEqual(first.body.data);
    expect((await stockBySku())["FZ-CHK-001"]).toBe(60);
    expect(
      (await getDocument(operatorToken, documentId)).receipts,
    ).toHaveLength(1);
  });

  it("urutan baris berbeda dan catatan kosong vs tidak dikirim → tetap dianggap request yang sama", async () => {
    await receive(
      operatorToken,
      documentId,
      [
        { item_id: ayam, quantity: 10 },
        { item_id: udang, quantity: 5 },
      ],
      { key: KEY, notes: "" },
    );

    const retry = await receive(
      operatorToken,
      documentId,
      [
        { item_id: udang, quantity: 5 },
        { item_id: ayam, quantity: 10 },
      ],
      { key: KEY },
    );

    expect(retry.status).toBe(200);
  });

  it("AC2: key sama dengan isi berbeda → 409, stok tidak berubah", async () => {
    await receive(
      operatorToken,
      documentId,
      [{ item_id: ayam, quantity: 60 }],
      { key: KEY },
    );

    const res = await receive(
      operatorToken,
      documentId,
      [{ item_id: ayam, quantity: 50 }],
      {
        key: KEY,
      },
    );

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("IDEMPOTENCY_KEY_CONFLICT");
    expect((await stockBySku())["FZ-CHK-001"]).toBe(60);
  });

  it("key sama dipakai di dokumen lain → 409", async () => {
    const other = await createOpenDocument(operatorToken, { "FZ-CHK-001": 10 });
    await receive(operatorToken, documentId, [{ item_id: ayam, quantity: 1 }], {
      key: KEY,
    });

    const res = await receive(
      operatorToken,
      other.documentId,
      [{ item_id: other.itemIds["FZ-CHK-001"], quantity: 1 }],
      { key: KEY },
    );

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("IDEMPOTENCY_KEY_CONFLICT");
  });

  it.each([
    ["tidak dikirim", null],
    ["kurang dari 8 karakter", "abc"],
  ])("AC3: Idempotency-Key %s → 400", async (_label, key) => {
    const headers = key === null ? {} : { "Idempotency-Key": key };
    const res = await callRoute(receiptRoute, {
      method: "POST",
      token: operatorToken,
      params: { id: documentId },
      headers,
      body: { lines: [{ item_id: ayam, quantity: 1 }] },
    });

    expect(res.status).toBe(400);
    expect(res.body.error.details[0].field).toBe("Idempotency-Key");
  });

  it("klik dobel: key sama dikirim BERSAMAAN → hanya satu receipt, stok bertambah sekali", async () => {
    const lines = [{ item_id: ayam, quantity: 60 }];

    const { results, settledWhileLocked } = await runWhileDocumentsLocked(
      [documentId],
      () => [
        receive(operatorToken, documentId, lines, { key: KEY }),
        receive(operatorToken, documentId, lines, { key: KEY }),
      ],
    );

    expect(settledWhileLocked).toBe(0);
    expect(results.map((r) => r.status).sort()).toEqual([200, 201]);
    expect(results[0].body.data.id).toBe(results[1].body.data.id);
    expect((await stockBySku())["FZ-CHK-001"]).toBe(60);
  });

  it("request ulang setelah dokumen COMPLETED → tetap 200 (FR-33)", async () => {
    const lines = [
      { item_id: ayam, quantity: 100 },
      { item_id: udang, quantity: 50 },
    ];
    await receive(operatorToken, documentId, lines, { key: KEY });
    await callRoute(completeRoute, {
      method: "POST",
      token: await tokenFor("supervisor1"),
      params: { id: documentId },
    });

    const retry = await receive(operatorToken, documentId, lines, { key: KEY });

    expect(retry.status).toBe(200);
    expect((await getDocument(operatorToken, documentId)).status).toBe(
      "COMPLETED",
    );
  });
});
