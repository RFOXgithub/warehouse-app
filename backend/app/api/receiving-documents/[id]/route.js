import { handle } from "@/src/lib/http.js";
import { requireUser } from "@/src/lib/auth.js";
import { parseParams } from "@/src/validators/common.js";
import { documentIdParams } from "@/src/validators/receiving-documents.js";
import { getDocument } from "@/src/services/receiving-documents.js";

export const GET = handle(async (request, context) => {
  await requireUser(request);
  const { id } = await parseParams(documentIdParams, context);
  return Response.json({ data: await getDocument(id) });
});
