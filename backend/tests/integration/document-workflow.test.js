import { describe, it, expect, beforeEach } from "vitest";
import { POST as createDocumentRoute } from "@/app/api/receiving-documents/route.js";
import { GET as detailRoute } from "@/app/api/receiving-documents/[id]/route.js";
import { POST as addItemRoute } from "@/app/api/receiving-documents/[id]/items/route.js";
import {
  PATCH as updateItemRoute,
  DELETE as deleteItemRoute,
} from "@/app/api/receiving-documents/[id]/items/[itemId]/route.js";
import { POST as submitRoute } from "@/app/api/receiving-documents/[id]/submit/route.js";
import { POST as cancelRoute } from "@/app/api/receiving-documents/[id]/cancel/route.js";
import { query } from "@/src/lib/db.js";
import { callRoute } from "../helpers/http.js";
import { tokenFor } from "../helpers/db.js";

let operatorToken;
let supervisorToken;
let ayamId;
let udangId;

beforeEach(async () => {
  operatorToken = await tokenFor("operator1");
  supervisorToken = await tokenFor("supervisor1");
  const { rows } = await query("SELECT id, sku FROM products");
  ayamId = rows.find((p) => p.sku === "FZ-CHK-001").id;
  udangId = rows.find((p) => p.sku === "FZ-SHR-002").id;
});

async function createDraft() {
  const res = await callRoute(createDocumentRoute, {
    method: "POST",
    token: operatorToken,
    body: { supplier_name: "PT Sumber Beku", expected_date: "2026-10-27" },
  });
  return res.body.data.id;
}

function addItem(documentId, body) {
  return callRoute(addItemRoute, {
    method: "POST",
    token: operatorToken,
    params: { id: documentId },
    body,
  });
}

function updateItem(documentId, itemId, body) {
  return callRoute(updateItemRoute, {
    method: "PATCH",
    token: operatorToken,
    params: { id: documentId, itemId },
    body,
  });
}

function deleteItem(documentId, itemId) {
  return callRoute(deleteItemRoute, {
    method: "DELETE",
    token: operatorToken,
    params: { id: documentId, itemId },
  });
}

function submit(documentId) {
  return callRoute(submitRoute, {
    method: "POST",
    token: operatorToken,
    params: { id: documentId },
  });
}

function cancel(documentId, body, token = supervisorToken) {
  return callRoute(cancelRoute, {
    method: "POST",
    token,
    params: { id: documentId },
    body,
  });
}

async function getDocument(documentId) {
  const res = await callRoute(detailRoute, {
    token: operatorToken,
    params: { id: documentId },
  });
  return res.body.data;
}

async function createOpenDocument() {
  const documentId = await createDraft();
  const item = await addItem(documentId, {
    product_id: ayamId,
    expected_qty: 100,
  });
  await submit(documentId);
  return { documentId, itemId: item.body.data.id };
}

describe("US-03: menyusun item dokumen DRAFT (FR-26)", () => {
  it("AC2: tambah 100 → ubah 120 → hapus → produk bisa ditambah lagi", async () => {
    const documentId = await createDraft();

    const added = await addItem(documentId, {
      product_id: ayamId,
      expected_qty: 100,
    });
    expect(added.status).toBe(201);
    expect(added.body.data).toMatchObject({
      sku: "FZ-CHK-001",
      expected_qty: 100,
      received_qty: 0,
      remaining_qty: 100,
    });
    const itemId = added.body.data.id;

    const updated = await updateItem(documentId, itemId, { expected_qty: 120 });
    expect(updated.status).toBe(200);
    expect(updated.body.data).toMatchObject({
      expected_qty: 120,
      remaining_qty: 120,
    });

    const deleted = await deleteItem(documentId, itemId);
    expect(deleted.status).toBe(204);
    expect(deleted.body).toBeNull();
    expect((await getDocument(documentId)).items).toEqual([]);

    const readded = await addItem(documentId, {
      product_id: ayamId,
      expected_qty: 50,
    });
    expect(readded.status).toBe(201);
  });

  it("AC3 (BR-05): produk yang sama dua kali → 409", async () => {
    const documentId = await createDraft();
    await addItem(documentId, { product_id: ayamId, expected_qty: 100 });

    const res = await addItem(documentId, {
      product_id: ayamId,
      expected_qty: 5,
    });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("PRODUCT_ALREADY_IN_DOCUMENT");
  });

  it.each([0, -5, 1.5, "100", 1000001])(
    "AC4: jumlah diharapkan %s → 400",
    async (expectedQty) => {
      const documentId = await createDraft();

      const res = await addItem(documentId, {
        product_id: ayamId,
        expected_qty: expectedQty,
      });

      expect(res.status).toBe(400);
      expect(res.body.error.details[0].field).toBe("expected_qty");
    },
  );

  it("produk tidak ada → 422", async () => {
    const documentId = await createDraft();

    const res = await addItem(documentId, {
      product_id: 999,
      expected_qty: 10,
    });

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe("PRODUCT_NOT_FOUND");
  });

  it("item milik dokumen lain → 404", async () => {
    const documentA = await createDraft();
    const documentB = await createDraft();
    const itemOfA = await addItem(documentA, {
      product_id: ayamId,
      expected_qty: 10,
    });

    const res = await updateItem(documentB, itemOfA.body.data.id, {
      expected_qty: 20,
    });

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("ITEM_NOT_FOUND");
  });

  it("dokumen tidak ada → 404", async () => {
    const res = await addItem(999, { product_id: ayamId, expected_qty: 10 });

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("DOCUMENT_NOT_FOUND");
  });

  it("AC5 (BR-03): tambah, ubah, atau hapus item saat OPEN → 409", async () => {
    const { documentId, itemId } = await createOpenDocument();

    const added = await addItem(documentId, {
      product_id: udangId,
      expected_qty: 10,
    });
    const updated = await updateItem(documentId, itemId, { expected_qty: 999 });
    const deleted = await deleteItem(documentId, itemId);

    for (const res of [added, updated, deleted]) {
      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe("INVALID_DOCUMENT_STATUS");
    }
    const document = await getDocument(documentId);
    expect(document.items).toHaveLength(1);
    expect(document.items[0].expected_qty).toBe(100);
  });
});

