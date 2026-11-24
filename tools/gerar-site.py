#!/usr/bin/env python3
"""Gera a landing page estática em site/ (pt em /, en em /en/, es em /es/, mais /privacidade/).

Uso: python3 tools/gerar-site.py
Os links das lojas ficam em LOJAS: com None o botão aparece como "Em breve"; ao publicar, troque pela URL.
O GitHub Pages publica a pasta site/ (workflow .github/workflows/site.yml); o domínio vem de site/CNAME.
"""
import html
import re
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
SITE = RAIZ / "site"
DOMINIO = "nicska.driit.co"
REPO = "https://github.com/HyakoV3/nicska"
SPONSORS = "https://github.com/sponsors/HyakoV3"
LOJAS = {"play": None, "appstore": None}  # troque None pela URL quando a loja publicar

T = {
    "pt": {
        "lang": "pt-BR", "base": "/", "titulo": "Nicska: shot timer de IPSC para Android",
        "desc": "Shot timer gratuito e de código aberto para IPSC: detecta o apito e cada disparo pelo microfone, mostra splits e tempo total, e grava vídeo com os tempos por cima.",
        "h1": "Nicska", "pron": "pronuncia-se “Nísca”",
        "tag": "O shot timer de IPSC que você já tem no bolso.",
        "sub": "Dá o apito, escuta cada disparo e mostra o 1º tiro, os splits e o tempo total. Gratuito, de código aberto e sem internet.",
        "play": "Google Play", "appstore": "App Store", "soon": "Em breve", "apk": "Baixar o APK", "gh": "Código no GitHub",
        "h_rec": "O que ele faz",
        "rec": [
            ("Apito e atraso aleatório", "Standby, atraso sorteado e apito de 2700 Hz saturado, alto o bastante para o estande. Voz “Standing by” opcional."),
            ("Detecta os tiros pelo microfone", "O app reconhece o próprio apito e mede tudo a partir dele, então a latência do som se anula, até com caixa Bluetooth."),
            ("Splits, total e pontuação", "1º disparo, splits, tempo total, hit factor e ranking. Revise a linha do tempo, apague ou insira disparos."),
            ("Vídeo com os tempos", "Grave a tentativa em vídeo (até 4K) e exporte um MP4 com o cronômetro e os disparos desenhados por cima."),
            ("Histórico e gráficos", "Percursos, sessões, evolução e comparação entre dias. Backup em JSON que você mesmo guarda."),
            ("Para todos", "Iniciar batendo no celular, vibração 3/2/1 para atiradores surdos, temas e alto contraste, português, inglês e espanhol."),
        ],
        "h_priv": "Privacidade de verdade",
        "priv": "Sem conta, sem anúncios, sem rastreadores. O app nem pede a permissão de internet: seus tempos, áudios e vídeos ficam no aparelho e só saem quando você compartilha.",
        "priv_link": "Ler a política de privacidade",
        "aviso": "Projeto independente, sem vínculo com a IPSC, a CBTP nem com fabricantes. Não é cronômetro oficial de prova: pela regra 9.10.1 da IPSC, só o timer de um Range Officer vale como tempo oficial. Use para treinar.",
        "h_apoio": "Apoie o projeto", "apoio": "O Nicska é gratuito e de código aberto. Se ele ajuda no seu treino, você pode apoiar o desenvolvimento pelo GitHub Sponsors. É voluntário e nada muda no app.", "apoio_btn": "Apoiar no GitHub Sponsors",
        "foot": "Licença MIT", "priv_t": "Privacidade", "outros": "English · Español",
    },
    "en": {
        "lang": "en", "base": "/en/", "titulo": "Nicska: IPSC shot timer for Android",
        "desc": "Free, open-source IPSC shot timer: it hears the start beep and every shot through the microphone, shows splits and total time, and records video with your times on top.",
        "h1": "Nicska", "pron": "pronounced “NEES-ka”",
        "tag": "The IPSC shot timer you already carry.",
        "sub": "It beeps, listens to every shot and shows the first shot, splits and total time. Free, open source and offline.",
        "play": "Google Play", "appstore": "App Store", "soon": "Coming soon", "apk": "Download the APK", "gh": "Source on GitHub",
        "h_rec": "What it does",
        "rec": [
            ("Random delay and beep", "Standby, a random delay and a saturated 2700 Hz beep, loud enough for the range. Optional “Standing by” voice."),
            ("Hears the shots", "The app recognizes its own beep and measures everything from it, so sound latency cancels out, even with a Bluetooth speaker."),
            ("Splits, total and scoring", "First shot, splits, total time, hit factor and ranking. Review the timeline, delete or add shots."),
            ("Video with your times", "Record the attempt on video (up to 4K) and export an MP4 with the timer and shots drawn on top."),
            ("History and charts", "Drills, sessions, progress and day-to-day comparison. A JSON backup that you keep yourself."),
            ("For everyone", "Start by tapping the phone, 3/2/1 vibration for deaf shooters, themes and high contrast, Portuguese, English and Spanish."),
        ],
        "h_priv": "Real privacy",
        "priv": "No account, no ads, no trackers. The app does not even request the internet permission: your times, audio and video stay on your device and leave only when you share them.",
        "priv_link": "Read the privacy policy",
        "aviso": "Independent project, not affiliated with IPSC, CBTP or timer makers. Not an official match timer: under IPSC rule 9.10.1 only a Range Officer's timer gives the official time. Use it to train.",
        "h_apoio": "Support the project", "apoio": "Nicska is free and open source. If it helps your training, you can support its development through GitHub Sponsors. It is voluntary and nothing changes in the app.", "apoio_btn": "Support on GitHub Sponsors",
        "foot": "MIT license", "priv_t": "Privacy", "outros": "Português · Español",
    },
    "es": {
        "lang": "es", "base": "/es/", "titulo": "Nicska: cronómetro de tiro IPSC para Android",
        "desc": "Cronómetro de tiro IPSC gratuito y de código abierto: oye el pitido y cada disparo con el micrófono, muestra parciales y tiempo total, y graba video con los tiempos encima.",
        "h1": "Nicska", "pron": "se pronuncia “Nísca”",
        "tag": "El cronómetro de tiro IPSC que ya llevas en el bolsillo.",
        "sub": "Da el pitido, escucha cada disparo y muestra el primer tiro, los parciales y el tiempo total. Gratis, de código abierto y sin internet.",
        "play": "Google Play", "appstore": "App Store", "soon": "Próximamente", "apk": "Descargar el APK", "gh": "Código en GitHub",
        "h_rec": "Qué hace",
        "rec": [
            ("Pitido y retraso aleatorio", "Standby, retraso sorteado y pitido de 2700 Hz saturado, lo bastante fuerte para el campo de tiro. Voz “Standing by” opcional."),
            ("Detecta los disparos", "La app reconoce su propio pitido y mide todo desde él, así la latencia del sonido se anula, incluso con un altavoz Bluetooth."),
            ("Parciales, total y puntuación", "Primer disparo, parciales, tiempo total, hit factor y ranking. Revisa la línea de tiempo, borra o inserta disparos."),
            ("Video con los tiempos", "Graba el intento en video (hasta 4K) y exporta un MP4 con el cronómetro y los disparos dibujados encima."),
            ("Historial y gráficos", "Recorridos, sesiones, evolución y comparación entre días. Copia de seguridad en JSON que guardas tú."),
            ("Para todos", "Iniciar golpeando el teléfono, vibración 3/2/1 para tiradores sordos, temas y alto contraste, portugués, inglés y español."),
        ],
        "h_priv": "Privacidad de verdad",
        "priv": "Sin cuenta, sin anuncios, sin rastreadores. La app ni siquiera pide el permiso de internet: tus tiempos, audios y videos se quedan en el dispositivo y solo salen cuando los compartes.",
        "priv_link": "Leer la política de privacidad",
        "aviso": "Proyecto independiente, sin vínculo con la IPSC, la CBTP ni con fabricantes. No es un cronómetro oficial de competencia: según la regla 9.10.1 de la IPSC solo el timer de un Range Officer da el tiempo oficial. Úsalo para entrenar.",
        "h_apoio": "Apoya el proyecto", "apoio": "Nicska es gratuito y de código abierto. Si te ayuda en tu entrenamiento, puedes apoyar el desarrollo en GitHub Sponsors. Es voluntario y nada cambia en la app.", "apoio_btn": "Apoyar en GitHub Sponsors",
        "foot": "Licencia MIT", "priv_t": "Privacidad", "outros": "Português · English",
    },
}

