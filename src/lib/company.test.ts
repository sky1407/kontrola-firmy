import { beforeEach, describe, expect, it, vi } from "vitest";
import { RuzError } from "./ruz/client";
import type { CompanyProfile } from "./ruz/profile";

vi.mock("server-only", () => ({}));

const db = { findUnique: vi.fn(), upsert: vi.fn() };
vi.mock("./db", () => ({ getPrisma: () => ({ companySnapshot: db }) }));

const getCompanyProfile = vi.fn();
vi.mock("./ruz/profile", () => ({ getCompanyProfile: (...args: unknown[]) => getCompanyProfile(...args) }));

const { getCompanyReport } = await import("./company");

const profile = (overrides: Partial<CompanyProfile> = {}): CompanyProfile => ({
  ico: "12345678",
  name: "Test s.r.o.",
  dic: null,
  address: null,
  foundedOn: null,
  dissolvedOn: null,
  naceCode: null,
  lastFiledPeriod: "2025-12",
  years: [],
  incomplete: false,
  ...overrides,
});

const HOUR = 60 * 60 * 1000;
const cachedRow = (expiresInMs: number, name = "Z cache") => ({
  ico: "12345678",
  data: { version: 1, profile: profile({ name }) },
  fetchedAt: new Date(Date.now() - HOUR),
  expiresAt: new Date(Date.now() + expiresInMs),
});

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("getCompanyReport", () => {
  it("čerstvú cache vráti bez volania RÚZ", async () => {
    db.findUnique.mockResolvedValue(cachedRow(HOUR));
    const report = await getCompanyReport("12345678");
    expect(report).toMatchObject({ profile: { name: "Z cache" }, stale: false });
    expect(getCompanyProfile).not.toHaveBeenCalled();
  });

  it("pri expirovanej cache načíta z RÚZ a uloží s TTL podľa úplnosti", async () => {
    db.findUnique.mockResolvedValue(cachedRow(-HOUR));
    getCompanyProfile.mockResolvedValue(profile({ name: "Čerstvá", incomplete: true }));

    const report = await getCompanyReport("12345678");

    expect(report).toMatchObject({ profile: { name: "Čerstvá" }, stale: false });
    const { create } = db.upsert.mock.calls[0][0];
    expect(create.expiresAt.getTime() - create.fetchedAt.getTime()).toBe(HOUR);
  });

  it("ignoruje cache so starou verziou formátu", async () => {
    db.findUnique.mockResolvedValue({ ...cachedRow(HOUR), data: { version: 0, profile: {} } });
    getCompanyProfile.mockResolvedValue(profile({ name: "Čerstvá" }));
    expect((await getCompanyReport("12345678"))?.profile.name).toBe("Čerstvá");
  });

  it("pri výpadku RÚZ vráti expirovanú cache označenú ako stale", async () => {
    db.findUnique.mockResolvedValue(cachedRow(-HOUR));
    getCompanyProfile.mockRejectedValue(new RuzError("timeout"));
    expect(await getCompanyReport("12345678")).toMatchObject({ profile: { name: "Z cache" }, stale: true });
  });

  it("pri výpadku RÚZ bez cache chybu propaguje", async () => {
    db.findUnique.mockResolvedValue(null);
    getCompanyProfile.mockRejectedValue(new RuzError("timeout"));
    await expect(getCompanyReport("12345678")).rejects.toBeInstanceOf(RuzError);
  });

  it("výpadok databázy nezhodí vyhľadávanie", async () => {
    db.findUnique.mockRejectedValue(new Error("connection refused"));
    db.upsert.mockRejectedValue(new Error("connection refused"));
    getCompanyProfile.mockResolvedValue(profile());
    expect(await getCompanyReport("12345678")).toMatchObject({ stale: false });
  });

  it("neexistujúcu firmu necachuje", async () => {
    db.findUnique.mockResolvedValue(null);
    getCompanyProfile.mockResolvedValue(null);
    expect(await getCompanyReport("12345678")).toBeNull();
    expect(db.upsert).not.toHaveBeenCalled();
  });
});
