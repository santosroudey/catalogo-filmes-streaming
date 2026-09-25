// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MovieCard } from "@/components/MovieCard";

describe("MovieCard", () => {
  it("mostra placeholder quando não há pôster nem ano", () => {
    render(<MovieCard movie={{ id: 7, title: "Sem Pôster", year: null, rating: 0, posterUrl: null }} />);
    expect(screen.getByText("Sem imagem")).toBeTruthy();
    expect(screen.getByRole("link").getAttribute("href")).toBe("/filme/7");
    expect(screen.queryByText("null")).toBeNull();
  });
});
