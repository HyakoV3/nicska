#!/usr/bin/env python3
"""Confere que o movimento do app respeita "reduzir movimento" (prefers-reduced-motion).

Uso:  python3 tools/verificar-movimento.py     # sai com código 1 se achar algum problema

Regras (veja src/lib/movimento.css):
  1. Em src/lib/movimento.css, tudo que se move (animation, transform, @keyframes) tem de estar dentro de um bloco
     @media (prefers-reduced-motion: no-preference).
  2. Em movimento.css, toda transition tem de usar var(--duracao) (que vira 0 com movimento reduzido) ou estar
     dentro do bloco no-preference.
  3. Fora de movimento.css não pode haver animation, transition, transform nem @keyframes, exceto nos arquivos da
     lista PERMITIDOS, e só se o próprio arquivo tiver uma regra prefers-reduced-motion.
"""
import re
import sys
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
SRC = RAIZ / "src"
MOVIMENTO = SRC / "lib" / "movimento.css"
PERMITIDOS = {SRC / "lib" / "Estado.svelte"}  # indicador de carregamento, com a sua própria proteção
# (?<![-\w]) evita falsos positivos como "text-transform" (maiúsculas) e "-webkit-transition".
PADRAO = re.compile(r"(@keyframes\b|(?<![-\w])(animation|transition|transform)\s*:)")
SE_MOVE = re.compile(r"(@keyframes\b|(?<![-\w])(animation|transform)\s*:)")
COMENTARIO = re.compile(r"/\*.*?\*/|<!--.*?-->", re.S)


def sem_comentarios(texto):
    """Troca comentários por espaços (mantém posições e números de linha)."""
    return COMENTARIO.sub(lambda m: re.sub(r"[^\n]", " ", m.group(0)), texto)


def blocos(css):
    """Lista de (inicio, fim, cabecalho) de cada bloco { ... }."""
    pilha, res, ultimo = [], [], 0
    for i, c in enumerate(css):
        if c == "{":
            cab = css[ultimo:i].split("}")[-1].split(";")[-1].strip()
            pilha.append((i, cab))
            ultimo = i + 1
        elif c == "}":
            ini, cab = pilha.pop()
            res.append((ini, i, cab))
            ultimo = i + 1
        elif c == ";":
            ultimo = i + 1
    return res


def dentro_de_sem_reduzir(pos, lista):
    return any(ini < pos < fim and "prefers-reduced-motion: no-preference" in cab for ini, fim, cab in lista)


def verificar_movimento_css(css):
    problemas = []
    lista = blocos(css)
    for m in PADRAO.finditer(css):
        linha = css.count("\n", 0, m.start()) + 1
        protegido = dentro_de_sem_reduzir(m.start(), lista)
        trecho = m.group(0).strip()
        if SE_MOVE.match(m.group(0)) and not protegido:
            problemas.append(f"movimento.css:{linha}: '{trecho}' fora de @media (prefers-reduced-motion: no-preference)")
        elif trecho.startswith("transition") and not protegido:
            valor = re.match(r"transition\s*:([^;]*);", css[m.start():], re.S)
            if not valor or "var(--duracao)" not in valor.group(1):
                problemas.append(f"movimento.css:{linha}: transition sem var(--duracao) e fora do bloco no-preference")
    return problemas


def main():
    problemas = []
    if not MOVIMENTO.exists():
        problemas.append("falta src/lib/movimento.css")
    else:
        problemas += verificar_movimento_css(sem_comentarios(MOVIMENTO.read_text(encoding="utf-8")))

    for arq in sorted(list(SRC.rglob("*.svelte")) + list(SRC.rglob("*.css")) + list(SRC.rglob("*.ts"))):
        if arq == MOVIMENTO:
            continue
        texto = sem_comentarios(arq.read_text(encoding="utf-8"))
        achados = [m for m in PADRAO.finditer(texto)]
        if not achados:
            continue
        rel = arq.relative_to(RAIZ)
        if arq in PERMITIDOS and "prefers-reduced-motion" in texto:
            continue
        for m in achados:
            linha = texto.count("\n", 0, m.start()) + 1
            problemas.append(f"{rel}:{linha}: '{m.group(0).strip()}' fora de movimento.css")

    print(f"verificados: movimento.css + {len(list(SRC.rglob('*.svelte')))} componentes (permitidos: "
          f"{', '.join(str(p.relative_to(RAIZ)) for p in PERMITIDOS)})")
    if problemas:
        print(f"\n{len(problemas)} problema(s):")
        for p in problemas:
            print("  -", p)
        sys.exit(1)
    print("Movimento consistente: tudo que se move respeita 'reduzir movimento'.")


if __name__ == "__main__":
    main()
