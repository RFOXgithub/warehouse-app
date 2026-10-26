import { handle, readJson } from "@/src/lib/http.js";
import { requireUser } from "@/src/lib/auth.js";
import { parseParams } from "@/src/validators/common.js";
import {
  itemParams,
  updateItemSchema,
} from "@/src/validators/receiving-documents.js";
import { updateItem, deleteItem } from "@/src/services/receiving-documents.js";

export const PATCH = handle(async (request, context) => {
  await requireUser(request);
  const { id, itemId } = await parseParams(itemParams, context);
  const input = updateItemSchema.parse(await readJson(request));
  const item = await updateItem(id, itemId, input);
  return Response.json({ data: item });
});

export const DELETE = handle(async (request, context) => {
  await requireUser(request);
  const { id, itemId } = await parseParams(itemParams, context);
  await deleteItem(id, itemId);
  return new Response(null, { status: 204 });
});
