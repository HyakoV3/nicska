"""Eco e reverberação para as vozes do aviso do Standby (I-03), com o ffmpeg. Usado por gerar-voz-standby.py e recortar-voz.py.

Eco: duas repetições que decaem. Reverberação: convolução com uma resposta ao impulso sintética (ruído rosa que decai a exp(-t·DECAIMENTO)). Os dois ficam por baixo da
voz seca (a palavra segue na frente e inteligível). O filtro devolve a voz + a cauda; quem chama apara o silêncio do fim.
"""
import subprocess
from pathlib import Path

PADRAO = {
    "eco": "aecho=in_gain=1:out_gain=0.9:delays=150|300:decays=0.4|0.2",
    "reverb_s": 0.7,
    "decaimento": 7.0,
    "mistura": 0.35,
}


# Dois ajustes prontos. "leve": a voz segue seca e clara, com um toque de sala. "marcante": uma baia coberta de estande, com a cauda e o eco bem audíveis (mais
# reverberação, repetições mais fortes e mais espaçadas); a palavra ainda vem na frente porque a voz seca não é abaixada.
PRESETS = {
    "leve": PADRAO,
    "marcante": {"eco": "aecho=in_gain=1:out_gain=0.85:delays=210|420|630:decays=0.5|0.3|0.15", "reverb_s": 1.1, "decaimento": 4.5, "mistura": 0.6},
}


def grafo(entrada_filtros: str, p: dict = PADRAO) -> str:
    """Filtergraph que recebe a voz em [0:a] (já com `entrada_filtros` aplicados) e entrega [saida] com eco e reverb. Põe silêncio no fim para a cauda caber."""
    ir = f"anoisesrc=d={p['reverb_s']}:c=pink:r=48000:a=1,lowpass=f=5000,volume='exp(-t*{p['decaimento']})':eval=frame,afade=t=in:d=0.004,aformat=channel_layouts=mono"
    return (
        f"[0:a]{entrada_filtros},apad=pad_dur={p['reverb_s'] + 0.4},asplit[seca][molhada];"
        f"{ir}[ir];"
        f"[molhada][ir]afir=dry=0:wet=1:gtype=gn:irgain=1,volume={p['mistura']}[rev];"
        f"[seca]{p['eco']}[eco];"
        "[eco][rev]amix=inputs=2:duration=longest:normalize=0,alimiter=limit=0.97,aformat=channel_layouts=mono[saida]"
    )


def aplicar(entrada: Path, saida: Path, entrada_filtros: str = "anull", p: dict = PADRAO) -> None:
    subprocess.run(["ffmpeg", "-y", "-v", "error", "-i", str(entrada), "-filter_complex", grafo(entrada_filtros, p), "-map", "[saida]", "-ar", "48000", str(saida)], check=True)
