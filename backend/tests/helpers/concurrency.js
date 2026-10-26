import { getPool, query } from "@/src/lib/db.js";

async function warmUpPool(connections) {
  await Promise.all(
    Array.from({ length: connections }, () => query("SELECT pg_sleep(0.02)")),
  );
}

export async function runWhileDocumentsLocked(documentIds, startRequests) {
  await warmUpPool(4);
  const blocker = await getPool().connect();
  let pending;
  let settledWhileLocked;
  try {
    await blocker.query("BEGIN");
    await blocker.query(
      "SELECT id FROM receiving_documents WHERE id = ANY($1::int[]) FOR UPDATE",
      [documentIds],
    );

    let settled = 0;
    pending = startRequests().map((request) =>
      request.finally(() => settled++),
    );
    await new Promise((resolve) => setTimeout(resolve, 200));
    settledWhileLocked = settled;
  } finally {
    await blocker.query("ROLLBACK");
    blocker.release();
  }
  return { results: await Promise.all(pending), settledWhileLocked };
}
