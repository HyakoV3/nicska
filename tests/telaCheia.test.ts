import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { overlayPadrao } from "../src/lib/preferencias";
import type { EstadoDoTimer } from "../src/lib/timerTipos";
import { dadosAoVivo, opcoesAoVivo, tempoAoVivoS } from "../src/lib/video/aoVivo";
import { estadoDoOverlay } from "../src/lib/video/overlay";
import { PASSO_DO_SEGURAR_MS, SEGURAR_MS, Segurar } from "../src/lib/video/segurar";
import {
  abrirTelaCheia, acaoDoBotao, acaoDoVoltar, comecarNaTelaCheia, faseAposTimer, sairDaTelaCheia, type FaseDaTelaCheia,
} from "../src/lib/video/telaCheia";

// A tela cheia do modo vídeo (V2b): os passos (enquadrar → standby → correndo → fim ou cancelar), as regras do botão e do Voltar, o "segure para parar" com
// relógio falso e os dados do overlay ao vivo.

/** Aplica uma sequência de estados do Timer a partir do passo `f`. */
const seguir = (f: FaseDaTelaCheia, estados: EstadoDoTimer[]) => estados.reduce(faseAposTimer, f);

describe("passos da tela cheia", () => {
  it("Standby abre o enquadrar; Sair volta à aba; Começar passa a iniciando", () => {
    expect(abrirTelaCheia("fechada")).toBe("enquadrar");
    expect(sairDaTelaCheia("enquadrar")).toBe("fechada");
    expect(comecarNaTelaCheia("enquadrar")).toBe("iniciando");
  });
  it("Começar e Sair só valem no enquadrar; abrir de novo não muda um passo aberto", () => {
    expect(comecarNaTelaCheia("fechada")).toBe("fechada");
    expect(comecarNaTelaCheia("correndo")).toBe("correndo");
    expect(sairDaTelaCheia("antes")).toBe("antes");
    expect(sairDaTelaCheia("correndo")).toBe("correndo");
    expect(abrirTelaCheia("correndo")).toBe("correndo");
  });
  it("tentativa inteira: iniciando → antes (Standby) → correndo (escuta) → fechada no resultado", () => {
    expect(seguir("iniciando", ["preparando"])).toBe("antes");
    expect(seguir("iniciando", ["preparando", "atraso", "apito"])).toBe("antes");
    expect(seguir("iniciando", ["preparando", "atraso", "apito", "escutando"])).toBe("correndo");
    expect(seguir("iniciando", ["preparando", "atraso", "apito", "escutando", "resultado"])).toBe("fechada");
  });
  it("cancelar antes do apito (o Timer volta a parado) e erro fecham", () => {
    expect(seguir("iniciando", ["preparando", "atraso", "parado"])).toBe("fechada");
    expect(seguir("iniciando", ["preparando", "erro"])).toBe("fechada");
    expect(seguir("iniciando", ["erro"])).toBe("fechada");
  });
  it("em iniciando, o parado de antes do Standby não fecha (o Timer ainda não respondeu)", () => {
    expect(faseAposTimer("iniciando", "parado")).toBe("iniciando");
  });
  it("fechada e enquadrar não seguem o Timer (o Standby ainda não começou por esta tela)", () => {
    expect(faseAposTimer("fechada", "escutando")).toBe("fechada");
    expect(faseAposTimer("enquadrar", "resultado")).toBe("enquadrar");
  });
});

describe("botão do alto e Voltar do Android", () => {
  it("antes do apito, um toque cancela; correndo, só segurando", () => {
    expect(acaoDoBotao("iniciando")).toBe("cancelar");
    expect(acaoDoBotao("antes")).toBe("cancelar");
    expect(acaoDoBotao("correndo")).toBe("segurar");
    expect(acaoDoBotao("enquadrar")).toBeNull();
    expect(acaoDoBotao("fechada")).toBeNull();
  });
  it("Voltar: no enquadrar sai; antes do apito cancela; correndo só mostra a dica; fechada segue o normal", () => {
    expect(acaoDoVoltar("enquadrar")).toBe("sair");
    expect(acaoDoVoltar("iniciando")).toBe("cancelar");
    expect(acaoDoVoltar("antes")).toBe("cancelar");
    expect(acaoDoVoltar("correndo")).toBe("dica");
    expect(acaoDoVoltar("fechada")).toBeNull();
  });
});

