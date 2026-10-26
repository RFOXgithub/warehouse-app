import { query } from "@/src/lib/db.js";
import { seedDatabase } from "@/src/lib/seed.js";
import { login } from "@/src/services/auth.js";

export const PASSWORDS = {
  supervisor1: "supervisor-test-123",
  operator1: "operator-test-123",
};

export async function resetDatabase() {
  await query(`
    TRUNCATE users, products, receiving_documents, receiving_items,
             receipts, inventory_balances, inventory_transactions
    RESTART IDENTITY CASCADE;
    ALTER SEQUENCE receiving_document_number_seq RESTART;
    ALTER SEQUENCE receipt_number_seq RESTART;
  `);
  await seedDatabase({
    supervisorPassword: PASSWORDS.supervisor1,
    operatorPassword: PASSWORDS.operator1,
    log: () => {},
  });
}

export async function tokenFor(username) {
  const { token } = await login({ username, password: PASSWORDS[username] });
  return token;
}
