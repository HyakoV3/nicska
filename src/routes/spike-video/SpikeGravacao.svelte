<script lang="ts">
  import { i18n } from "$lib/i18n/index.svelte";
  import { anexar, registrarErro } from "$lib/spike/estado.svelte";
  import { executarGravacao } from "$lib/spike/gravacao";
  import type { Entrada } from "$lib/spike/relatorio";
  import { MODOS, type Modo } from "$lib/spike/restricoes";
  import SpikePasso from "./SpikePasso.svelte";

  // SPIKE passo 3 (EXPERIMENTAL, descartável): o teste principal. O mesmo procedimento em 3 modos, com o detector contando as palmas.
  const t = (c: Parameters<typeof i18n.t>[0], p?: Record<string, string | number>) => i18n.t(c, p);
  let previa = $state<HTMLVideoElement>();
  let segundos = $state(30);
  let ocupado = $state(false);
  let erro = $state<string | null>(null);
  let ultimo = $state<Entrada | null>(null);
  let estalos = $state(0);
  let tempo = $state(0);
  let total = $state(30);
  let pronto = $state<string | null>(null);

  async function rodar(modo: Modo) {
    if (!previa) return;
    ocupado = true;
    erro = null;
    pronto = null;
    [estalos, tempo, total] = [0, 0, segundos];
    try {
      ultimo = await executarGravacao({ modo, segundos, lado: "environment", previa, aoEstalo: (n) => (estalos = n), aoTempo: (s) => (tempo = s) });
      anexar("gravacoes", ultimo);
      pronto = t("spike.p3.pronto", { n: estalos });
    } catch (e) {
      const falha = registrarErro("gravacao", e);
      erro = t("spike.erro", { ...falha });
      anexar("gravacoes", { passo: "gravacao", modo, erro: falha });
    } finally {
      ocupado = false;
    }
  }
</script>

<SpikePasso titulo={t("spike.p3.titulo")} texto={t("spike.p3.texto")} {erro} resultado={ultimo}>
  <fieldset class="duracao" disabled={ocupado}>
    <legend>{t("spike.p3.duracao")}</legend>
    {#each [30, 180] as s}
      <label class:ativo={segundos === s}>
        <input type="radio" name="duracao" value={s} bind:group={segundos} />
        <span>{t(s === 30 ? "spike.p3.d30" : "spike.p3.d180")}</span>
      </label>
    {/each}
  </fieldset>
  {#each MODOS as modo}
    <button class="botao primario" onclick={() => rodar(modo)} disabled={ocupado}>{t(`spike.p3.modo.${modo}`)}</button>
  {/each}
  {#if ocupado}<p class="gravando" role="status">{t("spike.p3.gravando", { s: tempo, total, n: estalos })}</p>{/if}
  {#if pronto}<p role="status">{pronto}</p>{/if}
</SpikePasso>
<!-- svelte-ignore a11y_media_has_caption -->
<video class="previa" class:oculta={!ocupado} bind:this={previa} muted playsinline></video>

<style>
  .duracao { display: flex; gap: 0.5rem; flex: 1 1 100%; margin: 0; padding: 0; border: 0; }
  legend { padding: 0; font-size: 0.9rem; color: var(--suave); }
  .duracao label { position: relative; flex: 1; }
  .duracao input { position: absolute; opacity: 0; inset: 0; width: 100%; height: 100%; margin: 0; cursor: pointer; }
  .duracao span {
    display: flex; align-items: center; justify-content: center; min-height: 3rem; box-sizing: border-box; border-radius: 0.75rem;
    border: 0.0625rem solid var(--borda-controle); background: var(--superficie); color: var(--texto);
  }
  .duracao .ativo span { border: 0.125rem solid var(--acento); font-weight: 700; }
  .gravando { flex: 1 1 100%; margin: 0; font-weight: 700; color: var(--tempo-ativo); }
  .previa { display: block; width: 100%; max-height: 14rem; margin: -0.6rem 0 1.2rem; border-radius: 0.75rem; object-fit: contain; }
  .oculta { display: none; }
</style>
