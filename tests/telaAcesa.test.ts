import { describe, expect, it, vi } from "vitest";
import { manterTelaAcesa } from "../src/lib/telaAcesa";

// A trava de tela com wakeLock e documento falsos: pede, solta, pede de novo ao voltar a ficar visível e não deixa trava sobrando num pedido atrasado.

function ambiente(opc: { hidden?: boolean; falha?: boolean } = {}) {
  const ouvintes = new Set<() => void>();
  const doc = {
    hidden: opc.hidden ?? false,
    addEventListener: (_n: string, f: () => void) => ouvintes.add(f),
    removeEventListener: (_n: string, f: () => void) => ouvintes.delete(f),
  };
  const sentinelas: { release: ReturnType<typeof vi.fn>; derrubar: () => void }[] = [];
  let resolver: ((w: unknown) => void) | null = null;
  const request = vi.fn(() => {
    if (opc.falha) return Promise.reject(new Error("NotAllowedError"));
    const ouv: (() => void)[] = [];
    const s = { release: vi.fn(async () => {}), addEventListener: (_n: string, f: () => void) => ouv.push(f), derrubar: () => ouv.forEach((f) => f()) };
    sentinelas.push(s);
    return new Promise((ok) => (resolver = ok)).then(() => s);
  });
  const chegar = async () => {
    resolver?.(null);
    await new Promise((r) => setTimeout(r, 0));
  };
  const mudarVisibilidade = (oculto: boolean) => {
    doc.hidden = oculto;
    ouvintes.forEach((f) => f());
  };
  return { documento: doc as unknown as Document, request, sentinelas, chegar, mudarVisibilidade, ouvintes, wakeLock: { request } as unknown as WakeLock };
}

describe("manterTelaAcesa", () => {
  it("pede a trava e a solta; soltar duas vezes não quebra; para de ouvir a visibilidade", async () => {
    const a = ambiente();
    const t = manterTelaAcesa(a);
    await a.chegar();
    expect(a.request).toHaveBeenCalledWith("screen");
    t.soltar();
    t.soltar();
    expect(a.sentinelas[0].release).toHaveBeenCalledTimes(1);
    expect(a.ouvintes.size).toBe(0);
  });
  it("solta antes de o pedido voltar: a trava que chega depois é solta na hora", async () => {
    const a = ambiente();
    manterTelaAcesa(a).soltar();
    await a.chegar();
    expect(a.sentinelas[0].release).toHaveBeenCalledTimes(1);
  });
  it("o sistema derruba a trava (app oculto): pede de novo ao voltar a ficar visível", async () => {
    const a = ambiente();
    const t = manterTelaAcesa(a);
    await a.chegar();
    a.mudarVisibilidade(true);
    a.sentinelas[0].derrubar();
    expect(a.request).toHaveBeenCalledTimes(1);
    a.mudarVisibilidade(false);
    await a.chegar();
    expect(a.request).toHaveBeenCalledTimes(2);
    t.soltar();
    expect(a.sentinelas[1].release).toHaveBeenCalled();
  });
  it("com o app oculto não pede; sem wakeLock ou com recusa, não quebra", async () => {
    const oculto = ambiente({ hidden: true });
    manterTelaAcesa(oculto);
    expect(oculto.request).not.toHaveBeenCalled();
    const recusa = ambiente({ falha: true });
    expect(() => manterTelaAcesa(recusa).soltar()).not.toThrow();
    const sem = ambiente();
    expect(() => manterTelaAcesa({ documento: sem.documento }).soltar()).not.toThrow();
  });
});
