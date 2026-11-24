#!/usr/bin/env python3
"""Testes da silhueta monocromática de tools/gerar-icone-do-app-png.py (só Pillow; não rodam o `tauri icon`).

Uso:  python3 tools/test_gerar_icone_do_app_png.py
"""
import importlib.util
import tempfile
import unittest
from pathlib import Path
from unittest import mock

from PIL import Image

AQUI = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location("gerar_icone_do_app_png", AQUI / "gerar-icone-do-app-png.py")
g = importlib.util.module_from_spec(spec)
spec.loader.exec_module(g)


class SilhuetaMono(unittest.TestCase):
    def test_claro_e_vermelho_ficam_opacos_e_preto_e_vazio_ficam_transparentes(self):
        im = Image.new("RGBA", (5, 1))
        # branco, vermelho, cinza da base, preto do contorno, vazio (preto transparente)
        im.putdata([(255, 255, 255, 255), (255, 0, 0, 255), (183, 183, 183, 255), (0, 0, 0, 255), (0, 0, 0, 0)])
        s = g.silhueta_mono(im)
        self.assertEqual([s.getpixel((i, 0)) for i in range(5)],
                         [(255, 255, 255, 255)] * 3 + [(255, 255, 255, 0)] * 2)

    def test_so_o_alfa_varia_e_o_resto_e_branco_puro(self):
        im = Image.new("RGBA", (3, 1), (200, 30, 30, 128))
        s = g.silhueta_mono(im)
        self.assertEqual({s.getpixel((i, 0))[:3] for i in range(3)}, {(255, 255, 255)})
        self.assertAlmostEqual(s.getpixel((0, 0))[3], 128, delta=1, msg="meio-transparente continua assim")


class Monocromaticos(unittest.TestCase):
    def test_gera_as_cinco_densidades_dentro_da_zona_segura(self):
        simbolo = Image.new("RGBA", (400, 400), (255, 255, 255, 255))
        with tempfile.TemporaryDirectory() as t:
            res = Path(t)
            for dens in g.TAMANHOS:
                (res / f"mipmap-{dens}").mkdir()
            with mock.patch.object(g, "RES", res):
                g.gerar_monocromaticos(simbolo)
            for dens, lado in {"mdpi": 108, "hdpi": 162, "xhdpi": 216, "xxhdpi": 324, "xxxhdpi": 432}.items():
                im = Image.open(res / f"mipmap-{dens}" / "ic_launcher_monochrome.png")
                self.assertEqual(im.size, (lado, lado))
                x0, y0, x1, y1 = im.getchannel("A").getbbox()
                self.assertLessEqual(x1 - x0, round(lado * g.ZONA_SEGURA) + 1, "não passa da zona segura de 66 dp")

    def test_o_xml_adaptativo_declara_o_monocromatico(self):
        self.assertIn('<monochrome android:drawable="@mipmap/ic_launcher_monochrome"/>', g.XML_ADAPTATIVO)


if __name__ == "__main__":
    unittest.main()
