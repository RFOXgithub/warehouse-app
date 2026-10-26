import { handle } from "@/src/lib/http.js";
import { requireUser } from "@/src/lib/auth.js";

export const GET = handle(async (request) => {
  const user = await requireUser(request);
  return Response.json({ data: user });
});
