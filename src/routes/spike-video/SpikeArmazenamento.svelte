<script lang="ts">
  import { i18n } from "$lib/i18n/index.svelte";
  import { apagarBanco } from "$lib/spike/bancoSpike";
  import { ensaiarArmazenamento, type Alvo } from "$lib/spike/armazenamento";
  import { anexar, registrarErro, ultimoVideo } from "$lib/spike/estado.svelte";
  import type { Entrada } from "$lib/spike/relatorio";
  import { MIB, pedacosSinteticos } from "$lib/spike/sintetico";
  import SpikePasso from "./SpikePasso.svelte";

  // SPIKE passo 4 / S2 (EXPERIMENTAL, descartável): o vídeo no IndexedDB do spike (banco `nicska-spike`, separado do app), em bloco e em pedaços.
  const t = (c: Parameters<typeof i18n.t>[0], p?: Record<string, string | number>) => i18n.t(c, p);
  let ocupado = $state(false);
  let erro = $state<string | null>(null);
  let ultimo = $state<Entrada | null>(null);
  let aviso = $state<string | null>(null);

  async function ensaiar(alvo: Alvo) {
    ocupado = true;
    [erro, aviso] = [null, null];
    try {
      ultimo = await ensaiarArmazenamento(alvo);
      anexar("armazenamento", ultimo);
    } catch (e) {
      const falha = registrarErro("armazenamento", e);
      erro = t("spike.erro", { ...falha });
      anexar("armazenamento", { passo: "armazenamento", id: alvo.id, erro: falha });
    } finally {
      ocupado = false;
    }
  }

  function comOVideo() {
    if (!ultimoVideo.blob) return void (erro = t("spike.sem_video"));
    return ensaiar({ id: `video-${ultimoVideo.modo}`, blob: ultimoVideo.blob, pedacos: ultimoVideo.pedacos });
  }

  function comSintetico() {
    const pedacos = pedacosSinteticos(60 * MIB);
    return ensaiar({ id: "sintetico-60mb", blob: new Blob(pedacos, { type: "video/webm" }), pedacos });
  }

  async function apagar() {
    try {
      await apagarBanco();
      aviso = t("spike.p4.apagado");
    } catch (e) {
      erro = t("spike.erro", { ...registrarErro("armazenamento", e) });
    }
  }
</script>

<SpikePasso titulo={t("spike.p4.titulo")} texto={t("spike.p4.texto")} {ocupado} {erro} resultado={ultimo}>
  <button class="botao primario" onclick={comOVideo} disabled={ocupado}>{t("spike.p4.video")}</button>
  <button class="botao" onclick={comSintetico} disabled={ocupado}>{t("spike.p4.sintetico")}</button>
  <button class="botao perigo" onclick={apagar} disabled={ocupado}>{t("spike.p4.apagar")}</button>
  {#if aviso}<p role="status">{aviso}</p>{/if}
</SpikePasso>