CSS = """
:root{color-scheme:dark;--fundo:#14181F;--sup:#1d232d;--borda:#2e3744;--texto:#F2F2F2;--suave:#aab4c2;--acento:#FF746D;--botao:#C92B31}
*{box-sizing:border-box}html{-webkit-text-size-adjust:100%}
body{margin:0;background:var(--fundo);color:var(--texto);font:1rem/1.6 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}
a{color:var(--acento)}a:focus-visible,.btn:focus-visible{outline:.1875rem solid var(--acento);outline-offset:.1875rem}
.wrap{max-width:60rem;margin:0 auto;padding:0 1.25rem}
.top{display:flex;justify-content:flex-end;padding:1rem 0;font-size:.9rem;color:var(--suave)}
.hero{display:grid;gap:2rem;align-items:center;padding:1.5rem 0 3rem;grid-template-columns:1fr}
@media(min-width:48rem){.hero{grid-template-columns:1.2fr .8fr;padding:3rem 0 4rem}}
.hero img{width:100%;height:auto;aspect-ratio:1;max-width:18rem;justify-self:center;border-radius:22%;box-shadow:0 1.5rem 3rem rgba(0,0,0,.5)}
h1{font-size:clamp(2.6rem,8vw,4.2rem);line-height:1;margin:0}
.pron{color:var(--suave);margin:.35rem 0 1.25rem}
.tag{font-size:clamp(1.3rem,3.5vw,1.8rem);font-weight:650;line-height:1.25;margin:0 0 .75rem}
.sub{color:var(--suave);font-size:1.1rem;margin:0 0 1.5rem}
.btns{display:flex;flex-wrap:wrap;gap:.75rem}
.btn{display:inline-flex;flex-direction:column;justify-content:center;min-height:3rem;padding:.55rem 1.25rem;border-radius:.75rem;border:.0625rem solid var(--borda);background:var(--sup);color:var(--texto);text-decoration:none;font-weight:650;line-height:1.2}
.btn small{font-weight:500;font-size:.8rem;color:var(--suave)}
.btn.primario{background:var(--botao);border-color:var(--botao);color:#fff}.btn.primario small{color:#ffd9d7}
.btn[aria-disabled=true]{opacity:.7;cursor:default}
section{padding:2.5rem 0;border-top:.0625rem solid var(--borda)}
h2{font-size:1.6rem;margin:0 0 1.5rem}
.grade{display:grid;gap:1rem;grid-template-columns:repeat(auto-fit,minmax(16rem,1fr))}
.card{background:var(--sup);border:.0625rem solid var(--borda);border-radius:.9rem;padding:1.1rem 1.2rem}
.card h3{margin:0 0 .4rem;font-size:1.1rem}.card p{margin:0;color:var(--suave)}
.aviso{font-size:.9rem;color:var(--suave)}
footer{border-top:.0625rem solid var(--borda);padding:1.5rem 0 2.5rem;color:var(--suave);font-size:.9rem;display:flex;flex-wrap:wrap;gap:.75rem 1.5rem;justify-content:space-between}
.doc{max-width:46rem;padding:1rem 0 3rem}.doc h1{font-size:2rem;margin-bottom:1rem}.doc h2{font-size:1.3rem;margin:2rem 0 .5rem}.doc li{margin:.25rem 0}
"""


