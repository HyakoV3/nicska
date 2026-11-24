import { IDBFactory, IDBKeyRange } from "fake-indexeddb";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Armazenamento } from "../src/lib/armazenamento";
import type { FabricasDeVideo } from "../src/lib/video/fabricasDeVideo";
import { GravadorDeVideo, LIMITE_DA_CAMERA_MS, type LojaDeVideos, type PedidoDeVideo } from "../src/lib/video/gravadorDeVideo";
import { qualidadePadrao } from "../src/lib/video/formato";

// O gravador do vídeo com a câmera e o MediaRecorder falsos (injetados pelas fábricas) e o banco do fake-indexeddb. A câmera de verdade fica no e2e.

vi.stubGlobal("IDBKeyRange", IDBKeyRange);

class Faixa {
  parada = false;
  ouvintes: Record<string, (() => void)[]> = {};
  constructor(readonly kind: "audio" | "video") {}
  addEventListener(n: string, f: () => void) {
    (this.ouvintes[n] ??= []).push(f);
  }
  emitir(n: string) {
    this.ouvintes[n]?.forEach((f) => f());
  }
  stop() {
    this.parada = true;
  }
}
class Fluxo {
  constructor(readonly faixas: Faixa[]) {}
  getTracks() {
    return this.faixas;
  }
  getVideoTracks() {
    return this.faixas.filter((f) => f.kind === "video");
  }
  getAudioTracks() {
    return this.faixas.filter((f) => f.kind === "audio");
  }
}
class Gravador {
  state = "inactive";
  mimeType = "video/webm;codecs=vp8,opus";
  fatia: number | undefined;
  ondataavailable: ((e: { data: Blob }) => void) | null = null;
  onerror: (() => void) | null = null;
  onstop: (() => void) | null = null;
  constructor(readonly fluxo: Fluxo) {}
  start(fatia?: number) {
    this.state = "recording";
    this.fatia = fatia;
  }
  /** Como o de verdade: o último pedaço chega antes do `onstop`. */
  stop() {
    this.state = "inactive";
    queueMicrotask(() => {
      this.ondataavailable?.({ data: new Blob(["fim"]) });
      this.onstop?.();
    });
  }
  pedaco(texto: string) {
    this.ondataavailable?.({ data: new Blob([texto]) });
  }
}

type Cenario = { formato?: string | null; temCamera?: boolean; camera?: () => Promise<Fluxo>; gravadorFalha?: boolean };

function montar(c: Cenario = {}, loja?: LojaDeVideos) {
  const cameras: Fluxo[] = [];
  const gravadores: Gravador[] = [];
  const abrirCamera = vi.fn(async (_r: MediaStreamConstraints) => {
    const f = c.camera ? await c.camera() : new Fluxo([new Faixa("video")]);
    cameras.push(f);
    return f;
  });
  const fabricas = {
    temCamera: () => c.temCamera ?? true,
    formato: () => (c.formato === undefined ? "video/webm;codecs=vp8,opus" : c.formato),
    abrirCamera,
    compor: (faixas: Faixa[]) => new Fluxo(faixas),
    gravador: vi.fn((fluxo: Fluxo, _tipo: string) => {
      if (c.gravadorFalha) throw new Error("NotSupportedError");
      const g = new Gravador(fluxo);
      gravadores.push(g);
      return g;
    }),
  } as unknown as FabricasDeVideo;
  const banco = new Armazenamento(() => new IDBFactory());
  const v = new GravadorDeVideo(loja ?? banco, fabricas);
  const microfone = new Fluxo([new Faixa("audio")]);
  const pedido: PedidoDeVideo = { id: "t1", audio: microfone as unknown as MediaStream, camera: "traseira", qualidade: qualidadePadrao() };
  return { v, banco, cameras, gravadores, abrirCamera, fabricas, microfone, pedido };
}

const texto = async (b: Blob | null) => (b ? await b.text() : null);
const erro = (name: string) => Object.assign(new Error(name), { name });

beforeEach(() => vi.spyOn(console, "warn").mockImplementation(() => {}));
afterEach(() => vi.restoreAllMocks());

