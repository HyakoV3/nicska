<script lang="ts">
  import { i18n } from "./i18n/index.svelte";
  import { PARTES_DO_OVERLAY, lerOverlay, salvarOverlay, type PrefsOverlay } from "./preferencias";

  // Ajustes → Overlay do vídeo: o geral (o mesmo botão que fica embaixo do vídeo) e cada parte do que aparece sobre ele. Foto e nome desligados = dá para
  // mostrar o vídeo sem identificar quem atira. Sem posição ajustável nesta fatia: os blocos ficam no padrão (cabeçalho no alto, avatar embaixo à esquerda,
  // tempos embaixo à direita); escolher a posição de cada bloco fica para depois (achado 26 da revisão do vídeo).
  const t = (c: Parameters<typeof i18n.t>[0], p?: Record<string, string | number>) => i18n.t(c, p);
  let prefs = $state<PrefsOverlay>(lerOverlay());
  const mudar = (k: keyof PrefsOverlay, v: boolean) => {
    prefs[k] = v;
    salvarOverlay($state.snapshot(prefs));
  };
  const ROTULOS = {
    avatar: "ajustes.overlay_avatar",
    nome: "ajustes.overlay_nome",
    cabecalho: "ajustes.overlay_cabecalho",
    splits: "ajustes.overlay_splits",
    marca: "ajustes.overlay_marca",
  } as const satisfies Record<(typeof PARTES_DO_OVERLAY)[number], Parameters<typeof i18n.t>[0]>;
</script>

<p class="meta">{t("ajustes.overlay_ajuda")}</p>
<label class="opcao geral"><input type="checkbox" checked={prefs.ligado} onchange={(e) => mudar("ligado", e.currentTarget.checked)} /> <span>{t("ajustes.overlay_ligado")}</span></label>
<!-- Com o geral desligado as partes ficam travadas (mas lembradas): voltam como estavam ao religar. -->
<fieldset class="partes" disabled={!prefs.ligado}>
  <legend>{t("ajustes.overlay_partes")}</legend>
  {#each PARTES_DO_OVERLAY as k (k)}
    <label class="opcao"><input type="checkbox" checked={prefs[k]} onchange={(e) => mudar(k, e.currentTarget.checked)} /> <span>{t(ROTULOS[k])}</span></label>
  {/each}
</fieldset>
<p class="meta">{t("ajustes.overlay_privacidade")}</p>

<style>
  .meta { margin: 0.4rem 0; }
  .opcao { display: flex; align-items: center; gap: 0.6rem; min-height: 3rem; }
  .opcao input { width: 1.5rem; height: 1.5rem; flex: none; }
  .geral { font-weight: 600; }
  .partes { margin: 0.4rem 0; padding: 0; border: 0; display: grid; gap: 0.2rem; }
  .partes legend { padding: 0; margin-bottom: 0.3rem; font-size: 0.9rem; color: var(--suave); }
  .partes:disabled { opacity: 0.6; }
</style>
