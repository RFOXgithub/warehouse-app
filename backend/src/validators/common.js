import { z } from "zod";

export const paginationShape = {
  page: z.coerce
    .number({ error: "page harus berupa angka." })
    .int("page harus bilangan bulat.")
    .min(1, "page minimal 1.")
    .default(1),
  page_size: z.coerce
    .number({ error: "page_size harus berupa angka." })
    .int("page_size harus bilangan bulat.")
    .min(1, "page_size minimal 1.")
    .max(100, "page_size maksimal 100.")
    .default(20),
};

export function parseQuery(schema, request) {
  return schema.parse(Object.fromEntries(new URL(request.url).searchParams));
}

export function idParam(name) {
  return z.coerce
    .number({ error: `${name} harus berupa angka.` })
    .int(`${name} harus bilangan bulat.`)
    .min(1, `${name} harus lebih dari 0.`)
    .max(2147483647, `${name} terlalu besar.`);
}

export async function parseParams(schema, context) {
  return schema.parse(await context.params);
}

export function optionalText(max, label) {
  return z
    .string({ error: `${label} harus berupa teks.` })
    .trim()
    .max(max, `${label} maksimal ${max} karakter.`)
    .nullish()
    .transform((value) => value || null);
}
