import { describe, expect, it, vi } from "vitest";
import { createRuzClient, RuzError } from "./client";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

const entity = (id: number, ico: string, datumPoslednejUpravy: string) => ({
  id,
  ico,
  nazovUJ: `Firma ${id}`,
  datumPoslednejUpravy,
  idUctovnychZavierok: [1],
});

/** Fake fetch, ktorý odpovedá podľa cesty a query parametra `id`. */
function fakeFetch(routes: Record<string, () => Response>) {
  return vi.fn<typeof fetch>(async (input) => {
    const url = new URL(String(input));
    const key = `${url.pathname.split("/").pop()}${url.searchParams.has("id") ? `#${url.searchParams.get("id")}` : ""}`;
    const route = routes[key];
    if (!route) throw new Error(`Nečakaná požiadavka: ${key}`);
    return route();
  });
}

describe("createRuzClient.findEntityByIco", () => {
  it("preskočí zmazané záznamy a záznamy s iným IČO, vráti naposledy upravený", async () => {
    const client = createRuzClient(
      fakeFetch({
        "uctovne-jednotky": () => json({ id: [1, 2, 3, 4], existujeDalsieId: false }),
        "uctovna-jednotka#1": () => json({ id: 1, stav: "ZMAZANÉ", datumPoslednejUpravy: "2026-01-01" }),
        "uctovna-jednotka#2": () => json(entity(2, "12345678", "2024-01-01")),
        "uctovna-jednotka#3": () => json(entity(3, "12345678", "2025-06-01")),
        "uctovna-jednotka#4": () => json(entity(4, "87654321", "2026-01-01")),
      }),
    );
    expect((await client.findEntityByIco("12345678"))?.id).toBe(3);
  });

  it("vráti null, keď IČO neexistuje", async () => {
    const client = createRuzClient(
      fakeFetch({ "uctovne-jednotky": () => json({ id: [], existujeDalsieId: false }) }),
    );
    expect(await client.findEntityByIco("12345678")).toBeNull();
  });
});

describe("getJson cez createRuzClient", () => {
  it("raz zopakuje požiadavku pri 503", async () => {
    let calls = 0;
    const client = createRuzClient(
      fakeFetch({
        "uctovna-zavierka#7": () =>
          ++calls === 1
            ? json({}, 503)
            : json({ id: 7, obdobieOd: "2025-01", obdobieDo: "2025-12", typ: "Riadna" }),
      }),
    );
    expect(await client.getStatement(7)).toMatchObject({ id: 7, idUctovnychVykazov: [] });
    expect(calls).toBe(2);
  });

  it("vráti null pri 404 a neopakuje pri 400", async () => {
    const fetchMock = fakeFetch({
      "uctovny-vykaz#1": () => json({}, 404),
      "uctovny-vykaz#2": () => json({}, 400),
    });
    const client = createRuzClient(fetchMock);
    expect(await client.getReport(1)).toBeNull();
    await expect(client.getReport(2)).rejects.toMatchObject({ name: "RuzError", status: 400 });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("odmietne odpoveď v neočakávanom formáte", async () => {
    const client = createRuzClient(fakeFetch({ "uctovna-zavierka#7": () => json({ id: "x" }) }));
    await expect(client.getStatement(7)).rejects.toBeInstanceOf(RuzError);
  });
});
