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
