import { IDBFactory, IDBKeyRange } from "fake-indexeddb";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Armazenamento } from "../src/lib/armazenamento";
import { ReproducaoDoVideo, encaixeDoVideo, metasDosVideos, type Urls } from "../src/lib/video/reproducao";

// O ciclo de vida do player: a URL de objeto é criada uma vez por vídeo aberto e SEMPRE revogada ao fechar, ao abrir outro, ou se o abrir chega tarde.

vi.stubGlobal("IDBKeyRange", IDBKeyRange);

function montar() {
  const banco = new Armazenamento(() => new IDBFactory());
  const vivas = new Set<string>();
  let n = 0;
  const urls: Urls = {
    criar: () => {
      const u = `blob:${++n}`;
      vivas.add(u);
      return u;
    },
    revogar: (u) => vivas.delete(u),
  };
  const preparar = vi.fn(async (b: Blob) => b);
  return { banco, vivas, urls, preparar, r: new ReproducaoDoVideo(banco, urls, preparar) };
}

async function gravar(banco: Armazenamento, id: string, inicioDoVideoMs = 0) {
  await banco.iniciarVideo(id, "video/webm", inicioDoVideoMs);
  await banco.gravarPedaco(id, 0, new Blob(["a"]));
  await banco.gravarPedaco(id, 1, new Blob(["b"]));
  await banco.finalizarVideo(id, false);
}

afterEach(() => vi.restoreAllMocks());

describe("ReproducaoDoVideo", () => {
  it("abre o vídeo (pedaços juntos e preparados) numa URL; fechar a revoga", async () => {
    const { banco, vivas, preparar, r } = montar();
    await gravar(banco, "t1", 300);
    const v = (await r.abrir("t1"))!;
    expect(v.meta).toMatchObject({ inicioDoVideoMs: 300, parcial: false });
    expect(await (preparar.mock.calls[0][0] as Blob).text()).toBe("ab");
    expect(vivas.has(v.url)).toBe(true);
    r.fechar();
    r.fechar();
    expect(vivas.size).toBe(0);
  });
  it("abrir outro revoga o anterior: nunca há duas URLs vivas", async () => {
    const { banco, vivas, r } = montar();
    await gravar(banco, "t1");
    await gravar(banco, "t2");
    await r.abrir("t1");
    await r.abrir("t2");
    expect(vivas.size).toBe(1);
  });
  it("fechado enquanto abria: nada fica vivo e o resultado é nulo", async () => {
    const { banco, vivas, r } = montar();
    await gravar(banco, "t1");
    const abrindo = r.abrir("t1");
    r.fechar();
    expect(await abrindo).toBeNull();
    expect(vivas.size).toBe(0);
  });
  it("sem vídeo, ou com o banco falhando: nulo, sem lançar", async () => {
    const { banco, r } = montar();
    expect(await r.abrir("nada")).toBeNull();
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(banco, "video").mockRejectedValueOnce(new Error("banco fechado"));
    await gravar(banco, "t1");
    expect(await r.abrir("t1")).toBeNull();
  });
});

describe("encaixeDoVideo", () => {
  const meta = { tipo: "video/webm", pedacos: 1, bytes: 1, parcial: false, fixado: false, atualizadoEm: 0 };
  it("usa o zero da Revisão quando vem; senão o guardado ao salvar; metas antigas sem deslocamento valem 0", () => {
    expect(encaixeDoVideo({ ...meta, inicioDoVideoMs: 200, zeroNoAudioMs: 900 }, 1.5)).toEqual({ zeroNoAudioS: 1.5, inicioDoVideoMs: 200 });
    expect(encaixeDoVideo({ ...meta, inicioDoVideoMs: 200, zeroNoAudioMs: 900 })).toEqual({ zeroNoAudioS: 0.9, inicioDoVideoMs: 200 });
    expect(encaixeDoVideo({ ...meta, zeroNoAudioMs: 900 })).toEqual({ zeroNoAudioS: 0.9, inicioDoVideoMs: 0 });
  });
  it("sem zero conhecido: nulo (o vídeo toca, sem pular aos disparos)", () => {
    expect(encaixeDoVideo(meta)).toBeNull();
    expect(encaixeDoVideo(meta, null)).toBeNull();
  });
});

describe("metasDosVideos", () => {
  it("só as tentativas com vídeo entram, com a meta de cada uma", async () => {
    const { banco } = montar();
    await gravar(banco, "t1", 120);
    await banco.fixarVideo("t1", true);
    const m = await metasDosVideos(banco, ["t1", "sem"]);
    expect(Object.keys(m)).toEqual(["t1"]);
    expect(m.t1).toMatchObject({ fixado: true, inicioDoVideoMs: 120 });
  });
});
