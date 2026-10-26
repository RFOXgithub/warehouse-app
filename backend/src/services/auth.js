import bcrypt from "bcryptjs";
import { query } from "../lib/db.js";
import { AppError } from "../lib/errors.js";
import { signToken } from "../lib/auth.js";

const DUMMY_HASH =
  "$2b$10$g1lrf9j3s2YjczpwlNf8/Ot4b3BqOrWYCSxL.fEQ/dq.kvj2sYH4.";

export async function login({ username, password }) {
  const { rows } = await query(
    "SELECT id, username, password_hash, full_name, role FROM users WHERE username = $1",
    [username],
  );
  const user = rows[0];

  const passwordOk = await bcrypt.compare(
    password,
    user ? user.password_hash : DUMMY_HASH,
  );
  if (!user || !passwordOk) {
    throw new AppError("INVALID_CREDENTIALS", "Username atau password salah.");
  }

  const { token, expiresAt } = await signToken(user);
  return {
    token,
    expires_at: expiresAt,
    user: {
      id: user.id,
      username: user.username,
      full_name: user.full_name,
      role: user.role,
    },
  };
}
