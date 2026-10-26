import { z } from "zod";
import { paginationShape, idParam, optionalText } from "./common.js";

export const DOCUMENT_STATUSES = [
  "DRAFT",
  "OPEN",
  "IN_PROGRESS",
  "COMPLETED",
  "CANCELLED",
];

export const documentIdParams = z.object({ id: idParam("id") });

export const itemParams = z.object({
  id: idParam("id"),
  itemId: idParam("itemId"),
});

const expectedQty = z
  .number({ error: "Jumlah diharapkan wajib diisi dan berupa angka." })
  .int("Jumlah diharapkan harus bilangan bulat.")
  .min(1, "Jumlah diharapkan minimal 1.")
  .max(1000000, "Jumlah diharapkan maksimal 1.000.000.");

export const addItemSchema = z.strictObject({
  product_id: z
    .number({ error: "product_id wajib diisi dan berupa angka." })
    .int("product_id harus bilangan bulat.")
    .min(1, "product_id harus lebih dari 0.")
    .max(2147483647, "product_id terlalu besar."),
  expected_qty: expectedQty,
});

export const updateItemSchema = z.strictObject({ expected_qty: expectedQty });

export const cancelDocumentSchema = z.strictObject({
  reason: z
    .string({ error: "Alasan pembatalan wajib diisi dan berupa teks." })
    .trim()
    .min(1, "Alasan pembatalan wajib diisi.")
    .max(500, "Alasan pembatalan maksimal 500 karakter."),
});

export const listDocumentsQuery = z.object({
  ...paginationShape,
  status: z
    .enum(DOCUMENT_STATUSES, {
      error: `status harus salah satu dari: ${DOCUMENT_STATUSES.join(", ")}.`,
    })
    .optional(),
});

export const createDocumentSchema = z.strictObject({
  supplier_name: z
    .string({ error: "Nama supplier wajib diisi dan berupa teks." })
    .trim()
    .min(1, "Nama supplier wajib diisi.")
    .max(150, "Nama supplier maksimal 150 karakter."),
  expected_date: z.iso.date({
    error: "Tanggal rencana wajib diisi dengan format YYYY-MM-DD yang valid.",
  }),
  notes: optionalText(500, "Catatan"),
});
