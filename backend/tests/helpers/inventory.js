import { expect } from "vitest";
import { query } from "@/src/lib/db.js";

export async function assertInventoryConsistent() {
  const stock = await query(
    `SELECT b.product_id, b.on_hand_qty, COALESCE(SUM(t.quantity), 0)::int AS total
     FROM inventory_balances b
     LEFT JOIN inventory_transactions t ON t.product_id = b.product_id
     GROUP BY b.product_id, b.on_hand_qty`,
  );
  for (const row of stock.rows) {
    expect(row.on_hand_qty, `stok produk ${row.product_id}`).toBe(row.total);
  }

  const items = await query(
    `SELECT i.id, i.expected_qty, i.received_qty, COALESCE(SUM(t.quantity), 0)::int AS total
     FROM receiving_items i
     LEFT JOIN inventory_transactions t ON t.receiving_item_id = i.id
     GROUP BY i.id`,
  );
  for (const item of items.rows) {
    expect(item.received_qty, `received_qty item ${item.id}`).toBe(item.total);
    expect(
      item.received_qty,
      `item ${item.id} melebihi rencana`,
    ).toBeLessThanOrEqual(item.expected_qty);
  }

  const mismatched = await query(
    `SELECT t.id
     FROM inventory_transactions t
     JOIN receipts r ON r.id = t.receipt_id
     JOIN receiving_items i ON i.id = t.receiving_item_id
     WHERE r.document_id <> i.document_id`,
  );
  expect(
    mismatched.rows,
    "transaksi dengan receipt & item beda dokumen",
  ).toEqual([]);
}

export async function stockBySku() {
  const { rows } = await query(
    `SELECT p.sku, b.on_hand_qty
     FROM inventory_balances b JOIN products p ON p.id = b.product_id`,
  );
  return Object.fromEntries(rows.map((row) => [row.sku, row.on_hand_qty]));
}
