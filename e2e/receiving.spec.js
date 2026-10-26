import { test, expect } from "@playwright/test";

const OPERATOR = {
  username: "operator1",
  password: process.env.SEED_OPERATOR_PASSWORD,
};
const SUPERVISOR = {
  username: "supervisor1",
  password: process.env.SEED_SUPERVISOR_PASSWORD,
};

const AYAM = "FZ-CHK-001";
const UDANG = "FZ-SHR-002";

async function login(page, user) {
  await page.goto("/login");
  await page.getByLabel("Username").fill(user.username);
  await page.getByLabel("Password").fill(user.password);
  await page.getByRole("button", { name: "Masuk" }).click();
  await expect(page).toHaveURL(/\/documents$/);
}

async function logout(page) {
  await page.getByRole("button", { name: "Keluar" }).click();
  await expect(page).toHaveURL(/\/login/);
}

async function readStock(page, sku) {
  await page.goto("/inventory");
  const row = page.getByRole("row").filter({ hasText: sku });
  const text = await row.getByRole("cell").nth(2).textContent();
  return Number(text.replace(/\./g, ""));
}

async function addItem(page, sku, quantity) {
  const select = page.getByRole("combobox", { name: "Produk" });
  await expect(select).toContainText(sku); // tunggu daftar produk termuat
  const value = await select.evaluate(
    (element, prefix) =>
      [...element.options].find((option) => option.text.startsWith(prefix))
        ?.value,
    sku,
  );
  await select.selectOption(value);
  await page.getByLabel("Jumlah diharapkan").fill(String(quantity));
  await page.getByRole("button", { name: "Tambah Item" }).click();
  await expect(
    page.getByRole("cell", { name: sku, exact: true }),
  ).toBeVisible();
}

async function receive(page, quantities) {
  for (const [sku, quantity] of Object.entries(quantities)) {
    await page.getByLabel(`Terima sekarang ${sku}`).fill(String(quantity));
  }
  await page.getByRole("button", { name: "Konfirmasi Penerimaan" }).click();
  await expect(page.getByRole("status")).toContainText("tersimpan");
}

test("alur utama: buat dokumen → terima bertahap → complete → stok bertambah", async ({
  page,
}) => {
  page.on("dialog", (dialog) => dialog.accept());

  const supplier = `PT E2E ${Date.now()}`;
  const heading = page.getByRole("heading", { level: 1 });

  await login(page, OPERATOR);
  const stockBefore = {
    ayam: await readStock(page, AYAM),
    udang: await readStock(page, UDANG),
  };

  await test.step("operator membuat dokumen dan menambah 2 item", async () => {
    await page.goto("/documents");
    await page.getByRole("button", { name: "Buat Dokumen" }).click();
    await page.getByLabel("Supplier").fill(supplier);
    await page.getByLabel("Tanggal rencana kedatangan").fill("2026-12-01");
    await page
      .getByRole("button", { name: "Buat & lanjut tambah item" })
      .click();
    await expect(page).toHaveURL(/\/documents\/\d+$/);
    await expect(heading).toContainText("Draft");

    await addItem(page, AYAM, 10);
    await addItem(page, UDANG, 5);
  });

  const documentUrl = page.url();

  await test.step("submit: DRAFT → OPEN", async () => {
    await page.getByRole("button", { name: "Ajukan" }).click();
    await expect(heading).toContainText("Menunggu barang");
  });

  await test.step("terima parsial: OPEN → IN_PROGRESS", async () => {
    await receive(page, { [AYAM]: 6 });
    await expect(heading).toContainText("Sedang diterima");
  });

  await test.step("terima sisa: semua item penuh", async () => {
    await receive(page, { [AYAM]: 4, [UDANG]: 5 });
    await expect(
      page.getByText("Semua item sudah diterima penuh"),
    ).toBeVisible();
  });

  await test.step("operator tidak bisa menandai selesai", async () => {
    await expect(
      page.getByRole("button", { name: "Tandai Selesai" }),
    ).toHaveCount(0);
    await logout(page);
  });

  await test.step("supervisor menandai selesai: IN_PROGRESS → COMPLETED", async () => {
    await login(page, SUPERVISOR);
    await page.goto(documentUrl);
    await page.getByRole("button", { name: "Tandai Selesai" }).click();
    await expect(heading).toContainText("Selesai");
  });

  await test.step("stok bertambah tepat sebesar yang diterima", async () => {
    expect(await readStock(page, AYAM)).toBe(stockBefore.ayam + 10);
    expect(await readStock(page, UDANG)).toBe(stockBefore.udang + 5);
  });
});
