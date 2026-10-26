import { handle, paginated } from "@/src/lib/http.js";
import { requireUser } from "@/src/lib/auth.js";
import { parseQuery } from "@/src/validators/common.js";
import { listTransactionsQuery } from "@/src/validators/inventory.js";
import { listTransactions } from "@/src/services/inventory.js";

export const GET = handle(async (request) => {
  await requireUser(request);
  const {
    product_id: productId,
    page,
    page_size: pageSize,
  } = parseQuery(listTransactionsQuery, request);
  const { rows, total } = await listTransactions({ productId, page, pageSize });
  return paginated(rows, { page, pageSize, total });
});
