import { query, withTransaction } from "../lib/db.js";
import { AppError } from "../lib/errors.js";
import { listReceiptsByDocument } from "./receipts.js";

function userRef(id, fullName) {
  return id === null ? null : { id, full_name: fullName };
}

export async function listDocuments({ status, page, pageSize }) {
  const statusFilter = status ?? null;

  const countResult = await query(
    `SELECT COUNT(*)::int AS total
     FROM receiving_documents
     WHERE ($1::varchar IS NULL OR status = $1)`,
    [statusFilter],
  );

  const { rows } = await query(
    `SELECT d.id, d.doc_number, d.supplier_name, d.expected_date, d.status, d.created_at,
            COUNT(i.id)::int AS item_count,
            COALESCE(SUM(i.expected_qty), 0)::int AS total_expected,
            COALESCE(SUM(i.received_qty), 0)::int AS total_received
     FROM receiving_documents d
     LEFT JOIN receiving_items i ON i.document_id = d.id
     WHERE ($1::varchar IS NULL OR d.status = $1)
     GROUP BY d.id
     ORDER BY d.created_at DESC, d.id DESC
     LIMIT $2 OFFSET $3`,
    [statusFilter, pageSize, (page - 1) * pageSize],
  );

  return { rows, total: countResult.rows[0].total };
}

export async function getDocument(id) {
  const { rows } = await query(
    `SELECT d.id, d.doc_number, d.supplier_name, d.expected_date, d.notes, d.status,
            d.created_by, cu.full_name AS created_by_name, d.created_at,
            d.submitted_by, su.full_name AS submitted_by_name, d.submitted_at,
            d.completed_by, co.full_name AS completed_by_name, d.completed_at,
            d.cancelled_by, ca.full_name AS cancelled_by_name, d.cancelled_at,
            d.cancel_reason
     FROM receiving_documents d
     JOIN users cu ON cu.id = d.created_by
     LEFT JOIN users su ON su.id = d.submitted_by
     LEFT JOIN users co ON co.id = d.completed_by
     LEFT JOIN users ca ON ca.id = d.cancelled_by
     WHERE d.id = $1`,
    [id],
  );
  const doc = rows[0];
  if (!doc) {
    throw new AppError("DOCUMENT_NOT_FOUND", `Dokumen ${id} tidak ditemukan.`);
  }

  const items = await query(
    `SELECT i.id, i.product_id, p.sku, p.name AS product_name, p.unit,
            i.expected_qty, i.received_qty,
            i.expected_qty - i.received_qty AS remaining_qty
     FROM receiving_items i
     JOIN products p ON p.id = i.product_id
     WHERE i.document_id = $1
     ORDER BY i.id`,
    [id],
  );

  return {
    id: doc.id,
    doc_number: doc.doc_number,
    supplier_name: doc.supplier_name,
    expected_date: doc.expected_date,
    notes: doc.notes,
    status: doc.status,
    created_by: userRef(doc.created_by, doc.created_by_name),
    created_at: doc.created_at,
    submitted_by: userRef(doc.submitted_by, doc.submitted_by_name),
    submitted_at: doc.submitted_at,
    completed_by: userRef(doc.completed_by, doc.completed_by_name),
    completed_at: doc.completed_at,
    cancelled_by: userRef(doc.cancelled_by, doc.cancelled_by_name),
    cancelled_at: doc.cancelled_at,
    cancel_reason: doc.cancel_reason,
    items: items.rows,
    receipts: await listReceiptsByDocument(id),
  };
}

export async function createDocument(
  { supplier_name, expected_date, notes },
  user,
) {
  const { rows } = await query(
    `INSERT INTO receiving_documents (doc_number, supplier_name, expected_date, notes, created_by)
     VALUES (
       'RCV-' || to_char(now() AT TIME ZONE 'Asia/Jakarta', 'YYYYMMDD')
              || '-' || lpad(nextval('receiving_document_number_seq')::text, 6, '0'),
       $1, $2, $3, $4
     )
     RETURNING id`,
    [supplier_name, expected_date, notes, user.id],
  );
  return getDocument(rows[0].id);
}

const ALLOWED_STATUSES = {
  editItem: ["DRAFT"],
  submit: ["DRAFT"],
  receive: ["OPEN", "IN_PROGRESS"],
  complete: ["IN_PROGRESS"],
  cancel: ["DRAFT", "OPEN"],
};

const ACTION_LABELS = {
  editItem: "mengubah item",
  submit: "submit",
  receive: "mencatat penerimaan",
  complete: "menyelesaikan",
  cancel: "membatalkan",
};

