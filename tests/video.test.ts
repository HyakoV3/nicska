import { IDBFactory, IDBKeyRange } from "fake-indexeddb";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Armazenamento } from "../src/lib/armazenamento";
import { lerAvisoVideoVisto, lerQualidade, lerRegistro, lerRetencao, registroPadrao, salvarAvisoVideoVisto, salvarQualidade, salvarRegistro, salvarRetencao } from "../src/lib/preferencias";
import { ALTURAS, DURACAO_MAXIMA_DO_VIDEO_S, TAXAS, bitsDoVideo, bytesEsperados, escolherFormatoDeVideo, normalizarQualidade, qualidadeEntregue, qualidadePadrao, restricoesDaCamera, taxasDa } from "../src/lib/video/formato";
import { DIA_MS, ESPACO_DE_VIDEO, MB, PRAZOS_DE_VIDEO, aApagar, formatarEspaco, limitesDeVideoPadrao } from "../src/lib/video/politica";

vi.stubGlobal("IDBKeyRange", IDBKeyRange);
const novo = () => new Armazenamento(() => new IDBFactory());
const bloco = (bytes: number) => new Blob([new Uint8Array(bytes).fill(3)], { type: "video/webm" });

describe("formato e qualidade do vídeo", () => {
  it("prefere WebM vp8 e cai nos outros; nulo se o aparelho não grava", () => {
    expect(escolherFormatoDeVideo(() => true)).toBe("video/webm;codecs=vp8,opus");
    expect(escolherFormatoDeVideo((t) => t.startsWith("video/mp4"))).toBe("video/mp4;codecs=avc1,mp4a.40.2");
    expect(escolherFormatoDeVideo((t) => t === "video/webm")).toBe("video/webm");
    expect(escolherFormatoDeVideo(() => false)).toBeNull();
  });
  it("a câmera pede a qualidade escolhida (720p30 por padrão), só vídeo, traseira por padrão", () => {
    const r = restricoesDaCamera("traseira");
    expect(r.audio).toBe(false);
    expect(r.video).toMatchObject({ facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30 } });
    expect(restricoesDaCamera("frontal", { altura: 720, fps: 60 }).video).toMatchObject({ facingMode: { ideal: "user" }, width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 60 } });
  });
  it("o bitrate cresce com a resolução e com a taxa; 720p30 = 2 Mbps (30 s ≈ 8 MB)", () => {
    expect(bitsDoVideo(qualidadePadrao())).toBe(2_000_000);
    const todas = ALTURAS.flatMap((altura) => TAXAS.map((fps) => bitsDoVideo({ altura, fps })));
    expect(new Set(todas).size).toBe(4); // 1080p e 4K só existem a 30 fps: 2160-60 vale o 2160-30
    expect(bitsDoVideo({ altura: 720, fps: 60 })).toBeGreaterThan(bitsDoVideo({ altura: 720, fps: 30 }));
    expect(bitsDoVideo({ altura: 1080, fps: 30 })).toBeGreaterThan(bitsDoVideo({ altura: 720, fps: 60 }));
    expect(bytesEsperados(30)).toBeGreaterThan(7 * MB);
    expect(bytesEsperados(30)).toBeLessThan(9 * MB);
    expect(bytesEsperados(30, { altura: 1080, fps: 30 })).toBeGreaterThan(bytesEsperados(30) * 1.9);
  });
  it("4K (2160p): avançado, só 30 fps, ~18 Mbps, pede 3840x2160", () => {
    expect(ALTURAS).toEqual([720, 1080, 2160]);
    expect(taxasDa(2160)).toEqual([30]);
    expect(taxasDa(1080)).toEqual([30]);
    expect(taxasDa(720)).toEqual([30, 60]);
    expect(normalizarQualidade({ altura: 1080, fps: 60 })).toEqual({ altura: 1080, fps: 30 });
    expect(normalizarQualidade({ altura: 720, fps: 60 })).toEqual({ altura: 720, fps: 60 });
    expect(bitsDoVideo({ altura: 1080, fps: 60 })).toBe(4_000_000);
    expect(normalizarQualidade({ altura: 2160, fps: 60 })).toEqual({ altura: 2160, fps: 30 });
    expect(bitsDoVideo({ altura: 2160, fps: 30 })).toBe(18_000_000);
    expect(bitsDoVideo({ altura: 2160, fps: 60 })).toBe(18_000_000);
    expect(bitsDoVideo({ altura: 2160, fps: 30 })).toBeGreaterThan(bitsDoVideo({ altura: 1080, fps: 30 }) * 2.5);
    expect(restricoesDaCamera("traseira", { altura: 2160, fps: 30 }).video).toMatchObject({ width: { ideal: 3840 }, height: { ideal: 2160 }, frameRate: { ideal: 30 } });
  });
  it("tabela de tamanhos: o maior vídeo (200 s) em cada qualidade", () => {
    const mib = (q: Parameters<typeof bytesEsperados>[1]) => bytesEsperados(DURACAO_MAXIMA_DO_VIDEO_S, q) / MB;
    expect(mib({ altura: 720, fps: 30 })).toBeCloseTo(49.2, 0);
    expect(mib({ altura: 1080, fps: 30 })).toBeCloseTo(96.9, 0);
    expect(mib({ altura: 2160, fps: 30 })).toBeCloseTo(431.0, 0);
    expect(bytesEsperados(60, { altura: 2160, fps: 30 }) / MB).toBeCloseTo(129.2, 0);
  });
  it("qualidadeEntregue: pelo lado menor da imagem, nunca acima do pedido; sem dados, o pedido", () => {
    const q4k = { altura: 2160, fps: 30 } as const;
    expect(qualidadeEntregue(q4k, 2160)).toEqual(q4k);
    expect(qualidadeEntregue(q4k, 1080)).toEqual({ altura: 1080, fps: 30 });
    expect(qualidadeEntregue(q4k, 1440)).toEqual({ altura: 1080, fps: 30 });
    expect(qualidadeEntregue(q4k, 480)).toEqual({ altura: 720, fps: 30 });
    expect(qualidadeEntregue({ altura: 720, fps: 60 }, 2160)).toEqual({ altura: 720, fps: 60 });
    expect(qualidadeEntregue({ altura: 1080, fps: 60 }, 2160)).toEqual({ altura: 1080, fps: 30 });
    expect(qualidadeEntregue(q4k, null)).toEqual(q4k);
  });
});

