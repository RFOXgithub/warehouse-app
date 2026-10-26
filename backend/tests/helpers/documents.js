import { randomUUID } from "node:crypto";
import { query } from "@/src/lib/db.js";
import { POST as createDocumentRoute } from "@/app/api/receiving-documents/route.js";
import { GET as detailRoute } from "@/app/api/receiving-documents/[id]/route.js";
import { POST as addItemRoute } from "@/app/api/receiving-documents/[id]/items/route.js";
import { POST as submitRoute } from "@/app/api/receiving-documents/[id]/submit/route.js";
import { POST as receiptRoute } from "@/app/api/receiving-documents/[id]/receipts/route.js";
import { callRoute } from "./http.js";

export async function createOpenDocument(token, items) {
  const created = await callRoute(createDocumentRoute, {
    method: "POST",
    token,
    body: { supplier_name: "PT Sumber Beku", expected_date: "2026-10-27" },
  });
  const documentId = created.body.data.id;

  const { rows } = await query("SELECT id, sku FROM products");
  const productIdBySku = Object.fromEntries(rows.map((p) => [p.sku, p.id]));

  const itemIds = {};
  for (const [sku, expectedQty] of Object.entries(items)) {
    const added = await callRoute(addItemRoute, {
      method: "POST",
      token,
      params: { id: documentId },
      body: { product_id: productIdBySku[sku], expected_qty: expectedQty },
    });
    itemIds[sku] = added.body.data.id;
  }

  await callRoute(submitRoute, {
    method: "POST",
    token,
    params: { id: documentId },
  });
  return { documentId, itemIds };
}

export function receive(
  token,
  documentId,
  lines,
  { key = randomUUID(), notes } = {},
) {
  return callRoute(receiptRoute, {
    method: "POST",
    token,
    params: { id: documentId },
    headers: { "Idempotency-Key": key },
    body: { notes, lines },
  });
}

export async function getDocument(token, documentId) {
  const res = await callRoute(detailRoute, {
    token,
    params: { id: documentId },
  });
  return res.body.data;
}
