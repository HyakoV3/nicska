#!/usr/bin/env python3
"""Gera os ícones do APP (Android, iOS, desktop, favicon) a partir do SVG do símbolo.

(Não confundir com `tools/gerar-icones.mjs`, que gera os ícones da INTERFACE, em `src/lib/icones.json`.)

Uso:  python3 tools/gerar-icone-do-app.py [FONTE.svg]     (padrão: design/icone/icone.svg)

Precisa do Inkscape (desenha o SVG), do Pillow e do `tauri` do projeto (`npx tauri icon`). Rode da raiz do repositório. Sobrescreve
`src-tauri/icons/**`, os ícones de `src-tauri/gen/**` (o que existir) e `static/favicon.png`.

O desenho tem uma convenção, e o script confere: os DOIS PRIMEIROS caminhos preenchidos são a moldura dourada e a placa azul-escuro (o
"quadrado arredondado"); o resto é o símbolo (livro, nota, teclado). Um grupo inicial de traços finos (`stroke`, sobra de vetorização
automática) só desenha fios de 2 px nas bordas e é descartado. Cada sistema recebe o que ele pede:

* **Padrão** (desktop, iOS, tiles do Windows, loja): o ícone completo, recortado rente à moldura. O iOS não aceita transparência: os cantos
  transparentes viram a cor da placa (`bg_color`).
* **Android adaptativo** (Android 8+): o sistema recorta o ícone em círculo, quadrado arredondado ou gota, então a moldura dourada seria
  cortada. O fundo é a cor lisa da placa e o primeiro plano é só o símbolo, reduzido para caber no CÍRCULO SEGURO (66 dp de uma tela de 108 dp).
* **Android 13 monocromático** (ícone temático): a silhueta do símbolo; só o alfa importa, e as partes escuras (nota, vãos do teclado) viram
  recortes.
* **iOS**: os PNGs saem do `tauri icon` em RGBA e são regravados em RGB (a App Store recusa canal alfa).

Os ícones do Android de antes do 8 (`ic_launcher.png` e `ic_launcher_round.png`, para o `minSdk` 24 do projeto) são montados pelo próprio
`tauri icon` a partir da frente e do fundo; no redondo o símbolo fica apertado.
"""
import json
import re
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

from PIL import Image

RAIZ = Path(__file__).resolve().parent.parent
FONTE = RAIZ / "design" / "icone" / "icone.svg"
TAMANHO = 1024  # lado das imagens de trabalho
ZONA_SEGURA = 66 / 108  # diâmetro do círculo seguro do ícone adaptativo, em fração da tela (o sistema recorta o resto)
MARGEM_SEGURA = 0.93  # o símbolo ocupa 93% do círculo seguro, não 100%: sobra folga contra o recorte
LIMIAR_CLARO = 0.35  # luminância (0 a 1) a partir da qual um pixel entra na silhueta monocromática
FAVICON = 256
CAMINHO = re.compile(r'<path fill="(#[0-9a-fA-F]{6})" d="(.*?)"\s*/>', re.S)
# O desenho é só caminhos preenchidos; o resto é recusado, porque poderia fazer o Inkscape ler arquivo local ou rede: script, imagem, objeto
# estrangeiro, <use> e <style> (referências e @import), qualquer href (inclusive `xlink:href`), manipuladores de evento, entidades externas
# do DOCTYPE e url() que não seja só uma referência interna (#id). `\son...=` e não `on...=`: o cabeçalho XML tem `standalone="no"`, que
# termina em "one=".
PROIBIDO = re.compile(
    r"<(?:script|image|foreignObject|use|style)\b|(?:^|[\s:])href\s*=|\son[a-z]+\s*=|<!ENTITY|@import|url\(\s*[\"']?\s*[^#\s\"')]",
    re.I,
)


class ErroIcone(Exception):
    pass


