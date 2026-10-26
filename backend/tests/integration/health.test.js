import { describe, it, expect } from "vitest";
import { GET as healthRoute } from "@/app/api/health/route.js";
import { callRoute } from "../helpers/http.js";

describe("FR-50: health check", () => {
  it("database hidup → 200, tanpa token", async () => {
    const res = await callRoute(healthRoute);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: "ok", database: "ok" });
  });
});
