import { z } from "zod";

export const loginSchema = z.strictObject({
  username: z
    .string({ error: "Username wajib diisi dan berupa teks." })
    .trim()
    .min(1, "Username wajib diisi.")
    .max(50, "Username maksimal 50 karakter."),
  password: z
    .string({ error: "Password wajib diisi dan berupa teks." })
    .min(1, "Password wajib diisi.")
    .max(100, "Password maksimal 100 karakter."),
});