def head(t, titulo, desc, caminho, extras=""):
    url = f"https://{DOMINIO}{caminho}"
    alt = "".join(f'<link rel="alternate" hreflang="{h}" href="https://{DOMINIO}{c}">' for h, c in (("pt", "/"), ("en", "/en/"), ("es", "/es/")))
    return f"""<!doctype html>
<html lang="{t['lang']}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>{html.escape(titulo)}</title>
<meta name="description" content="{html.escape(desc)}">
<link rel="canonical" href="{url}">{alt}
<link rel="icon" href="/img/favicon.png" type="image/png">
<meta property="og:type" content="website"><meta property="og:title" content="{html.escape(titulo)}"><meta property="og:description" content="{html.escape(desc)}">
<meta property="og:image" content="https://{DOMINIO}/img/icone.png"><meta property="og:url" content="{url}">
<meta name="theme-color" content="#14181F">
<link rel="stylesheet" href="/style.css">{extras}
</head>
"""


def botao_loja(rotulo, url, t):
    if url:
        return f'<a class="btn" href="{url}" rel="noopener">{rotulo}</a>'
    return f'<span class="btn" aria-disabled="true" role="link"><small>{t["soon"]}</small>{rotulo}</span>'


def pagina(idioma):
    t = T[idioma]
    base = t["base"]
    recs = "".join(f'<div class="card"><h3>{html.escape(a)}</h3><p>{html.escape(b)}</p></div>' for a, b in t["rec"])
    outros = " · ".join(
        f'<a href="{c}">{n}</a>' for n, c in (("Português", "/"), ("English", "/en/"), ("Español", "/es/")) if c != base
    )
    return head(t, t["titulo"], t["desc"], base) + f"""<body>
<div class="wrap">
<div class="top"><span>{outros}</span></div>
<main>
<div class="hero">
<div>
<h1>{t['h1']}</h1>
<p class="pron">{t['pron']}</p>
<p class="tag">{html.escape(t['tag'])}</p>
<p class="sub">{html.escape(t['sub'])}</p>
<div class="btns">
{botao_loja(t['play'], LOJAS['play'], t)}
{botao_loja(t['appstore'], LOJAS['appstore'], t)}
<a class="btn primario" href="{REPO}/releases/latest"><small>Android 7+</small>{t['apk']}</a>
<a class="btn" href="{REPO}"><small>MIT</small>{t['gh']}</a>
</div>
</div>
<img src="/img/icone.png" alt="Nicska" width="512" height="512">
</div>
<section aria-labelledby="rec"><h2 id="rec">{t['h_rec']}</h2><div class="grade">{recs}</div></section>
<section aria-labelledby="priv"><h2 id="priv">{t['h_priv']}</h2><p>{html.escape(t['priv'])} <a href="/privacidade/">{t['priv_link']}</a>.</p></section>
<section aria-labelledby="apoio"><h2 id="apoio">{t['h_apoio']}</h2><p>{html.escape(t['apoio'])}</p><p><a class="btn" href="{SPONSORS}" rel="noopener">{t['apoio_btn']}</a></p></section>
<section><p class="aviso">{html.escape(t['aviso'])}</p></section>
</main>
<footer><span>© Nicska · {t['foot']}</span><span><a href="/privacidade/">{t['priv_t']}</a> · <a href="{REPO}">GitHub</a> · <a href="{SPONSORS}" rel="noopener">Sponsors</a></span></footer>
</div>
</body>
</html>
"""


