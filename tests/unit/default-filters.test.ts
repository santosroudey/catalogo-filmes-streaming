import { describe, it, expect } from "vitest";
import { resolveFilters } from "@/lib/default-filters";

describe("resolveFilters", () => {
  it("usa serviços salvos quando a URL não tem servicos", () => {
    expect(resolveFilters({ genero: "28" }, [8, 119])).toMatchObject({ providers: [8, 119], genre: 28 });
  });
  it("URL com servicos tem prioridade sobre os salvos", () => {
    expect(resolveFilters({ servicos: "337" }, [8]).providers).toEqual([337]);
  });
  it("servicos= vazio na URL significa todos, mesmo com salvos", () => {
    expect(resolveFilters({ servicos: "" }, [8]).providers).toEqual([]);
  });
  it("visitante (null) ou sem salvos segue a URL", () => {
    expect(resolveFilters({}, null).providers).toEqual([]);
    expect(resolveFilters({}, []).providers).toEqual([]);
  });
});
