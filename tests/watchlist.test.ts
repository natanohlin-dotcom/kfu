import { describe, expect, it } from "vitest";
import { relativeTime } from "@/lib/format";
import { NewWatchInput, NoteInput, WatchPatchInput } from "@/lib/watchlist/input";
import { BOARD_COLUMNS, isWatchStatus, STATUS_LABELS, targetDistance, WATCH_STATUSES } from "@/lib/watchlist/status";

describe("bevakningsstatus", () => {
  it("tavlan visar alla statusar utom arkiverad, exakt en gång", () => {
    const onBoard = BOARD_COLUMNS.flatMap((c) => c.statuses);
    expect(new Set(onBoard).size).toBe(onBoard.length);
    expect([...onBoard].sort()).toEqual(WATCH_STATUSES.filter((s) => s !== "arkiverad").sort());
  });

  it("har etikett för varje status och känner igen giltiga värden", () => {
    for (const s of WATCH_STATUSES) expect(STATUS_LABELS[s]).toBeTruthy();
    expect(isWatchStatus("analys")).toBe(true);
    expect(isWatchStatus("sold")).toBe(false);
  });

  it("räknar avstånd till målkurs (positivt = uppsida kvar)", () => {
    expect(targetDistance(80, 100)).toBeCloseTo(0.25);
    expect(targetDistance(120, 100)).toBeCloseTo(-1 / 6);
    expect(targetDistance(null, 100)).toBeNull();
    expect(targetDistance(100, null)).toBeNull();
  });
});

describe("validering av indata", () => {
  it("kräver positiv målkurs och tillåter att den tas bort", () => {
    expect(WatchPatchInput.safeParse({ targetPrice: -1 }).success).toBe(false);
    expect(WatchPatchInput.safeParse({ targetPrice: null }).success).toBe(true);
    expect(WatchPatchInput.safeParse({ status: "okänd" }).success).toBe(false);
  });

  it("kräver symbol vid ny bevakning och text i anteckningar", () => {
    expect(NewWatchInput.safeParse({ thesis: "x" }).success).toBe(false);
    expect(NewWatchInput.safeParse({ symbol: "ERIC-B.ST", status: "bevakning" }).success).toBe(true);
    expect(NoteInput.safeParse({ body: "   " }).success).toBe(false);
  });
});

describe("relativ tid", () => {
  const now = new Date("2026-10-16T12:00:00Z");
  it("skriver tid på svenska", () => {
    expect(relativeTime("2026-10-16T11:59:30Z", now)).toBe("nyss");
    expect(relativeTime("2026-10-16T11:55:00Z", now)).toBe("för 5 minuter sedan");
    expect(relativeTime("2026-10-15T12:00:00Z", now)).toBe("i går");
    expect(relativeTime("2026-08-01T12:00:00Z", now)).toMatch(/aug/);
  });
});
