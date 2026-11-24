import { describe, expect, it } from "vitest";
import { MIMES_TESTADOS, escolherMimeVideo, extensaoDoMime, tabelaDeSuporte, tipoSemCodec } from "../src/lib/spike/mime";
import {
  alvosDeSeek, bytesPorSegundo, derivaDoRelogio, diferencaDeIntervalos, erroDeSeek, intervalosEntreEstalos, numeroOuTexto,
  percentualDescartado, razaoDoEsperado, resumirFps,
} from "../src/lib/spike/estatisticas";
import { MIB, dividirEmPedacos, pedacosSinteticos } from "../src/lib/spike/sintetico";
import { entregouTaxa, outroLado, restricoesDeVideo } from "../src/lib/spike/restricoes";
import { compararComSoAudio, descreverErro, montarRelatorio, nomeDoRelatorio, nomeDoVideoDeTeste } from "../src/lib/spike/relatorio";

describe("mime", () => {
  it("a lista fixa tem 14 formatos e a tabela mostra cada um", () => {
    expect(MIMES_TESTADOS).toHaveLength(14);
    const t = tabelaDeSuporte((x) => x === "video/webm");
    expect(Object.keys(t)).toHaveLength(14);
    expect(t["video/webm"]).toBe(true);
    expect(t["video/mp4"]).toBe(false);
  });
  it("prefere MP4 avc1+aac; senão WebM vp9, depois vp8", () => {
    expect(escolherMimeVideo(() => true)).toBe("video/mp4;codecs=avc1,mp4a.40.2");
    expect(escolherMimeVideo((t) => t.startsWith("video/webm"))).toBe("video/webm;codecs=vp9,opus");
    expect(escolherMimeVideo((t) => t === "video/webm;codecs=vp8,opus")).toBe("video/webm;codecs=vp8,opus");
    expect(escolherMimeVideo(() => false)).toBeNull();
  });
  it("extensão e tipo sem codec", () => {
    expect(extensaoDoMime("video/mp4;codecs=avc1")).toBe("mp4");
    expect(extensaoDoMime("video/webm;codecs=vp9,opus")).toBe("webm");
    expect(extensaoDoMime("application/json")).toBe("json");
    expect(extensaoDoMime("")).toBe("bin");
    expect(tipoSemCodec("Video/MP4;codecs=avc1")).toBe("video/mp4");
  });
});

describe("estatísticas", () => {
  it("intervalos entre estalos independem do início", () => {
    expect(intervalosEntreEstalos([1, 1.5, 2.25])).toEqual([500, 750]);
    expect(intervalosEntreEstalos([11, 11.5, 12.25])).toEqual([500, 750]);
    expect(intervalosEntreEstalos([3])).toEqual([]);
  });
  it("diferença entre execuções só se o número de estalos bate", () => {
    expect(diferencaDeIntervalos([500, 750], [502, 749])).toEqual([2, -1]);
    expect(diferencaDeIntervalos([500], [500, 700])).toBeNull();
    expect(diferencaDeIntervalos([], [])).toBeNull();
  });
  it("bytes por segundo e razão do esperado", () => {
    expect(bytesPorSegundo(2_500_000, 10)).toBe(250_000);
    expect(bytesPorSegundo(10, 0)).toBe(0);
    expect(razaoDoEsperado(2_580_000, 10, 2_064_000)).toBe(1);
    expect(razaoDoEsperado(1, 0, 1000)).toBe(0);
  });
  it("resume o fps e conta quadros atrasados", () => {
    const ok = Array.from({ length: 31 }, (_, i) => i * (1000 / 30));
    const r = resumirFps(ok);
    expect(r.quadros).toBe(31);
    expect(r.fpsMedio).toBeCloseTo(30, 1);
    expect(r.atrasados).toBe(0);
    const comFalha = [0, 33, 66, 200, 233, 266];
    const f = resumirFps(comFalha);
    expect(f.atrasados).toBe(1);
    expect(f.maiorIntervaloMs).toBe(134);
    expect(resumirFps([]).fpsMedio).toBe(0);
  });
  it("alvos e erro de seek", () => {
    expect(alvosDeSeek(30)).toEqual([10, 15, 20]);
    expect(erroDeSeek(10, 10.04)).toBe(40);
    expect(erroDeSeek(10, 9.98)).toBe(-20);
  });
  it("percentual descartado e número não finito", () => {
    expect(percentualDescartado(3, 300)).toBe(1);
    expect(percentualDescartado(0, 0)).toBe(0);
    expect(numeroOuTexto(Infinity)).toBe("Infinity");
    expect(numeroOuTexto(2.5)).toBe(2.5);
  });
  it("deriva do relógio: sem travada é ~0; com travada aparece o salto", () => {
    const certo = [0, 1, 2, 3].map((s) => ({ perfMs: s * 1000, ctxS: s }));
    expect(derivaDoRelogio(certo)).toEqual({ derivaMaximaMs: 0, maiorSaltoMs: 0 });
    const travou = [{ perfMs: 0, ctxS: 0 }, { perfMs: 1000, ctxS: 1 }, { perfMs: 2000, ctxS: 1.4 }, { perfMs: 3000, ctxS: 2.4 }];
    expect(derivaDoRelogio(travou)).toEqual({ derivaMaximaMs: 600, maiorSaltoMs: 600 });
    expect(derivaDoRelogio([])).toEqual({ derivaMaximaMs: 0, maiorSaltoMs: 0 });
  });
});

