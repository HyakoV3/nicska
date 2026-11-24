#!/usr/bin/env python3
"""Compara as tentativas do Nicska com um timer comercial (critérios da seção 9 do roadmap, Etapa 7).

Uso:  python3 tools/comparar-com-timer.py backup.json timer.csv [--percurso NOME] [--tolerancia-ms 10] [--meta-contagem 95]

`backup.json` é o "Exportar backup" do app. `timer.csv` tem uma linha por tentativa, separada por ponto e vírgula, na ordem em que foram feitas:

    n;grupo;disparos_s
    1;celular;1,48 1,73 1,98 2,21
    2;bluetooth;1,50 1,75 2,00 2,24

`n` é a posição da tentativa no percurso, da mais antiga (1) para a mais nova; `grupo` é livre (celular, bluetooth, vizinho...) e serve para a
latência anulada; `disparos_s` são os tempos do timer comercial desde o apito, em segundos (vírgula ou ponto), separados por espaço.
Sai 0 se os dois critérios passam (mesma contagem em pelo menos 95% das tentativas; diferença de até 10 ms por disparo), 1 se não.
"""
import argparse
import csv
import json
import statistics
import sys
from pathlib import Path


def ler_segundos(texto: str) -> list[int]:
    """'1,48 1.73' -> [1480, 1730] (ms, arredondado)."""
    return [round(float(t.replace(",", ".")) * 1000) for t in texto.split()]


def ler_csv(caminho: Path) -> list[dict]:
    linhas = []
    with caminho.open(newline="", encoding="utf-8") as f:
        for i, r in enumerate(csv.DictReader(f, delimiter=";"), start=2):
            if not r.get("n") or not r.get("disparos_s"):
                continue
            try:
                linhas.append({"n": int(r["n"]), "grupo": (r.get("grupo") or "").strip(), "timer": ler_segundos(r["disparos_s"])})
            except ValueError as e:
                raise SystemExit(f"{caminho}, linha {i}: {e}")
    return linhas


def tentativas_do_percurso(backup: dict, nome: str | None) -> list[dict]:
    percursos = backup["percursos"]
    if nome:
        achados = [p for p in percursos if p["nome"].lower() == nome.lower()]
        if not achados:
            raise SystemExit(f"percurso '{nome}' não está no backup (há: {', '.join(p['nome'] for p in percursos) or 'nenhum'})")
        alvo = achados[0]
    elif len(percursos) == 1:
        alvo = percursos[0]
    else:
        raise SystemExit("o backup tem mais de um percurso: use --percurso NOME (há: " + ", ".join(p["nome"] for p in percursos) + ")")
    return sorted((t for t in backup["tentativas"] if t["percurso_id"] == alvo["id"]), key=lambda t: (t["quando"], t["id"]))


def comparar(app: list[dict], linhas: list[dict], tolerancia_ms: int) -> list[dict]:
    """Uma entrada por linha do CSV: contagens, diferenças por disparo e se passou."""
    saida = []
    for l in linhas:
        if not 1 <= l["n"] <= len(app):
            saida.append({**l, "erro": f"não há tentativa {l['n']} no app (há {len(app)})"})
            continue
        a = app[l["n"] - 1]["disparos_ms"]
        t = l["timer"]
        mesma = len(a) == len(t)
        difs = [x - y for x, y in zip(a, t)] if mesma else []
        saida.append({**l, "app": a, "mesma_contagem": mesma, "difs": difs, "dentro": mesma and all(abs(d) <= tolerancia_ms for d in difs)})
    return saida


def resumo(res: list[dict], tolerancia_ms: int, meta_contagem: float) -> dict:
    validas = [r for r in res if "erro" not in r]
    n = len(validas)
    iguais = sum(r["mesma_contagem"] for r in validas)
    todas = [abs(d) for r in validas for d in r["difs"]]
    por_grupo: dict[str, list[int]] = {}
    for r in validas:
        if r["app"] and r["timer"]:
            por_grupo.setdefault(r["grupo"] or "-", []).append(r["app"][0] - r["timer"][0])
    pct = 100 * iguais / n if n else 0.0
    return {
        "tentativas": n,
        "contagem_igual": iguais,
        "contagem_pct": pct,
        "disparos_comparados": len(todas),
        "maior_dif_ms": max(todas) if todas else None,
        "dentro_da_tolerancia": sum(d <= tolerancia_ms for d in todas),
        "primeiro_por_grupo_ms": {g: statistics.mean(v) for g, v in por_grupo.items()},
        "passa_contagem": n > 0 and pct >= meta_contagem,
        "passa_tempo": bool(todas) and max(todas) <= tolerancia_ms,
    }


def imprimir(res: list[dict], r: dict, tolerancia_ms: int, meta_contagem: float) -> None:
    print(f"{'n':>3} {'grupo':<10} {'timer':>5} {'app':>5}  diferenças por disparo (ms, app − timer)")
    for x in res:
        if "erro" in x:
            print(f"{x['n']:>3} {x['grupo']:<10} {x['erro']}")
            continue
        marca = "ok " if x["dentro"] else ("!! " if x["mesma_contagem"] else "?? ")
        dif = " ".join(f"{d:+d}" for d in x["difs"]) if x["mesma_contagem"] else f"contagem diferente (faltou {max(0, len(x['timer']) - len(x['app']))}, sobrou {max(0, len(x['app']) - len(x['timer']))})"
        print(f"{x['n']:>3} {x['grupo']:<10} {len(x['timer']):>5} {len(x['app']):>5}  {marca}{dif}")
    print()
    print(f"Contagem igual: {r['contagem_igual']}/{r['tentativas']} ({r['contagem_pct']:.1f}%), meta {meta_contagem:g}%: {'PASSA' if r['passa_contagem'] else 'NÃO PASSA'}")
    if r["maior_dif_ms"] is not None:
        print(f"Tempo: {r['dentro_da_tolerancia']}/{r['disparos_comparados']} disparos dentro de ±{tolerancia_ms} ms, maior diferença {r['maior_dif_ms']} ms: {'PASSA' if r['passa_tempo'] else 'NÃO PASSA'}")
    if len(r["primeiro_por_grupo_ms"]) > 1:
        print("1º disparo, diferença média (app − timer) por grupo:")
        for g, v in r["primeiro_por_grupo_ms"].items():
            print(f"  {g:<12} {v:+.1f} ms")
        v = list(r["primeiro_por_grupo_ms"].values())
        print(f"  entre grupos: {max(v) - min(v):.1f} ms (meta da latência anulada: até ~10 ms)")


def principal(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("backup", type=Path)
    ap.add_argument("timer", type=Path)
    ap.add_argument("--percurso")
    ap.add_argument("--tolerancia-ms", type=int, default=10)
    ap.add_argument("--meta-contagem", type=float, default=95.0)
    a = ap.parse_args(argv)
    backup = json.loads(a.backup.read_text(encoding="utf-8"))
    if not str(backup.get("formato", "")).startswith("nicska-backup/"):
        raise SystemExit("não é um backup do Nicska (formato nicska-backup/1)")
    res = comparar(tentativas_do_percurso(backup, a.percurso), ler_csv(a.timer), a.tolerancia_ms)
    r = resumo(res, a.tolerancia_ms, a.meta_contagem)
    imprimir(res, r, a.tolerancia_ms, a.meta_contagem)
    return 0 if r["passa_contagem"] and r["passa_tempo"] else 1


if __name__ == "__main__":
    sys.exit(principal())
