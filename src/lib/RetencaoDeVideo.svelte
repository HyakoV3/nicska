<script lang="ts">
  import { trilha } from "./trilha";
  import { onMount } from "svelte";
  import { armazenamento } from "./armazenamento";
  import Aviso from "./Aviso.svelte";
  import { i18n } from "./i18n/index.svelte";
  import { lerLimpezaDeOrfaos, lerQualidade, lerRetencao, salvarLimpezaDeOrfaos, salvarRetencao } from "./preferencias";
  import Segmentos from "./Segmentos.svelte";
  import { INICIO_DA_SESSAO } from "./video/limpezaDeOrfaos";
  import { bytesEsperados } from "./video/formato";
  import { ESPACO_DE_VIDEO, PRAZOS_DE_VIDEO, formatarEspaco, type LimitesDeVideo } from "./video/politica";

  // A retenção dos vídeos: quanto espaço reservar (controle deslizante) e por quanto tempo guardar (7 dias, 1 mês, 3 meses ou sem prazo). O que passar do prazo ou do espaço é
  // apagado, do mais antigo ao mais novo, depois de cada gravação; os fixados ficam. "Apagar agora" aplica o que está escolhido, sem esperar a próxima gravação.
  const t = (c: Parameters<typeof i18n.t>[0], p?: Record<string, string | number>) => i18n.t(c, p);
  let limites = $state<LimitesDeVideo>(lerRetencao());
  let ocupado = $state({ videos: 0, bytes: 0 });
  let resultado = $state("");
  let soltos = $state(lerLimpezaDeOrfaos());
  let resultadoSoltos = $state("");
  let erro = $state(false);
  const salvar = () => salvarRetencao($state.snapshot(limites));
  const rotuloDoPrazo = (d: number | null) => (d === null ? t("video.sem_prazo") : d === 7 ? t("video.prazo_7") : d === 30 ? t("video.prazo_30") : t("video.prazo_90"));
  /** Quantos vídeos de 30 s cabem no espaço escolhido, na qualidade de agora. */
  const cabem = $derived(Math.floor(limites.bytes / bytesEsperados(30, lerQualidade())));

  const ler = async () => {
    try {
      ocupado = await armazenamento.resumoDosVideos();
    } catch {
      erro = true;
    }
  };
  onMount(ler);

  async function apagarAgora() {
    resultado = "";
    try {
      const ids = await armazenamento.limparVideos($state.snapshot(limites));
      resultado = t("video.apagados", { n: ids.length });
      await ler();
    } catch {
      erro = true;
    }
  }

  /** Apaga já os vídeos soltos (sem tentativa salva, ou nunca terminados), mantendo as cercas de segurança da abertura. */
  async function limparSoltos() {
    resultadoSoltos = "";
    try {
      const r = await armazenamento.limparOrfaos(INICIO_DA_SESSAO);
      resultadoSoltos = t("video.soltos_limpos", { n: r.n, espaco: formatarEspaco(r.bytes, i18n.idioma) });
      if (r.n > 0) {
        soltos = { ...r, quando: Date.now() };
        salvarLimpezaDeOrfaos(soltos);
      }
      await ler();
    } catch {
      erro = true;
    }
  }
</script>

<label class="espaco">
  <span class="rotulo-grupo">{t("video.espaco")}: <strong>{formatarEspaco(limites.bytes, i18n.idioma)}</strong></span>
  <input type="range" use:trilha={limites.bytes} min={ESPACO_DE_VIDEO.min} max={ESPACO_DE_VIDEO.max} step={ESPACO_DE_VIDEO.passo} bind:value={limites.bytes} onchange={salvar} />
</label>
<p class="meta">{t("video.cabem", { n: cabem })}</p>

<Segmentos id="video-prazo" rotulo={t("video.prazo")} opcoes={PRAZOS_DE_VIDEO.map((d) => ({ valor: d, texto: rotuloDoPrazo(d) }))} bind:valor={limites.dias} aoMudar={salvar} />

<p class="meta ocupado">{t("video.ocupado", { n: i18n.tn("plural.videos", ocupado.videos), espaco: formatarEspaco(ocupado.bytes, i18n.idioma) })}</p>
<button type="button" class="botao" onclick={apagarAgora}>{t("video.apagar_agora")}</button>
{#if resultado}<p class="meta" role="status">{resultado}</p>{/if}
<button type="button" class="botao" onclick={limparSoltos}>{t("video.soltos_limpar")}</button>
{#if resultadoSoltos}<p class="meta" role="status">{resultadoSoltos}</p>{:else if soltos}<p class="meta">{t("video.soltos_apagados", { n: soltos.n, espaco: formatarEspaco(soltos.bytes, i18n.idioma) })}</p>{/if}
{#if erro}<Aviso tipo="erro">{t("video.erro")}</Aviso>{/if}
<p class="meta">{t("video.retencao_aviso")}</p>

<style>
  .espaco { display: grid; gap: 0.3rem; margin-top: 0.4rem; }
  .rotulo-grupo { font-size: 0.9rem; color: var(--suave); }
  .rotulo-grupo strong { color: var(--texto); }

  .ocupado { margin-top: 0.9rem; }
</style>
