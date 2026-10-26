import { z } from "zod";
import { paginationShape, idParam } from "./common.js";

export const listInventoryQuery = z.object({ ...paginationShape });

export const listTransactionsQuery = z.object({
  ...paginationShape,
  product_id: idParam("product_id").optional(),
});
