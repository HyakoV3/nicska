import { afterEach, describe, expect, it, vi } from "vitest";
import { chaveDaPrevia, chaveDoSemVideo } from "../src/lib/video/avisos";
import { PREVIA_OCIOSA_MS, PreviaDaCamera, previaPodeFicar, type SituacaoDaPrevia } from "../src/lib/video/previa";
import { qualidadePadrao } from "../src/lib/video/formato";
import { pt } from "../src/lib/i18n/pt";
import { en } from "../src/lib/i18n/en";
import { es } from "../src/lib/i18n/es";

// A pré-visualização da câmera (V1c): a regra de ligar/desligar (pura) e o fluxo com a câmera falsa.

const base: SituacaoDaPrevia = { modoVideo: true, abaAtiva: true, visivel: true, ocupado: false, paradaHaMs: 0 };

describe("previaPodeFicar", () => {
  it("parada, no modo vídeo, na aba Timer e antes de 60 s: fica", () => {
    expect(previaPodeFicar(base)).toBe(true);
    expect(previaPodeFicar({ ...base, paradaHaMs: PREVIA_OCIOSA_MS - 1 })).toBe(true);
  });
  it("desliga depois de 60 s sem Standby, fora da aba, no modo só áudio e com o app oculto", () => {
    expect(previaPodeFicar({ ...base, paradaHaMs: PREVIA_OCIOSA_MS })).toBe(false);
    expect(previaPodeFicar({ ...base, abaAtiva: false })).toBe(false);
    expect(previaPodeFicar({ ...base, modoVideo: false })).toBe(false);
    expect(previaPodeFicar({ ...base, visivel: false })).toBe(false);
  });
  it("durante o Standby e a gravação fica, mesmo em outra aba ou depois de 60 s (o vídeo sai dela); oculto, não", () => {
    expect(previaPodeFicar({ ...base, ocupado: true, abaAtiva: false, paradaHaMs: 10 * PREVIA_OCIOSA_MS })).toBe(true);
    expect(previaPodeFicar({ ...base, ocupado: true, visivel: false })).toBe(false);
  });
});

class Faixa {
  parada = false;
  private ouvintes: (() => void)[] = [];
  addEventListener(_n: string, f: () => void) {
    this.ouvintes.push(f);
  }
  cair() {
    this.ouvintes.forEach((f) => f());
  }
  stop() {
    this.parada = true;
  }
}
const fluxo = (f = new Faixa()) => ({ faixa: f, getTracks: () => [f], getVideoTracks: () => [f] }) as unknown as MediaStream & { faixa: Faixa };
const erro = (name: string) => Object.assign(new Error(name), { name });

function montar(abrir?: (r: MediaStreamConstraints) => Promise<MediaStream>, temCamera = true) {
  const abrirCamera = vi.fn(abrir ?? (async () => fluxo()));
  return { p: new PreviaDaCamera({ temCamera: () => temCamera, abrirCamera }), abrirCamera };
}

afterEach(() => vi.restoreAllMocks());

describe("PreviaDaCamera", () => {
  it("liga com a câmera e a qualidade pedidas, sem áudio; desligar solta a câmera", async () => {
    const { p, abrirCamera } = montar();
    expect(await p.ligar("frontal", qualidadePadrao())).toBeNull();
    const pedido = abrirCamera.mock.calls[0][0] as { audio: boolean; video: { facingMode: { ideal: string } } };
    expect(pedido.audio).toBe(false);
    expect(pedido.video.facingMode.ideal).toBe("user");
    const f = p.fluxo as MediaStream & { faixa: Faixa };
    p.desligar();
    expect(f.faixa.parada).toBe(true);
    expect(p.fluxo).toBeNull();
  });
  it("trocar de câmera solta a anterior antes de abrir a outra (o Android não abre duas)", async () => {
    const { p } = montar();
    await p.ligar("traseira", qualidadePadrao());
    const primeira = p.fluxo as MediaStream & { faixa: Faixa };
    await p.ligar("frontal", qualidadePadrao());
    expect(primeira.faixa.parada).toBe(true);
    expect(p.fluxo).not.toBe(primeira);
  });
  it("câmera negada ou ausente: devolve o motivo e fica desligada", async () => {
    expect(await montar(() => Promise.reject(erro("NotAllowedError"))).p.ligar("traseira", qualidadePadrao())).toBe("negada");
    expect(await montar(undefined, false).p.ligar("traseira", qualidadePadrao())).toBe("sem_camera");
  });
  it("desligada enquanto a câmera abria: a câmera que chega é solta", async () => {
    let chegar!: (f: MediaStream) => void;
    const { p } = montar(() => new Promise((ok) => (chegar = ok)));
    const ligando = p.ligar("traseira", qualidadePadrao());
    p.desligar();
    const f = fluxo();
    chegar(f);
    expect(await ligando).toBeNull();
    expect((f as MediaStream & { faixa: Faixa }).faixa.parada).toBe(true);
    expect(p.fluxo).toBeNull();
  });
  it("a câmera cai (outro app a tomou): a prévia desliga e avisa", async () => {
    const { p } = montar();
    const aoMudar = vi.fn();
    p.aoMudar = aoMudar;
    await p.ligar("traseira", qualidadePadrao());
    (p.fluxo as MediaStream & { faixa: Faixa }).faixa.cair();
    expect(p.fluxo).toBeNull();
    expect(aoMudar).toHaveBeenCalledTimes(1);
  });
});

describe("textos dos motivos sem vídeo", () => {
  const motivos = ["negada", "sem_camera", "sem_formato", "falhou"] as const;
  it("cada motivo tem a sua chave, nos três idiomas", () => {
    expect(chaveDoSemVideo("negada")).toBe("registro.sem_video_negada");
    expect(chaveDaPrevia("sem_camera")).toBe("registro.previa_sem_camera");
    for (const m of motivos)
      for (const d of [pt, en, es] as Record<string, string>[]) {
        expect(d[chaveDoSemVideo(m)]).toBeTruthy();
        expect(d[chaveDaPrevia(m)]).toBeTruthy();
      }
  });
});
