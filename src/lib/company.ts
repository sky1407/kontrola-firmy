import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { getPrisma } from "./db";
import { assessRisk, type RiskAssessment } from "./risk";
import { createRuzClient } from "./ruz/client";
import { getCompanyProfile, type CompanyProfile } from "./ruz/profile";

const HOUR_MS = 60 * 60 * 1000;
const COMPLETE_TTL_MS = 24 * HOUR_MS;
/** Neúplný profil (časť RÚZ zlyhala) skúsime načítať znova skôr. */
const INCOMPLETE_TTL_MS = 1 * HOUR_MS;
/** Zvýšiť pri zmene tvaru `CompanyProfile` – staré záznamy sa potom ignorujú. */
const SNAPSHOT_VERSION = 1;

interface SnapshotData {
  version: number;
  profile: CompanyProfile;
}

export interface CompanyReport {
  profile: CompanyProfile;
  risk: RiskAssessment;
  fetchedAt: Date;
  /** Dáta sú z cache po expirácii, lebo RÚZ práve nie je dostupný. */
  stale: boolean;
}

function readSnapshot(data: unknown): CompanyProfile | null {
  const snapshot = data as Partial<SnapshotData> | null;
  return snapshot?.version === SNAPSHOT_VERSION && snapshot.profile ? snapshot.profile : null;
}

async function loadCached(ico: string) {
  try {
    const row = await getPrisma().companySnapshot.findUnique({ where: { ico } });
    const profile = row && readSnapshot(row.data);
    return profile ? { profile, fetchedAt: row.fetchedAt, expiresAt: row.expiresAt } : null;
  } catch (error) {
    // Výpadok DB nesmie zhodiť vyhľadávanie – pokračujeme priamo na RÚZ.
    console.error("Čítanie cache zlyhalo", error);
    return null;
  }
}

async function saveCached(profile: CompanyProfile, fetchedAt: Date): Promise<void> {
  const expiresAt = new Date(fetchedAt.getTime() + (profile.incomplete ? INCOMPLETE_TTL_MS : COMPLETE_TTL_MS));
  // CompanyProfile obsahuje len reťazce, čísla, null a polia – je bezpečne serializovateľný do JSON.
  const data = { version: SNAPSHOT_VERSION, profile } satisfies SnapshotData as unknown as Prisma.InputJsonObject;
  try {
    await getPrisma().companySnapshot.upsert({
      where: { ico: profile.ico },
      create: { ico: profile.ico, data, fetchedAt, expiresAt },
      update: { data, fetchedAt, expiresAt },
    });
  } catch (error) {
    console.error("Zápis do cache zlyhal", error);
  }
}

/**
 * Profil firmy s hodnotením rizika. Čerstvá cache → bez volania RÚZ; inak načíta z RÚZ
 * a uloží. Ak RÚZ zlyhá a existuje expirovaná cache, vráti ju označenú ako `stale`.
 * Vráti `null`, ak firma neexistuje. `ico` musí byť normalizované (pozri `normalizeIco`).
 */
export async function getCompanyReport(ico: string): Promise<CompanyReport | null> {
  const now = new Date();
  const cached = await loadCached(ico);
  if (cached && cached.expiresAt > now) {
    return { profile: cached.profile, risk: assessRisk(cached.profile, now), fetchedAt: cached.fetchedAt, stale: false };
  }

  let profile: CompanyProfile | null;
  try {
    profile = await getCompanyProfile(createRuzClient(), ico);
  } catch (error) {
    if (!cached) throw error;
    console.error("RÚZ zlyhal, vraciam expirovanú cache", error);
    return { profile: cached.profile, risk: assessRisk(cached.profile, now), fetchedAt: cached.fetchedAt, stale: true };
  }
  if (!profile) return null;

  await saveCached(profile, now);
  return { profile, risk: assessRisk(profile, now), fetchedAt: now, stale: false };
}
