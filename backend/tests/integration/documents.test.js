import { describe, it, expect, beforeEach } from "vitest";
import {
  GET as listRoute,
  POST as createRoute,
} from "@/app/api/receiving-documents/route.js";
import { GET as detailRoute } from "@/app/api/receiving-documents/[id]/route.js";
import { query } from "@/src/lib/db.js";
import { callRoute } from "../helpers/http.js";
import { tokenFor } from "../helpers/db.js";

let operatorToken;

beforeEach(async () => {
  operatorToken = await tokenFor("operator1");
});

function createDocument(body) {
  return callRoute(createRoute, { method: "POST", token: operatorToken, body });
}

function getDocument(id) {
  return callRoute(detailRoute, { token: operatorToken, params: { id } });
}

function listDocuments(queryString = "") {
  return callRoute(listRoute, {
    path: `/api/receiving-documents${queryString}`,
    token: operatorToken,
  });
}

function todayWib() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta" })
    .format(new Date())
    .replaceAll("-", "");
}

describe("FR-23, FR-24: buat dokumen", () => {
  it("US-03 AC1: status DRAFT, nomor RCV-<tanggal WIB>-000001, pembuat tercatat", async () => {
    const res = await createDocument({
      supplier_name: "PT Sumber Beku",
      expected_date: "2026-10-27",
      notes: "Kiriman mingguan",
    });

    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({
      doc_number: `RCV-${todayWib()}-000001`,
      supplier_name: "PT Sumber Beku",
      expected_date: "2026-10-27",
      notes: "Kiriman mingguan",
      status: "DRAFT",
      created_by: { id: expect.any(Number), full_name: "Operator Satu" },
      submitted_by: null,
      completed_by: null,
      cancelled_by: null,
      items: [],
      receipts: [],
    });
  });

  it("nomor urut terus bertambah dan catatan kosong disimpan sebagai null", async () => {
    await createDocument({
      supplier_name: "PT A",
      expected_date: "2026-10-27",
    });
    const second = await createDocument({
      supplier_name: "PT B",
      expected_date: "2026-10-28",
      notes: "   ",
    });

    expect(second.body.data.doc_number).toBe(`RCV-${todayWib()}-000002`);
    expect(second.body.data.notes).toBeNull();
  });

  it("supplier kosong, tanggal tidak valid, dan field asing → 400", async () => {
    const res = await createDocument({
      supplier_name: "  ",
      expected_date: "2026-02-30",
      status: "COMPLETED",
    });

    expect(res.status).toBe(400);
    expect(res.body.error.details.map((d) => d.field).sort()).toEqual([
      "expected_date",
      "status",
      "supplier_name",
    ]);
  });

  it("tanpa token → 401", async () => {
    const res = await callRoute(createRoute, {
      method: "POST",
      body: { supplier_name: "PT A", expected_date: "2026-10-27" },
    });

    expect(res.status).toBe(401);
  });
});

describe("FR-25: detail dokumen", () => {
  it("menampilkan item dengan sisa yang dihitung", async () => {
    const created = await createDocument({
      supplier_name: "PT Sumber Beku",
      expected_date: "2026-10-27",
    });
    const id = created.body.data.id;

    await query(
      `INSERT INTO receiving_items (document_id, product_id, expected_qty)
       SELECT $1, id, 100 FROM products WHERE sku = 'FZ-CHK-001'`,
      [id],
    );

    const res = await getDocument(id);

    expect(res.status).toBe(200);
    expect(res.body.data.items).toEqual([
      {
        id: expect.any(Number),
        product_id: expect.any(Number),
        sku: "FZ-CHK-001",
        product_name: "Ayam Fillet",
        unit: "KARTON",
        expected_qty: 100,
        received_qty: 0,
        remaining_qty: 100,
      },
    ]);
  });

  it("dokumen tidak ada → 404", async () => {
    const res = await getDocument(999);

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("DOCUMENT_NOT_FOUND");
  });

  it.each(["abc", "0", "-5", "1.5", "99999999999"])(
    "id %s bukan bilangan bulat positif → 400",
    async (id) => {
      const res = await getDocument(id);

      expect(res.status).toBe(400);
      expect(res.body.error.details[0].field).toBe("id");
    },
  );
});

describe("FR-20, FR-21, FR-22: daftar dokumen", () => {
  beforeEach(async () => {
    await createDocument({
      supplier_name: "PT Lama",
      expected_date: "2026-10-27",
    });
    const latest = await createDocument({
      supplier_name: "PT Baru",
      expected_date: "2026-10-28",
    });

    await query(
      `INSERT INTO receiving_items (document_id, product_id, expected_qty, received_qty)
       SELECT $1::int, id, 100, 60 FROM products WHERE sku = 'FZ-CHK-001'
       UNION ALL
       SELECT $1::int, id, 70, 50 FROM products WHERE sku = 'FZ-SHR-002'`,
      [latest.body.data.id],
    );
    await query(
      `UPDATE receiving_documents SET status = 'IN_PROGRESS' WHERE id = $1`,
      [latest.body.data.id],
    );
  });

  it("US-09 AC1: terbaru di atas, dengan jumlah item dan progres berupa angka", async () => {
    const res = await listDocuments();

    expect(res.status).toBe(200);
    expect(res.body.data.map((d) => d.supplier_name)).toEqual([
      "PT Baru",
      "PT Lama",
    ]);
    expect(res.body.data[0]).toMatchObject({
      item_count: 2,
      total_expected: 170,
      total_received: 110,
    });
    expect(res.body.data[1]).toMatchObject({
      item_count: 0,
      total_expected: 0,
      total_received: 0,
    });
    expect(res.body.pagination.total).toBe(2);
  });

  it("FR-21: filter status", async () => {
    const res = await listDocuments("?status=IN_PROGRESS");

    expect(res.body.data.map((d) => d.supplier_name)).toEqual(["PT Baru"]);
    expect(res.body.pagination.total).toBe(1);
  });

  it("status tidak dikenal → 400", async () => {
    const res = await listDocuments("?status=SELESAI");

    expect(res.status).toBe(400);
    expect(res.body.error.details[0].field).toBe("status");
  });
});
