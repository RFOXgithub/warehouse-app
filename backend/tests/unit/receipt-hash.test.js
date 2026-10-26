import { describe, it, expect } from "vitest";
import { receiptRequestHash } from "@/src/services/receipts.js";

describe("receiptRequestHash (technical-spec 3.4)", () => {
  const base = {
    notes: "Truk B 1234 XY",
    lines: [
      { item_id: 101, quantity: 60 },
      { item_id: 102, quantity: 50 },
    ],
  };

  it("urutan baris tidak memengaruhi hash", () => {
    const reversed = { ...base, lines: [...base.lines].reverse() };

    expect(receiptRequestHash(15, reversed)).toBe(receiptRequestHash(15, base));
  });

  it("catatan null dan tidak dikirim menghasilkan hash yang sama", () => {
    const withNull = { ...base, notes: null };
    const withoutNotes = { lines: base.lines };

    expect(receiptRequestHash(15, withoutNotes)).toBe(
      receiptRequestHash(15, withNull),
    );
  });

  it("dokumen, jumlah, atau catatan berbeda → hash berbeda", () => {
    const original = receiptRequestHash(15, base);

    expect(receiptRequestHash(16, base)).not.toBe(original);
    expect(
      receiptRequestHash(15, {
        ...base,
        lines: [{ item_id: 101, quantity: 61 }, base.lines[1]],
      }),
    ).not.toBe(original);
    expect(receiptRequestHash(15, { ...base, notes: "Truk lain" })).not.toBe(
      original,
    );
  });

  it("menghasilkan SHA-256 dalam bentuk 64 karakter hex (sesuai kolom request_hash)", () => {
    expect(receiptRequestHash(15, base)).toMatch(/^[0-9a-f]{64}$/);
  });
});
