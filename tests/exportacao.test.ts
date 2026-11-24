import { afterEach, describe, expect, it, vi } from "vitest";
import { nomeDoVideo } from "../src/lib/compartilhar";
import { dadosDoOverlay, fonteDaRevisao, fonteDaTentativaSalva } from "../src/lib/video/dadosDoOverlay";
import {
  MotorIndisponivel,
  bitrateDaExportacao,
  tamanhoDaExportacao,
  detalheDaFalha,
  exportarEEntregar,
  motoresPossiveis,
  nomeComTempos,
  type Acompanhamento,
  type Capacidades,
  type EntradaDaExportacao,
  type MotorDeExportacao,
  type PassosDaExportacao,
} from "../src/lib/video/exportacao";
import { avisoDoFim, demoraOTamanho, escolhaInicial, escolhasDaJanela, motivoSemTempos, porcentagem } from "../src/lib/video/janelaDeExportacao";
import { formatoDoGravador } from "../src/lib/video/motorTempoReal";
import { CODECS_AVC, configAvc } from "../src/lib/video/motorWebCodecs";

// Exportar o vídeo com os tempos (V3): a escolha do motor pelo que o aparelho tem, a janela (escolhas, a marcada, avisos), o roteiro da exportação com
// motores falsos (progresso, recuo de motor, cancelar de verdade, tela acesa solta sempre), o nome e o tipo do arquivo e a montagem dos dados do overlay.

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const cap = (c: Partial<Capacidades> = {}): Capacidades => ({ webCodecs: true, avc: true, quadroAQuadro: true, captura: true, gravador: "video/webm", ...c });

describe("escolha do motor", () => {
  it("WebCodecs com H.264 primeiro, o de tempo real de recuo", () => {
    expect(motoresPossiveis(cap())).toEqual(["webcodecs", "tempo-real"]);
  });
  it("sem H.264 (ou sem WebCodecs) só o de tempo real; sem gravador ou captura, só o WebCodecs", () => {
    expect(motoresPossiveis(cap({ avc: false }))).toEqual(["tempo-real"]);
    expect(motoresPossiveis(cap({ webCodecs: false }))).toEqual(["tempo-real"]);
    expect(motoresPossiveis(cap({ gravador: null }))).toEqual(["webcodecs"]);
    expect(motoresPossiveis(cap({ captura: false }))).toEqual(["webcodecs"]);
  });
  it("sem o quadro a quadro do <video>, nenhum", () => {
    expect(motoresPossiveis(cap({ quadroAQuadro: false }))).toEqual([]);
  });
  it("o gravador do motor B prefere MP4 e recua para WebM", () => {
    expect(formatoDoGravador((t) => t.startsWith("video/mp4"))).toBe("video/mp4;codecs=avc1,mp4a.40.2");
    expect(formatoDoGravador((t) => t === "video/webm")).toBe("video/webm");
    expect(formatoDoGravador(() => false)).toBeNull();
  });
  it("H.264: a primeira configuração que o codificador aceita na resolução do vídeo; nenhuma, nulo", async () => {
    const pedidas: string[] = [];
    vi.stubGlobal("VideoEncoder", { isConfigSupported: async (c: VideoEncoderConfig) => (pedidas.push(c.codec), { supported: c.codec === CODECS_AVC[2] }) });
    expect((await configAvc(1080, 1920, 4e6))?.codec).toBe(CODECS_AVC[2]);
    expect(pedidas).toEqual(CODECS_AVC.slice(0, 3));
    vi.stubGlobal("VideoEncoder", { isConfigSupported: async () => Promise.reject(new Error("não")) });
    expect(await configAvc(1280, 720, 2e6)).toBeNull();
    vi.stubGlobal("VideoEncoder", undefined);
    expect(await configAvc(1280, 720, 2e6)).toBeNull();
  });
});

