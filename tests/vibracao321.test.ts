import { afterEach, describe, expect, it, vi } from "vitest";
import { avisoTresDois, duracaoDoPadrao, PADRAO_PARTIDA, PADRAO_PRONTO, PADRAO_STANDBY } from "../src/lib/vibracao321";
import { avisoDoStandby, pararVibracao, vibrarPartida } from "../src/lib/timerDoApp";
import { timerPadrao } from "../src/lib/preferencias";

const toques = (p: readonly number[]) => p.filter((_, i) => i % 2 === 0).length;

describe("padrões 3/2/1", () => {
  it("contam 3, 2 e 1 toques", () => {
    expect(toques(PADRAO_PRONTO)).toBe(3);
    expect(toques(PADRAO_STANDBY)).toBe(2);
    expect(toques(PADRAO_PARTIDA)).toBe(1);
  });
  it("são distintos entre si e das vibrações de entender (80) e cancelar ([40,60,40])", () => {
    const todos = [PADRAO_PRONTO, PADRAO_STANDBY, PADRAO_PARTIDA].map((p) => JSON.stringify(p));
    expect(new Set([...todos, "[80]", "[40,60,40]"]).size).toBe(5);
  });
  it("o aviso junta 3 toques, pausa e 2 toques e informa a duração", () => {
    const { padrao, duracaoMs } = avisoTresDois();
    expect(padrao.length % 2).toBe(1); // termina num toque
    expect(padrao).toEqual([...PADRAO_PRONTO, 700, ...PADRAO_STANDBY]);
    expect(duracaoMs).toBe(duracaoDoPadrao(padrao));
    expect(duracaoMs).toBeGreaterThan(duracaoDoPadrao(PADRAO_PRONTO) + duracaoDoPadrao(PADRAO_STANDBY));
  });
});

describe("ligação com o aparelho", () => {
  afterEach(() => vi.unstubAllGlobals());
  const apito = { falar: async () => 500, avisar: async () => 300 } as never;

  it("desligado: vibração longa de 250 ms, como antes", async () => {
    const v = vi.fn();
    vi.stubGlobal("navigator", { vibrate: v });
    expect(await avisoDoStandby(apito)(timerPadrao())).toBe(500);
    expect(v).toHaveBeenCalledWith(250);
    vibrarPartida(timerPadrao());
    expect(v).toHaveBeenCalledTimes(1);
  });
  it("ligado: toques 3/2, atraso depois do mais longo (voz ou toques) e 1 toque na partida", async () => {
    const v = vi.fn();
    vi.stubGlobal("navigator", { vibrate: v });
    const p = { ...timerPadrao(), vibracao321: true };
    expect(await avisoDoStandby(apito)(p)).toBe(avisoTresDois().duracaoMs);
    expect(v).toHaveBeenCalledWith(avisoTresDois().padrao);
    expect(v).not.toHaveBeenCalledWith(250);
    vibrarPartida(p);
    expect(v).toHaveBeenLastCalledWith([...PADRAO_PARTIDA]);
    pararVibracao();
    expect(v).toHaveBeenLastCalledWith(0);
  });
  it("sem navigator.vibrate não falha", async () => {
    vi.stubGlobal("navigator", {});
    const p = { ...timerPadrao(), vibracao321: true };
    await expect(avisoDoStandby(apito)(p)).resolves.toBeGreaterThan(0);
    expect(() => { vibrarPartida(p); pararVibracao(); }).not.toThrow();
  });
});
