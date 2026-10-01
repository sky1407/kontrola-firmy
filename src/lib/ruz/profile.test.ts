import { describe, expect, it } from "vitest";
import { normalizeIco } from "../ico";
import { RuzError, type RuzClient, type RuzReport, type RuzStatement } from "./client";
import { getCompanyProfile } from "./profile";
import micro from "./__fixtures__/vykaz-687.json";

const statement = (id: number, year: number, extra: Partial<RuzStatement> = {}): RuzStatement => ({
  id,
  obdobieOd: `${year}-01`,
  obdobieDo: `${year}-12`,
  typ: "Riadna",
  datumPodania: `${year + 1}-06-01`,
  idUctovnychVykazov: [id * 10],
  ...extra,
});

const pdfOnly: RuzReport = {
  id: 0,
  idSablony: 742,
  prilohy: [{ id: 555, meno: "zavierka.pdf", mimeType: "application/pdf" }],
};

function fakeClient(statements: RuzStatement[], reports: Record<number, RuzReport | Error>): RuzClient {
  return {
    findEntityByIco: async (ico) => ({
      id: 1,
      ico,
      nazovUJ: "Test s.r.o.",
      ulica: "Hlavná 1",
      psc: "81101",
      mesto: "Bratislava",
      datumPoslednejUpravy: "2026-01-01",
      idUctovnychZavierok: statements.map((s) => s.id),
    }),
    getStatement: async (id) => statements.find((s) => s.id === id) ?? null,
    getReport: async (id) => {
      const report = reports[id];
      if (report instanceof Error) throw report;
      return report ?? null;
    },
  };
}

describe("getCompanyProfile", () => {
  it("zoradí roky od najnovšieho, ignoruje priebežné závierky a pri duplicite vyberie výkaz s číslami", async () => {
    const statements = [
      statement(1, 2023),
      statement(2, 2024, { idUctovnychVykazov: [21] }), // len PDF (napr. konsolidovaná)
      statement(3, 2024, { datumPodania: "2025-01-01", idUctovnychVykazov: [31] }),
      statement(4, 2025, { typ: "Priebežná" }),
    ];
    const profile = await getCompanyProfile(
      fakeClient(statements, { 10: { ...micro, prilohy: [] }, 21: pdfOnly, 31: { ...micro, prilohy: [] } }),
      "12345678",
    );

    expect(profile).toMatchObject({
      name: "Test s.r.o.",
      address: "Hlavná 1, 81101 Bratislava",
      lastFiledPeriod: "2024-12",
      incomplete: false,
    });
    expect(profile?.years.map((y) => y.periodTo)).toEqual(["2024-12", "2023-12"]);
    expect(profile?.years[0]).toMatchObject({
      figures: { netProfit: 2822 },
      documentUrl: expect.stringContaining("/attachment/555"),
    });
  });

  it("pri zlyhaní jednej závierky vráti zvyšok a označí profil ako neúplný", async () => {
    const profile = await getCompanyProfile(
      fakeClient([statement(1, 2023), statement(2, 2024)], {
        10: { ...micro, prilohy: [] },
        20: new RuzError("timeout"),
      }),
      "12345678",
    );
    expect(profile?.incomplete).toBe(true);
    expect(profile?.years.map((y) => y.periodTo)).toEqual(["2023-12"]);
  });

  it("neočakávané chyby (bug v kóde) nezamlčí", async () => {
    const client = fakeClient([statement(1, 2023)], { 10: new TypeError("bug") });
    await expect(getCompanyProfile(client, "12345678")).rejects.toBeInstanceOf(TypeError);
  });
});

describe("normalizeIco", () => {
  it.each([
    ["31 322 832", "31322832"],
    ["151513", "00151513"],
    ["00151513", "00151513"],
  ])("%s → %s", (input, expected) => expect(normalizeIco(input)).toBe(expected));

  it.each(["", "12345", "123456789", "12a45678", "000000"])("odmietne %j", (input) =>
    expect(normalizeIco(input)).toBeNull(),
  );
});
