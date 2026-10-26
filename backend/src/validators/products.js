import { z } from "zod";
import { paginationShape } from "./common.js";

export const listProductsQuery = z.object({
  ...paginationShape,
  q: z
    .string()
    .trim()
    .max(100, "Kata pencarian maksimal 100 karakter.")
    .optional(),
});

export const createProductSchema = z.strictObject({
  sku: z
    .string({ error: "SKU wajib diisi dan berupa teks." })
    .trim()
    .regex(
      /^[A-Za-z0-9-]{3,50}$/,
      "SKU harus 3–50 karakter, hanya huruf, angka, dan tanda -.",
    )
    .transform((value) => value.toUpperCase()),
  name: z
    .string({ error: "Nama wajib diisi dan berupa teks." })
    .trim()
    .min(1, "Nama wajib diisi.")
    .max(150, "Nama maksimal 150 karakter."),
  unit: z
    .string({ error: "Satuan wajib diisi dan berupa teks." })
    .trim()
    .min(1, "Satuan wajib diisi.")
    .max(20, "Satuan maksimal 20 karakter."),
});
