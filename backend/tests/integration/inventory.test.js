import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as inventoryRoute from "@/app/api/inventory/route.js";
import * as transactionsRoute from "@/app/api/inventory/transactions/route.js";
import { query } from "@/src/lib/db.js";
import { callRoute } from "../helpers/http.js";
import { tokenFor } from "../helpers/db.js";
import { createOpenDocument, receive } from "../helpers/documents.js";
import { assertInventoryConsistent } from "../helpers/inventory.js";

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

function listInventory(queryString = "") {
  return callRoute(inventoryRoute.GET, {
    path: `/api/inventory${queryString}`,
    token: operatorToken,
  });
}

function listTransactions(queryString = "") {
  return callRoute(transactionsRoute.GET, {
    path: `/api/inventory/transactions${queryString}`,
    token: operatorToken,
  });
}

describe("FR-40: daftar stok", () => {
  it("US-09 AC2: semua produk tampil urut SKU, termasuk yang stoknya 0", async () => {
    const res = await listInventory();

    expect(res.status).toBe(200);
    expect(res.body.data.map((row) => [row.sku, row.on_hand_qty])).toEqual([
      ["FZ-BKS-003", 0],
      ["FZ-CHK-001", 0],
      ["FZ-SHR-002", 0],
    ]);
    expect(res.body.pagination).toEqual({
      page: 1,
      page_size: 20,
      total: 3,
      total_pages: 1,
    });
  });

  it("US-09 AC2: setelah Ayam diterima 60 lalu 40, stok Ayam tampil 100", async () => {
    await receive(operatorToken, documentId, [{ item_id: ayam, quantity: 60 }]);
    await receive(operatorToken, documentId, [{ item_id: ayam, quantity: 40 }]);

    const res = await listInventory();

    const ayamRow = res.body.data.find((row) => row.sku === "FZ-CHK-001");
    expect(ayamRow).toMatchObject({
      name: "Ayam Fillet",
      unit: "KARTON",
      on_hand_qty: 100,
    });
  });

  it("tanpa token → 401", async () => {
    const res = await callRoute(inventoryRoute.GET, { path: "/api/inventory" });

    expect(res.status).toBe(401);
  });

  it("FR-43: tidak ada endpoint untuk mengubah stok secara manual", () => {
    expect(Object.keys(inventoryRoute)).toEqual(["GET"]);
    expect(Object.keys(transactionsRoute)).toEqual(["GET"]);
  });
});

describe("FR-41, FR-42: riwayat transaksi stok", () => {
  beforeEach(async () => {
    await receive(operatorToken, documentId, [
      { item_id: ayam, quantity: 60 },
      { item_id: udang, quantity: 50 },
    ]);
    await receive(operatorToken, documentId, [{ item_id: ayam, quantity: 40 }]);
  });

  it("US-09 AC3: terbaru di atas, lengkap dengan receipt, dokumen, dan user", async () => {
    const res = await listTransactions();

    expect(res.status).toBe(200);
    expect(
      res.body.data.map((t) => [t.sku, t.quantity, t.balance_after]),
    ).toEqual([
      ["FZ-CHK-001", 40, 100],
      ["FZ-SHR-002", 50, 50],
      ["FZ-CHK-001", 60, 60],
    ]);
    expect(res.body.data[0]).toMatchObject({
      type: "RECEIPT",
      product_name: "Ayam Fillet",
      receipt_number: expect.stringMatching(/^GR-\d{8}-000002$/),
      doc_number: expect.stringMatching(/^RCV-\d{8}-000001$/),
      created_by: { id: expect.any(Number), full_name: "Operator Satu" },
    });
    expect(res.body.pagination.total).toBe(3);
  });

  it("FR-42: filter berdasarkan produk", async () => {
    const { rows } = await query(
      "SELECT id FROM products WHERE sku = 'FZ-CHK-001'",
    );

    const res = await listTransactions(`?product_id=${rows[0].id}`);

    expect(res.body.data.map((t) => t.quantity)).toEqual([40, 60]);
    expect(res.body.pagination.total).toBe(2);
  });

  it("product_id bukan bilangan bulat positif → 400", async () => {
    const res = await listTransactions("?product_id=abc");

    expect(res.status).toBe(400);
    expect(res.body.error.details[0].field).toBe("product_id");
  });
});
