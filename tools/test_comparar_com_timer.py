#!/usr/bin/env python3
"""Testes de tools/comparar-com-timer.py.  Uso:  python3 tools/test_comparar_com_timer.py"""
import contextlib
import importlib.util
import io
import json
import tempfile
import unittest
from pathlib import Path

spec = importlib.util.spec_from_file_location("comparar", Path(__file__).resolve().parent / "comparar-com-timer.py")
c = importlib.util.module_from_spec(spec)
spec.loader.exec_module(c)


def backup(*tentativas, percursos=None):
    return {
        "formato": "nicska-backup/1",
        "percursos": percursos or [{"id": "p1", "nome": "Bill Drill"}],
        "tentativas": [{"id": f"t{i}", "percurso_id": "p1", "quando": 1000 + i, "disparos_ms": d} for i, d in enumerate(tentativas)],
    }


class Testes(unittest.TestCase):
    def test_segundos_com_virgula_ou_ponto(self):
        self.assertEqual(c.ler_segundos("1,48 1.73  2"), [1480, 1730, 2000])

    def test_dentro_da_tolerancia_e_contagem(self):
        app = c.tentativas_do_percurso(backup([1480, 1735], [1500]), None)
        res = c.comparar(app, [{"n": 1, "grupo": "", "timer": [1480, 1730]}, {"n": 2, "grupo": "", "timer": [1500]}], 10)
        r = c.resumo(res, 10, 95)
        self.assertEqual(res[0]["difs"], [0, 5])
        self.assertTrue(r["passa_contagem"] and r["passa_tempo"])
        self.assertEqual(r["maior_dif_ms"], 5)

    def test_diferenca_maior_que_a_tolerancia_reprova(self):
        app = c.tentativas_do_percurso(backup([1480, 1750]), None)
        res = c.comparar(app, [{"n": 1, "grupo": "", "timer": [1480, 1730]}], 10)
        r = c.resumo(res, 10, 95)
        self.assertTrue(r["passa_contagem"])
        self.assertFalse(r["passa_tempo"])

    def test_contagem_diferente_conta_contra_os_95_por_cento(self):
        app = c.tentativas_do_percurso(backup(*[[1000, 1200]] * 18, [1000], [1000, 1200, 1400]), None)
        linhas = [{"n": i + 1, "grupo": "", "timer": [1000, 1200]} for i in range(20)]
        r = c.resumo(c.comparar(app, linhas, 10), 10, 95)
        self.assertEqual((r["contagem_igual"], r["tentativas"]), (18, 20))
        self.assertFalse(r["passa_contagem"])  # 90% < 95%
        self.assertTrue(c.resumo(c.comparar(app, linhas, 10), 10, 90)["passa_contagem"])

    def test_tentativas_ordenadas_da_mais_antiga_para_a_mais_nova(self):
        b = backup([1], [2], [3])
        b["tentativas"].reverse()
        self.assertEqual([t["disparos_ms"][0] for t in c.tentativas_do_percurso(b, None)], [1, 2, 3])

    def test_n_que_nao_existe_vira_erro_e_fica_fora_das_contas(self):
        app = c.tentativas_do_percurso(backup([1000]), None)
        res = c.comparar(app, [{"n": 5, "grupo": "", "timer": [1000]}], 10)
        self.assertIn("erro", res[0])
        self.assertEqual(c.resumo(res, 10, 95)["tentativas"], 0)

    def test_latencia_anulada_compara_o_primeiro_disparo_por_grupo(self):
        app = c.tentativas_do_percurso(backup([1000], [1004], [1001]), None)
        linhas = [{"n": 1, "grupo": "celular", "timer": [1000]}, {"n": 2, "grupo": "bluetooth", "timer": [1000]}, {"n": 3, "grupo": "celular", "timer": [1000]}]
        g = c.resumo(c.comparar(app, linhas, 10), 10, 95)["primeiro_por_grupo_ms"]
        self.assertEqual(g, {"celular": 0.5, "bluetooth": 4})

    def test_percurso_ambiguo_pede_o_nome(self):
        b = backup([1], percursos=[{"id": "p1", "nome": "A"}, {"id": "p2", "nome": "B"}])
        with self.assertRaises(SystemExit):
            c.tentativas_do_percurso(b, None)
        self.assertEqual(len(c.tentativas_do_percurso(b, "a")), 1)

    def test_ponta_a_ponta_pelo_arquivo(self):
        with tempfile.TemporaryDirectory() as d:
            (Path(d) / "b.json").write_text(json.dumps(backup([1480, 1735])), encoding="utf-8")
            (Path(d) / "t.csv").write_text("n;grupo;disparos_s\n1;celular;1,48 1,73\n", encoding="utf-8")
            with contextlib.redirect_stdout(io.StringIO()) as s:
                codigo = c.principal([str(Path(d) / "b.json"), str(Path(d) / "t.csv")])
            self.assertEqual(codigo, 0)
            self.assertIn("PASSA", s.getvalue())


if __name__ == "__main__":
    unittest.main()