describe("GravadorDeVideo: falha segura (só áudio)", () => {
  it("câmera negada: segue só com áudio e diz por quê; o microfone fica intocado", async () => {
    const { v, microfone, pedido } = montar({ camera: () => Promise.reject(erro("NotAllowedError")) });
    expect(await v.iniciar(pedido)).toBe("negada");
    expect(v.gravando).toBe(false);
    expect(microfone.faixas[0].parada).toBe(false);
  });
  it("sem câmera, câmera não encontrada ou outra falha", async () => {
    expect(await montar({ temCamera: false }).v.iniciar(montar().pedido)).toBe("sem_camera");
    const nao = montar({ camera: () => Promise.reject(erro("NotFoundError")) });
    expect(await nao.v.iniciar(nao.pedido)).toBe("sem_camera");
    const lida = montar({ camera: () => Promise.reject(erro("NotReadableError")) });
    expect(await lida.v.iniciar(lida.pedido)).toBe("falhou");
  });
  it("sem formato de vídeo: nem abre a câmera", async () => {
    const { v, abrirCamera, pedido } = montar({ formato: null });
    expect(await v.iniciar(pedido)).toBe("sem_formato");
    expect(abrirCamera).not.toHaveBeenCalled();
  });
  it("o gravador de vídeo não abre: solta a câmera e segue só com áudio", async () => {
    const { v, cameras, pedido, banco } = montar({ gravadorFalha: true });
    expect(await v.iniciar(pedido)).toBe("falhou");
    expect(cameras[0].faixas[0].parada).toBe(true);
    expect(await banco.metaDoVideo("t1")).toBeNull();
  });
  it("câmera que não responde: desiste no limite e solta a câmera que chegar depois", async () => {
    vi.useFakeTimers();
    let chegar!: (f: Fluxo) => void;
    const tarde = new Fluxo([new Faixa("video")]);
    const { v, pedido } = montar({ camera: () => new Promise<Fluxo>((ok) => (chegar = ok)) });
    const p = v.iniciar(pedido);
    await vi.advanceTimersByTimeAsync(LIMITE_DA_CAMERA_MS);
    expect(await p).toBe("falhou");
    chegar(tarde);
    await vi.runAllTimersAsync();
    expect(tarde.faixas[0].parada).toBe(true);
    vi.useRealTimers();
  });
});

describe("GravadorDeVideo: gravar", () => {
  it("câmera própria + áudio do microfone num fluxo composto, pedaços de 1 s, na qualidade pedida", async () => {
    const { v, gravadores, abrirCamera, fabricas, microfone, pedido } = montar();
    expect(await v.iniciar(pedido)).toBeNull();
    expect(abrirCamera.mock.calls[0][0]).toMatchObject({ audio: false, video: { height: { ideal: 720 }, frameRate: { ideal: 30 } } });
    const g = gravadores[0];
    expect(g.state).toBe("recording");
    expect(g.fatia).toBe(1000);
    expect(g.fluxo.getAudioTracks()).toEqual(microfone.faixas);
    expect(g.fluxo.getVideoTracks()).toHaveLength(1);
    expect(fabricas.gravador).toHaveBeenCalledWith(expect.anything(), "video/webm;codecs=vp8,opus", qualidadePadrao());
  });
  it("os pedaços vão ao banco em ordem; parar normal = inteiro (parcial false), câmera solta, microfone intocado", async () => {
    const { v, banco, gravadores, cameras, microfone, pedido } = montar();
    await v.iniciar(pedido);
    ["a", "b", "", "c"].forEach((t) => gravadores[0].pedaco(t));
    await v.parar();
    expect(await texto(await banco.video("t1"))).toBe("abcfim");
    expect(await banco.metaDoVideo("t1")).toMatchObject({ pedacos: 4, parcial: false, tipo: "video/webm;codecs=vp8,opus" });
    expect(cameras[0].faixas[0].parada).toBe(true);
    expect(microfone.faixas[0].parada).toBe(false);
  });
  it("pedaços chegando rápido com escritas lentas: uma escrita por vez, na ordem de chegada", async () => {
    let ativas = 0;
    let maximo = 0;
    const ordem: number[] = [];
    const loja: LojaDeVideos = {
      iniciarVideo: async () => {},
      gravarPedaco: async (_id, n) => {
        maximo = Math.max(maximo, ++ativas);
        await new Promise((r) => setTimeout(r, (7 - n) % 3));
        ordem.push(n);
        ativas--;
      },
      finalizarVideo: async () => {},
      apagarVideo: async () => {},
      limparVideos: async () => [],
    };
    const { v, gravadores, pedido } = montar({}, loja);
    await v.iniciar(pedido);
    for (let i = 0; i < 6; i++) gravadores[0].pedaco(`p${i}`);
    await v.parar();
    expect(ordem).toEqual([0, 1, 2, 3, 4, 5, 6]);
    expect(maximo).toBe(1);
  });
});

