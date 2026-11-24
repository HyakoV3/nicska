#!/usr/bin/env python3
"""Gera a voz "STAND BY" de fliperama (I-03) com um sintetizador, sem gravar ninguém.

Uso:  python3 tools/gerar-voz-standby.py SAIDA/ [--texto "Stand by"] [--so A,B]

Precisa do `espeak-ng` (sintetizador de formantes: já soa robótico) e do `ffmpeg` no PATH. Sem espeak-ng instalado, aponte para ele com as variáveis
ESPEAK_NG (o binário), ESPEAK_DATA (a pasta espeak-ng-data) e, se for o caso, LD_LIBRARY_PATH.

Para cada variante gera `voz-standby-<id>.ogg` (Opus mono 48 kHz, o que o app toca) e um `.wav` igual (para o teste do detector). A receita do efeito:
voz sintética grave → taxa de amostragem baixa → 8 bits (bitcrusher) → realce nos médios → saturação → compressor → eco e reverberação (sob a voz) → limitador no fundo de escala.
`--sem-efeitos` gera a voz seca.
Nada aqui vem do jogo Metal Slug: é só o jeito de processar (voz digital de baixa qualidade e áspera) que dá a sensação de fliperama.
"""
import argparse
import os
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import efeitos_voz  # noqa: E402

# id -> (voz do espeak, tom 0-99, velocidade em palavras/min, cadeia de filtros do ffmpeg depois da síntese, descrição)
VARIANTES = {
    "A": ("en-us+m3", 8, 105, "aresample=8000,acrusher=bits=8:mix=1:mode=lin:aa=0,highpass=f=140,lowpass=f=3400,equalizer=f=1000:t=q:w=1:g=6,asoftclip=type=tanh", "sargento: grave, 8 kHz, 8 bits"),
    "B": ("en-us+m7", 22, 120, "treble=g=9:f=3500,aresample=16000,acrusher=bits=6:mix=1:mode=lin:aa=0,highpass=f=160,lowpass=f=7000,equalizer=f=1800:t=q:w=1:g=5,equalizer=f=5500:t=q:w=1:g=6,asoftclip=type=tanh", "robô: mais agudo, 6 bits, mais sujo, com o SSS do começo"),
    "C": ("en-us+croak", 12, 100, "aresample=8000,acrusher=bits=7:mix=1:mode=lin:aa=0,highpass=f=300,lowpass=f=2800,equalizer=f=1400:t=q:w=1:g=7,asoftclip=type=tanh", "rádio: faixa estreita, rouco"),
}
DINAMICA = "volume=6dB,asoftclip=type=tanh,acompressor=threshold=-18dB:ratio=6:attack=3:release=60:makeup=4,aresample=48000"
def rodar(cmd: list[str], **kw) -> subprocess.CompletedProcess:
    return subprocess.run(cmd, check=True, capture_output=True, **kw)


def sintetizar(texto: str, voz: str, tom: int, vel: int, destino: Path) -> None:
    espeak = os.environ.get("ESPEAK_NG") or shutil.which("espeak-ng")
    if not espeak:
        raise SystemExit("espeak-ng não encontrado: instale-o ou aponte ESPEAK_NG (ver o topo deste arquivo)")
    cmd = [espeak, "-v", voz, "-p", str(tom), "-s", str(vel), "-w", str(destino), texto]
    if os.environ.get("ESPEAK_DATA"):
        cmd[1:1] = [f"--path={Path(os.environ['ESPEAK_DATA']).parent}"]
    rodar(cmd)


def processar(entrada: Path, filtros: str, saida_base: Path, efeitos: bool = True) -> None:
    """Voz → efeito de fliperama → (eco e reverberação) → limitador. `efeitos=False` deixa a voz seca, como na primeira rodada."""
    corte = "silenceremove=start_periods=1:start_threshold=-45dB,areverse,silenceremove=start_periods=1:start_threshold=-45dB,areverse"
    wav = saida_base.with_suffix(".wav")
    if not efeitos:
        rodar(["ffmpeg", "-y", "-i", str(entrada), "-af", f"{corte},{filtros},{DINAMICA},alimiter=limit=0.97", "-ac", "1", "-ar", "48000", str(wav)])
    else:
        efeitos_voz.aplicar(entrada, wav, f"{corte},{filtros},{DINAMICA}")
    rodar(["ffmpeg", "-y", "-i", str(wav), "-c:a", "libopus", "-b:a", "24k", "-application", "voip", str(saida_base.with_suffix(".ogg"))])


def principal(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("saida", type=Path)
    ap.add_argument("--texto", default="Stand by")
    ap.add_argument("--so", help="só estas variantes, separadas por vírgula (por exemplo A,C)")
    ap.add_argument("--sem-efeitos", action="store_true", help="voz seca, sem eco nem reverberação")
    a = ap.parse_args(argv)
    ids = [i.strip().upper() for i in a.so.split(",")] if a.so else list(VARIANTES)
    for i in ids:
        if i not in VARIANTES:
            raise SystemExit(f"variante desconhecida: {i} (há {', '.join(VARIANTES)})")
    a.saida.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory() as tmp:
        for i in ids:
            voz, tom, vel, filtros, desc = VARIANTES[i]
            bruto = Path(tmp) / f"{i}.wav"
            sintetizar(a.texto, voz, tom, vel, bruto)
            processar(bruto, filtros, a.saida / f"voz-standby-{i}", efeitos=not a.sem_efeitos)
            print(f"{i}: {desc} -> {a.saida / f'voz-standby-{i}.ogg'}")
    return 0


if __name__ == "__main__":
    sys.exit(principal())
