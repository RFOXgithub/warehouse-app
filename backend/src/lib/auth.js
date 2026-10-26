import { SignJWT, jwtVerify, decodeJwt } from "jose";
import { getConfig } from "./config.js";
import { AppError } from "./errors.js";

function secretKey() {
  return new TextEncoder().encode(getConfig().jwtSecret);
}

export async function signToken(user) {
  const token = await new SignJWT({
    username: user.username,
    full_name: user.full_name,
    role: user.role,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(String(user.id))
    .setIssuedAt()
    .setExpirationTime(getConfig().jwtExpiresIn)
    .sign(secretKey());

  const { exp } = decodeJwt(token);
  return { token, expiresAt: new Date(exp * 1000).toISOString() };
}

export async function requireUser(request, roles) {
  const key = secretKey(); // di luar try: konfigurasi rusak harus menjadi 500, bukan 401

  const match = /^Bearer\s+(.+)$/i.exec(
    request.headers.get("authorization") ?? "",
  );
  if (!match) {
    throw new AppError("UNAUTHENTICATED", "Silakan login terlebih dahulu.");
  }

  let payload;
  try {
    ({ payload } = await jwtVerify(match[1], key, { algorithms: ["HS256"] }));
  } catch {
    throw new AppError(
      "UNAUTHENTICATED",
      "Sesi Anda tidak valid atau sudah berakhir. Silakan login kembali.",
    );
  }

  const user = {
    id: Number(payload.sub),
    username: payload.username,
    full_name: payload.full_name,
    role: payload.role,
  };

  if (roles && !roles.includes(user.role)) {
    throw new AppError(
      "FORBIDDEN",
      "Anda tidak memiliki akses untuk aksi ini.",
    );
  }
  return user;
}
