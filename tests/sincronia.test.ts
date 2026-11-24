import { describe, expect, it } from "vitest";
import { acompanharVideo, type ElementoDeVideo, type Quadros } from "../src/lib/video/sincronia";

// A sincronia do overlay com o <video>: quadro a quadro enquanto toca (requestVideoFrameCallback ou rAF), por eventos parado, e nada pendurado ao parar.

type Ouvinte = () => void;
/** O elemento falso deixa mudar `paused` (no de verdade é só leitura). */
type Mutavel<T> = { -readonly [K in keyof T]: T[K] };
type Falso = Mutavel<ElementoDeVideo> & { disparar: (e: string) => void; ouvintes: Map<string, Set<Ouvinte>>; pendentesDoVideo: Map<number, (a: number, m: { mediaTime: number }) => void> };

function elemento(comRvfc: boolean): Falso {
  const ouvintes = new Map<string, Set<Ouvinte>>();
  const pendentesDoVideo = new Map<number, (a: number, m: { mediaTime: number }) => void>();
  let n = 0;
  const el = {
    currentTime: 0,
    paused: true,
    ouvintes,
    pendentesDoVideo,
    addEventListener: (e: string, f: Ouvinte) => void (ouvintes.get(e) ?? ouvintes.set(e, new Set()).get(e)!).add(f),
    removeEventListener: (e: string, f: Ouvinte) => void ouvintes.get(e)?.delete(f),
    disparar: (e: string) => ouvintes.get(e)?.forEach((f) => f()),
  } as unknown as Falso;
  if (comRvfc) {
    el.requestVideoFrameCallback = (cb) => (pendentesDoVideo.set(++n, cb), n);
    el.cancelVideoFrameCallback = (h) => void pendentesDoVideo.delete(h);
  }
  return el;
}

function quadrosFalsos() {
  const pendentes = new Map<number, () => void>();
  let n = 0;
  const quadros: Quadros = { pedir: (cb) => (pendentes.set(++n, cb), n), cancelar: (h) => void pendentes.delete(h) };
  /** Roda o próximo quadro pedido (como o navegador faria). */
  const rodar = () => {
    const [h, cb] = [...pendentes][0] ?? [];
    if (h === undefined) return;
    pendentes.delete(h);
    cb!();
  };
  return { quadros, pendentes, rodar };
}

const totalDeOuvintes = (el: Falso) => [...el.ouvintes.values()].reduce((a, s) => a + s.size, 0);

describe("acompanharVideo sem requestVideoFrameCallback (rAF)", () => {
  it("lê o tempo ao ligar e, parado, não pede quadro nenhum", () => {
    const el = elemento(false);
    el.currentTime = 1.5;
    const { quadros, pendentes } = quadrosFalsos();
    const tempos: number[] = [];
    acompanharVideo(el, (s) => tempos.push(s), quadros);
    expect(tempos).toEqual([1.5]);
    expect(pendentes.size).toBe(0);
  });
  it("tocando: um quadro por vez lendo currentTime; ao pausar, o laço é cancelado", () => {
    const el = elemento(false);
    const { quadros, pendentes, rodar } = quadrosFalsos();
    const tempos: number[] = [];
    acompanharVideo(el, (s) => tempos.push(s), quadros);
    el.paused = false;
    el.disparar("play");
    expect(pendentes.size).toBe(1);
    el.currentTime = 0.04;
    rodar();
    expect(tempos.at(-1)).toBe(0.04);
    expect(pendentes.size).toBe(1); // pediu o próximo
    el.paused = true;
    el.currentTime = 0.05;
    el.disparar("pause");
    expect(pendentes.size).toBe(0);
    expect(tempos.at(-1)).toBe(0.05);
  });
  it("parado, arrastar a barra (seeked) e o timeupdate atualizam o tempo", () => {
    const el = elemento(false);
    const { quadros } = quadrosFalsos();
    const tempos: number[] = [];
    acompanharVideo(el, (s) => tempos.push(s), quadros);
    el.currentTime = 3.3;
    el.disparar("seeked");
    el.currentTime = 3.4;
    el.disparar("timeupdate");
    expect(tempos).toEqual([0, 3.3, 3.4]);
  });
  it("já tocando ao ligar começa o laço; desligar cancela o quadro e solta todos os eventos", () => {
    const el = elemento(false);
    el.paused = false;
    const { quadros, pendentes } = quadrosFalsos();
    const desligar = acompanharVideo(el, () => {}, quadros);
    expect(pendentes.size).toBe(1);
    desligar();
    expect(pendentes.size).toBe(0);
    expect(totalDeOuvintes(el)).toBe(0);
  });
  it("dois play seguidos não abrem dois laços", () => {
    const el = elemento(false);
    const { quadros, pendentes } = quadrosFalsos();
    acompanharVideo(el, () => {}, quadros);
    el.paused = false;
    el.disparar("play");
    el.disparar("play");
    expect(pendentes.size).toBe(1);
  });
});

describe("acompanharVideo com requestVideoFrameCallback", () => {
  it("usa o mediaTime do quadro na tela, não o rAF; pausar cancela o pedido do vídeo", () => {
    const el = elemento(true);
    const { quadros, pendentes } = quadrosFalsos();
    const tempos: number[] = [];
    const desligar = acompanharVideo(el, (s) => tempos.push(s), quadros);
    el.paused = false;
    el.disparar("play");
    expect(pendentes.size).toBe(0);
    expect(el.pendentesDoVideo.size).toBe(1);
    const [h, cb] = [...el.pendentesDoVideo][0];
    el.pendentesDoVideo.delete(h);
    cb(0, { mediaTime: 2.002 });
    expect(tempos.at(-1)).toBe(2.002);
    expect(el.pendentesDoVideo.size).toBe(1);
    el.paused = true;
    el.disparar("pause");
    expect(el.pendentesDoVideo.size).toBe(0);
    desligar();
    expect(totalDeOuvintes(el)).toBe(0);
  });
  it("o quadro que chega depois de pausado não pede outro", () => {
    const el = elemento(true);
    acompanharVideo(el, () => {}, quadrosFalsos().quadros);
    el.paused = false;
    el.disparar("play");
    const [h, cb] = [...el.pendentesDoVideo][0];
    el.pendentesDoVideo.delete(h);
    el.paused = true;
    cb(0, { mediaTime: 1 });
    expect(el.pendentesDoVideo.size).toBe(0);
  });
});
