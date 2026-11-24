<script lang="ts">
  import Aviso from "./Aviso.svelte";
  import Segmentos from "./Segmentos.svelte";
  import { i18n } from "./i18n/index.svelte";
  import { lerAvisoVideoVisto, lerRegistro, salvarAvisoVideoVisto, salvarRegistro, type Registro } from "./preferencias";

  // Ajustes → Registro (V2b): como registrar a tentativa, "Só áudio" (padrão, celular no bolso) ou "Áudio + vídeo" (tripé ou alguém filmando), e a câmera,
  // traseira ou frontal. Saiu da aba Cronômetro para ela ficar limpa: lá só o Standby, que no modo vídeo abre a câmera em tela cheia para enquadrar. Lembrado
  // (`salvarRegistro`). Escolher Áudio + vídeo pela primeira vez mostra o aviso de privacidade (o mesmo, visto uma vez só, do enquadrar).
  let { aoMudar }: { aoMudar?: (r: Registro) => void } = $props();
  const t = (c: Parameters<typeof i18n.t>[0], p?: Record<string, string | number>) => i18n.t(c, p);

  let registro = $state<Registro>(lerRegistro());
  let avisoPrivacidade = $state(false);

  function mudar(r: Registro) {
    registro = r;
    salvarRegistro($state.snapshot(r));
    aoMudar?.(r);
  }
  function escolherModo(modo: Registro["modo"]) {
    mudar({ ...registro, modo });
    if (modo !== "video" || lerAvisoVideoVisto()) return;
    salvarAvisoVideoVisto(); // conta como visto já ao aparecer, como o AvisoVoz
    avisoPrivacidade = true;
  }
</script>

<p class="meta">{t("ajustes.registro_ajuda")}</p>
<Segmentos id="registro-modo" rotulo={t("registro.rotulo")} opcoes={[{ valor: "audio", texto: t("registro.so_audio") }, { valor: "video", texto: t("registro.audio_video") }]} valor={registro.modo} aoMudar={escolherModo} />
{#if avisoPrivacidade && registro.modo === "video"}
  <Aviso tipo="info">
    <p class="msg">{t("registro.privacidade")}</p>
    <button class="botao" onclick={() => (avisoPrivacidade = false)}>{t("registro.privacidade_entendi")}</button>
  </Aviso>
{/if}
<!-- A câmera fica escolhível mesmo em Só áudio: vale para quando o modo vídeo for ligado. -->
<Segmentos id="registro-camera" rotulo={t("registro.camera")} opcoes={[{ valor: "traseira", texto: t("registro.traseira") }, { valor: "frontal", texto: t("registro.frontal") }]} valor={registro.camera} aoMudar={(camera) => mudar({ ...registro, camera })} />
{#if registro.modo === "video"}<p class="meta">{t("registro.distancia")}</p>{/if}

<style>
  .meta { margin: 0.4rem 0; }
  .msg { margin: 0 0 0.6rem; }
</style>
