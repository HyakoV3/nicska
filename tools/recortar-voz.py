#!/usr/bin/env python3
"""Recorta uma gravação de voz (tela, microfone, TTS) para o aviso do Standby (I-03): tira o silêncio do começo e do fim sem cortar a fala.

Uso:  python3 tools/recortar-voz.py SAIDA/ NOME=arquivo.wav [NOME=arquivo.wav ...] [--pre-ms 8] [--cauda-ms 80] [--pico-db -1]

Para cada gravação: converte para mono 48 kHz, acha o início da fala (o envelope de 1 ms passa do piso de ruído + 10 dB, e de 40 dB abaixo do pico da fala),
corta `--pre-ms` antes dele (para não comer o ataque da consoante) e deixa `--cauda-ms` depois do fim, com um fade-out de cosseno nessa cauda (sem estalo),
e leva o pico a `--pico-db` dBFS (as vozes ficam no mesmo nível). Com `--efeitos leve|marcante` acrescenta eco e reverberação (tools/efeitos_voz.py) DEPOIS do corte e apara a cauda
no fim, de modo que o arquivo termina quando o som termina. Gera `NOME.wav` (PCM 16 bits, o que o teste do detector lê) e `NOME.ogg` (Opus mono, o que o app toca).
Precisa do ffmpeg e do numpy. Não toca áudio.
"""
import argparse
import subprocess
import sys
import tempfile
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parent))
import efeitos_voz  # noqa: E402

TAXA = 48000


def ler(caminho: Path) -> np.ndarray:
    """Qualquer áudio que o ffmpeg abra → mono, 48 kHz, float32 em [-1, 1]."""
    p = subprocess.run(["ffmpeg", "-v", "error", "-i", str(caminho), "-ac", "1", "-ar", str(TAXA), "-f", "f32le", "-"], check=True, capture_output=True)
    return np.frombuffer(p.stdout, dtype=np.float32).copy()


def envelope_db(x: np.ndarray, janela_ms: float = 1.0) -> np.ndarray:
    n = max(1, round(TAXA * janela_ms / 1000))
    return 20 * np.log10(np.sqrt(np.convolve(x**2, np.ones(n) / n, "same")) + 1e-9)


def limites(x: np.ndarray, vazio_ms: float = 150) -> tuple[int, int, dict]:
    """(início, fim) da fala em amostras, mais os números usados.

    O piso é o ruído de fundo + 10 dB, nunca abaixo de 40 dB sob o pico. O que passa dele se agrupa em trechos separados por mais de `vazio_ms` de silêncio (as
    pausas dentro de uma frase, como em "Reload and Standing By", ficam juntas), e a fala é o trecho de MAIOR ENERGIA: um estalo ou um respiro isolado antes
    ou depois não conta (uma gravação de tela tinha um estalo de 28 ms meio segundo antes da voz).
    """
    db = envelope_db(x)
    base = np.median(db[: max(1, int(0.3 * TAXA))])  # ruído de fundo: o começo da gravação, antes de a voz entrar
    pico = float(db.max())
    limiar = max(base + 10, pico - 40)
    acima = np.flatnonzero(db > limiar)
    if acima.size == 0:
        raise SystemExit("não achei fala nesta gravação (nada passa do piso de ruído)")
    corte = np.flatnonzero(np.diff(acima) > round(TAXA * vazio_ms / 1000))
    trechos = [(int(acima[i]), int(acima[j])) for i, j in zip(np.r_[0, corte + 1], np.r_[corte, acima.size - 1])]
    ini, fim = max(trechos, key=lambda t: float((x[t[0] : t[1] + 1] ** 2).sum()))
    return ini, fim, {"ruido_db": round(float(base), 1), "pico_env_db": round(pico, 1), "limiar_db": round(float(limiar), 1), "trechos": len(trechos)}


