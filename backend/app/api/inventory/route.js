import { handle, paginated } from "@/src/lib/http.js";
import { requireUser } from "@/src/lib/auth.js";
import { parseQuery } from "@/src/validators/common.js";
import { listInventoryQuery } from "@/src/validators/inventory.js";
import { listInventory } from "@/src/services/inventory.js";

export const GET = handle(async (request) => {
  await requireUser(request);
  const { page, page_size: pageSize } = parseQuery(listInventoryQuery, request);
  const { rows, total } = await listInventory({ page, pageSize });
  return paginated(rows, { page, pageSize, total });
});
