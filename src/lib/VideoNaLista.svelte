<script lang="ts">
  import VideoDaTentativa from "./VideoDaTentativa.svelte";
  import type { MetaDoVideo } from "./armazenamento/videos";
  import { armazenamento } from "./armazenamento";
  import { criarConfirmacao } from "./confirmacao";
  import type { TentativaGuardada } from "./documento";
  import { i18n } from "./i18n/index.svelte";
  import type { AtiradorDoOverlay } from "./video/overlay";

  // O vídeo de uma tentativa salva, no Histórico: "Ver o vídeo" (o player só é montado ao pedir: nada de abrir dezenas de vídeos ao listar), "Fixar" (a
  // retenção de Ajustes não o apaga; conceito só local) e "Apagar só o vídeo" (a tentativa fica), com a mesma confirmação em dois toques dos outros apagares.
  type Mensagem = { tipo: "sucesso" | "erro" | "info"; texto: string } | null;
  let { id, meta, disparosMs, tentativa, atirador, onmudou, onaviso }: {
    id: string;
    meta: MetaDoVideo;
    disparosMs: number[];
    /** O que o overlay do vídeo mostra além dos disparos: percurso, data, pontos e o selo de incompleta. */
    tentativa: Pick<TentativaGuardada, "percurso_id" | "data" | "pontos" | "incompleta">;
    /** De quem é a tentativa (avatar e nome no overlay). */
    atirador: AtiradorDoOverlay;
    /** O vídeo mudou (fixado, apagado): a lista relê as metas. */
    onmudou: () => void;
    onaviso: (a: Mensagem) => void;
  } = $props();
  const t = (c: Parameters<typeof i18n.t>[0], p?: Record<string, string | number>) => i18n.t(c, p);

  let vendo = $state(false);
  let confirmando = $state(false);
  const confirmacao = criarConfirmacao((armado) => (confirmando = armado !== null));
  $effect(() => () => confirmacao.cancelar());

  const erro = () => onaviso({ tipo: "erro", texto: t("revisao_video.erro_acao") });
  async function fixar() {
    await armazenamento.fixarVideo(id, !meta.fixado).then(onmudou, erro);
  }
  async function apagar() {
    if (!confirmacao.pedir(id)) return;
    vendo = false; // fecha o player (e revoga a URL) antes de o vídeo sumir
    await armazenamento
      .apagarVideo(id)
      .then(() => {
        onaviso({ tipo: "sucesso", texto: t("revisao_video.apagado") });
        onmudou();
      }, erro);
  }
</script>

{#if vendo}<VideoDaTentativa {id} {disparosMs} pontos={tentativa.pontos ?? null} incompleta={tentativa.incompleta === true} percursoId={tentativa.percurso_id} data={tentativa.data} {atirador} />{/if}
<div class="acoes-video">
  <button class="botao" aria-expanded={vendo} onclick={() => (vendo = !vendo)}>{vendo ? t("revisao_video.fechar") : t("revisao_video.ver")}</button>
  <!-- A estrela é decorativa: o estado vai no aria-pressed e no texto ("fixado" aparece também no resumo da tentativa). -->
  <button class="botao" aria-pressed={meta.fixado} onclick={fixar}><span aria-hidden="true">{meta.fixado ? "★" : "☆"}</span> {t("revisao_video.fixar")}</button>
  <button class="botao perigo" class:confirmar={confirmando} onclick={apagar}>{confirmando ? t("revisao_video.apagar_mesmo") : t("revisao_video.apagar")}</button>
</div>
<p class="meta">{t("revisao_video.fixar_ajuda")}</p>

<style>
  .acoes-video { display: flex; flex-wrap: wrap; gap: 0.5rem; }
  .acoes-video .botao { flex: 1; }
  .meta { margin: 0; }
</style>
