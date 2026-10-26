import { query } from "../lib/db.js";

export async function listReceiptsByDocument(documentId) {
  const receipts = await query(
    `SELECT r.id, r.receipt_number, r.document_id, r.notes, r.received_at,
            u.id AS received_by_id, u.full_name AS received_by_name
     FROM receipts r
     JOIN users u ON u.id = r.received_by
     WHERE r.document_id = $1
     ORDER BY r.id`,
    [documentId],
  );

  const lines = await query(
    `SELECT t.id AS transaction_id, t.receipt_id, t.receiving_item_id AS item_id,
            t.product_id, p.sku, p.name AS product_name, t.quantity, t.balance_after
     FROM inventory_transactions t
     JOIN receipts r ON r.id = t.receipt_id
     JOIN products p ON p.id = t.product_id
     WHERE r.document_id = $1
     ORDER BY t.id`,
    [documentId],
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
