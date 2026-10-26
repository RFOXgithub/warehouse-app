import { handle, readJson } from "@/src/lib/http.js";
import { requireUser } from "@/src/lib/auth.js";
import { parseParams } from "@/src/validators/common.js";
import { documentIdParams } from "@/src/validators/receiving-documents.js";
import {
  parseIdempotencyKey,
  createReceiptSchema,
} from "@/src/validators/receipts.js";
import { createReceipt } from "@/src/services/receipts.js";

export const POST = handle(async (request, context) => {
  const user = await requireUser(request);
  const { id } = await parseParams(documentIdParams, context);
  const idempotencyKey = parseIdempotencyKey(request);
  const input = createReceiptSchema.parse(await readJson(request));

  const { receipt, replayed } = await createReceipt(
    id,
    input,
    idempotencyKey,
    user,
  );

  if (replayed) {
    return Response.json(
      { data: receipt },
      { status: 200, headers: { "Idempotent-Replayed": "true" } },
    );
  }
  return Response.json({ data: receipt }, { status: 201 });
});