describe("nome, tipo e bitrate do arquivo exportado", () => {
  const quando = new Date(2026, 10, 23, 14, 7).getTime();
  it("nicska-<percurso>-<data>-tempos com a extensão do que saiu", () => {
    const cru = nomeDoVideo(quando, "video/webm", "El Presidente!");
    expect(nomeComTempos(cru, "video/mp4")).toBe("nicska-el-presidente-2026-11-23-1407-tempos.mp4");
    expect(nomeComTempos(cru, "video/webm;codecs=vp8,opus")).toBe("nicska-el-presidente-2026-11-23-1407-tempos.webm");
    expect(nomeComTempos(nomeDoVideo(quando, "video/webm"), "video/mp4")).toBe("nicska-2026-11-23-1407-tempos.mp4");
  });
  it("bitrate: o gravado com folga, entre 1 e 8 Mbps; sem duração, 2 Mbps", () => {
    expect(bitrateDaExportacao(7_500_000, 30)).toBe(2_500_000);
    expect(bitrateDaExportacao(1000, 30)).toBe(1_000_000);
    expect(bitrateDaExportacao(1e9, 10)).toBe(8_000_000);
    expect(bitrateDaExportacao(5e6, Number.NaN)).toBe(2_000_000);
  });
});

describe("tamanho do arquivo exportado", () => {
  it("até 1080p fica como está; 4K sai em 1080p (deitado ou em pé), sempre par", () => {
    expect(tamanhoDaExportacao(1280, 720)).toEqual({ largura: 1280, altura: 720 });
    expect(tamanhoDaExportacao(1920, 1080)).toEqual({ largura: 1920, altura: 1080 });
    expect(tamanhoDaExportacao(3840, 2160)).toEqual({ largura: 1920, altura: 1080 });
    expect(tamanhoDaExportacao(2160, 3840)).toEqual({ largura: 1080, altura: 1920 });
    expect(tamanhoDaExportacao(4000, 3000)).toEqual({ largura: 1440, altura: 1080 });
  });
});

const entradaFalsa = (soltar = vi.fn()): EntradaDaExportacao => ({ video: new Blob(["x"], { type: "video/webm" }), desenho: {} as never, soltar });
/** Um motor que anda em `passos` e cumpre; para no meio se o sinal abortar. */
function motorFalso(id: MotorDeExportacao["id"], comportamento: "ok" | "indisponivel" | "falha" | "espera" = "ok"): MotorDeExportacao & { soltou: boolean } {
  const m = {
    id,
    soltou: false,
    async exportar(_e: EntradaDaExportacao, aoProgresso: (f: number | null) => void, sinal: AbortSignal) {
      if (comportamento === "indisponivel") throw new MotorIndisponivel("não serve");
      if (comportamento === "falha") throw new Error("codificador caiu");
      for (const f of [0.25, 0.5, 1]) aoProgresso(f);
      if (comportamento === "espera") await new Promise((_, falha) => sinal.addEventListener("abort", () => ((m.soltou = true), falha(new DOMException("parou", "AbortError")))));
      return new Blob(["mp4"], { type: "video/mp4" });
    },
  };
  return m;
}
function passos(p: Partial<PassosDaExportacao> = {}) {
  const tela = { soltar: vi.fn() };
  const entregar = vi.fn(async () => "ok" as const);
  const tudo: PassosDaExportacao = { preparar: async () => entradaFalsa(), motores: [motorFalso("webcodecs")], entregar, manterTelaAcesa: () => tela, ...p };
  return { tudo, tela, entregar };
}
const acompanhar = () => {
  const progresso: (number | null)[] = [];
  const motores: string[] = [];
  const a: Acompanhamento = { aoProgresso: (f) => progresso.push(f), aoMotor: (id) => motores.push(id), aoEntregar: vi.fn() };
  return { a, progresso, motores };
};