describe("segure para parar", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("segurando 1 s completa uma vez e zera", () => {
    const completou = vi.fn();
    const s = new Segurar(completou);
    s.comecar();
    vi.advanceTimersByTime(SEGURAR_MS - PASSO_DO_SEGURAR_MS);
    expect(completou).not.toHaveBeenCalled();
    expect(s.progresso).toBeCloseTo(1 - PASSO_DO_SEGURAR_MS / SEGURAR_MS, 6);
    vi.advanceTimersByTime(PASSO_DO_SEGURAR_MS);
    expect(completou).toHaveBeenCalledTimes(1);
    expect(s.segurando).toBe(false);
    expect(s.progresso).toBe(0);
    vi.advanceTimersByTime(5 * SEGURAR_MS);
    expect(completou).toHaveBeenCalledTimes(1);
  });
  it("soltar antes do fim não completa, zera e diz que foi cedo", () => {
    const completou = vi.fn();
    const s = new Segurar(completou);
    const progresso: number[] = [];
    s.aoMudar = (p) => progresso.push(p);
    s.comecar();
    vi.advanceTimersByTime(SEGURAR_MS / 2);
    expect(s.progresso).toBeCloseTo(0.5, 6);
    expect(s.soltar()).toBe(true);
    vi.advanceTimersByTime(2 * SEGURAR_MS);
    expect(completou).not.toHaveBeenCalled();
    expect(progresso.at(-1)).toBe(0);
    expect(s.soltar()).toBe(false); // já solto: nada a dizer
  });
  it("a tecla que repete o evento não recomeça a contagem", () => {
    const completou = vi.fn();
    const s = new Segurar(completou);
    s.comecar();
    vi.advanceTimersByTime(SEGURAR_MS / 2);
    s.comecar();
    vi.advanceTimersByTime(SEGURAR_MS / 2);
    expect(completou).toHaveBeenCalledTimes(1);
  });
  it("parar (a tela saiu) cancela sem completar", () => {
    const completou = vi.fn();
    const s = new Segurar(completou);
    s.comecar();
    s.parar();
    vi.advanceTimersByTime(2 * SEGURAR_MS);
    expect(completou).not.toHaveBeenCalled();
  });
});

describe("overlay ao vivo", () => {
  it("antes da escuta, sem zero ou sem relógio: STAND BY (-1)", () => {
    expect(tempoAoVivoS("atraso", 10, 11)).toBe(-1);
    expect(tempoAoVivoS("escutando", null, 11)).toBe(-1);
    expect(tempoAoVivoS("escutando", 10, null)).toBe(-1);
    expect(tempoAoVivoS("escutando", 10, Number.NaN)).toBe(-1);
  });
  it("correndo: segundos desde o apito no relógio do áudio, nunca negativo", () => {
    expect(tempoAoVivoS("escutando", 10, 12.5)).toBeCloseTo(2.5, 6);
    expect(tempoAoVivoS("escutando", 10, 9.99)).toBe(0);
  });
  it("o último disparo não encerra: o cronômetro segue, todos os disparos contam e não há clarão nem resultado", () => {
    const dados = dadosAoVivo({ disparosMs: [800, 1100] }, { percurso: "El Presidente" });
    expect(dados).toMatchObject({ zeroNoVideoS: 0, aoVivo: true, percurso: "El Presidente" });
    const e = estadoDoOverlay(1.05, dados); // o relógio ainda 50 ms antes do 2º disparo que já chegou
    expect(e.fase).toBe("correndo");
    expect(e.nDisparos).toBe(2);
    expect(e.decorridoMs).toBeCloseTo(1050, 6);
    expect(estadoDoOverlay(3, dados)).toMatchObject({ fase: "correndo", resultado: null });
    expect(estadoDoOverlay(0.01, dadosAoVivo({ disparosMs: [] }, {})).clarao).toBe(false);
    expect(estadoDoOverlay(-1, dados).fase).toBe("antes");
  });
  it("na reprodução (sem aoVivo) segue como era: fim no último disparo", () => {
    expect(estadoDoOverlay(3, { zeroNoVideoS: 0, disparosMs: [800, 1100] }).fase).toBe("fim");
  });
  it("partes: as de Ajustes; com o overlay desligado, só o essencial", () => {
    const p = overlayPadrao();
    expect(opcoesAoVivo(p)).toEqual(p);
    expect(opcoesAoVivo({ ...p, ligado: false })).toEqual({ ligado: true, avatar: false, nome: false, cabecalho: false, splits: false, marca: false });
  });
});
