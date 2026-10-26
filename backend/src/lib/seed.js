import bcrypt from "bcryptjs";
import { withTransaction } from "./db.js";

const SAMPLE_PRODUCTS = [
  { sku: "FZ-CHK-001", name: "Ayam Fillet", unit: "KARTON" },
  { sku: "FZ-SHR-002", name: "Udang Kupas", unit: "KARTON" },
  { sku: "FZ-BKS-003", name: "Bakso Sapi", unit: "KARTON" },
];

export async function seedDatabase({
  supervisorPassword,
  operatorPassword,
  log = console.log,
}) {
  const supervisorHash = await bcrypt.hash(supervisorPassword, 10);
  const operatorHash = await bcrypt.hash(operatorPassword, 10);

  await withTransaction(async (client) => {
    await client.query(
      `INSERT INTO users (username, password_hash, full_name, role)
       VALUES ('supervisor1', $1, 'Supervisor Satu', 'SUPERVISOR'),
              ('operator1',   $2, 'Operator Satu',   'OPERATOR')
       ON CONFLICT (username) DO NOTHING`,
      [supervisorHash, operatorHash],
    );

    const { rows } = await client.query(
      `SELECT id FROM users WHERE username = 'supervisor1'`,
    );
    const supervisorId = rows[0].id;

    for (const product of SAMPLE_PRODUCTS) {
      await client.query(
        `INSERT INTO products (sku, name, unit, created_by)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (sku) DO NOTHING`,
        [product.sku, product.name, product.unit, supervisorId],
      );
    }

    await client.query(
      `INSERT INTO inventory_balances (product_id)
       SELECT id FROM products
       ON CONFLICT (product_id) DO NOTHING`,
    );
  });

  log("Seed selesai: supervisor1, operator1, dan 3 produk contoh.");
}
