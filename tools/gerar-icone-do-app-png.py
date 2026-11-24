#!/usr/bin/env python3
"""Gera os ícones do APP (Android, desktop/iOS, favicon do cabeçalho) a partir dos PNGs do símbolo em design/icone/.

Uso, da raiz do repositório:
  python3 tools/gerar-icone-do-app-png.py                     tudo (favicon, `tauri icon`, mipmaps)
  python3 tools/gerar-icone-do-app-png.py --so-monocromatico  só o ic_launcher_monochrome (Android 13) e o XML adaptativo; não roda o `tauri icon`

Entrada (RGBA, fundo transparente, 1254 px): design/icone/nicska-simbolo.png, o símbolo da fase 2 (cópia de icone-fonte/nicska-fase2.png):
contorno preto, anéis e ponteiros brancos, base cinza e fatia/marcas vermelhas. A silhueta monocromática sai dele (`silhueta_mono`):
branco opaco onde há desenho claro ou vermelho, transparente onde era preto (contorno e mostrador), então o aro, os ponteiros, as marcas,
os botões e a base continuam legíveis quando o Android pinta tudo de uma cor só.

O símbolo é CLARO e foi pensado para fundo escuro: todo ícone leva o fundo preto-azulado da marca (#14181F). Nada do desenho é alterado
(só posição e escala). Saídas: `static/favicon.png`; `src-tauri/icons/**` (pelo `tauri icon`, a partir de uma imagem de 1024 px); e, no Android,
`mipmap-*` do `ic_launcher` (legado, quadrado e redondo), `ic_launcher_foreground` (o símbolo na zona segura de 66 dp de uma tela de 108 dp),
`ic_launcher_monochrome`, mais `values/ic_launcher_background.xml` (a cor lisa do fundo adaptativo).
"""
import subprocess
import sys
from pathlib import Path

from PIL import Image, ImageChops, ImageDraw

RAIZ = Path(__file__).resolve().parent.parent
COR = RAIZ / "design" / "icone" / "nicska-simbolo.png"
FUNDO = (0x14, 0x18, 0x1F, 255)
RES = RAIZ / "src-tauri" / "gen" / "android" / "app" / "src" / "main" / "res"
ZONA_SEGURA = 66 / 108  # diâmetro do círculo seguro do ícone adaptativo, em fração da tela
OCUPACAO_PADRAO = 0.86  # o símbolo ocupa 86% do ícone padrão (sobra uma margem)
XML_ADAPTATIVO = (
    '<?xml version="1.0" encoding="utf-8"?>\n<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">\n'
    '  <foreground android:drawable="@mipmap/ic_launcher_foreground"/>\n  <background android:drawable="@color/ic_launcher_background"/>\n'
    '  <monochrome android:drawable="@mipmap/ic_launcher_monochrome"/>\n</adaptive-icon>'
)
TAMANHOS = {"mdpi": 48, "hdpi": 72, "xhdpi": 96, "xxhdpi": 144, "xxxhdpi": 192}  # ícone legado; o adaptativo é 108/48 maior


