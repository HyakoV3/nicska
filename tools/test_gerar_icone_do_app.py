#!/usr/bin/env python3
"""Testes da parte pura de tools/gerar-icone-do-app.py (não precisam do Inkscape nem do `tauri icon`).

Uso:  python3 tools/test_gerar_icone_do_app.py
"""
import contextlib
import importlib.util
import io
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path
from unittest import mock

from PIL import Image, ImageDraw

AQUI = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location("gerar_icone_do_app", AQUI / "gerar-icone-do-app.py")
g = importlib.util.module_from_spec(spec)
spec.loader.exec_module(g)

CABECA = '<?xml version="1.0" encoding="UTF-8" standalone="no"?>\n<svg xmlns="http://www.w3.org/2000/svg" version="1.1" viewBox="0 0 100 100">\n'
GRUPO = '<g stroke-width="2.00" fill="none"><path stroke="#7f6928" d="M0 0L1 1"/></g>\n'


def svg(*caminhos, extra=""):
    corpo = "".join(f'<path fill="{c}" d="M0 0L{i} {i}"/>\n' for i, c in enumerate(caminhos, 1))
    return CABECA + GRUPO + corpo + extra + "</svg>\n"


class SepararCamadas(unittest.TestCase):
    def test_os_dois_primeiros_sao_a_placa_e_o_resto_e_o_simbolo(self):
        cabecalho, placa, simbolo = g.separar_camadas(svg("#fdaf00", "#012250", "#fcf5ea", "#012250", "#fcf5ea"))
        self.assertEqual([c for c, _ in placa], ["#fdaf00", "#012250"])
        self.assertEqual([c for c, _ in simbolo], ["#fcf5ea", "#012250", "#fcf5ea"])
        self.assertTrue(cabecalho.rstrip().endswith('viewBox="0 0 100 100">'))
        self.assertNotIn("stroke", cabecalho, "o grupo de traços finos não vai junto")

    def test_o_cabecalho_xml_com_standalone_nao_e_confundido_com_um_manipulador_de_evento(self):
        # `standalone="no"` termina em "one=": um filtro frouxo de on...= o recusaria
        self.assertIn('standalone="no"', CABECA)
        g.separar_camadas(svg("#fdaf00", "#012250", "#fcf5ea"))

    def test_recusa_conteudo_ativo(self):
        for extra in ("<script>alert(1)</script>", '<image href="x.png"/>', '<a href="http://x"/>', "<foreignObject/>", '<path onclick="x()" d="M0 0"/>'):
            with self.assertRaises(g.ErroIcone, msg=extra):
                g.separar_camadas(svg("#fdaf00", "#012250", "#fcf5ea", extra=extra))

    def test_recusa_referencias_a_arquivos_ou_rede_em_todas_as_formas(self):
        # o filtro antigo só via ` href=` e deixava passar tudo isto (comentário do vandame na PR #47)
        casos = {
            "xlink:href": '<use xlink:href="file:///etc/hostname"/>',
            "href com prefixo de outro espaço de nomes": '<a xl:href="http://x"/>',
            "<use>": "<use/>",
            "<style> com @import": '<style>@import "file:///etc/hostname";</style>',
            "<style>": "<style>path{fill:red}</style>",
            "@import fora de <style>": '<path d="M0 0" data-x="@import"/>',
            "url() externo": '<path fill="url(file:///etc/hostname)" d="M0 0"/>',
            "url() externo entre aspas": '<path fill="url(\'http://x/a.svg#g\')" d="M0 0"/>',
            "entidade externa": '<!DOCTYPE svg [<!ENTITY x SYSTEM "file:///etc/hostname">]>',
        }
        for rotulo, extra in casos.items():
            with self.assertRaises(g.ErroIcone, msg=rotulo):
                g.separar_camadas(svg("#fdaf00", "#012250", "#fcf5ea", extra=extra))

    def test_aceita_referencia_interna_por_fragmento(self):
        # `url(#id)` (gradiente do próprio desenho) não lê nada de fora
        g.separar_camadas(svg("#fdaf00", "#012250", "#fcf5ea", extra='<path fill="url(#g1)" d="M0 0"/>'))

    def test_grupo_de_tracos_sem_fecho_ou_autofechado_e_erro_do_script_e_nao_excecao(self):
        # `<g/>` e arquivo truncado davam ValueError (str.index) e um traceback no lugar da mensagem. A mensagem tem de dizer O QUE está
        # errado (e não só levantar algum erro: com três caminhos a mais, outra checagem levantaria o mesmo tipo por outro motivo).
        tres = '<path fill="#fdaf00" d="M0 0"/><path fill="#012250" d="M0 0"/><path fill="#fcf5ea" d="M0 0"/>'
        casos = {
            "autofechado": (CABECA + "<g/>" + tres + "</svg>", "autofechado"),
            "autofechado com atributos": (CABECA + '<g fill="none" />' + tres + "</svg>", "autofechado"),
            "truncado": (CABECA + "<g fill='none'>" + tres, "não fecha"),
            "sem nenhum <g": (CABECA + tres + "</svg>", "não achei o grupo"),
        }
        for rotulo, (texto, mensagem) in casos.items():
            with self.assertRaisesRegex(g.ErroIcone, mensagem, msg=rotulo):
                g.separar_camadas(texto)

    def test_recusa_menos_de_tres_caminhos_e_placa_de_uma_cor_so(self):
        with self.assertRaises(g.ErroIcone):
            g.separar_camadas(svg("#fdaf00", "#012250"))
        with self.assertRaises(g.ErroIcone):
            g.separar_camadas(svg("#012250", "#012250", "#fcf5ea"))

    def test_recusa_arquivo_sem_o_grupo_de_tracos(self):
        with self.assertRaises(g.ErroIcone):
            g.separar_camadas(CABECA + '<path fill="#fff" d="M0 0"/></svg>')

    def test_o_icone_provisorio_passa(self):
        fonte = AQUI.parent / "design" / "icone" / "icone.svg"
        if not fonte.exists():
            self.skipTest("sem o SVG-fonte")
        _, placa, simbolo = g.separar_camadas(fonte.read_text(encoding="utf-8"))
        self.assertEqual((placa[0][0], placa[1][0]), ("#d9822b", "#14181f"))
        self.assertEqual(len(simbolo), 2)  # o anel e o Ч

    def test_montar_svg_recompoe_o_arquivo(self):
        cabecalho, placa, simbolo = g.separar_camadas(svg("#fdaf00", "#012250", "#fcf5ea"))
        saida = g.montar_svg(cabecalho, placa + simbolo)
        self.assertEqual(saida.count("<path"), 3)
        self.assertTrue(saida.endswith("</svg>\n"))


