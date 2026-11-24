import { describe, expect, it, vi } from "vitest";
import { ErroDeDocumento, LIMITES, lerDocumento } from "../src/lib/documento";
import { lerArquivo } from "../src/lib/lerArquivo";

const falso = (size: number, texto = "") => ({ size, text: vi.fn(async () => texto) });

describe("lerArquivo", () => {
  it("recusa arquivo acima do limite sem ler", async () => {
    const f = falso(LIMITES.bytes + 1);
    await expect(lerArquivo(f)).rejects.toMatchObject({ codigo: "grande_demais" });
    await expect(lerArquivo(f)).rejects.toBeInstanceOf(ErroDeDocumento);
    expect(f.text).not.toHaveBeenCalled();
  });
  it("lê arquivo normal e no limite exato", async () => {
    expect(await lerArquivo(falso(5, "ola"))).toBe("ola");
    expect(await lerArquivo(falso(LIMITES.bytes, "x"))).toBe("x");
  });
  it("respeita um limite injetado", async () => {
    await expect(lerArquivo(falso(11), 10)).rejects.toMatchObject({ codigo: "grande_demais" });
  });
  it("o BOM do arquivo lido continua tratado pelo parser", async () => {
    const json = JSON.stringify({ formato: "nicska-backup/1", app: "t", exportado_em: "2026-11-21T12:00:00Z", atirador: { id: "a", nome: "A" }, percursos: [], tentativas: [] });
    const texto = await lerArquivo(falso(json.length + 3, "﻿" + json));
    expect(() => lerDocumento(texto)).not.toThrow();
  });
});