describe("política de guardar vídeos (espaço e prazo)", () => {
  const AGORA = 100 * DIA_MS;
  const v = (id: string, idade: number, bytes = MB, fixado = false) => ({ id, atualizadoEm: AGORA - idade * DIA_MS, bytes, fixado });
  it("o padrão é 2 GB e 30 dias; o controle vai de 1 GB a 8 GB e os prazos são 7, 30, 90 ou nenhum", () => {
    expect(limitesDeVideoPadrao()).toEqual({ bytes: 2048 * MB, dias: 30 });
    expect(ESPACO_DE_VIDEO.min).toBe(1024 * MB);
    expect(ESPACO_DE_VIDEO.max).toBe(8192 * MB);
    expect((ESPACO_DE_VIDEO.max - ESPACO_DE_VIDEO.min) % ESPACO_DE_VIDEO.passo).toBe(0);
    expect(PRAZOS_DE_VIDEO).toEqual([7, 30, 90, null]);
  });
  it("o espaço mínimo guarda ao menos 2 dos maiores vídeos possíveis (4K, 200 s); o padrão, ao menos 4", () => {
    const maior = bytesEsperados(DURACAO_MAXIMA_DO_VIDEO_S, { altura: 2160, fps: 30 });
    expect(Math.floor(ESPACO_DE_VIDEO.min / maior)).toBeGreaterThanOrEqual(2);
    expect(Math.floor(limitesDeVideoPadrao().bytes / maior)).toBeGreaterThanOrEqual(4);
  });
  it("o vídeo recém-salvo nunca é apagado, nem sozinho acima do espaço nem pelo prazo", () => {
    expect(aApagar([v("novo", 0, 600 * MB)], { bytes: 100 * MB, dias: null }, AGORA, ["novo"])).toEqual([]);
    expect(aApagar([v("velho", 5, 300 * MB), v("novo", 0, 600 * MB)], { bytes: 100 * MB, dias: null }, AGORA, ["novo"])).toEqual(["velho"]);
    expect(aApagar([v("novo", 40, 4 * MB)], { bytes: 100 * MB, dias: 30 }, AGORA, ["novo"])).toEqual([]);
    // sem preservar (o "Apagar agora" da pessoa), a política vale inteira
    expect(aApagar([v("a", 1, 600 * MB)], { bytes: 100 * MB, dias: null }, AGORA)).toEqual(["a"]);
  });
  it("apaga o que passou do prazo, mesmo cabendo no espaço", () => {
    expect(aApagar([v("velho", 40), v("novo", 3)], { bytes: 100 * MB, dias: 30 }, AGORA)).toEqual(["velho"]);
    expect(aApagar([v("a", 8), v("b", 7)], { bytes: 100 * MB, dias: 7 }, AGORA)).toEqual(["a"]);
  });
  it("sem prazo, só o espaço conta: apaga do mais antigo ao mais novo até caber", () => {
    expect(aApagar([v("a", 300, 4 * MB), v("b", 200, 4 * MB), v("c", 1, 4 * MB)], { bytes: 5 * MB, dias: null }, AGORA)).toEqual(["a", "b"]);
  });
  it("o que o prazo já apagou conta como livre antes de olhar o espaço", () => {
    expect(aApagar([v("velho", 40, 8 * MB), v("b", 2, 4 * MB), v("c", 1, 4 * MB)], { bytes: 8 * MB, dias: 30 }, AGORA)).toEqual(["velho"]);
  });
  it("fixados nunca são apagados, nem pelo prazo nem pelo espaço", () => {
    expect(aApagar([v("fixo", 400, 9 * MB, true), v("b", 2, 4 * MB), v("c", 1, 4 * MB)], { bytes: 5 * MB, dias: 30 }, AGORA)).toEqual(["b", "c"]);
    expect(aApagar([v("fixo", 400, MB, true)], { bytes: MB, dias: 7 }, AGORA)).toEqual([]);
  });
  it("não apaga nada dentro dos limites ou sem vídeos", () => {
    expect(aApagar([v("a", 1)], limitesDeVideoPadrao(), AGORA)).toEqual([]);
    expect(aApagar([], limitesDeVideoPadrao(), AGORA)).toEqual([]);
  });
});