def recortar(x: np.ndarray, pre_ms: float, cauda_ms: float, pico_db: float) -> tuple[np.ndarray, dict]:
    ini, fim, info = limites(x)
    a = max(0, ini - round(TAXA * pre_ms / 1000))
    cauda = round(TAXA * cauda_ms / 1000)
    b = min(len(x), fim + cauda)
    y = x[a:b].copy()
    # fade-out de cosseno na cauda (o fim da fala fica intacto; só a sobra some devagar), e uma entrada de 1 ms contra estalo
    f = min(cauda, len(y))
    y[-f:] *= 0.5 * (1 + np.cos(np.linspace(0, np.pi, f)))
    e = min(round(TAXA * 0.001), len(y))
    y[:e] *= np.linspace(0, 1, e)
    y *= 10 ** (pico_db / 20) / max(1e-9, float(np.abs(y).max()))
    info.update(inicio_s=round(ini / TAXA, 3), fim_s=round(fim / TAXA, 3), duracao_s=round(len(y) / TAXA, 3), fala_s=round((fim - ini) / TAXA, 3))
    return y, info


def aparar_cauda(y: np.ndarray, abaixo_db: float = 50, fade_ms: float = 40) -> np.ndarray:
    """Corta o silêncio do fim (a cauda do reverb que já não se ouve) e fecha com um fade-out curto."""
    db = envelope_db(y, 5.0)
    ativo = np.flatnonzero(db > float(db.max()) - abaixo_db)
    z = y[: int(ativo[-1]) + 1].copy()
    f = min(round(TAXA * fade_ms / 1000), len(z))
    z[-f:] *= 0.5 * (1 + np.cos(np.linspace(0, np.pi, f)))
    return z


def com_efeitos(y: np.ndarray, pico_db: float, preset: str = "leve") -> np.ndarray:
    with tempfile.TemporaryDirectory() as tmp:
        a, b = Path(tmp) / "seca.wav", Path(tmp) / "molhada.wav"
        subprocess.run(["ffmpeg", "-y", "-v", "error", "-f", "s16le", "-ar", str(TAXA), "-ac", "1", "-i", "-", str(a)], input=(np.clip(y, -1, 1) * 32767).astype("<i2").tobytes(), check=True)
        efeitos_voz.aplicar(a, b, p=efeitos_voz.PRESETS[preset])
        z = aparar_cauda(ler(b))
    return z * (10 ** (pico_db / 20) / max(1e-9, float(np.abs(z).max())))


def gravar(y: np.ndarray, base: Path) -> None:
    pcm = (np.clip(y, -1, 1) * 32767).astype("<i2").tobytes()
    wav = base.with_suffix(".wav")
    subprocess.run(["ffmpeg", "-y", "-v", "error", "-f", "s16le", "-ar", str(TAXA), "-ac", "1", "-i", "-", str(wav)], input=pcm, check=True)
    subprocess.run(["ffmpeg", "-y", "-v", "error", "-i", str(wav), "-c:a", "libopus", "-b:a", "32k", "-application", "voip", str(base.with_suffix(".ogg"))], check=True)


def principal(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("saida", type=Path)
    ap.add_argument("entradas", nargs="+", help="NOME=arquivo")
    ap.add_argument("--pre-ms", type=float, default=8)
    ap.add_argument("--cauda-ms", type=float, default=80)
    ap.add_argument("--pico-db", type=float, default=-1)
    ap.add_argument("--efeitos", choices=sorted(efeitos_voz.PRESETS), help="eco e reverberação depois do corte: leve (um toque de sala) ou marcante (baia coberta)")
    a = ap.parse_args(argv)
    a.saida.mkdir(parents=True, exist_ok=True)
    for par in a.entradas:
        nome, _, arq = par.partition("=")
        if not arq:
            raise SystemExit(f"use NOME=arquivo (veio '{par}')")
        y, info = recortar(ler(Path(arq)), a.pre_ms, a.cauda_ms, a.pico_db)
        if a.efeitos:
            y = com_efeitos(y, a.pico_db, a.efeitos)
            info["duracao_s"] = round(len(y) / TAXA, 3)
        gravar(y, a.saida / nome)
        print(f"{nome}: fala de {info['inicio_s']} s a {info['fim_s']} s ({info['fala_s']} s); recorte de {info['duracao_s']} s; ruído {info['ruido_db']} dB, limiar {info['limiar_db']} dB, {info['trechos']} trecho(s) acima do limiar")
    return 0


if __name__ == "__main__":
    sys.exit(principal())
