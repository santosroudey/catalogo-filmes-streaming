import { describe, it, expect } from "vitest";
import { parseFilters, filtersToQuery, hasProviderParam } from "@/lib/filters";

describe("parseFilters", () => {
  it("lê todos os filtros válidos", () => {
    expect(parseFilters({ servicos: "8,119", genero: "28", ano: "2024", nota: "7", pagina: "3" }))
      .toEqual({ providers: [8, 119], genre: 28, year: 2024, minRating: 7, page: 3 });
  });

  it("descarta individualmente valores inválidos", () => {
    expect(parseFilters({ servicos: "8,abc,,-1", genero: "x", ano: "1700", nota: "11" }))
      .toEqual({ providers: [8], page: 1 });
  });

  it.each([["0", 1], ["-5", 1], ["9999", 500], ["abc", 1], [undefined, 1]])(
    "pagina=%s vira %s", (pagina, expected) => {
      expect(parseFilters({ pagina }).page).toBe(expected);
    });

  it("usa o primeiro valor quando o parâmetro se repete", () => {
    expect(parseFilters({ genero: ["12", "28"] }).genre).toBe(12);
  });
});

describe("filtersToQuery", () => {
  it("serializa omitindo vazios e página 1", () => {
    expect(filtersToQuery({ providers: [8, 119], genre: 28, page: 1 })).toBe("servicos=8%2C119&genero=28");
  });
  it("faz ida e volta com parseFilters", () => {
    const f = { providers: [337], year: 2020, minRating: 6, page: 4 };
    expect(parseFilters(Object.fromEntries(new URLSearchParams(filtersToQuery(f))))).toEqual(f);
  });
});

describe("hasProviderParam", () => {
  it("detecta presença do parâmetro servicos", () => {
    expect(hasProviderParam({ servicos: "" })).toBe(true);
    expect(hasProviderParam({})).toBe(false);
  });
});
