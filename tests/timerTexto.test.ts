import { describe, expect, it } from "vitest";
import { anuncioDoTimer } from "../src/lib/timerTexto";
import type { EstadoDoTimer, Instantaneo } from "../src/lib/timerTipos";

const t = (c: string, p?: Record<string, string | number>) => (p ? `${c}:${JSON.stringify(p)}` : c);
const snap = (estado: EstadoDoTimer, extra: object = {}) => ({ estado, ...extra }) as Instantaneo;
const anunciar = (s: Instantaneo, texto = "texto do estado") => anuncioDoTimer(s, texto, { t, idioma: "pt" });

describe("anuncioDoTimer (CONS-033)", () => {
  it("fica calado no preparo, no apito e na escuta", () => {
    for (const e of ["preparando", "apito", "escutando"] as const) expect(anunciar(snap(e))).toBe("");
  });
  it("anuncia o Standby ao armar e o estado parado", () => {
    expect(anunciar(snap("atraso"), "Standby")).toBe("Standby");
    expect(anunciar(snap("parado"), "Pronto")).toBe("Pronto");
  });
  it("anuncia o resultado ao terminar", () => {
    const r = { resumo: { n: 3, total: 4000, primeiro: 1500 } };
    expect(anunciar(snap("resultado", { resultado: r }))).toContain("timer.anuncio_resultado");
    expect(anunciar(snap("resultado", { resultado: { resumo: { n: 0 } } }))).toBe("timer.anuncio_sem_disparos");
  });
  it("anuncia o erro", () => {
    expect(anunciar(snap("erro", { erro: "negada" }))).toBe("timer.erro_negada");
  });
});
