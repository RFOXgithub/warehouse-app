import { handle, readJson, paginated } from "@/src/lib/http.js";
import { requireUser } from "@/src/lib/auth.js";
import { parseQuery } from "@/src/validators/common.js";
import {
  listDocumentsQuery,
  createDocumentSchema,
} from "@/src/validators/receiving-documents.js";
import {
  listDocuments,
  createDocument,
} from "@/src/services/receiving-documents.js";

export const GET = handle(async (request) => {
  await requireUser(request);
  const {
    status,
    page,
    page_size: pageSize,
  } = parseQuery(listDocumentsQuery, request);
  const { rows, total } = await listDocuments({ status, page, pageSize });
  return paginated(rows, { page, pageSize, total });
});

export const POST = handle(async (request) => {
  const user = await requireUser(request);
  const input = createDocumentSchema.parse(await readJson(request));
  const document = await createDocument(input, user);
  return Response.json({ data: document }, { status: 201 });
});