def md_para_html(md):
    def inline(s):
        s = html.escape(s)
        s = re.sub(r"\*\*(.+?)\*\*", r"<strong>\1</strong>", s)
        s = re.sub(r"`(.+?)`", r"<code>\1</code>", s)
        s = re.sub(r"\[(.+?)\]\((https?://[^)]+)\)", r'<a href="\2" rel="noopener">\1</a>', s)
        s = re.sub(r"&lt;(https?://[^&]+)&gt;", r'<a href="\1" rel="noopener">\1</a>', s)
        return s.replace("*", "")
    out, lista = [], False
    for linha in md.splitlines():
        if linha.startswith("- "):
            if not lista:
                out.append("<ul>"); lista = True
            out.append(f"<li>{inline(linha[2:])}</li>")
            continue
        if lista:
            out.append("</ul>"); lista = False
        if linha.startswith("# "): out.append(f"<h1>{inline(linha[2:])}</h1>")
        elif linha.startswith("## "): out.append(f"<h2>{inline(linha[3:])}</h2>")
        elif linha.strip() == "---": out.append("<hr>")
        elif linha.strip(): out.append(f"<p>{inline(linha)}</p>")
    if lista: out.append("</ul>")
    return "\n".join(out)


def privacidade():
    t = T["pt"]
    corpo = md_para_html((RAIZ / "docs" / "privacidade.md").read_text(encoding="utf-8"))
    return head(t, "Política de privacidade · Nicska", "Política de privacidade do Nicska: o app não acessa a internet e seus dados ficam no aparelho.", "/privacidade/") + f"""<body>
<div class="wrap"><div class="top"><a href="/">← Nicska</a></div>
<main class="doc">{corpo}</main>
<footer><span>© Nicska · MIT</span><span><a href="{REPO}">GitHub</a></span></footer></div>
</body>
</html>
"""


def main():
    (SITE / "en").mkdir(parents=True, exist_ok=True)
    (SITE / "es").mkdir(parents=True, exist_ok=True)
    (SITE / "privacidade").mkdir(parents=True, exist_ok=True)
    (SITE / "style.css").write_text(CSS.strip() + "\n", encoding="utf-8")
    (SITE / "index.html").write_text(pagina("pt"), encoding="utf-8")
    (SITE / "en" / "index.html").write_text(pagina("en"), encoding="utf-8")
    (SITE / "es" / "index.html").write_text(pagina("es"), encoding="utf-8")
    (SITE / "privacidade" / "index.html").write_text(privacidade(), encoding="utf-8")
    (SITE / "CNAME").write_text(DOMINIO + "\n", encoding="utf-8")
    (SITE / ".nojekyll").write_text("", encoding="utf-8")
    (SITE / "robots.txt").write_text(f"User-agent: *\nAllow: /\nSitemap: https://{DOMINIO}/sitemap.xml\n", encoding="utf-8")
    urls = "".join(f"<url><loc>https://{DOMINIO}{c}</loc></url>" for c in ("/", "/en/", "/es/", "/privacidade/"))
    (SITE / "sitemap.xml").write_text(f'<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">{urls}</urlset>\n', encoding="utf-8")
    print("site/ gerado")


if __name__ == "__main__":
    main()