def separar_camadas(svg: str):
    """(cabeçalho do SVG, [(cor, d)] da placa, [(cor, d)] do símbolo). Confere a convenção do desenho e recusa SVG com conteúdo ativo."""
    if PROIBIDO.search(svg):
        raise ErroIcone("o SVG tem script, imagem, <use>, <style>, link, entidade externa ou url() externo: só desenho (caminhos) é aceito")
    achou = re.search(r"<g[\s>/]", svg)
    if achou is None or "<svg" not in svg[: achou.start()]:
        raise ErroIcone("não achei o grupo de traços depois do <svg ...>: o arquivo não é o esperado")
    inicio = achou.start()
    if svg[svg.index(">", inicio) - 1] == "/":
        raise ErroIcone("o grupo de traços está autofechado (<g/>): o arquivo não é o esperado")
    fecha = svg.find("</g>", inicio)
    if fecha < 0:
        raise ErroIcone("o grupo de traços não fecha (</g>): o arquivo está truncado ou não é o esperado")
    cabecalho = svg[:inicio]
    fim_grupo = fecha + len("</g>")
    caminhos = CAMINHO.findall(svg[fim_grupo:])
    if len(caminhos) < 3:
        raise ErroIcone(f"esperava a moldura, a placa e o símbolo; achei {len(caminhos)} caminhos preenchidos")
    if caminhos[1][0].lower() == caminhos[0][0].lower():
        raise ErroIcone("os dois primeiros caminhos (moldura e placa) deviam ter cores diferentes")
    return cabecalho, caminhos[:2], caminhos[2:]


def montar_svg(cabecalho: str, caminhos) -> str:
    corpo = "".join(f'<path fill="{cor}" d="{d}"/>\n' for cor, d in caminhos)
    return cabecalho + corpo + "</svg>\n"


def desenhar(svg: Path, saida: Path, largura: int):
    try:
        subprocess.run(["inkscape", str(svg), "--export-type=png", f"--export-width={largura}", "--export-background-opacity=0",
                        f"--export-filename={saida}"], check=True, capture_output=True, text=True, timeout=300)
    except FileNotFoundError as e:
        raise ErroIcone("não achei o Inkscape (instale e deixe no PATH)") from e
    except subprocess.TimeoutExpired as e:
        raise ErroIcone(f"o Inkscape passou de 300 s desenhando {svg.name}") from e
    except subprocess.CalledProcessError as e:
        detalhe = (e.stderr or e.stdout or "").strip()[-400:]
        raise ErroIcone(f"o Inkscape falhou desenhando {svg.name} (código {e.returncode})" + (f": {detalhe}" if detalhe else "")) from e
    with Image.open(saida) as aberta:
        return aberta.convert("RGBA")


