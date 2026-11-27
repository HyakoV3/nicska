<script lang="ts">
  import { i18n } from "./i18n/index.svelte";
  import { lerQualidade, salvarQualidade } from "./preferencias";
  import Segmentos from "./Segmentos.svelte";
  import { ALTURAS, bytesEsperados, normalizarQualidade, taxasDa, type Qualidade } from "./video/formato";
  import { formatarEspaco } from "./video/politica";

  // A qualidade do vídeo: resolução (720p, 1080p ou, como opção avançada, 4K) e quadros por segundo (30 ou 60; 1080p e 4K só a 30). Quanto maior, mais espaço e mais calor; o aparelho
  // pode entregar menos que o pedido (o 4K recua para 1080p sem falhar).
  const t = (c: Parameters<typeof i18n.t>[0], p?: Record<string, string | number>) => i18n.t(c, p);
  let q = $state<Qualidade>(lerQualidade());
  const altura = $derived(q.altura);
  const fps = $derived(q.fps);
  const salvar = () => {
    q = normalizarQualidade($state.snapshot(q));
    salvarQualidade($state.snapshot(q));
  };
  const rotuloDaAltura = (a: number) => (a === 2160 ? t("video.opcao_4k") : `${a}p`);
</script>

<Segmentos id="video-altura" rotulo={t("video.resolucao")} opcoes={ALTURAS.map((a) => ({ valor: a, texto: rotuloDaAltura(a) }))} bind:valor={q.altura} aoMudar={salvar} />
<Segmentos id="video-fps" rotulo={t("video.taxa")} opcoes={taxasDa(altura).map((f) => ({ valor: f, texto: `${f} fps` }))} bind:valor={q.fps} aoMudar={salvar} />
<p class="meta">{t("video.estimativa", { espaco: formatarEspaco(bytesEsperados(30, { altura, fps }), i18n.idioma), minuto: formatarEspaco(bytesEsperados(60, { altura, fps }), i18n.idioma) })}</p>
<p class="meta">{t("video.qualidade_aviso")}</p>
{#if altura === 1080}<p class="meta" role="status">{t("video.aviso_1080")}</p>{/if}
{#if altura === 2160}<p class="meta" role="status">{t("video.aviso_4k")}</p>{/if}
