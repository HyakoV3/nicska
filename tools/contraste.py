#!/usr/bin/env python3
"""Confere o contraste (WCAG 2.2) dos tokens de cor de src/lib/tema.css.

Uso:  python3 tools/contraste.py            # imprime a tabela e falha (exit 1) se algum par reprovar
      python3 tools/contraste.py --markdown # tabela em Markdown (para docs/design-tokens.md)

Lê os tokens do próprio CSS, um conjunto por estilo (normal, titanio, telemetria; ver data-estilo). Em cada estilo há
o tema claro (um bloco) e o escuro (dois blocos, que precisam ser idênticos: o de @media (prefers-color-scheme: dark)
e o de [data-tema="escuro"]).

O modo "alto contraste" (I-06, :root[data-tema="alto-contraste"]) é uma paleta à parte, de um bloco só, que vale em
qualquer estilo. Ele é conferido com metas AAA (7:1 no texto e 4,5:1 nos componentes), mais rígidas que as do resto.
"""
import re
import sys
from pathlib import Path

CSS = Path(__file__).resolve().parent.parent / "src" / "lib" / "tema.css"

# (primeiro plano, fundo, mínimo, descrição). 4,5:1 = texto; 3:1 = componente de interface (1.4.11).
PARES = [
    ("texto", "fundo", 4.5, "Texto principal sobre o fundo"),
    ("texto", "superficie", 4.5, "Texto principal sobre cartões e campos"),
    ("texto", "superficie-alt", 4.5, "Texto principal sobre superfícies alternativas"),
    ("texto", "selecionado", 4.5, "Texto sobre o item selecionado"),
    ("suave", "fundo", 4.5, "Texto secundário sobre o fundo"),
    ("suave", "superficie", 4.5, "Texto secundário sobre cartões e campos"),
    ("suave", "superficie-alt", 4.5, "Texto secundário sobre superfícies alternativas"),
    ("suave", "selecionado", 4.5, "Texto secundário sobre o item selecionado"),
    ("acento", "selecionado", 4.5, "Links e ações sobre o item selecionado"),
    ("acento", "fundo", 4.5, "Links e ações sobre o fundo"),
    ("acento", "superficie", 4.5, "Links e ações sobre cartões"),
    ("acento-texto", "acento-botao", 4.5, "Texto do botão principal"),
    ("acento-botao", "fundo", 3.0, "Botão principal contra o fundo"),
    ("acento-botao", "superficie", 3.0, "Botão principal contra cartões"),
    ("tempo-ativo", "fundo", 4.5, "Tempo em evidência (texto) sobre o fundo"),
    ("tempo-ativo", "superficie", 4.5, "Tempo em evidência (texto) sobre cartões"),
    ("tempo-sobre", "tempo-fundo", 4.5, "Texto sobre o bloco de tempo em evidência"),
    ("tempo-fundo", "tempo-trilha", 3.0, "Preenchimento do tempo sobre a trilha"),
    ("perigo", "fundo", 4.5, "Erro e ação destrutiva (texto) sobre o fundo"),
    ("perigo", "superficie", 4.5, "Erro e ação destrutiva (texto) sobre cartões"),
    ("sucesso", "fundo", 4.5, "Sucesso (texto) sobre o fundo"),
    ("sucesso", "superficie", 4.5, "Sucesso (texto) sobre cartões"),
    ("aviso", "fundo", 4.5, "Aviso (texto) sobre o fundo"),
    ("aviso", "superficie", 4.5, "Aviso (texto) sobre cartões"),
    ("info", "fundo", 4.5, "Informação (texto) sobre o fundo"),
    ("info", "superficie", 4.5, "Informação (texto) sobre cartões"),
    ("borda-controle", "fundo", 3.0, "Limite de controles sobre o fundo"),
    ("borda-controle", "superficie", 3.0, "Limite de controles sobre cartões"),
    ("foco", "fundo", 3.0, "Anel de foco sobre o fundo"),
    ("foco", "superficie", 3.0, "Anel de foco sobre cartões"),
    ("grafico-a", "superficie", 3.0, "Gráfico, série A sobre o cartão"),
    ("grafico-b", "superficie", 3.0, "Gráfico, série B sobre o cartão"),
    ("grafico-c", "superficie", 3.0, "Gráfico, série C sobre o cartão"),
    ("grafico-d", "superficie", 3.0, "Gráfico, série D sobre o cartão"),
]


def luminancia(hex_):
    h = hex_.lstrip("#")
    r, g, b = (int(h[i : i + 2], 16) / 255 for i in (0, 2, 4))
    f = lambda c: c / 12.92 if c <= 0.03928 else ((c + 0.055) / 1.055) ** 2.4
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b)


def razao(a, b):
    la, lb = sorted((luminancia(a), luminancia(b)), reverse=True)
    return (la + 0.05) / (lb + 0.05)


def meta_alto_contraste(minimo):
    """Meta do modo alto contraste (AAA): 7:1 onde o normal pede 4,5:1 (texto) e 4,5:1 onde pede 3:1 (componentes)."""
    return 7.0 if minimo >= 4.5 else 4.5


