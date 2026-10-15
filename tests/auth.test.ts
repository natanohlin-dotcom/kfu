import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { matchAdminKey, parseAdminKeys } from "@/lib/auth/admin-keys";
import { hashPassword, passwordProblems, verifyPassword } from "@/lib/auth/password";
import { can, PERMISSIONS } from "@/lib/auth/permissions";
import { dashboardWidgetsFor, MODULES, navModulesFor } from "@/lib/modules";

describe("lösenord", () => {
  it("hashar och verifierar", async () => {
    const hash = await hashPassword("Rätt-Lösen1");
    expect(hash).toMatch(/^pbkdf2-sha256\$20000\$/);
    expect(await verifyPassword("Rätt-Lösen1", hash)).toBe(true);
    expect(await verifyPassword("Fel-Lösen1", hash)).toBe(false);
  });

  it("ger olika hash för samma lösenord (salt)", async () => {
    expect(await hashPassword("Samma1Lösen")).not.toBe(await hashPassword("Samma1Lösen"));
  });

  it("verifierar hash med annat iterationsantal", async () => {
    const hash = await hashPassword("Gammal1Hash", 1000);
    expect(await verifyPassword("Gammal1Hash", hash)).toBe(true);
  });

  it("avvisar trasiga hashar", async () => {
    expect(await verifyPassword("x", "")).toBe(false);
    expect(await verifyPassword("x", "md5$1$a$b")).toBe(false);
  });

  it("listar ouppfyllda krav", () => {
    expect(passwordProblems("kort")).toContain("Minst 10 tecken");
    expect(passwordProblems("allagemener1")).toEqual(["En stor bokstav"]);
    expect(passwordProblems("Godkänt1Lösen")).toEqual([]);
  });
});

describe("ADMIN_KEYS", () => {
  const sha = (s: string) => createHash("sha256").update(s).digest("hex");
  const raw = `Natan Ohlin:Natan:admin:${sha("natan:temp123")}, Test:test:member:${sha("test:abc")},Trasig:x:superuser:${sha("x:y")}`;

  it("tolkar giltiga poster och hoppar över ogiltiga", () => {
    const keys = parseAdminKeys(raw);
    expect(keys.map((k) => [k.username, k.role, k.displayName])).toEqual([
      ["natan", "admin", "Natan Ohlin"],
      ["test", "member", "Test"],
    ]);
    expect(parseAdminKeys(undefined)).toEqual([]);
  });

  it("matchar rätt tillfälligt lösenord", async () => {
    const keys = parseAdminKeys(raw);
    expect((await matchAdminKey(keys, "natan", "temp123"))?.role).toBe("admin");
    expect(await matchAdminKey(keys, "natan", "fel")).toBeNull();
    expect(await matchAdminKey(keys, "okänd", "temp123")).toBeNull();
  });
});

describe("roller och moduler", () => {
  it("ger båda rollerna samma rättigheter i början", () => {
    for (const p of PERMISSIONS) {
      expect(can({ role: "admin" }, p)).toBe(true);
      expect(can({ role: "member" }, p)).toBe(true);
    }
    expect(can(null, "dashboard:read")).toBe(false);
  });

  it("har unika id och adresser i modulregistret", () => {
    expect(new Set(MODULES.map((m) => m.id)).size).toBe(MODULES.length);
    expect(new Set(MODULES.map((m) => m.href)).size).toBe(MODULES.length);
  });

  it("skickar bara serialiserbara fält till menyn", () => {
    const nav = navModulesFor({ role: "member" });
    expect(JSON.parse(JSON.stringify(nav))).toEqual(nav);
    expect(dashboardWidgetsFor({ role: "member" }).map((w) => w.widget)).toEqual(["watchlist-movers", "active-analyses", "activity"]);
  });
});
