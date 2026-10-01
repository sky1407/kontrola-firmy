import { z } from "zod";

const RUZ_API_URL = "https://www.registeruz.sk/cruz-public/api";
const REQUEST_TIMEOUT_MS = 10_000;
const RETRY_DELAY_MS = 500;
/** RÚZ občas vráti pre jedno IČO viac záznamov (zmazané duplicity) – viac nikdy nepotrebujeme. */
const MAX_ENTITY_CANDIDATES = 5;

/** Chyba komunikácie s Registrom účtovných závierok. `status` je HTTP kód, ak odpoveď prišla. */
export class RuzError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = "RuzError";
  }
}

const IdListSchema = z.object({
  id: z.array(z.number().int()),
  existujeDalsieId: z.boolean(),
});

const DeletedEntitySchema = z.object({
  id: z.number().int(),
  stav: z.literal("ZMAZANÉ"),
});

const EntitySchema = z.object({
  id: z.number().int(),
  ico: z.string(),
  nazovUJ: z.string(),
  dic: z.string().optional(),
  mesto: z.string().optional(),
  ulica: z.string().optional(),
  psc: z.string().optional(),
  skNace: z.string().optional(),
  pravnaForma: z.string().optional(),
  velkostOrganizacie: z.string().optional(),
  datumZalozenia: z.string().optional(),
  datumZrusenia: z.string().optional(),
  datumPoslednejUpravy: z.string(),
  idUctovnychZavierok: z.array(z.number().int()).default([]),
});

const StatementSchema = z.object({
  id: z.number().int(),
  obdobieOd: z.string(),
  obdobieDo: z.string(),
  typ: z.string(),
  datumPodania: z.string().optional(),
  idUctovnychVykazov: z.array(z.number().int()).default([]),
});

const ReportSchema = z.object({
  id: z.number().int(),
  idSablony: z.number().int().optional(),
  obsah: z
    .object({
      tabulky: z.array(z.object({ data: z.array(z.string()) })).optional(),
    })
    .optional(),
  prilohy: z
    .array(z.object({ id: z.number().int(), meno: z.string(), mimeType: z.string() }))
    .default([]),
});

export type RuzEntity = z.infer<typeof EntitySchema>;
export type RuzStatement = z.infer<typeof StatementSchema>;
export type RuzReport = z.infer<typeof ReportSchema>;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function isRetryable(status: number): boolean {
  return status === 429 || status >= 500;
}

/**
 * GET na RÚZ API s timeoutom, jedným opakovaním pri sieťovej chybe / 429 / 5xx
 * a validáciou odpovede. Vráti `null` pri 404.
 */
async function getJson<T>(
  path: string,
  params: Record<string, string | number>,
  schema: z.ZodType<T>,
  fetchImpl: typeof fetch,
): Promise<T | null> {
  const url = new URL(`${RUZ_API_URL}/${path}`);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, String(value));

  let lastError: RuzError | undefined;
  for (let attempt = 0; attempt < 2; attempt++) {
    if (attempt > 0) await sleep(RETRY_DELAY_MS);

    let response: Response;
    try {
      response = await fetchImpl(url, {
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
    } catch (error) {
      lastError = new RuzError(`RÚZ je nedostupný: ${(error as Error).message}`);
      continue;
    }

    if (response.status === 404) return null;
    if (!response.ok) {
      lastError = new RuzError(`RÚZ vrátil HTTP ${response.status}`, response.status);
      if (isRetryable(response.status)) continue;
      throw lastError;
    }

    let body: unknown;
    try {
      body = await response.json();
    } catch {
      throw new RuzError("RÚZ vrátil neplatný JSON", response.status);
    }
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      throw new RuzError(`Neočakávaný formát odpovede z RÚZ (${path}): ${parsed.error.message}`);
    }
    return parsed.data;
  }
  throw lastError ?? new RuzError("RÚZ je nedostupný");
}

/** Klient pre verejné API Registra účtovných závierok. `fetchImpl` slúži na testy. */
export function createRuzClient(fetchImpl: typeof fetch = fetch) {
  return {
    /**
     * Nájde účtovnú jednotku podľa normalizovaného 8-miestneho IČO.
     * Preskočí zmazané záznamy a záznamy s iným IČO; pri viacerých platných vráti naposledy upravený.
     */
    async findEntityByIco(ico: string): Promise<RuzEntity | null> {
      const ids = await getJson(
        "uctovne-jednotky",
        { "zmenene-od": "2000-01-01", ico },
        IdListSchema,
        fetchImpl,
      );
      if (!ids || ids.id.length === 0) return null;

      const candidates = await Promise.all(
        ids.id
          .slice(0, MAX_ENTITY_CANDIDATES)
          .map((id) =>
            getJson("uctovna-jednotka", { id }, z.union([DeletedEntitySchema, EntitySchema]), fetchImpl),
          ),
      );

      const active = candidates.filter(
        (entity): entity is RuzEntity => entity !== null && !("stav" in entity) && entity.ico === ico,
      );
      active.sort((a, b) => b.datumPoslednejUpravy.localeCompare(a.datumPoslednejUpravy));
      return active[0] ?? null;
    },

    getStatement(id: number): Promise<RuzStatement | null> {
      return getJson("uctovna-zavierka", { id }, StatementSchema, fetchImpl);
    },

    getReport(id: number): Promise<RuzReport | null> {
      return getJson("uctovny-vykaz", { id }, ReportSchema, fetchImpl);
    },
  };
}

export type RuzClient = ReturnType<typeof createRuzClient>;