describe("roteiro da exportação (motores falsos)", () => {
  it("exporta, conta o progresso, entrega o arquivo e solta a tela acesa e a entrada", async () => {
    const soltar = vi.fn();
    const { tudo, tela, entregar } = passos({ preparar: async () => entradaFalsa(soltar) });
    const { a, progresso, motores } = acompanhar();
    expect(await exportarEEntregar(tudo, a, new AbortController().signal)).toBe("ok");
    expect(progresso).toEqual([0, 0.25, 0.5, 1]);
    expect(motores).toEqual(["webcodecs"]);
    expect(entregar).toHaveBeenCalledWith(expect.objectContaining({ type: "video/mp4" }));
    expect(a.aoEntregar).toHaveBeenCalledOnce();
    expect(tela.soltar).toHaveBeenCalledOnce();
    expect(soltar).toHaveBeenCalledOnce();
  });

  it("um motor que não serve a este vídeo passa ao próximo; nenhum servindo é erro", async () => {
    const { tudo } = passos({ motores: [motorFalso("webcodecs", "indisponivel"), motorFalso("tempo-real")] });
    const { a, motores } = acompanhar();
    vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(await exportarEEntregar(tudo, a, new AbortController().signal)).toBe("ok");
    expect(motores).toEqual(["webcodecs", "tempo-real"]);
    const nenhum = passos({ motores: [motorFalso("webcodecs", "indisponivel")] });
    expect(await exportarEEntregar(nenhum.tudo, acompanhar().a, new AbortController().signal)).toBe("erro");
    expect(nenhum.entregar).not.toHaveBeenCalled();
  });

  it("uma falha de verdade de um motor passa ao próximo; se todos falham, é erro e a tela acesa se solta", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const segundo = motorFalso("tempo-real");
    const espia = vi.spyOn(segundo, "exportar");
    const { tudo } = passos({ motores: [motorFalso("webcodecs", "falha"), segundo] });
    expect(await exportarEEntregar(tudo, acompanhar().a, new AbortController().signal)).toBe("ok");
    expect(espia).toHaveBeenCalledOnce();
    const { tudo: todos, tela } = passos({ motores: [motorFalso("webcodecs", "falha"), motorFalso("tempo-real", "falha")] });
    expect(await exportarEEntregar(todos, acompanhar().a, new AbortController().signal)).toBe("erro");
    expect(tela.soltar).toHaveBeenCalledOnce();
  });

  it("a falha diz em que etapa foi e o que o navegador respondeu", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const { tudo } = passos({ motores: [motorFalso("webcodecs", "falha")] });
    const detalhes: string[] = [];
    await exportarEEntregar(tudo, { ...acompanhar().a, aoFalhar: (d) => detalhes.push(d) }, new AbortController().signal);
    expect(detalhes).toHaveLength(1);
    expect(detalhes[0]).toMatch(/^motores — .*nenhum serve \(webcodecs: /);
    const nenhum = passos({ motores: [motorFalso("webcodecs", "indisponivel")] });
    await exportarEEntregar(nenhum.tudo, { ...acompanhar().a, aoFalhar: (d) => detalhes.push(d) }, new AbortController().signal);
    expect(detalhes[1]).toMatch(/^motores — .*nenhum serve \(webcodecs: /);
  });
  it("detalheDaFalha junta etapa, nome e mensagem, corta o excesso e aceita qualquer coisa jogada", () => {
    expect(detalheDaFalha("motor webcodecs", new DOMException("codificador recusou", "EncodingError"))).toBe("motor webcodecs — EncodingError: codificador recusou");
    expect(detalheDaFalha("entregar", "texto solto")).toBe("entregar — texto solto");
    expect(detalheDaFalha("preparar", undefined)).toBe("preparar");
    expect(detalheDaFalha("x", new Error("a".repeat(500))).length).toBeLessThan(180);
  });

  it("cancelar no meio interrompe o motor de verdade, não entrega e solta tudo", async () => {
    const motor = motorFalso("webcodecs", "espera");
    const { tudo, tela, entregar } = passos({ motores: [motor] });
    const controle = new AbortController();
    const fim = exportarEEntregar(tudo, acompanhar().a, controle.signal);
    await new Promise((r) => setTimeout(r, 0));
    controle.abort();
    expect(await fim).toBe("interrompida");
    expect(motor.soltou).toBe(true);
    expect(entregar).not.toHaveBeenCalled();
    expect(tela.soltar).toHaveBeenCalledOnce();
  });

  it("sem vídeo ou sem zero (a preparação devolve nada): 'sem', sem rodar motor", async () => {
    const motor = motorFalso("webcodecs");
    const espia = vi.spyOn(motor, "exportar");
    const { tudo, tela } = passos({ preparar: async () => null, motores: [motor] });
    expect(await exportarEEntregar(tudo, acompanhar().a, new AbortController().signal)).toBe("sem");
    expect(espia).not.toHaveBeenCalled();
    expect(tela.soltar).toHaveBeenCalledOnce();
  });

  it("a pessoa fechar a folha depois de pronto volta 'cancelado' (não é a exportação interrompida)", async () => {
    const { tudo } = passos({ entregar: async () => "cancelado" });
    expect(await exportarEEntregar(tudo, acompanhar().a, new AbortController().signal)).toBe("cancelado");
  });
});