describe("US-04: submit (FR-27, BR-04)", () => {
  it("AC1: DRAFT dengan item → OPEN, pengirim dan waktu tercatat", async () => {
    const documentId = await createDraft();
    await addItem(documentId, { product_id: ayamId, expected_qty: 100 });

    const res = await submit(documentId);

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({
      status: "OPEN",
      submitted_by: { id: expect.any(Number), full_name: "Operator Satu" },
      submitted_at: expect.any(String),
    });
  });

  it("AC2: DRAFT tanpa item → 422 dan status tetap DRAFT", async () => {
    const documentId = await createDraft();

    const res = await submit(documentId);

    expect(res.status).toBe(422);
    expect(res.body.error).toEqual({
      code: "DOCUMENT_HAS_NO_ITEMS",
      message: "Dokumen harus memiliki minimal 1 item.",
    });
    expect((await getDocument(documentId)).status).toBe("DRAFT");
  });

  it("AC3: dokumen bukan DRAFT → 409", async () => {
    const { documentId } = await createOpenDocument();

    const res = await submit(documentId);

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("INVALID_DOCUMENT_STATUS");
  });
});

describe("US-08: cancel (FR-28)", () => {
  it("AC1: supervisor membatalkan DRAFT dan OPEN, alasan dan pelaku tercatat", async () => {
    const draftId = await createDraft();
    const { documentId: openId } = await createOpenDocument();

    for (const documentId of [draftId, openId]) {
      const res = await cancel(documentId, {
        reason: "  Supplier membatalkan kiriman ",
      });

      expect(res.status).toBe(200);
      expect(res.body.data).toMatchObject({
        status: "CANCELLED",
        cancel_reason: "Supplier membatalkan kiriman",
        cancelled_by: { id: expect.any(Number), full_name: "Supervisor Satu" },
        cancelled_at: expect.any(String),
      });
    }
  });

  it("AC2: IN_PROGRESS tidak bisa dibatalkan → 409", async () => {
    const { documentId } = await createOpenDocument();
    await query(
      "UPDATE receiving_documents SET status = 'IN_PROGRESS' WHERE id = $1",
      [documentId],
    );

    const res = await cancel(documentId, { reason: "Coba batal" });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("INVALID_DOCUMENT_STATUS");
  });

  it("AC2: alasan kosong → 400", async () => {
    const documentId = await createDraft();

    const res = await cancel(documentId, { reason: "   " });

    expect(res.status).toBe(400);
    expect(res.body.error.details[0].field).toBe("reason");
  });

  it("AC2: operator → 403", async () => {
    const documentId = await createDraft();

    const res = await cancel(
      documentId,
      { reason: "Coba batal" },
      operatorToken,
    );

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("FORBIDDEN");
  });

  it("BR-03: dokumen CANCELLED tidak bisa disubmit atau diubah lagi", async () => {
    const documentId = await createDraft();
    await addItem(documentId, { product_id: ayamId, expected_qty: 10 });
    await cancel(documentId, { reason: "Batal" });

    const submitted = await submit(documentId);
    const added = await addItem(documentId, {
      product_id: udangId,
      expected_qty: 5,
    });

    expect(submitted.status).toBe(409);
    expect(added.status).toBe(409);
  });
});
