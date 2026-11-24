import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type Global = { NkServico?: { armar?: () => void; desarmar?: () => void; temFone?: () => boolean }; __nkParadoPelaNotificacao?: () => void; __nkServicoFalhou?: () => void };
const g = globalThis as Global;

async function carregar() {
  vi.resetModules();
  return import("../src/lib/servico");
}

describe("serviço do timer (motivo 'armado')", () => {
  let chamadas: string[];
  beforeEach(() => {
    chamadas = [];
    g.NkServico = { armar: () => chamadas.push("armar"), desarmar: () => chamadas.push("desarmar"), temFone: () => true };
  });
  afterEach(() => {
    delete g.NkServico;
    delete g.__nkParadoPelaNotificacao;
    delete g.__nkServicoFalhou;
    vi.restoreAllMocks();
  });

  it("arma e desarma pela ponte; armar devolve true quando o Android assumiu", async () => {
    const { armarServico, desarmarServico } = await carregar();
    expect(armarServico()).toBe(true);
    desarmarServico();
    expect(chamadas).toEqual(["armar", "desarmar"]);
  });

  it("sem a ponte (navegador, testes) nada acontece e armar devolve false", async () => {
    delete g.NkServico;
    const { armarServico, desarmarServico, foneConectado } = await carregar();
    expect(armarServico()).toBe(false);
    expect(() => desarmarServico()).not.toThrow();
    expect(foneConectado()).toBe(false);
  });

  it("uma ponte que falha nunca derruba o app: vai para o console", async () => {
    const aviso = vi.spyOn(console, "warn").mockImplementation(() => {});
    g.NkServico = {
      armar: () => {
        throw new Error("ponte");
      },
      desarmar: () => {
        throw new Error("ponte");
      },
      temFone: () => {
        throw new Error("ponte");
      },
    };
    const { armarServico, desarmarServico, foneConectado } = await carregar();
    expect(armarServico()).toBe(false);
    expect(() => desarmarServico()).not.toThrow();
    expect(foneConectado()).toBe(false);
    expect(aviso).toHaveBeenCalledTimes(3);
  });

  it("foneConectado repete o que a ponte diz", async () => {
    const { foneConectado } = await carregar();
    expect(foneConectado()).toBe(true);
    g.NkServico!.temFone = () => false;
    expect(foneConectado()).toBe(false);
  });

  it("o botão Parar da notificação e a falha do serviço chamam o aviso registrado, que se remove sozinho", async () => {
    const { aoPararPelaNotificacao, aoFalharServico } = await carregar();
    const parou = vi.fn();
    const falhou = vi.fn();
    const soltarParou = aoPararPelaNotificacao(parou);
    const soltarFalhou = aoFalharServico(falhou);
    g.__nkParadoPelaNotificacao!();
    g.__nkServicoFalhou!();
    expect(parou).toHaveBeenCalledTimes(1);
    expect(falhou).toHaveBeenCalledTimes(1);
    soltarParou();
    soltarFalhou();
    expect(g.__nkParadoPelaNotificacao).toBeUndefined();
    expect(g.__nkServicoFalhou).toBeUndefined();
  });

  it("remover um aviso antigo não apaga o aviso novo", async () => {
    const { aoPararPelaNotificacao } = await carregar();
    const soltarAntigo = aoPararPelaNotificacao(() => {});
    const novo = vi.fn();
    aoPararPelaNotificacao(novo);
    soltarAntigo();
    g.__nkParadoPelaNotificacao!();
    expect(novo).toHaveBeenCalledTimes(1);
  });
});