describe("a janela de enviar o vídeo", () => {
  const com = { ids: ["webcodecs", "tempo-real"] as const, temZero: true };
  it("as duas escolhas só com motor e zero; senão só 'Sem os tempos', com o motivo", () => {
    expect(escolhasDaJanela(com)).toEqual(["com", "sem"]);
    expect(escolhasDaJanela({ ids: [], temZero: true })).toEqual(["sem"]);
    expect(motivoSemTempos({ ids: [], temZero: true })).toBe("sem_motor");
    expect(motivoSemTempos({ ids: ["webcodecs"], temZero: false })).toBe("sem_zero");
    expect(motivoSemTempos(com)).toBeNull();
  });
  it("a marcada segue a chave 'Tempos sobre o vídeo' (e só se der para exportar)", () => {
    expect(escolhaInicial(true, com)).toBe("com");
    expect(escolhaInicial(false, com)).toBe("sem");
    expect(escolhaInicial(true, { ids: [], temZero: true })).toBe("sem");
  });
  it("avisa que demora o tamanho do vídeo só quando o preferido é o de tempo real", () => {
    expect(demoraOTamanho(com)).toBe(false);
    expect(demoraOTamanho({ ids: ["tempo-real"], temZero: true })).toBe(true);
  });
  it("porcentagem inteira entre 0 e 100; sem duração, nula", () => {
    expect(porcentagem(0.426)).toBe(43);
    expect(porcentagem(1.2)).toBe(100);
    expect(porcentagem(-1)).toBe(0);
    expect(porcentagem(null)).toBeNull();
    expect(porcentagem(Number.NaN)).toBeNull();
  });
  it("o aviso de cada fim", () => {
    expect(avisoDoFim("ok", true)).toBeNull();
    expect(avisoDoFim("cancelado", true)).toBeNull();
    expect(avisoDoFim("interrompida", false)).toEqual({ tipo: "info", chave: "exportar.interrompida" });
    expect(avisoDoFim("erro", false)).toEqual({ tipo: "erro", chave: "exportar.erro" });
    expect(avisoDoFim("erro", true)).toEqual({ tipo: "erro", chave: "compartilhar_video.erro" });
    expect(avisoDoFim("sem", false)).toEqual({ tipo: "erro", chave: "compartilhar_video.sem" });
  });
});

describe("os dados do overlay (a mesma montagem do player e da exportação)", () => {
  const pontos = { A: 10, C: 0, D: 0, M: 0, NS: 0, procedimentais: 0, fator: "minor" as const };
  it("sem zero conhecido, sem overlay; com ele, o zero levado ao vídeo (pode ser negativo)", () => {
    expect(dadosDoOverlay(null, { disparosMs: [1000] })).toBeNull();
    const d = dadosDoOverlay({ zeroNoAudioS: 1, inicioDoVideoMs: 1500 }, { disparosMs: [1000], incompleta: undefined });
    expect(d).toMatchObject({ zeroNoVideoS: -0.5, disparosMs: [1000], pontos: null, incompleta: false, atirador: null });
  });
  it("Histórico: os disparos e os pontos salvos, o percurso e quem atira", () => {
    const x = { disparos_ms: [900, 1300], pontos, incompleta: true as const, data: "2026-11-23T12:00:00Z" };
    expect(fonteDaTentativaSalva(x, { nome: "Bill Drill", divisao: "Open" }, { id: "a", nome: "Ana" })).toEqual({
      disparosMs: [900, 1300], pontos, incompleta: true, atirador: { id: "a", nome: "Ana" }, percurso: "Bill Drill", divisao: "Open", data: x.data,
    });
  });
  it("Revisão: os disparos editados (uma cópia), sem atirador (fica o do aparelho)", () => {
    const rev = { disparosMs: [500, 800] };
    const f = fonteDaRevisao(rev, { incompleta: false, data: "2026-11-23T12:00:00Z" }, null);
    expect(f).toMatchObject({ disparosMs: [500, 800], pontos: null, incompleta: false, percurso: undefined });
    expect(f.disparosMs).not.toBe(rev.disparosMs);
    expect(f.atirador).toBeUndefined();
  });
});