def ler_tokens(texto):
    """Devolve ({estilo: {"claro": {...}, "escuro": [{...}, {...}]}}, {tokens do alto contraste}) percorrendo o CSS.

    O estilo vem de [data-estilo="x"] no seletor (sem ele, é o "normal"). O escuro de cada estilo tem dois blocos que
    precisam ser idênticos: um em @media (prefers-color-scheme: dark) e outro em [data-tema="escuro"]."""
    texto = re.sub(r"/\*.*?\*/", "", texto, flags=re.S)
    estilos = {}
    alto = {}
    pilha = []  # seletores abertos
    for m in re.finditer(r"([^{};]*)\{|\}", texto):
        if m.group(0) == "}":
            pilha.pop()
            continue
        pilha.append(m.group(1).strip())
        fim = texto.find("}", m.end())
        prox_abre = texto.find("{", m.end())
        if prox_abre != -1 and prox_abre < fim:
            continue  # bloco que contém outros blocos (ex.: @media)
        corpo = texto[m.end() : fim]
        tokens = dict(re.findall(r"--([\w-]+)\s*:\s*(#[0-9a-fA-F]{6})\s*;", corpo))
        if not tokens:
            continue
        contexto = " ".join(pilha)
        # O bloco do alto contraste é UM bloco próprio. Os escuros "do sistema" só o citam dentro de :not(...), e esses
        # ficam em @media, então o que o identifica é o seletor ser exatamente :root[data-tema="alto-contraste"].
        if re.fullmatch(r':root\[data-tema="alto-contraste"\]', pilha[-1]):
            alto.update(tokens)
            continue
        achado = re.search(r'data-estilo="([\w-]+)"', contexto)
        estilo = estilos.setdefault(achado.group(1) if achado else "normal", {"claro": {}, "escuro": []})
        if "prefers-color-scheme: dark" in contexto or 'data-tema="escuro"' in contexto:
            estilo["escuro"].append(tokens)
        else:
            estilo["claro"].update(tokens)
    return estilos, alto


def main():
    markdown = "--markdown" in sys.argv
    estilos, alto = ler_tokens(CSS.read_text(encoding="utf-8"))
    falhas = 0

    if "normal" not in estilos:
        print("ERRO: falta o estilo normal (o :root padrão).")
        sys.exit(1)

    for nome_estilo, est in estilos.items():
        escuros = est["escuro"]
        if len(escuros) != 2 or escuros[0] != escuros[1]:
            print(f"ERRO ({nome_estilo}): os dois blocos do escuro precisam existir e ter os mesmos valores.")
            falhas += 1
        if not est["claro"]:
            print(f"ERRO ({nome_estilo}): falta o bloco claro.")
            falhas += 1

        escuro = escuros[0] if escuros else {}
        # Cada estilo só redefine o que muda; o resto vem do normal (o :root padrão). Aqui conferimos a paleta final, na
        # ordem real da cascata do CSS. No escuro, o bloco claro do estilo (:root[data-estilo], especificidade igual à do
        # escuro base e escrito depois) também vale e vence o escuro base; só então o escuro do estilo (mais específico)
        # vence o claro. Ou seja: escuro base < claro do estilo < escuro do estilo. Se o escuro de um estilo omitir um
        # token, o que a pessoa vê é o valor claro do estilo, e é esse que precisa ser conferido.
        base = estilos["normal"]
        claro = {**base["claro"], **est["claro"]} if nome_estilo != "normal" else est["claro"]
        escuro = (
            {**(base["escuro"][0] if base["escuro"] else {}), **est["claro"], **escuro}
            if nome_estilo != "normal"
            else escuro
        )

        if markdown:
            print(f"\n#### Estilo `{nome_estilo}`\n")
            print("| Par (texto / fundo) | Uso | Meta | Claro | Escuro |")
            print("|---|---|---|---|---|")
        else:
            print(f"\n== Estilo {nome_estilo} ==")
        for fg, bg, minimo, desc in PARES:
            linha = []
            for nome, paleta in (("claro", claro), ("escuro", escuro)):
                if fg not in paleta or bg not in paleta:
                    linha.append((nome, None, False))
                    falhas += 1
                    continue
                r = razao(paleta[fg], paleta[bg])
                ok = r >= minimo
                falhas += 0 if ok else 1
                linha.append((nome, r, ok))
            if markdown:
                cel = lambda x: "—" if x[1] is None else f"{x[1]:.2f}:1 {'✓' if x[2] else '✗'}"
                print(f"| `{fg}` / `{bg}` | {desc} | {minimo}:1 | {cel(linha[0])} | {cel(linha[1])} |")
            else:
                partes = "  ".join(
                    f"{n}: {'sem token' if r is None else f'{r:5.2f}:1 ' + ('ok' if ok else 'FALHA')}" for n, r, ok in linha
                )
                print(f"{fg + ' / ' + bg:<32} (meta {minimo}:1)  {partes}")

    # Modo alto contraste: uma paleta só, com metas AAA.
    if markdown:
        print("\n#### Modo `alto-contraste` (metas AAA)\n")
        print("| Par (texto / fundo) | Uso | Meta | Contraste |")
        print("|---|---|---|---|")
    else:
        print("\n== Modo alto contraste (metas AAA) ==")
    if not alto:
        print("ERRO: falta o bloco :root[data-tema=\"alto-contraste\"].")
        falhas += 1
    for fg, bg, minimo, desc in PARES if alto else []:
        meta = meta_alto_contraste(minimo)
        if fg not in alto or bg not in alto:
            print(f"ERRO (alto-contraste): falta o token {fg if fg not in alto else bg}.")
            falhas += 1
            continue
        r = razao(alto[fg], alto[bg])
        ok = r >= meta
        falhas += 0 if ok else 1
        if markdown:
            print(f"| `{fg}` / `{bg}` | {desc} | {meta}:1 | {r:.2f}:1 {'✓' if ok else '✗'} |")
        else:
            print(f"{fg + ' / ' + bg:<32} (meta {meta}:1)  {r:5.2f}:1 {'ok' if ok else 'FALHA'}")

    if not markdown:
        print("\nTudo dentro da meta." if falhas == 0 else f"\n{falhas} problema(s) encontrado(s).")
    sys.exit(0 if falhas == 0 else 1)


if __name__ == "__main__":
    main()
