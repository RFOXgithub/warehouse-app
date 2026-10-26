import { handle, readJson } from "@/src/lib/http.js";
import { requireUser } from "@/src/lib/auth.js";
import { parseParams } from "@/src/validators/common.js";
import {
  documentIdParams,
  addItemSchema,
} from "@/src/validators/receiving-documents.js";
import { addItem } from "@/src/services/receiving-documents.js";

export const POST = handle(async (request, context) => {
  await requireUser(request);
  const { id } = await parseParams(documentIdParams, context);
  const input = addItemSchema.parse(await readJson(request));
  const item = await addItem(id, input);
  return Response.json({ data: item }, { status: 201 });
});
