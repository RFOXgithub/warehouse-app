import { handle, readJson } from "@/src/lib/http.js";
import { loginSchema } from "@/src/validators/auth.js";
import { login } from "@/src/services/auth.js";

export const POST = handle(async (request) => {
  const input = loginSchema.parse(await readJson(request));
  const result = await login(input);
  return Response.json({ data: result });
});
