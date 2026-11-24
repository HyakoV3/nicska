import { describe, expect, it, vi } from "vitest";
import { QUALIDADE_DO_RECUO, abrirCameraComRecuo } from "../src/lib/video/camera";

const fluxo = (lado: number | null) => ({ getVideoTracks: () => [{ getSettings: () => (lado ? { width: lado * 2, height: lado } : {}) }] }) as unknown as MediaStream;
const erro = (name: string) => Object.assign(new Error(name), { name });
const q4k = { altura: 2160, fps: 30 } as const;

describe("abrir a câmera com recuo do 4K", () => {
  it("4K entregue: sem recuo", async () => {
    const abrir = vi.fn().mockResolvedValue(fluxo(2160));
    const r = await abrirCameraComRecuo(abrir, "traseira", q4k);
    expect(r).toMatchObject({ recuou: false, entregue: q4k });
    expect(abrir).toHaveBeenCalledTimes(1);
  });
  it("a câmera abre com menos que 4K: segue com o que veio e avisa (o bitrate é o do real)", async () => {
    const r = await abrirCameraComRecuo(vi.fn().mockResolvedValue(fluxo(1080)), "traseira", q4k);
    expect(r).toMatchObject({ recuou: true, entregue: { altura: 1080, fps: 30 } });
  });
  it("o pedido de 4K falha por limite do aparelho: tenta de novo em 1080p30", async () => {
    const abrir = vi.fn().mockRejectedValueOnce(erro("NotReadableError")).mockResolvedValueOnce(fluxo(1080));
    const r = await abrirCameraComRecuo(abrir, "frontal", q4k);
    expect(r.recuou).toBe(true);
    expect(abrir).toHaveBeenLastCalledWith(expect.objectContaining({ video: expect.objectContaining({ height: { ideal: QUALIDADE_DO_RECUO.altura } }) }));
  });
  it("permissão negada, falta de câmera e 1080p que falha não recuam", async () => {
    await expect(abrirCameraComRecuo(vi.fn().mockRejectedValue(erro("NotAllowedError")), "traseira", q4k)).rejects.toThrow();
    await expect(abrirCameraComRecuo(vi.fn().mockRejectedValue(erro("NotFoundError")), "traseira", q4k)).rejects.toThrow();
    const abrir = vi.fn().mockRejectedValue(erro("NotReadableError"));
    await expect(abrirCameraComRecuo(abrir, "traseira", { altura: 1080, fps: 30 })).rejects.toThrow();
    expect(abrir).toHaveBeenCalledTimes(1);
  });
  it("sem getSettings (aparelho que não diz), vale o pedido", async () => {
    expect((await abrirCameraComRecuo(vi.fn().mockResolvedValue(fluxo(null)), "traseira", q4k)).recuou).toBe(false);
  });
});