def recortar_quadrado(img: Image.Image, lado: int) -> Image.Image:
    """Recorta rente ao conteúdo (alfa), completa para quadrado, centralizado, e reduz para `lado`."""
    caixa = img.getchannel("A").point(lambda v: 255 if v > 8 else 0).getbbox()
    if caixa is None:
        raise ErroIcone("a imagem está vazia")
    conteudo = img.crop(caixa)
    maior = max(conteudo.size)
    tela = Image.new("RGBA", (maior, maior), (0, 0, 0, 0))
    tela.paste(conteudo, ((maior - conteudo.width) // 2, (maior - conteudo.height) // 2))
    return tela.resize((lado, lado), Image.LANCZOS)


def raio_maximo(img: Image.Image) -> float:
    """Distância, em pixels, do ponto opaco mais afastado do centro da imagem."""
    alfa = img.getchannel("A").tobytes()
    w, h = img.size
    cx, cy = (w - 1) / 2, (h - 1) / 2
    maior = 0.0
    for i, a in enumerate(alfa):
        if a > 8:
            d = (i % w - cx) ** 2 + (i // w - cy) ** 2
            if d > maior:
                maior = d
    return maior ** 0.5


def primeiro_plano(simbolo: Image.Image, lado: int) -> Image.Image:
    """O símbolo centralizado numa tela `lado` x `lado`, reduzido para caber no círculo seguro do ícone adaptativo."""
    caixa = simbolo.getchannel("A").point(lambda v: 255 if v > 8 else 0).getbbox()
    if caixa is None:
        raise ErroIcone("o símbolo está vazio")
    conteudo = simbolo.crop(caixa)
    # O recorte tem o centro da caixa do símbolo no meio: o ponto opaco mais afastado desse centro (no tamanho original, antes de reduzir)
    # dá o fator para ele caber no raio alvo. Medir só depois de colar numa tela menor cortaria o símbolo e erraria o fator.
    alvo = lado * ZONA_SEGURA / 2 * MARGEM_SEGURA
    fator = alvo / raio_maximo(conteudo)
    novo = (max(1, round(conteudo.width * fator)), max(1, round(conteudo.height * fator)))
    miolo = conteudo.resize(novo, Image.LANCZOS)
    saida = Image.new("RGBA", (lado, lado), (0, 0, 0, 0))
    saida.paste(miolo, ((lado - miolo.width) // 2, (lado - miolo.height) // 2))
    return saida


def silhueta(img: Image.Image) -> Image.Image:
    """Preto onde a imagem é CLARA e opaca (creme, dourado); transparente onde é escura (azul) ou vazia. Só o alfa importa no Android."""
    rgba = img.convert("RGBA")
    dados = bytearray()
    for r, g, b, a in zip(*(iter(rgba.tobytes()),) * 4):
        luz = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255
        dados += bytes((0, 0, 0, a if luz > LIMIAR_CLARO else 0))
    return Image.frombytes("RGBA", rgba.size, bytes(dados))


def sem_alfa(pasta: Path, cor: str) -> int:
    """Regrava como RGB (sem canal alfa) todo PNG da pasta, compondo sobre `cor`. A App Store recusa ícone com canal alfa, mesmo que opaco,
    e o `tauri icon` grava os do iOS em RGBA. Devolve quantos arquivos foram regravados."""
    arquivos = sorted(pasta.glob("*.png")) if pasta.is_dir() else []
    if not arquivos:
        raise ErroIcone(f"não achei PNG em {pasta}: o tauri icon não gerou os ícones do iOS?")
    n = 0
    for p in arquivos:
        with Image.open(p) as aberta:
            img = aberta.convert("RGBA")
        fundo = Image.new("RGBA", img.size, cor)
        Image.alpha_composite(fundo, img).convert("RGB").save(p, optimize=True)
        n += 1
    return n


def gerar(cabecalho: str, placa, simbolo) -> int:
    """Desenha as camadas, roda o `tauri icon` e acerta o iOS e o favicon. Levanta ErroIcone se algo falhar."""
    cor_placa = placa[1][0]

    with tempfile.TemporaryDirectory(prefix="bm-icones-") as t:
        pasta = Path(t)
        camadas = {"completo": placa + simbolo, "simbolo": simbolo}
        imagens = {}
        for nome, caminhos in camadas.items():
            (pasta / f"{nome}.svg").write_text(montar_svg(cabecalho, caminhos), encoding="utf-8")
            imagens[nome] = desenhar(pasta / f"{nome}.svg", pasta / f"{nome}-grande.png", TAMANHO * 2)

        padrao = recortar_quadrado(imagens["completo"], TAMANHO)
        padrao.save(pasta / "padrao.png")
        Image.new("RGBA", (TAMANHO, TAMANHO), cor_placa).save(pasta / "fundo.png")
        frente = primeiro_plano(imagens["simbolo"], TAMANHO)
        frente.save(pasta / "frente.png")
        silhueta(frente).save(pasta / "monocromatico.png")
        manifesto = {"default": "padrao.png", "bg_color": cor_placa, "android_bg": "fundo.png", "android_fg": "frente.png",
                     "android_fg_scale": 100, "android_monochrome": "monocromatico.png"}
        (pasta / "manifesto.json").write_text(json.dumps(manifesto), encoding="utf-8")

        r = subprocess.run(["npx", "tauri", "icon", str(pasta / "manifesto.json")], cwd=RAIZ, capture_output=True, text=True)
        sys.stdout.write(r.stdout)
        if r.returncode != 0:
            sys.stderr.write(r.stderr)
            return r.returncode
        print(f"iOS sem canal alfa: {sem_alfa(RAIZ / 'src-tauri' / 'icons' / 'ios', cor_placa)} arquivos")
        favicon = RAIZ / "static" / "favicon.png"
        padrao.resize((FAVICON, FAVICON), Image.LANCZOS).save(favicon, optimize=True)
        print(f"{favicon.relative_to(RAIZ)}: {FAVICON}x{FAVICON}")
    return 0


def principal() -> int:
    fonte = Path(sys.argv[1]).resolve() if len(sys.argv) > 1 else FONTE
    if not fonte.is_file():
        print(f"erro: {fonte} não existe", file=sys.stderr)
        return 2
    for ferramenta in ("inkscape", "npx"):
        if shutil.which(ferramenta) is None:
            print(f"erro: falta o programa '{ferramenta}'", file=sys.stderr)
            return 2
    try:
        cabecalho, placa, simbolo = separar_camadas(fonte.read_text(encoding="utf-8"))
    except ErroIcone as e:
        print(f"erro: {e}", file=sys.stderr)
        return 2
    try:
        return gerar(cabecalho, placa, simbolo)
    except ErroIcone as e:
        print(f"erro: {e}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(principal())
