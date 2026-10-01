import { describe, expect, it } from "vitest";
import { assessRisk } from "./risk";
import type { FinancialFigures } from "./ruz/financials";
import type { CompanyProfile, FinancialYear } from "./ruz/profile";

const NOW = new Date("2026-10-01T12:00:00Z");

const year = (y: number, figures: Partial<FinancialFigures> | null): FinancialYear => ({
  periodFrom: `${y}-01`,
  periodTo: `${y}-12`,
  figures: figures && { totalAssets: 100, equity: 50, liabilities: 50, revenue: 200, netProfit: 10, ...figures },
  documentUrl: null,
});

const profile = (overrides: Partial<CompanyProfile> = {}): CompanyProfile => ({
  ico: "12345678",
  name: "Test s.r.o.",
  dic: null,
  address: null,
  foundedOn: "2015-03-01",
  dissolvedOn: null,
  naceCode: null,
  lastFiledPeriod: "2025-12",
  years: [year(2025, {}), year(2024, {}), year(2023, {})],
  incomplete: false,
  ...overrides,
});

const codes = (p: CompanyProfile, now = NOW) => assessRisk(p, now).flags.map((f) => f.code);

describe("assessRisk", () => {
  it("zdravá firma má skóre 100 bez upozornení", () => {
    expect(assessRisk(profile(), NOW)).toEqual({ score: 100, level: "low", flags: [] });
  });

  it("záporné vlastné imanie a strata 3 roky po sebe", () => {
    const p = profile({
      years: [year(2025, { equity: -5, netProfit: -1 }), year(2024, { netProfit: -2 }), year(2023, { netProfit: -3 })],
    });
    expect(assessRisk(p, NOW)).toMatchObject({ score: 40, level: "high" });
    expect(codes(p)).toEqual(["NEGATIVE_EQUITY", "CONSECUTIVE_LOSSES"]);
  });

  it("strata len v poslednom roku je mierne upozornenie", () => {
    expect(codes(profile({ years: [year(2025, { netProfit: -1 }), year(2024, {}), year(2023, {})] }))).toEqual([
      "LOSS_LAST_YEAR",
    ]);
  });

  it("roky bez čísel (PDF) sa do strát nerátajú", () => {
    const p = profile({ years: [year(2025, null), year(2024, { netProfit: -1 }), year(2023, { netProfit: -1 })] });
    expect(codes(p)).toEqual(["LOSS_LAST_YEAR"]);
  });

  describe("chýbajúca závierka", () => {
    it("v októbri 2026 už má byť závierka za 2025", () => {
      expect(codes(profile({ lastFiledPeriod: "2024-12" }))).toContain("MISSING_FILING");
    });

    it("v máji 2026 stačí závierka za 2024", () => {
      expect(codes(profile({ lastFiledPeriod: "2024-12" }), new Date("2026-05-15T00:00:00Z"))).not.toContain(
        "MISSING_FILING",
      );
    });

    it("firma založená v tomto roku ešte závierku mať nemusí, ale je nová", () => {
      expect(codes(profile({ foundedOn: "2026-02-01", lastFiledPeriod: null, years: [] }))).toEqual([
        "YOUNG_COMPANY",
      ]);
    });

    it("stará firma bez akejkoľvek závierky", () => {
      expect(codes(profile({ lastFiledPeriod: null, years: [] }))).toEqual(["MISSING_FILING"]);
    });
  });

  it("zrušená firma nemá upozornenie na chýbajúcu závierku", () => {
    expect(codes(profile({ dissolvedOn: "2024-01-01", lastFiledPeriod: "2023-12" }))).toEqual(["DISSOLVED"]);
  });
});
