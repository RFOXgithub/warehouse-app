import { handle, readJson, paginated } from "@/src/lib/http.js";
import { requireUser } from "@/src/lib/auth.js";
import { parseQuery } from "@/src/validators/common.js";
import {
  listProductsQuery,
  createProductSchema,
} from "@/src/validators/products.js";
import { listProducts, createProduct } from "@/src/services/products.js";

export const GET = handle(async (request) => {
  await requireUser(request);
  const {
    q,
    page,
    page_size: pageSize,
  } = parseQuery(listProductsQuery, request);
  const { rows, total } = await listProducts({ q, page, pageSize });
  return paginated(rows, { page, pageSize, total });
});

export const POST = handle(async (request) => {
  const user = await requireUser(request, ["SUPERVISOR"]);
  const input = createProductSchema.parse(await readJson(request));
  const product = await createProduct(input, user);
  return Response.json({ data: product }, { status: 201 });
});
