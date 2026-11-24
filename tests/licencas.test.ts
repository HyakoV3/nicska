import { describe, expect, it } from "vitest";
import { pt } from "../src/lib/i18n/pt";
import { CREDITOS, semLicenca, textoDaLicenca } from "../src/lib/licencas";
import { TEXTO_APACHE_2, TEXTO_MIT } from "../src/lib/licencas-textos";

describe("créditos e licenças", () => {
  it("ids únicos e cada crédito tem nome, autoria, licença e ao menos um texto", () => {
    const ids = CREDITOS.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const c of CREDITOS) {
      expect(c.nome, c.id).not.toBe("");
      expect(c.autoria, c.id).not.toBe("");
      expect(c.licenca, c.id).not.toBe("");
      expect(c.textos.length, c.id).toBeGreaterThan(0);
      if (c.url) expect(c.url, c.id).toMatch(/^https:\/\//);
    }
  });

  it("todo crédito tem a descrição de uso traduzida", () => {
    for (const c of CREDITOS) expect(pt, c.id).toHaveProperty(`creditos.uso.${c.id}`);
  });

  it("cobre o que o app usa: ícones, Svelte e Tauri", () => {
    const ids = CREDITOS.map((c) => c.id);
    for (const esperado of ["icones", "svelte", "tauri"]) expect(ids).toContain(esperado);
  });

  it("o MIT leva a linha de direitos e o texto padrão; a Apache 2.0 vem inteira", () => {
    const tauri = CREDITOS.find((c) => c.id === "tauri")!;
    const mit = textoDaLicenca(tauri.textos[0]);
    expect(mit).toContain("Tauri Apps Contributors");
    expect(mit).toContain("Permission is hereby granted, free of charge");
    expect(mit).toContain(TEXTO_MIT);
    const icones = CREDITOS.find((c) => c.id === "icones")!;
    expect(textoDaLicenca(icones.textos[0])).toBe(TEXTO_APACHE_2);
    expect(TEXTO_APACHE_2).toContain("END OF TERMS AND CONDITIONS");
  });

  it("nenhum crédito atual é só 'direitos reservados'", () => {
    expect(CREDITOS.filter(semLicenca)).toEqual([]);
  });
});
