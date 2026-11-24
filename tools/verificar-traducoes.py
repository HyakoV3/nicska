#!/usr/bin/env python3
"""Confere os dicionários de tradução em src/lib/i18n/*.ts.

Uso:  python3 tools/verificar-traducoes.py     # sai com código 1 se achar algum problema

Verifica, tendo o português (pt.ts) como referência:
  - todo idioma tem exatamente as mesmas chaves (nenhuma faltando, nenhuma sobrando);
  - os parâmetros {entre chaves} de cada texto são os mesmos do português;
  - toda chave de plural ("plural.x.um", ".zero", ".dois", ".poucos", ".muitos") tem a forma ".outros".
O TypeScript já acusa chave faltando; este script cobre também parâmetros e plurais.
"""
import re
import sys
from pathlib import Path

PASTA = Path(__file__).resolve().parent.parent / "src" / "lib" / "i18n"
REFERENCIA = "pt"
SUFIXOS_PLURAL = ("zero", "um", "dois", "poucos", "muitos", "outros")


def ler(codigo):
    texto = (PASTA / f"{codigo}.ts").read_text(encoding="utf-8")
    return dict(re.findall(r'^\s*"?([\w.]+)"?:\s*"((?:[^"\\]|\\.)*)"', texto, re.M))


def parametros(texto):
    return sorted(re.findall(r"\{(\w+)\}", texto))


def main():
    # Só arquivos cujo nome é um código de idioma (pt, es, en, pt-BR...); ignora index.svelte.ts etc.
    codigos = sorted(p.stem for p in PASTA.glob("*.ts") if re.fullmatch(r"[a-z]{2,3}(-[A-Za-z0-9]+)?", p.stem))
    dicts = {c: ler(c) for c in codigos}
    ref = dicts[REFERENCIA]
    problemas = []

    for c, d in dicts.items():
        if c != REFERENCIA:
            for k in sorted(set(ref) - set(d)):
                problemas.append(f"{c}: falta a chave {k!r}")
            for k in sorted(set(d) - set(ref)):
                problemas.append(f"{c}: chave {k!r} não existe em {REFERENCIA}")
            for k, v in ref.items():
                if k in d and parametros(v) != parametros(d[k]):
                    problemas.append(f"{c}: {k!r} tem parâmetros {parametros(d[k])}, esperado {parametros(v)}")
        bases = {k.rsplit(".", 1)[0] for k in d if k.startswith("plural.") and k.rsplit(".", 1)[1] in SUFIXOS_PLURAL}
        for b in sorted(bases):
            if f"{b}.outros" not in d:
                problemas.append(f"{c}: a chave de plural {b!r} não tem a forma '.outros'")

    print(f"idiomas: {', '.join(codigos)} | chaves em {REFERENCIA}: {len(ref)}")
    if problemas:
        print(f"\n{len(problemas)} problema(s):")
        for p in problemas:
            print("  -", p)
        sys.exit(1)
    print("Traduções consistentes.")


if __name__ == "__main__":
    main()