describe("formatarEspaco", () => {
  it("MB abaixo de 1 GB e GB (uma casa) acima, no formato do idioma", () => {
    expect(formatarEspaco(100 * MB, "pt-BR")).toBe("100 MB");
    expect(formatarEspaco(1536 * MB, "pt-BR")).toBe("1,5 GB");
    expect(formatarEspaco(1536 * MB, "en")).toBe("1.5 GB");
    expect(formatarEspaco(0, "pt-BR")).toBe("0 MB");
  });
});

describe("armazenamento de vídeo em pedaços", () => {
  it("grava pedaços, finaliza e monta o vídeo inteiro", async () => {
    const a = novo();
    await a.iniciarVideo("t1", "video/webm");
    for (let n = 0; n < 3; n++) await a.gravarPedaco("t1", n, bloco(100 + n));
    await a.finalizarVideo("t1", false);
    expect(await a.metaDoVideo("t1")).toMatchObject({ tipo: "video/webm", pedacos: 3, bytes: 303, parcial: false, fixado: false });
    const v = await a.video("t1");
    expect(v?.size).toBe(303);
    expect(v?.type).toBe("video/webm");
  });
  it("queda no meio: o que já foi gravado fica, marcado como parcial", async () => {
    const a = novo();
    await a.iniciarVideo("t1", "video/webm");
    await a.gravarPedaco("t1", 0, bloco(50));
    await a.finalizarVideo("t1", true);
    expect((await a.metaDoVideo("t1"))?.parcial).toBe(true);
    expect((await a.video("t1"))?.size).toBe(50);
  });
  it("sem vídeo, ou iniciado e vazio, devolve nulo; gravar sem iniciar recusa", async () => {
    const a = novo();
    expect(await a.video("x")).toBeNull();
    expect(await a.metaDoVideo("x")).toBeNull();
    await a.iniciarVideo("t1", "video/webm");
    expect(await a.video("t1")).toBeNull();
    await expect(a.gravarPedaco("outro", 0, bloco(1))).rejects.toThrow();
  });
  it("recomeçar com o mesmo id apaga o que havia; apagar leva os pedaços e só os dele", async () => {
    const a = novo();
    await a.iniciarVideo("t1", "video/webm");
    await a.gravarPedaco("t1", 0, bloco(10));
    await a.iniciarVideo("t2", "video/webm");
    await a.gravarPedaco("t2", 0, bloco(20));
    await a.iniciarVideo("t1", "video/webm");
    expect(await a.video("t1")).toBeNull();
    await a.gravarPedaco("t1", 0, bloco(5));
    await a.apagarVideo("t1");
    expect(await a.video("t1")).toBeNull();
    expect((await a.video("t2"))?.size).toBe(20);
  });
  it("apagar a tentativa e apagar o percurso apagam o vídeo; apagarTudo também", async () => {
    const a = novo();
    await a.salvarPercurso({ id: "p1", nome: "P", disparos_minimos: 6, criado_em: 1 });
    const t = await a.salvarTentativa({ id: "t1", percurso_id: "p1", quando: 5, disparos: [], total_ms: 1000, atirador_id: "eu" } as never);
    await a.iniciarVideo(t.id, "video/webm");
    await a.gravarPedaco(t.id, 0, bloco(10));
    await a.apagarTentativa(t.id);
    expect(await a.video(t.id)).toBeNull();
    await a.iniciarVideo("v2", "video/webm");
    await a.gravarPedaco("v2", 0, bloco(10));
    await a.apagarTudo();
    expect(await a.video("v2")).toBeNull();
    expect(await a.resumoDosVideos()).toEqual({ videos: 0, bytes: 0 });
  });
  it("o vídeo não entra no backup", async () => {
    const a = novo();
    await a.iniciarVideo("t1", "video/webm");
    expect(Object.keys(await a.tudo())).toEqual(["atiradores", "percursos", "tentativas"]);
  });
  it("resumo, fixar e limpeza pela política", async () => {
    const a = novo();
    for (const id of ["a", "b", "c"]) {
      await a.iniciarVideo(id, "video/webm");
      await a.gravarPedaco(id, 0, bloco(10));
      await new Promise((r) => setTimeout(r, 3));
    }
    expect(await a.resumoDosVideos()).toEqual({ videos: 3, bytes: 30 });
    await a.fixarVideo("a", true);
    expect(await a.limparVideos({ bytes: 20, dias: null })).toEqual(["b"]);
    expect(await a.video("a")).not.toBeNull();
    expect(await a.video("c")).not.toBeNull();
  });
  it("a limpeza preserva o vídeo recém-salvo mesmo maior que o espaço", async () => {
    const a = novo();
    await a.iniciarVideo("velho", "video/webm", 0);
    await a.gravarPedaco("velho", 0, bloco(10));
    await a.finalizarVideo("velho", false);
    await a.iniciarVideo("novo", "video/webm", 0);
    await a.gravarPedaco("novo", 0, bloco(50));
    await a.finalizarVideo("novo", false);
    expect(await a.limparVideos({ bytes: 20, dias: null }, ["novo"])).toEqual(["velho"]);
    expect(await a.video("novo")).not.toBeNull();
  });
});

