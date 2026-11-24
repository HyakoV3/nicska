<script lang="ts">
  import { i18n } from "$lib/i18n/index.svelte";
  import { anexar, registrarErro, ultimoVideo } from "$lib/spike/estado.svelte";
  import { compartilharVideoDeTeste } from "$lib/spike/compartilhar";
  import { ponte } from "$lib/compartilhar/ponte";
  import { extensaoDoMime } from "$lib/spike/mime";
  import { nomeDoVideoDeTeste, type Entrada } from "$lib/spike/relatorio";
  import SpikePasso from "./SpikePasso.svelte";

  // SPIKE passo 5 / S2 (EXPERIMENTAL, descartável): compartilhar o vídeo sem passar por `prepararOgg`, e anotar se tocou no app de destino.
  const t = (c: Parameters<typeof i18n.t>[0], p?: Record<string, string | number>) => i18n.t(c, p);
  let ocupado = $state(false);
  let erro = $state<string | null>(null);
  let ultimo = $state<Entrada | null>(null);
  let nota = $state("");

  async function compartilhar() {
    const blob = ultimoVideo.blob;
    if (!blob) return void (erro = t("spike.sem_video"));
    ocupado = true;
    erro = null;
    try {
      const nome = nomeDoVideoDeTeste(ultimoVideo.modo, new Date(), extensaoDoMime(blob.type));
      ultimo = { passo: "compartilhar", ponteNativaExiste: !!ponte(), ...(await compartilharVideoDeTeste(blob, nome)) };
      anexar("compartilhar", ultimo);
    } catch (e) {
      erro = t("spike.erro", { ...registrarErro("compartilhar", e) });
    } finally {
      ocupado = false;
    }
  }

  function anotar() {
    if (!nota.trim()) return;
    anexar("compartilhar", { passo: "compartilhar", nota: nota.trim().slice(0, 500) });
    nota = "";
  }
</script>

<SpikePasso titulo={t("spike.p5.titulo")} texto={t("spike.p5.texto")} {ocupado} {erro} resultado={ultimo}>
  <button class="botao primario" onclick={compartilhar} disabled={ocupado}>{t("spike.p5.botao")}</button>
  <label class="nota">
    <span class="meta">{t("spike.p5.nota")}</span>
    <input type="text" bind:value={nota} maxlength="500" />
  </label>
  <button class="botao" onclick={anotar} disabled={!nota.trim()}>{t("spike.p5.anotar")}</button>
</SpikePasso>

<style>
  .nota { display: grid; gap: 0.25rem; flex: 1 1 100%; }
  input {
    min-height: 3rem; box-sizing: border-box; padding: 0 0.6rem; font-size: 1rem; border-radius: 0.75rem;
    border: 0.0625rem solid var(--borda-controle); background: var(--superficie); color: var(--texto);
  }
</style>
