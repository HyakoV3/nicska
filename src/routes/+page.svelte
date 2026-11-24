<script lang="ts">
  import { onMount, tick } from "svelte";
  import { arquivoRecebido } from "$lib/compartilhar";
  import Abas from "$lib/Abas.svelte";
  import Barra from "$lib/Barra.svelte";
  import Historico from "$lib/Historico.svelte";
  import Icone from "$lib/Icone.svelte";
  import Timer from "$lib/Timer.svelte";
  import { i18n } from "$lib/i18n/index.svelte";
  import { inicio, type AbaInicio } from "$lib/inicio.svelte";
  import { limparOrfaosAoAbrir } from "$lib/video/limpezaDeOrfaos";

  const t = (c: Parameters<typeof i18n.t>[0], p?: Record<string, string | number>) => i18n.t(c, p);

  // As abas da tela inicial. A rolagem é da página (não de um contêiner): ao trocar de aba, ela guarda a posição da que sai e restaura a da que entra.
  const ABAS: AbaInicio[] = ["timer", "historico"];
  const ROTULOS = { timer: "inicio.aba_timer", historico: "inicio.aba_historico" } as const;
  // Arquivo mandado abrir por outro app (WhatsApp, gerenciador de arquivos): vai para a aba Histórico, que o importa. Busca ao abrir e ao voltar ao primeiro plano.
  function buscarArquivoRecebido() {
    const texto = arquivoRecebido();
    if (texto === null) return;
    inicio.recebido = texto;
    void trocarAba("historico");
  }
  onMount(() => {
    limparOrfaosAoAbrir();
    buscarArquivoRecebido();
    const aoVoltar = () => document.visibilityState === "visible" && buscarArquivoRecebido();
    document.addEventListener("visibilitychange", aoVoltar);
    return () => document.removeEventListener("visibilitychange", aoVoltar);
  });
  async function trocarAba(id: string) {
    const nova = id as AbaInicio;
    if (nova === inicio.aba) return;
    inicio.rolagem[inicio.aba] = window.scrollY;
    inicio.aba = nova;
    await tick();
    window.scrollTo(0, inicio.rolagem[nova]);
  }
</script>

<!-- O título do documento é o que leitores de tela anunciam a cada troca de tela. -->
<svelte:head><title>{t(ROTULOS[inicio.aba])} · Nicska</title></svelte:head>

<Barra titulo={t("app.nome_curto")} logo="/favicon.png">
  {#snippet acao()}
    <!-- Botão só de ícone (engrenagem); o nome "Ajustes" vai no rótulo de acessibilidade e na dica. -->
    <a class="botao botao-icone" href="/ajustes" aria-label={t("nav.ajustes")} title={t("nav.ajustes")}>
      <Icone nome="ajustes" tamanho={26} />
    </a>
  {/snippet}
</Barra>

<main class="coluna conteudo">
  <!-- Os painéis ficam montados (só um visível): o que está em andamento numa aba não se perde ao trocar de outra. -->
  <!-- O painel do Timer não usa `hidden`: o próprio Timer esconde o conteúdo (`.timer[hidden]`) e deixa a barra fixa do Parar/Cancelar à vista em todas as abas enquanto há Standby ou escuta em andamento. -->
  <div role="tabpanel" id="painel-timer" aria-labelledby="aba-timer">
    <Timer ativa={inicio.aba === "timer"} />
  </div>
  <div role="tabpanel" id="painel-historico" aria-labelledby="aba-historico" hidden={inicio.aba !== "historico"}>
    <Historico ativa={inicio.aba === "historico"} />
  </div>
</main>

<!-- As abas ficam embaixo (ao alcance do polegar); com o celular deitado, numa barra lateral à esquerda. -->
<Abas
  abas={ABAS.map((id) => ({ id, rotulo: t(ROTULOS[id]) }))}
  selecionada={inicio.aba}
  aoSelecionar={trocarAba}
  rotulo={t("inicio.abas")}
/>

<style>
  .botao-icone { min-width: 3rem; padding: 0; }
</style>