export async function lockDocument(client, id) {
  const { rows } = await client.query(
    "SELECT id, status FROM receiving_documents WHERE id = $1 FOR UPDATE",
    [id],
  );
  if (!rows[0]) {
    throw new AppError("DOCUMENT_NOT_FOUND", `Dokumen ${id} tidak ditemukan.`);
  }
  return rows[0];
}

export function assertStatusAllows(document, action) {
  const allowed = ALLOWED_STATUSES[action];
  if (!allowed.includes(document.status)) {
    throw new AppError(
      "INVALID_DOCUMENT_STATUS",
      `Tidak bisa ${ACTION_LABELS[action]} dokumen berstatus ${document.status}. ` +
        `Aksi ini hanya bisa saat dokumen berstatus ${allowed.join(" atau ")}.`,
    );
  }
}

async function getItem(client, itemId) {
  const { rows } = await client.query(
    `SELECT i.id, i.product_id, p.sku, p.name AS product_name, p.unit,
            i.expected_qty, i.received_qty,
            i.expected_qty - i.received_qty AS remaining_qty
     FROM receiving_items i
     JOIN products p ON p.id = i.product_id
     WHERE i.id = $1`,
    [itemId],
  );
  return rows[0];
}

async function assertItemInDocument(client, documentId, itemId) {
  const { rows } = await client.query(
    "SELECT id FROM receiving_items WHERE id = $1 AND document_id = $2",
    [itemId, documentId],
  );
  if (!rows[0]) {
    throw new AppError(
      "ITEM_NOT_FOUND",
      `Item ${itemId} tidak ditemukan di dokumen ${documentId}.`,
    );
  }
}

export async function addItem(documentId, { product_id, expected_qty }) {
  return withTransaction(async (client) => {
    const document = await lockDocument(client, documentId);
    assertStatusAllows(document, "editItem");

    const product = await client.query(
      "SELECT id FROM products WHERE id = $1",
      [product_id],
    );
    if (!product.rows[0]) {
      throw new AppError(
        "PRODUCT_NOT_FOUND",
        `Produk ${product_id} tidak ditemukan.`,
      );
    }

    try {
      const { rows } = await client.query(
        `INSERT INTO receiving_items (document_id, product_id, expected_qty)
         VALUES ($1, $2, $3)
         RETURNING id`,
        [documentId, product_id, expected_qty],
      );
      return await getItem(client, rows[0].id);
    } catch (error) {
      if (
        error.code === "23505" &&
        error.constraint === "uq_receiving_items_document_product"
      ) {
        throw new AppError(
          "PRODUCT_ALREADY_IN_DOCUMENT",
          "Produk ini sudah ada di dokumen. Ubah jumlah item yang sudah ada.",
        );
      }
      throw error;
    }
  });
}

export async function updateItem(documentId, itemId, { expected_qty }) {
  return withTransaction(async (client) => {
    const document = await lockDocument(client, documentId);
    await assertItemInDocument(client, documentId, itemId);
    assertStatusAllows(document, "editItem");

    await client.query(
      `UPDATE receiving_items SET expected_qty = $1, updated_at = now()
       WHERE id = $2`,
      [expected_qty, itemId],
    );
    return getItem(client, itemId);
  });
}

export async function deleteItem(documentId, itemId) {
  await withTransaction(async (client) => {
    const document = await lockDocument(client, documentId);
    await assertItemInDocument(client, documentId, itemId);
    assertStatusAllows(document, "editItem");

    await client.query("DELETE FROM receiving_items WHERE id = $1", [itemId]);
  });
}

export async function submitDocument(documentId, user) {
  await withTransaction(async (client) => {
    const document = await lockDocument(client, documentId);
    assertStatusAllows(document, "submit");

    const { rows } = await client.query(
      "SELECT COUNT(*)::int AS item_count FROM receiving_items WHERE document_id = $1",
      [documentId],
    );
    if (rows[0].item_count === 0) {
      throw new AppError(
        "DOCUMENT_HAS_NO_ITEMS",
        "Dokumen harus memiliki minimal 1 item.",
      );
    }

    await client.query(
      `UPDATE receiving_documents
       SET status = 'OPEN', submitted_by = $1, submitted_at = now(), updated_at = now()
       WHERE id = $2`,
      [user.id, documentId],
    );
  });
  return getDocument(documentId);
}

export async function cancelDocument(documentId, { reason }, user) {
  await withTransaction(async (client) => {
    const document = await lockDocument(client, documentId);
    assertStatusAllows(document, "cancel");

    await client.query(
      `UPDATE receiving_documents
       SET status = 'CANCELLED', cancelled_by = $1, cancelled_at = now(),
           cancel_reason = $2, updated_at = now()
       WHERE id = $3`,
      [user.id, reason, documentId],
    );
  });
  return getDocument(documentId);
}
