import { handle } from "@/src/lib/http.js";
import { requireUser } from "@/src/lib/auth.js";
import { parseParams } from "@/src/validators/common.js";
import { documentIdParams } from "@/src/validators/receiving-documents.js";
import { submitDocument } from "@/src/services/receiving-documents.js";

export const POST = handle(async (request, context) => {
  const user = await requireUser(request);
  const { id } = await parseParams(documentIdParams, context);
  return Response.json({ data: await submitDocument(id, user) });
});
