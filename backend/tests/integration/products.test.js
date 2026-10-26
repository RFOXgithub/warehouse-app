import { describe, it, expect, beforeEach } from "vitest";
import {
  GET as listRoute,
  POST as createRoute,
} from "@/app/api/products/route.js";
import { query } from "@/src/lib/db.js";
import { callRoute } from "../helpers/http.js";
import { tokenFor } from "../helpers/db.js";

let operatorToken;
let supervisorToken;

beforeEach(async () => {
  operatorToken = await tokenFor("operator1");
  supervisorToken = await tokenFor("supervisor1");
});

function listProducts(queryString = "") {
  return callRoute(listRoute, {
    path: `/api/products${queryString}`,
    token: operatorToken,
  });
}

function createProduct(body, token = supervisorToken) {
  return callRoute(createRoute, { method: "POST", token, body });
}

describe("FR-10, FR-04: daftar produk", () => {
  it("menampilkan produk urut SKU dengan pagination berupa angka", async () => {
    const res = await listProducts();

    expect(res.status).toBe(200);
    expect(res.body.data.map((p) => p.sku)).toEqual([
      "FZ-BKS-003",
      "FZ-CHK-001",
      "FZ-SHR-002",
    ]);
    expect(res.body.pagination).toEqual({
      page: 1,
      page_size: 20,
      total: 3,
      total_pages: 1,
    });
  });

  it("page_size membatasi jumlah data per halaman", async () => {
    const res = await listProducts("?page=2&page_size=2");

    expect(res.body.data.map((p) => p.sku)).toEqual(["FZ-SHR-002"]);
    expect(res.body.pagination).toEqual({
      page: 2,
      page_size: 2,
      total: 3,
      total_pages: 2,
    });
  });

  it("page atau page_size tidak valid → 400", async () => {
    const res = await listProducts("?page=abc&page_size=101");

    expect(res.status).toBe(400);
    expect(res.body.error.details.map((d) => d.field).sort()).toEqual([
      "page",
      "page_size",
    ]);
  });

  it("tanpa token → 401", async () => {
    const res = await callRoute(listRoute, { path: "/api/products" });

    expect(res.status).toBe(401);
  });
});

describe("FR-11: pencarian produk", () => {
  it('US-02 AC4: "ayam" menemukan "Ayam Fillet" (tidak peka huruf besar/kecil)', async () => {
    const res = await listProducts("?q=ayam");

    expect(res.body.data.map((p) => p.name)).toEqual(["Ayam Fillet"]);
  });

  it("karakter % dan _ dicari sebagai teks biasa, bukan wildcard", async () => {
    await createProduct({
      sku: "PROMO-50",
      name: "Diskon 50% Ayam",
      unit: "KARTON",
    });
    await createProduct({
      sku: "PROMO-500",
      name: "Diskon 500 Ayam",
      unit: "KARTON",
    });

    const res = await listProducts(`?q=${encodeURIComponent("50%")}`);

    expect(res.body.data.map((p) => p.name)).toEqual(["Diskon 50% Ayam"]);
  });
});

describe("FR-12: tambah produk", () => {
  it("US-02 AC1: SKU disimpan huruf besar dan stok awal 0", async () => {
    const res = await createProduct({
      sku: " fz-sap-004 ",
      name: "Daging Sapi Giling",
      unit: "KG",
    });

    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({
      sku: "FZ-SAP-004",
      name: "Daging Sapi Giling",
      unit: "KG",
    });

    const balance = await query(
      "SELECT on_hand_qty FROM inventory_balances WHERE product_id = $1",
      [res.body.data.id],
    );
    expect(balance.rows).toEqual([{ on_hand_qty: 0 }]);
  });

  it("US-02 AC2: SKU yang sudah ada (beda huruf besar/kecil) → 409", async () => {
    const res = await createProduct({
      sku: "fz-chk-001",
      name: "Ayam Lain",
      unit: "KARTON",
    });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("SKU_ALREADY_EXISTS");
  });

  it("US-02 AC3: operator → 403, walaupun datanya juga tidak valid", async () => {
    const res = await createProduct({ sku: "x" }, operatorToken);

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("FORBIDDEN");
  });

  it("data tidak valid dan field asing → 400 dengan detail per field", async () => {
    const res = await createProduct({
      sku: "FZ X",
      name: "   ",
      unit: "KG",
      harga: 5000,
    });

    expect(res.status).toBe(400);
    expect(res.body.error.details.map((d) => d.field).sort()).toEqual([
      "harga",
      "name",
      "sku",
    ]);
  });
});
