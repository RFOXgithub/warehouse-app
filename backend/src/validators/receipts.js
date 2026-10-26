import { z } from "zod";
import { optionalText } from "./common.js";

const idempotencyKeySchema = z.object({
  "Idempotency-Key": z
    .string({ error: "Header Idempotency-Key wajib dikirim." })
    .min(8, "Idempotency-Key minimal 8 karakter.")
    .max(100, "Idempotency-Key maksimal 100 karakter."),
});

export function parseIdempotencyKey(request) {
  const value = request.headers.get("idempotency-key") ?? undefined;
  return idempotencyKeySchema.parse({ "Idempotency-Key": value })[
    "Idempotency-Key"
  ];
}

const receiptLineSchema = z.strictObject({
  item_id: z
    .number({ error: "item_id wajib diisi dan berupa angka." })
    .int("item_id harus bilangan bulat.")
    .min(1, "item_id harus lebih dari 0.")
    .max(2147483647, "item_id terlalu besar."),
  quantity: z
    .number({ error: "Jumlah diterima wajib diisi dan berupa angka." })
    .int("Jumlah diterima harus bilangan bulat.")
    .min(1, "Jumlah diterima minimal 1."),
});

export const createReceiptSchema = z
  .strictObject({
    notes: optionalText(500, "Catatan"),
    lines: z
      .array(receiptLineSchema, {
        error: "lines wajib diisi dan berupa daftar.",
      })
      .min(1, "Minimal 1 baris penerimaan."),
  })
  .superRefine((data, ctx) => {
    const seen = new Set();
    data.lines.forEach((line, index) => {
      if (seen.has(line.item_id)) {
        ctx.addIssue({
          code: "custom",
          path: ["lines", index, "item_id"],
          message: "Item ini muncul lebih dari sekali dalam satu penerimaan.",
        });
      }
      seen.add(line.item_id);
    });
  });