class Desenhar(unittest.TestCase):
    def roda(self, efeito):
        with tempfile.TemporaryDirectory() as t:
            pasta = Path(t)
            with mock.patch.object(g.subprocess, "run", side_effect=efeito):
                return g.desenhar(pasta / "x.svg", pasta / "x.png", 64)

    def test_falha_do_inkscape_mostra_o_que_o_inkscape_disse(self):
        falha = subprocess.CalledProcessError(1, ["inkscape"], output="", stderr="Erro: arquivo corrompido na linha 7\n")
        with self.assertRaises(g.ErroIcone) as e:
            self.roda(falha)
        self.assertIn("arquivo corrompido na linha 7", str(e.exception))
        self.assertIn("código 1", str(e.exception))
        self.assertIn("x.svg", str(e.exception))

    def test_falha_sem_texto_ainda_vira_erro_do_script(self):
        with self.assertRaises(g.ErroIcone) as e:
            self.roda(subprocess.CalledProcessError(3, ["inkscape"], output="", stderr=""))
        self.assertIn("código 3", str(e.exception))

    def test_inkscape_ausente_ou_lento_viram_erro_do_script(self):
        with self.assertRaisesRegex(g.ErroIcone, "Inkscape"):
            self.roda(FileNotFoundError("inkscape"))
        with self.assertRaisesRegex(g.ErroIcone, "300 s"):
            self.roda(subprocess.TimeoutExpired(["inkscape"], 300))

    def test_sucesso_devolve_a_imagem_rgba_ja_carregada(self):
        with tempfile.TemporaryDirectory() as t:
            pasta = Path(t)

            def escreve(cmd, **k):
                Image.new("RGB", (4, 4), (1, 2, 3)).save(pasta / "x.png")
                return subprocess.CompletedProcess(cmd, 0, "", "")

            with mock.patch.object(g.subprocess, "run", side_effect=escreve):
                im = g.desenhar(pasta / "x.svg", pasta / "x.png", 4)
            (pasta / "x.png").unlink()  # a imagem não depende mais do arquivo
            self.assertEqual((im.mode, im.getpixel((0, 0))), ("RGBA", (1, 2, 3, 255)))


