import { createHash } from "node:crypto";
import { query, withTransaction } from "../lib/db.js";
import { AppError } from "../lib/errors.js";
import { lockDocument, assertStatusAllows } from "./document-rules.js";

async function loadReceipts(filter, value) {
  const receipts = await query(
    `SELECT r.id, r.receipt_number, r.document_id, r.notes, r.received_at,
            u.id AS received_by_id, u.full_name AS received_by_name
     FROM receipts r
     JOIN users u ON u.id = r.received_by
     WHERE ${filter}
     ORDER BY r.id`,
    [value],
  );

  const lines = await query(
    `SELECT t.id AS transaction_id, t.receipt_id, t.receiving_item_id AS item_id,
            t.product_id, p.sku, p.name AS product_name, t.quantity, t.balance_after
     FROM inventory_transactions t
     JOIN receipts r ON r.id = t.receipt_id
     JOIN products p ON p.id = t.product_id
     WHERE ${filter}
     ORDER BY t.id`,
    [value],
  );

  return receipts.rows.map((receipt) => ({
    id: receipt.id,
    receipt_number: receipt.receipt_number,
    document_id: receipt.document_id,
    notes: receipt.notes,
    received_by: {
      id: receipt.received_by_id,
      full_name: receipt.received_by_name,
    },
    received_at: receipt.received_at,
    lines: lines.rows
      .filter((line) => line.receipt_id === receipt.id)
      .map(({ receipt_id, ...line }) => line),
  }));
}

export function listReceiptsByDocument(documentId) {
  return loadReceipts("r.document_id = $1", documentId);
}

async function getReceipt(receiptId) {
  const [receipt] = await loadReceipts("r.id = $1", receiptId);
  return receipt;
}

export function receiptRequestHash(documentId, { notes, lines }) {
  const sortedLines = [...lines]
    .sort((a, b) => a.item_id - b.item_id)
    .map((line) => [line.item_id, line.quantity]);
  const canonical = JSON.stringify({
    document_id: documentId,
    notes: notes ?? null,
    lines: sortedLines,
  });
  return createHash("sha256").update(canonical).digest("hex");
}

export async function createReceipt(documentId, input, idempotencyKey, user) {
  const requestHash = receiptRequestHash(documentId, input);
  let result;
  try {
    result = await recordReceipt(
      documentId,
      input,
      idempotencyKey,
      requestHash,
      user,
    );
  } catch (error) {
    if (
      error.code === "23505" &&
      error.constraint === "receipts_idempotency_key_key"
    ) {
      result = await recordReceipt(
        documentId,
        input,
        idempotencyKey,
        requestHash,
        user,
      );
    } else {
      throw error;
    }
  }
  return {
    receipt: await getReceipt(result.receiptId),
    replayed: result.replayed,
  };
}

function recordReceipt(
  documentId,
  { notes, lines },
  idempotencyKey,
  requestHash,
  user,
) {
  return withTransaction(async (client) => {
    const document = await lockDocument(client, documentId);

    const existing = await client.query(
      "SELECT id, request_hash FROM receipts WHERE idempotency_key = $1",
      [idempotencyKey],
    );
    if (existing.rows[0]) {
      if (existing.rows[0].request_hash !== requestHash) {
        throw new AppError(
          "IDEMPOTENCY_KEY_CONFLICT",
          "Idempotency-Key ini sudah dipakai untuk isi penerimaan yang berbeda.",
        );
      }
      return { receiptId: existing.rows[0].id, replayed: true };
    }

    assertStatusAllows(document, "receive");

    const items = await loadItemsById(client, documentId);
    assertLinesValid(lines, items);

    const { rows } = await client.query(
      `INSERT INTO receipts
         (receipt_number, document_id, idempotency_key, request_hash, notes, received_by)
       VALUES (
         'GR-' || to_char(now() AT TIME ZONE 'Asia/Jakarta', 'YYYYMMDD')
               || '-' || lpad(nextval('receipt_number_seq')::text, 6, '0'),
         $1, $2, $3, $4, $5
       )
       RETURNING id`,
      [documentId, idempotencyKey, requestHash, notes, user.id],
    );
    const receiptId = rows[0].id;

    const sortedLines = [...lines].sort(
      (a, b) =>
        items.get(a.item_id).product_id - items.get(b.item_id).product_id,
    );
    for (const line of sortedLines) {
      const item = items.get(line.item_id);

      await client.query(
        `UPDATE receiving_items
         SET received_qty = received_qty + $1, updated_at = now()
         WHERE id = $2`,
        [line.quantity, item.id],
      );

      const balance = await client.query(
        `UPDATE inventory_balances
         SET on_hand_qty = on_hand_qty + $1, updated_at = now()
         WHERE product_id = $2
         RETURNING on_hand_qty`,
        [line.quantity, item.product_id],
      );

      await client.query(
        `INSERT INTO inventory_transactions
           (product_id, type, quantity, balance_after, receipt_id, receiving_item_id, created_by)
         VALUES ($1, 'RECEIPT', $2, $3, $4, $5, $6)`,
        [
          item.product_id,
          line.quantity,
          balance.rows[0].on_hand_qty,
          receiptId,
          item.id,
          user.id,
        ],
      );
    }

    if (document.status === "OPEN") {
      await client.query(
        `UPDATE receiving_documents SET status = 'IN_PROGRESS', updated_at = now()
         WHERE id = $1`,
        [documentId],
      );
    }

    return { receiptId, replayed: false };
  });
}

async function loadItemsById(client, documentId) {
  const { rows } = await client.query(
    `SELECT i.id, i.product_id, i.expected_qty, i.received_qty, p.sku, p.name
     FROM receiving_items i
     JOIN products p ON p.id = i.product_id
     WHERE i.document_id = $1`,
    [documentId],
  );
  return new Map(rows.map((item) => [item.id, item]));
}

function assertLinesValid(lines, items) {
  const notInDocument = [];
  const exceeding = [];

  lines.forEach((line, index) => {
    const lineNumber = index + 1;
    const item = items.get(line.item_id);
    if (!item) {
      notInDocument.push({
        line: lineNumber,
        item_id: line.item_id,
        message: `Item ${line.item_id} tidak ada di dokumen ini.`,
      });
      return;
    }
    const remaining = item.expected_qty - item.received_qty;
    if (line.quantity > remaining) {
      exceeding.push({
        line: lineNumber,
        item_id: item.id,
        sku: item.sku,
        remaining,
        requested: line.quantity,
        message: `${item.name}: maksimal ${remaining}, diminta ${line.quantity}.`,
      });
    }
  });

  if (notInDocument.length > 0) {
    const details = [...notInDocument, ...exceeding].sort(
      (a, b) => a.line - b.line,
    );
    throw new AppError(
      "ITEM_NOT_IN_DOCUMENT",
      "Ada item yang bukan milik dokumen ini.",
      details,
    );
  }
  if (exceeding.length > 0) {
    throw new AppError(
      "QUANTITY_EXCEEDS_REMAINING",
      `Jumlah yang diterima melebihi sisa pada ${exceeding.length} baris.`,
      exceeding,
    );
  }
}
