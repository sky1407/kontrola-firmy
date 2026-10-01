import { describe, expect, it } from "vitest";
import { extractFigures } from "./financials";
import micro from "./__fixtures__/vykaz-687.json";
import small from "./__fixtures__/vykaz-699.json";

describe("extractFigures", () => {
  it("číta mikro účtovnú jednotku (šablóna 687)", () => {
    expect(extractFigures(micro)).toEqual({
      current: { totalAssets: 6828, equity: 6478, liabilities: 350, revenue: 119 + 26910, netProfit: 2822 },
      previous: { totalAssets: 6195, equity: 5816, liabilities: 379, revenue: 618 + 8533, netProfit: 2375 },
    });
  });

  it("číta malú účtovnú jednotku (šablóna 699) vrátane netto aktív a prázdnych buniek", () => {
    expect(extractFigures(small)).toEqual({
      current: {
        totalAssets: 40326693,
        equity: 26561506,
        liabilities: 13757062,
        revenue: 289318,
        netProfit: -288494,
      },
      previous: { totalAssets: 5000, equity: 5000, liabilities: null, revenue: null, netProfit: 0 },
    });
  });

  it("vráti null pre nepodporovanú šablónu alebo výkaz bez dát", () => {
    expect(extractFigures({ ...micro, idSablony: 1164 })).toBeNull();
    expect(extractFigures({ idSablony: 687 })).toBeNull();
  });
});