describe("GravadorDeVideo: ciclo de vida", () => {
  it("app oculto (interromper): o vídeo fica parcial e a câmera é solta; o microfone segue; o parar do fim não o desmarca", async () => {
    const { v, banco, gravadores, cameras, microfone, pedido } = montar();
    await v.iniciar(pedido);
    gravadores[0].pedaco("a");
    await v.interromper();
    expect(v.gravando).toBe(false);
    expect(cameras[0].faixas[0].parada).toBe(true);
    expect(microfone.faixas[0].parada).toBe(false);
    await v.parar();
    expect(await banco.metaDoVideo("t1")).toMatchObject({ parcial: true });
    expect(await texto(await banco.video("t1"))).toBe("afim");
  });
  it("a câmera cai no meio (faixa encerrada) ou o gravador falha: parcial", async () => {
    const a = montar();
    await a.v.iniciar(a.pedido);
    a.cameras[0].faixas[0].emitir("ended");
    await a.v.parar();
    expect(await a.banco.metaDoVideo("t1")).toMatchObject({ parcial: true });
    const b = montar();
    await b.v.iniciar(b.pedido);
    b.gravadores[0].onerror!();
    await b.v.parar();
    expect(await b.banco.metaDoVideo("t1")).toMatchObject({ parcial: true });
  });
  it("uma escrita que falha (espaço cheio) para o vídeo como parcial, sem lançar", async () => {
    const { v, banco, gravadores, cameras, pedido } = montar();
    await v.iniciar(pedido);
    vi.spyOn(banco, "gravarPedaco").mockRejectedValueOnce(new Error("QuotaExceededError"));
    gravadores[0].pedaco("a");
    await vi.waitFor(() => expect(v.gravando).toBe(false)); // parou sozinho, ainda no meio da tentativa
    expect(cameras[0].faixas[0].parada).toBe(true);
    await v.parar();
    expect(await banco.metaDoVideo("t1")).toMatchObject({ parcial: true });
  });
  it("cancelar solta a câmera na hora e apaga o vídeo", async () => {
    const { v, banco, gravadores, cameras, pedido } = montar();
    await v.iniciar(pedido);
    gravadores[0].pedaco("a");
    await v.cancelar();
    expect(cameras[0].faixas[0].parada).toBe(true);
    expect(gravadores[0].state).toBe("inactive");
    expect(await banco.metaDoVideo("t1")).toBeNull();
    expect(await banco.video("t1")).toBeNull();
  });
  it("cancelada enquanto a câmera abria: a câmera que chega é solta e nada é gravado", async () => {
    let chegar!: (f: Fluxo) => void;
    const { v, banco, gravadores, cameras, pedido } = montar({ camera: () => new Promise<Fluxo>((ok) => (chegar = ok)) });
    const p = v.iniciar(pedido);
    await Promise.resolve();
    await v.cancelar();
    chegar(new Fluxo([new Faixa("video")]));
    await p;
    expect(cameras[0].faixas[0].parada).toBe(true);
    expect(gravadores).toHaveLength(0);
    expect(await banco.metaDoVideo("t1")).toBeNull();
  });
  it("descartada sem salvar (nova tentativa) apaga o vídeo anterior; salvo (confirmado), ele fica", async () => {
    const { v, banco, pedido } = montar();
    await v.iniciar(pedido);
    await v.parar();
    await v.iniciar({ ...pedido, id: "t2" });
    await v.parar();
    expect(await banco.metaDoVideo("t1")).toBeNull();
    await v.confirmar("t2", { bytes: 1024 * 1024 * 1024, dias: 30 });
    await v.cancelar();
    expect(await banco.metaDoVideo("t2")).not.toBeNull();
  });
  it("confirmar aplica a retenção; uma limpeza que falha não lança", async () => {
    const { v, banco, pedido } = montar();
    const limpar = vi.spyOn(banco, "limparVideos").mockRejectedValueOnce(new Error("banco fechado"));
    await v.iniciar(pedido);
    await v.parar();
    const limites = { bytes: 100, dias: 7 };
    await expect(v.confirmar("t1", limites)).resolves.toBeUndefined();
    expect(limpar).toHaveBeenCalledWith(limites, ["t1"]);
    await v.confirmar("t1", { bytes: 1, dias: null });
    expect(limpar).toHaveBeenCalledTimes(2); // a segunda limpeza rodou: a fila seguiu depois da falha
    expect(await banco.metaDoVideo("t1")).not.toBeNull(); // e o vídeo recém-confirmado ficou, mesmo maior que o espaço
  });
});