describe("blob sintético", () => {
  it("divide em pedaços que somam o total", () => {
    expect(dividirEmPedacos(10, 4)).toEqual([4, 4, 2]);
    expect(dividirEmPedacos(8, 4)).toEqual([4, 4]);
    expect(dividirEmPedacos(0, 4)).toEqual([]);
    expect(dividirEmPedacos(5, 0)).toEqual([]);
    expect(dividirEmPedacos(60 * MIB, MIB)).toHaveLength(60);
  });
  it("gera pedaços de blob com o tamanho certo", () => {
    const p = pedacosSinteticos(2.5 * MIB);
    expect(p.map((b) => b.size)).toEqual([MIB, MIB, 0.5 * MIB]);
  });
});

describe("restrições de vídeo", () => {
  it("1280x720 ideal e a taxa pedida", () => {
    expect(restricoesDeVideo({ lado: "environment", fps: 60 })).toEqual({
      facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 60 },
    });
    expect(outroLado("user")).toBe("environment");
  });
  it("entregou a taxa com tolerância de 10%", () => {
    expect(entregouTaxa(60, 59.94)).toBe(true);
    expect(entregouTaxa(60, 30)).toBe(false);
    expect(entregouTaxa(60, undefined)).toBe(false);
  });
});

describe("relatório", () => {
  const vazio = { camera: [], gravacoes: [], armazenamento: [], compartilhar: [], cicloDeVida: [] };
  it("monta com versão, data, ambiente e erros; é JSON válido", () => {
    const r = montarRelatorio({ quando: new Date("2026-11-23T12:00:00Z"), ambiente: { userAgent: "x" }, passos: vazio, erros: [{ passo: "camera", nome: "NotAllowedError", mensagem: "negado" }] });
    expect(r.versao).toBe(1);
    expect(r.quando).toBe("2026-11-23T12:00:00.000Z");
    expect(JSON.parse(JSON.stringify(r)).erros[0].nome).toBe("NotAllowedError");
  });
  it("compara os intervalos de cada modo com o só áudio", () => {
    const g = [
      { modo: "audio", detector: { intervalosMs: [500, 700] } },
      { modo: "720p30", detector: { intervalosMs: [501, 698] } },
      { modo: "720p60", detector: { intervalosMs: [500] } },
    ];
    expect(compararComSoAudio(g)).toEqual([
      { modo: "720p30", diferencaDeIntervalosMs: [1, -2] },
      { modo: "720p60", diferencaDeIntervalosMs: null },
    ]);
    expect(compararComSoAudio([{ modo: "720p30" }])).toEqual([]);
  });
  it("descreve erros de qualquer forma", () => {
    expect(descreverErro("camera", new DOMException("negou", "NotAllowedError"))).toEqual({ passo: "camera", nome: "NotAllowedError", mensagem: "negou" });
    expect(descreverErro("x", { name: "N", message: "m" })).toEqual({ passo: "x", nome: "N", mensagem: "m" });
    expect(descreverErro("x", "texto")).toEqual({ passo: "x", nome: "Error", mensagem: "texto" });
  });
  it("nomes de arquivo", () => {
    const q = new Date(2026, 10, 7, 9, 5, 3);
    expect(nomeDoRelatorio(q)).toBe("nicska-spike-s1-20261107-0905.json");
    expect(nomeDoVideoDeTeste("720p30", q, "webm")).toBe("nicska-spike-720p30-20261107-090503.webm");
  });
});
