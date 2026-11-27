import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { interromperVideoAoEsconder } from "../src/lib/timerCicloDeVida";
import { opcoesDeVideoDoApp } from "../src/lib/timerDoApp";

// O vídeo e o ciclo de vida do app (C8) e a leitura do modo de registro a cada Standby, com document e localStorage falsos.

let ouvintes: (() => void)[];
const doc = { hidden: false, addEventListener: (_n: string, f: () => void) => ouvintes.push(f), removeEventListener: (_n: string, f: () => void) => (ouvintes = ouvintes.filter((g) => g !== f)) };
let mem: Record<string, string>;

beforeEach(() => {
  ouvintes = [];
  doc.hidden = false;
  mem = {};
  vi.stubGlobal("document", doc);
  vi.stubGlobal("localStorage", { getItem: (k: string) => (k in mem ? mem[k] : null), setItem: (k: string, v: string) => (mem[k] = v) });
});
afterEach(() => vi.unstubAllGlobals());

describe("interromperVideoAoEsconder", () => {
  it("app oculto: o vídeo é interrompido (fica parcial); ao voltar, nada; o desligar tira o ouvinte", () => {
    const video = { interromper: vi.fn(async () => {}) };
    const desligar = interromperVideoAoEsconder(video);
    ouvintes.forEach((f) => f());
    expect(video.interromper).not.toHaveBeenCalled();
    doc.hidden = true;
    ouvintes.forEach((f) => f());
    expect(video.interromper).toHaveBeenCalledTimes(1);
    desligar();
    expect(ouvintes).toHaveLength(0);
  });
});

describe("opcoesDeVideoDoApp", () => {
  it("só áudio (padrão): nulo; Áudio + vídeo: a câmera e a qualidade de Ajustes", () => {
    expect(opcoesDeVideoDoApp()).toBeNull();
    mem["prefs.registro"] = JSON.stringify({ modo: "video", camera: "frontal" });
    mem["prefs.videoQualidade"] = JSON.stringify({ altura: 720, fps: 60 });
    expect(opcoesDeVideoDoApp()).toEqual({ camera: "frontal", qualidade: { altura: 720, fps: 60 } });
  });
  it("com a prévia ligada, o fluxo dela vai junto (o gravador não abre a câmera de novo); no modo só áudio, nunca", () => {
    const previa = { previa: true } as unknown as MediaStream;
    mem["prefs.registro"] = JSON.stringify({ modo: "video", camera: "traseira" });
    expect(opcoesDeVideoDoApp(previa)).toMatchObject({ camera: "traseira", fluxoDaCamera: previa });
    expect(opcoesDeVideoDoApp(null)).not.toHaveProperty("fluxoDaCamera");
    mem["prefs.registro"] = JSON.stringify({ modo: "audio", camera: "traseira" });
    expect(opcoesDeVideoDoApp(previa)).toBeNull();
  });
});
