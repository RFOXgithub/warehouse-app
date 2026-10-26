import { query } from "../lib/db.js";

export async function listInventory({ page, pageSize }) {
  const countResult = await query(
    "SELECT COUNT(*)::int AS total FROM products",
  );

  const { rows } = await query(
    `SELECT p.id AS product_id, p.sku, p.name, p.unit,
            COALESCE(b.on_hand_qty, 0) AS on_hand_qty,
            COALESCE(b.updated_at, p.created_at) AS updated_at
     FROM products p
     LEFT JOIN inventory_balances b ON b.product_id = p.id
     ORDER BY p.sku
     LIMIT $1 OFFSET $2`,
    [pageSize, (page - 1) * pageSize],
  );

  return { rows, total: countResult.rows[0].total };
}

export async function listTransactions({ productId, page, pageSize }) {
  const productFilter = productId ?? null;

  const countResult = await query(
    `SELECT COUNT(*)::int AS total
     FROM inventory_transactions
     WHERE ($1::int IS NULL OR product_id = $1)`,
    [productFilter],
  );

  const { rows } = await query(
    `SELECT t.id, t.created_at, t.product_id, p.sku, p.name AS product_name,
            t.type, t.quantity, t.balance_after,
            r.receipt_number, d.doc_number,
            u.id AS created_by_id, u.full_name AS created_by_name
     FROM inventory_transactions t
     JOIN products p ON p.id = t.product_id
     JOIN receipts r ON r.id = t.receipt_id
     JOIN receiving_documents d ON d.id = r.document_id
     JOIN users u ON u.id = t.created_by
     WHERE ($1::int IS NULL OR t.product_id = $1)
     ORDER BY t.created_at DESC, t.id DESC
     LIMIT $2 OFFSET $3`,
    [productFilter, pageSize, (page - 1) * pageSize],
  );

  return {
    rows: rows.map(({ created_by_id, created_by_name, ...transaction }) => ({
      ...transaction,
      created_by: { id: created_by_id, full_name: created_by_name },
    })),
    total: countResult.rows[0].total,
  };
}