describe("preferência do modo de registro", () => {
  let mem: Record<string, string>;
  beforeEach(() => {
    mem = {};
    vi.stubGlobal("localStorage", { getItem: (k: string) => mem[k] ?? null, setItem: (k: string, x: string) => void (mem[k] = x) });
  });
  it("começa em só áudio, câmera traseira", () => {
    expect(lerRegistro()).toEqual({ modo: "audio", camera: "traseira" });
    expect(registroPadrao()).toEqual({ modo: "audio", camera: "traseira" });
  });
  it("lembra a escolha e ignora lixo", () => {
    salvarRegistro({ modo: "video", camera: "frontal" });
    expect(lerRegistro()).toEqual({ modo: "video", camera: "frontal" });
    mem["prefs.registro"] = JSON.stringify({ modo: "xis", camera: 3 });
    expect(lerRegistro()).toEqual({ modo: "audio", camera: "traseira" });
    mem["prefs.registro"] = "{quebrado";
    expect(lerRegistro()).toEqual({ modo: "audio", camera: "traseira" });
  });
  it("o aviso de privacidade do vídeo aparece uma vez", () => {
    expect(lerAvisoVideoVisto()).toBe(false);
    salvarAvisoVideoVisto();
    expect(lerAvisoVideoVisto()).toBe(true);
  });
});

describe("preferências de qualidade e de retenção", () => {
  let mem: Record<string, string>;
  beforeEach(() => {
    mem = {};
    vi.stubGlobal("localStorage", { getItem: (k: string) => mem[k] ?? null, setItem: (k: string, x: string) => void (mem[k] = x) });
  });
  it("a qualidade começa em 720p30, lembra a escolha e ignora lixo", () => {
    expect(lerQualidade()).toEqual({ altura: 720, fps: 30 });
    salvarQualidade({ altura: 720, fps: 60 });
    expect(lerQualidade()).toEqual({ altura: 720, fps: 60 });
    mem["prefs.videoQualidade"] = JSON.stringify({ altura: 1080, fps: 60 }); // guardada antes de o 1080p60 sair
    expect(lerQualidade()).toEqual({ altura: 1080, fps: 30 });
    mem["prefs.videoQualidade"] = JSON.stringify({ altura: 4320, fps: 240 });
    expect(lerQualidade()).toEqual({ altura: 720, fps: 30 });
  });
  it("a retenção começa em 2 GB e 30 dias, lembra a escolha (inclusive sem prazo) e limita o espaço", () => {
    expect(lerRetencao()).toEqual({ bytes: 2048 * MB, dias: 30 });
    salvarRetencao({ bytes: 3072 * MB, dias: null });
    expect(lerRetencao()).toEqual({ bytes: 3072 * MB, dias: null });
    mem["prefs.videoRetencao"] = JSON.stringify({ bytes: 1, dias: 5 });
    expect(lerRetencao()).toEqual({ bytes: ESPACO_DE_VIDEO.min, dias: 30 });
    mem["prefs.videoRetencao"] = JSON.stringify({ bytes: 1e15, dias: 90 });
    expect(lerRetencao()).toEqual({ bytes: ESPACO_DE_VIDEO.max, dias: 90 });
    mem["prefs.videoRetencao"] = "{quebrado";
    expect(lerRetencao()).toEqual(limitesDeVideoPadrao());
  });
});