class Principal(unittest.TestCase):
    def roda(self, **patches):
        fonte = AQUI.parent / "design" / "icone" / "icone.svg"
        if not fonte.exists():
            self.skipTest("sem o SVG-fonte")
        erro = io.StringIO()
        with mock.patch.object(sys, "argv", ["gerar-icone-do-app.py", str(fonte)]), mock.patch.object(g.shutil, "which", return_value="/usr/bin/x"), \
                mock.patch.object(g, "desenhar", **patches), contextlib.redirect_stderr(erro):
            return g.principal(), erro.getvalue()

    def test_falha_do_inkscape_sai_com_mensagem_e_codigo_1_sem_traceback(self):
        codigo, erro = self.roda(side_effect=g.ErroIcone("o Inkscape falhou desenhando completo.svg (código 1): arquivo corrompido"))
        self.assertEqual(codigo, 1)
        self.assertTrue(erro.startswith("erro: o Inkscape falhou"), erro)
        self.assertNotIn("Traceback", erro)

    def test_svg_que_nao_e_o_esperado_sai_com_codigo_2(self):
        with tempfile.TemporaryDirectory() as t:
            ruim = Path(t) / "ruim.svg"
            ruim.write_text(CABECA + "<g fill='none'>", encoding="utf-8")  # truncado
            erro = io.StringIO()
            with mock.patch.object(sys, "argv", ["gerar-icone-do-app.py", str(ruim)]), mock.patch.object(g.shutil, "which", return_value="/x"), \
                    contextlib.redirect_stderr(erro):
                self.assertEqual(g.principal(), 2)
            self.assertIn("erro:", erro.getvalue())
            self.assertNotIn("Traceback", erro.getvalue())


def quadrado(lado, caixa, cor=(250, 245, 235, 255)):
    im = Image.new("RGBA", (lado, lado), (0, 0, 0, 0))
    ImageDraw.Draw(im).rectangle(caixa, fill=cor)
    return im


