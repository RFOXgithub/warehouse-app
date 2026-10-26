import { handle, readJson } from "@/src/lib/http.js";
import { requireUser } from "@/src/lib/auth.js";
import { parseParams } from "@/src/validators/common.js";
import {
  documentIdParams,
  cancelDocumentSchema,
} from "@/src/validators/receiving-documents.js";
import { cancelDocument } from "@/src/services/receiving-documents.js";

export const POST = handle(async (request, context) => {
  const user = await requireUser(request, ["SUPERVISOR"]);
  const { id } = await parseParams(documentIdParams, context);
  const input = cancelDocumentSchema.parse(await readJson(request));
  return Response.json({ data: await cancelDocument(id, input, user) });
});