describe("GravadorDeVideo: V1c (prévia emprestada e alinhamento com o áudio)", () => {
  it("com a prévia ligada, grava o fluxo DELA sem abrir outra câmera e não o para ao fim (a prévia segue)", async () => {
    const { v, abrirCamera, gravadores, pedido } = montar();
    const previa = new Fluxo([new Faixa("video")]);
    expect(await v.iniciar({ ...pedido, fluxoDaCamera: previa as unknown as MediaStream })).toBeNull();
    expect(abrirCamera).not.toHaveBeenCalled();
    expect(gravadores[0].fluxo.getVideoTracks()[0]).toBe(previa.faixas[0]);
    await v.parar();
    expect(previa.faixas[0].parada).toBe(false);
    await v.iniciar({ ...pedido, id: "t2", fluxoDaCamera: previa as unknown as MediaStream });
    await v.cancelar();
    expect(previa.faixas[0].parada).toBe(false);
  });
  it("prévia com a faixa já encerrada: abre a câmera ele mesmo, como sem prévia", async () => {
    const { v, abrirCamera, pedido } = montar();
    const morta = Object.assign(new Faixa("video"), { readyState: "ended" });
    expect(await v.iniciar({ ...pedido, fluxoDaCamera: new Fluxo([morta]) as unknown as MediaStream })).toBeNull();
    expect(abrirCamera).toHaveBeenCalledTimes(1);
  });
  it("guarda quanto depois do áudio o vídeo começou, no mesmo relógio", async () => {
    const { v, banco, fabricas, pedido } = montar();
    (fabricas as { agora?: () => number }).agora = () => 1350.4;
    await v.iniciar({ ...pedido, inicioDoAudioMs: 1000 });
    await v.parar();
    expect(await banco.metaDoVideo("t1")).toMatchObject({ inicioDoVideoMs: 350 });
  });
  it("sem o início do áudio, o deslocamento é 0 (como as metas antigas)", async () => {
    const { v, banco, pedido } = montar();
    await v.iniciar(pedido);
    await v.parar();
    expect(await banco.metaDoVideo("t1")).toMatchObject({ inicioDoVideoMs: 0 });
  });
  it("confirmar guarda o zero no áudio (ms) da Revisão; sem vídeo, nada acontece", async () => {
    const { v, banco, pedido } = montar();
    await v.iniciar(pedido);
    await v.parar();
    await v.confirmar("t1", { bytes: 1024 * 1024 * 1024, dias: null }, 2.3456);
    expect(await banco.metaDoVideo("t1")).toMatchObject({ zeroNoAudioMs: 2346 });
    await v.confirmar("sem-video", { bytes: 1024 * 1024 * 1024, dias: null }, 1);
    expect(await banco.metaDoVideo("sem-video")).toBeNull();
  });
});