class Imagens(unittest.TestCase):
    def test_recortar_quadrado_fica_rente_ao_conteudo_e_centralizado(self):
        im = quadrado(200, (20, 60, 119, 99))  # 100 x 40
        r = g.recortar_quadrado(im, 64)
        self.assertEqual(r.size, (64, 64))
        x0, y0, x1, y1 = r.getchannel("A").point(lambda v: 255 if v > 128 else 0).getbbox()
        self.assertEqual((x0, x1), (0, 64), "a largura toca as bordas")
        self.assertAlmostEqual((y0 + y1) / 2, 32, delta=1, msg="centralizado na vertical")
        self.assertAlmostEqual((y1 - y0) / (x1 - x0), 0.4, delta=0.03, msg="a proporção 100 x 40 se mantém")

    def test_recortar_quadrado_de_imagem_vazia_e_erro(self):
        with self.assertRaises(g.ErroIcone):
            g.recortar_quadrado(Image.new("RGBA", (10, 10), (0, 0, 0, 0)), 8)

    def test_raio_maximo_e_a_distancia_do_ponto_mais_afastado_do_centro(self):
        im = quadrado(101, (0, 0, 100, 100))  # centro (50, 50); canto (0,0) a ~70,7
        self.assertAlmostEqual(g.raio_maximo(im), 70.71, delta=0.8)

    def test_o_primeiro_plano_cabe_no_circulo_seguro_e_fica_centrado(self):
        simbolo = quadrado(2048, (100, 600, 1900, 1500))  # largo e baixo, maior que a tela de destino
        lado = 1024
        r = g.primeiro_plano(simbolo, lado)
        self.assertEqual(r.size, (lado, lado))
        limite = lado * g.ZONA_SEGURA / 2  # raio do círculo seguro
        self.assertLessEqual(g.raio_maximo(r), limite, "nenhum ponto passa do círculo seguro")
        self.assertGreater(g.raio_maximo(r), limite * 0.85, "e aproveita o espaço (não fica minúsculo)")
        caixa = r.getchannel("A").point(lambda v: 255 if v > 8 else 0).getbbox()
        self.assertAlmostEqual((caixa[0] + caixa[2]) / 2, lado / 2, delta=2)
        self.assertAlmostEqual((caixa[1] + caixa[3]) / 2, lado / 2, delta=2)

    def test_o_primeiro_plano_de_simbolo_pequeno_tambem_e_ampliado_ate_o_alvo(self):
        r = g.primeiro_plano(quadrado(300, (100, 100, 199, 199)), 1024)
        self.assertGreater(g.raio_maximo(r), 1024 * g.ZONA_SEGURA / 2 * 0.85)

    def test_silhueta_clara_vira_preto_opaco_e_escuro_vira_recorte(self):
        im = Image.new("RGBA", (4, 1))
        im.putdata([(250, 245, 235, 255), (253, 175, 0, 255), (1, 34, 80, 255), (250, 245, 235, 0)])
        s = g.silhueta(im)
        self.assertEqual([s.getpixel((i, 0)) for i in range(4)], [(0, 0, 0, 255), (0, 0, 0, 255), (0, 0, 0, 0), (0, 0, 0, 0)])

    def test_sem_alfa_pasta_inexistente_ou_sem_png_e_erro_e_nao_zero_em_silencio(self):
        with tempfile.TemporaryDirectory() as t:
            pasta = Path(t)
            with self.assertRaisesRegex(g.ErroIcone, "não achei PNG"):
                g.sem_alfa(pasta / "nao-existe", "#012250")
            with self.assertRaisesRegex(g.ErroIcone, "não achei PNG"):
                g.sem_alfa(pasta, "#012250")  # existe, mas vazia
            (pasta / "so-texto.txt").write_text("x")
            with self.assertRaises(g.ErroIcone):
                g.sem_alfa(pasta, "#012250")

    def test_sem_alfa_regrava_em_rgb_compondo_sobre_a_cor(self):
        with tempfile.TemporaryDirectory() as t:
            pasta = Path(t)
            im = Image.new("RGBA", (8, 8), (0, 0, 0, 0))
            im.putpixel((4, 4), (255, 255, 255, 255))
            im.save(pasta / "a.png")
            (pasta / "nao-e-png.txt").write_text("x")
            self.assertEqual(g.sem_alfa(pasta, "#012250"), 1)
            r = Image.open(pasta / "a.png")
            self.assertEqual(r.mode, "RGB")
            self.assertEqual(r.getpixel((0, 0)), (1, 34, 80), "o transparente virou a cor da placa")
            self.assertEqual(r.getpixel((4, 4)), (255, 255, 255))


if __name__ == "__main__":
    unittest.main()
