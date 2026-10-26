import { query, withTransaction, escapeLike } from "../lib/db.js";
import { AppError } from "../lib/errors.js";

export async function listProducts({ q, page, pageSize }) {
  const params = [];
  let where = "";
  if (q) {
    params.push(`%${escapeLike(q)}%`);
    where = `WHERE sku ILIKE $1 ESCAPE '\\' OR name ILIKE $1 ESCAPE '\\'`;
  }

  const countResult = await query(
    `SELECT COUNT(*)::int AS total FROM products ${where}`,
    params,
  );

  const limit = params.length + 1;
  const offset = params.length + 2;
  const { rows } = await query(
    `SELECT id, sku, name, unit, created_at
     FROM products ${where}
     ORDER BY sku
     LIMIT $${limit} OFFSET $${offset}`,
    [...params, pageSize, (page - 1) * pageSize],
  );

  return { rows, total: countResult.rows[0].total };
}

export async function createProduct({ sku, name, unit }, user) {
  try {
    return await withTransaction(async (client) => {
      const { rows } = await client.query(
        `INSERT INTO products (sku, name, unit, created_by)
         VALUES ($1, $2, $3, $4)
         RETURNING id, sku, name, unit, created_at`,
        [sku, name, unit, user.id],
      );
      await client.query(
        "INSERT INTO inventory_balances (product_id) VALUES ($1)",
        [rows[0].id],
      );
      return rows[0];
    });
  } catch (error) {
    if (error.code === "23505" && error.constraint === "products_sku_key") {
      throw new AppError("SKU_ALREADY_EXISTS", `SKU ${sku} sudah digunakan.`);
    }
    throw error;
  }
}
