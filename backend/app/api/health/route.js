import { query } from "@/src/lib/db.js";

export async function GET() {
  try {
    await query("SELECT 1");
    return Response.json({ status: "ok", database: "ok" });
  } catch (error) {
    console.error("Health check gagal:", error.message);
    return Response.json(
      { status: "error", database: "error" },
      { status: 503 },
    );
  }
}
