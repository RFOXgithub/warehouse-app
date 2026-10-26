import { AppError } from "../lib/errors.js";

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