def recorte(img: Image.Image) -> Image.Image:
    caixa = img.getchannel("A").point(lambda v: 255 if v > 24 else 0).getbbox()
    if caixa is None:
        sys.exit("símbolo vazio")
    c = img.crop(caixa)
    lado = max(c.size)
    tela = Image.new("RGBA", (lado, lado), (0, 0, 0, 0))
    tela.paste(c, ((lado - c.width) // 2, (lado - c.height) // 2))
    return tela


def simbolo_em(tela: int, fracao: float, img: Image.Image) -> Image.Image:
    """O símbolo (recortado, quadrado) centralizado numa tela transparente `tela` x `tela`, ocupando `fracao` dela."""
    lado = max(1, round(tela * fracao))
    mi = img.resize((lado, lado), Image.LANCZOS)
    saida = Image.new("RGBA", (tela, tela), (0, 0, 0, 0))
    saida.paste(mi, ((tela - lado) // 2, (tela - lado) // 2), mi)
    return saida


def silhueta_mono(img: Image.Image) -> Image.Image:
    """Silhueta para o ícone temático: branco puro, alfa = alfa original x quanto o pixel NÃO é preto (rampa de 64 a 160 no canal mais forte)."""
    r, g, b, a = img.split()
    claro = ImageChops.lighter(ImageChops.lighter(r, g), b).point(lambda v: max(0, min(255, round((v - 64) * 255 / 96))))
    alfa = ImageChops.multiply(a, claro)
    return Image.merge("RGBA", (*(Image.new("L", img.size, 255),) * 3, alfa))


def gerar_monocromaticos(cor: Image.Image) -> None:
    """`cor` é o recorte quadrado do símbolo; a silhueta usa o MESMO recorte, então fica alinhada ao primeiro plano em cores."""
    mono = silhueta_mono(cor)
    for dens, leg in TAMANHOS.items():
        simbolo_em(round(leg * 108 / 48), ZONA_SEGURA, mono).save(RES / f"mipmap-{dens}" / "ic_launcher_monochrome.png")


def escrever_xml_adaptativo() -> None:
    (RES / "mipmap-anydpi-v26" / "ic_launcher.xml").write_text(XML_ADAPTATIVO, encoding="utf-8")


def sobre_fundo(frente: Image.Image, forma: str = "quadrado") -> Image.Image:
    tela = frente.size[0]
    base = Image.new("RGBA", frente.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(base)
    if forma == "redondo":
        d.ellipse((0, 0, tela - 1, tela - 1), fill=FUNDO)
    elif forma == "arredondado":
        d.rounded_rectangle((0, 0, tela - 1, tela - 1), radius=round(tela * 0.22), fill=FUNDO)
    else:
        d.rectangle((0, 0, tela, tela), fill=FUNDO)
    base.alpha_composite(frente)
    return base


def main() -> None:
    cor = recorte(Image.open(COR).convert("RGBA"))
    if "--so-monocromatico" in sys.argv:
        gerar_monocromaticos(cor)
        escrever_xml_adaptativo()
        print("Gerados: ic_launcher_monochrome.png (5 densidades) e mipmap-anydpi-v26/ic_launcher.xml.")
        return

    # Favicon (o logo do cabeçalho): quadrado cheio; o CSS arredonda os cantos.
    sobre_fundo(simbolo_em(256, OCUPACAO_PADRAO, cor)).save(RAIZ / "static" / "favicon.png")

    # Desktop, iOS, Windows, loja: o `tauri icon` gera tudo de uma imagem de 1024 px (iOS não aceita alfa: o fundo é opaco).
    base = RAIZ / "design" / "icone" / "app-1024.png"
    sobre_fundo(simbolo_em(1024, OCUPACAO_PADRAO, cor)).convert("RGB").save(base)
    subprocess.run(["npx", "tauri", "icon", str(base)], cwd=RAIZ, check=True)

    # Android: o `tauri icon` acima também escreveu os mipmaps; aqui eles são refeitos do jeito certo para a zona segura.
    for dens, leg in TAMANHOS.items():
        pasta = RES / f"mipmap-{dens}"
        adapt = round(leg * 108 / 48)
        sobre_fundo(simbolo_em(leg, OCUPACAO_PADRAO, cor), "arredondado").save(pasta / "ic_launcher.png")
        sobre_fundo(simbolo_em(leg, 0.74, cor), "redondo").save(pasta / "ic_launcher_round.png")
        simbolo_em(adapt, ZONA_SEGURA, cor).save(pasta / "ic_launcher_foreground.png")
    gerar_monocromaticos(cor)
    escrever_xml_adaptativo()
    (RES / "values" / "ic_launcher_background.xml").write_text(
        '<?xml version="1.0" encoding="utf-8"?>\n<resources>\n  <color name="ic_launcher_background">#14181F</color>\n</resources>\n', encoding="utf-8"
    )
    print("Ícones gerados: static/favicon.png, src-tauri/icons/**, mipmaps do Android.")


if __name__ == "__main__":
    main()
