import { describe, it, expect } from "vitest";
import { requestHash } from "../../lib/hash";

describe("requestHash", () => {
  const base = {
    productId: "case-galaxy-s24",
    quantity: 1,
    customer: { name: "Test User", email: "test@example.com" },
  };

  it("same payload returns same hash", () => {
    expect(requestHash(base)).toBe(requestHash(base));
  });

  it("key insertion order does not matter (canonical serialization)", () => {
    // requestHash normalizes key order explicitly
    const hash1 = requestHash({ productId: "abc", quantity: 2, customer: { name: "A", email: "a@b.com" } });
    const hash2 = requestHash({ quantity: 2, productId: "abc", customer: { email: "a@b.com", name: "A" } });
    expect(hash1).toBe(hash2);
  });

  it("different payload returns different hash", () => {
    const altered = { ...base, quantity: 2 };
    expect(requestHash(base)).not.toBe(requestHash(altered));
  });

  it("different productId returns different hash", () => {
    const altered = { ...base, productId: "case-iphone-14" };
    expect(requestHash(base)).not.toBe(requestHash(altered));
  });

  it("different email returns different hash", () => {
    const altered = { ...base, customer: { name: "Test User", email: "other@example.com" } };
    expect(requestHash(base)).not.toBe(requestHash(altered));
  });

  it("returns a 64-char hex string (sha256)", () => {
    const h = requestHash(base);
    expect(h).toMatch(/^[0-9a-f]{64}$/);
  });
});
