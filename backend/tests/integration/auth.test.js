import { describe, it, expect } from "vitest";
import { SignJWT } from "jose";
import { POST as loginRoute } from "@/app/api/auth/login/route.js";
import { GET as meRoute } from "@/app/api/auth/me/route.js";
import { callRoute } from "../helpers/http.js";
import { PASSWORDS, tokenFor } from "../helpers/db.js";

function login(body) {
  return callRoute(loginRoute, { method: "POST", body });
}

function makeToken({ secret, expiresAt }) {
  return new SignJWT({
    username: "operator1",
    full_name: "Operator Satu",
    role: "OPERATOR",
  })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject("2")
    .setExpirationTime(expiresAt)
    .sign(new TextEncoder().encode(secret));
}

describe("US-01: login", () => {
  it("AC1: username & password benar → 200, token, dan data user tanpa password_hash", async () => {
    const res = await login({
      username: "operator1",
      password: PASSWORDS.operator1,
    });

    expect(res.status).toBe(200);
    expect(res.body.data.token).toEqual(expect.any(String));
    expect(res.body.data.user).toEqual({
      id: expect.any(Number),
      username: "operator1",
      full_name: "Operator Satu",
      role: "OPERATOR",
    });
  });

  it("AC2: password salah dan username tak terdaftar → 401 dengan pesan yang sama", async () => {
    const wrongPassword = await login({
      username: "operator1",
      password: "salah-sekali",
    });
    const unknownUser = await login({
      username: "tidakada",
      password: "salah-sekali",
    });

    expect(wrongPassword.status).toBe(401);
    expect(unknownUser.status).toBe(401);
    expect(wrongPassword.body).toEqual({
      error: {
        code: "INVALID_CREDENTIALS",
        message: "Username atau password salah.",
      },
    });
    expect(unknownUser.body).toEqual(wrongPassword.body);
  });

  it("menolak field kosong dan field asing → 400 dengan detail per field", async () => {
    const res = await login({ username: "   ", role: "SUPERVISOR" });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
    expect(res.body.error.details.map((d) => d.field).sort()).toEqual([
      "password",
      "role",
      "username",
    ]);
  });

  it("body bukan JSON → 400, bukan 500", async () => {
    const res = await login("{username:");

    expect(res.status).toBe(400);
    expect(res.body.error.details).toEqual([
      {
        field: "(body)",
        message: "Body request harus berupa JSON yang valid.",
      },
    ]);
  });
});

describe("FR-02: token wajib untuk endpoint selain login & health", () => {
  it("token valid → GET /auth/me mengembalikan data user", async () => {
    const res = await callRoute(meRoute, {
      token: await tokenFor("supervisor1"),
    });

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({
      username: "supervisor1",
      role: "SUPERVISOR",
    });
  });

  it("tanpa token → 401", async () => {
    const res = await callRoute(meRoute);

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("UNAUTHENTICATED");
  });

  it("token ditandatangani kunci lain (palsu) → 401", async () => {
    const forged = await makeToken({
      secret: "kunci-penyerang-yang-juga-32-karakter-lebih",
      expiresAt: "1h",
    });
    const res = await callRoute(meRoute, { token: forged });

    expect(res.status).toBe(401);
  });

  it("US-01 AC3: token kedaluwarsa → 401", async () => {
    const oneMinuteAgo = Math.floor(Date.now() / 1000) - 60;
    const expired = await makeToken({
      secret: process.env.JWT_SECRET,
      expiresAt: oneMinuteAgo,
    });
    const res = await callRoute(meRoute, { token: expired });

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("UNAUTHENTICATED");
  });
});
