<script lang="ts">
  import BotaoSegurar from "./BotaoSegurar.svelte";
  import Janela from "./Janela.svelte";
  import OverlayAoVivo from "./OverlayAoVivo.svelte";
  import Previa from "./Previa.svelte";
  import { i18n } from "./i18n/index.svelte";
  import { registrarNivel } from "./navegacao";
  import { soltarOrientacao, travarOrientacao } from "./orientacao";
  import { lerAvisoEnquadrarVisto, lerAvisoVideoVisto, lerRegistro, salvarAvisoEnquadrarVisto, salvarAvisoVideoVisto } from "./preferencias";
  import { manterTelaAcesa } from "./telaAcesa";
  import { manterImersivo } from "./telaImersiva";
  import type { Instantaneo } from "./timer";
  import { chaveDoSemVideo } from "./video/avisos";
  import { acaoDoBotao, acaoDoVoltar, type FaseDaTelaCheia } from "./video/telaCheia";

  // A tela cheia do modo vídeo (V2b), por cima de tudo (<dialog> modal: camada de cima, o resto fica inerte). Passo 1, enquadrar: a câmera ocupa a tela, o
  // aviso de distância, o de privacidade na primeira vez e Começar / Sair. Passo 2, depois do Começar: o Standby de verdade (o Timer, com o fluxo desta câmera
  // emprestado ao gravador), o overlay AO VIVO por cima e um botão só, no fundo, no centro (a faixa de baixo do overlay, com avatar, splits e cronômetro, sobe acima dele; o cabeçalho fica no alto):
  // antes do apito um toque cancela, correndo é preciso segurar. As regras são puras (video/telaCheia.ts). Enquanto aberta: tela acesa, barras do sistema
  // escondidas e, depois do Começar, orientação travada (C8); tudo solto ao fechar, com erro ou não (os `$effect` desfazem ao desmontar).
  type Acoes = { aoComecar: () => void; aoSair: () => void; aoCancelar: () => void; aoParar: () => void };
  let { fase, snap, anuncio, agoraDaEscutaS, percursoId, fluxo = $bindable(null), aoComecar, aoSair, aoCancelar, aoParar }: Acoes & {
    fase: FaseDaTelaCheia;
    snap: Instantaneo;
    /** O que o leitor de tela ouve (o mesmo da aba: Standby e resultado), aqui dentro porque o resto da página fica inerte. */
    anuncio: string;
    agoraDaEscutaS: () => number | null;
    percursoId: string | null;
    fluxo?: MediaStream | null;
  } = $props();
  const t = (c: Parameters<typeof i18n.t>[0], p?: Record<string, string | number>) => i18n.t(c, p);

  const camera = lerRegistro().camera;
  const enquadrar = $derived(fase === "enquadrar");
  const botao = $derived(acaoDoBotao(fase));
  let caixa = $state<HTMLDialogElement | null>(null);
  // O aviso do enquadramento (distância, tela acesa e, se ainda não foi visto em Ajustes, a privacidade): UMA vez só, numa janela no meio da tela. Conta como visto já ao
  // aparecer (como o AvisoVoz); tocar fora, no Entendi ou no Voltar fecha, e a pessoa segue para Começar ou Sair. Depois dessa vez, a tela mostra só os dois botões.
  const primeiraVez = !lerAvisoEnquadrarVisto();
  const comPrivacidade = primeiraVez && !lerAvisoVideoVisto();
  if (primeiraVez) salvarAvisoEnquadrarVisto();
  if (comPrivacidade) salvarAvisoVideoVisto();
  let aviso = $state(primeiraVez);

  // Começa sozinho: com o aviso (se houver) fechado, o Standby parte quando a câmera da prévia estiver pronta; se ela demorar ou falhar, parte assim mesmo
  // (o gravador abre a câmera, ou segue só com o áudio e avisa). Quem não quer, toca em Sair.
  const ESPERA_DA_CAMERA_MS = 8000;
  $effect(() => {
    if (!enquadrar || aviso) return;
    if (fluxo) return void aoComecar();
    const relogio = setTimeout(aoComecar, ESPERA_DA_CAMERA_MS);
    return () => clearTimeout(relogio);
  });

  // A dica "segure para parar": ao soltar cedo ou no Voltar com a tentativa correndo; some sozinha.
  let dica = $state(false);
  let relogioDaDica: ReturnType<typeof setTimeout> | null = null;
  function mostrarDica() {
    dica = true;
    if (relogioDaDica) clearTimeout(relogioDaDica);
    relogioDaDica = setTimeout(() => (dica = false), 4000);
  }
  $effect(() => () => void (relogioDaDica && clearTimeout(relogioDaDica)));

  /** O Voltar do Android e o Esc: o que a regra mandar para o passo de agora. */
  function voltar() {
    const a = acaoDoVoltar(fase);
    if (a === "sair") aoSair();
    else if (a === "cancelar") aoCancelar();
    else if (a === "dica") mostrarDica();
    return a;
  }
  // Um nível de Voltar enquanto aberta. Correndo, o Voltar só mostra a dica: o nível saiu da pilha, então `voltas` o registra de novo.
  let voltas = $state(0);
  $effect(() => {
    void voltas;
    return registrarNivel(() => {
      if (voltar() === "dica") voltas++;
    });
  });

  // Aberta enquanto montada. O navegador pode fechar um <dialog> sozinho (Esc repetido, que ele não deixa segurar para sempre): aí ela reabre, porque quem
  // fecha esta camada é o Timer (fim, cancelar, erro) ou o Sair, desmontando-a.
  let desmontando = false;
  $effect(() => {
    caixa?.showModal();
    return () => {
      desmontando = true;
      caixa?.close();
    };
  });
  const aoFechar = () => !desmontando && caixa && !caixa.open && caixa.showModal();
  $effect(() => {
    const tela = manterTelaAcesa();
    const barras = manterImersivo();
    return () => {
      tela.soltar();
      barras.soltar();
    };
  });
  $effect(() => {
    if (enquadrar) return;
    travarOrientacao();
    return soltarOrientacao;
  });
  const cancelarEvento = (e: Event) => {
    e.preventDefault(); // o Esc passa por aqui: quem decide é a regra do Voltar
    voltar();
  };
</script>

<dialog bind:this={caixa} class="tela-cheia" aria-label={t("tela_video.aria")} oncancel={cancelarEvento} onclose={aoFechar}>
  <Previa {camera} ocupado={!enquadrar} bind:fluxo />
  <p class="so-leitor" role="status">{anuncio}</p>

  {#if enquadrar}
    <!-- Sem "Começar": o Standby já foi pedido na aba. A câmera abre aqui (a permissão também) e, pronta, o Standby começa sozinho; até lá só há o Sair, grande, no fundo. -->
    <div class="canto"><button class="segurar-igual" onclick={aoSair}>{t("tela_video.sair")}</button></div>
    {#if aviso}
      <Janela titulo={t("tela_video.enquadrar")} onfechar={() => (aviso = false)}>
        <p>{t("tela_video.distancia")}</p>
        <p>{t("tela_video.tela_acesa")}</p>
        {#if comPrivacidade}<p>{t("registro.privacidade")}</p>{/if}
        <button class="botao primario" onclick={() => (aviso = false)}>{t("registro.privacidade_entendi")}</button>
      </Janela>
    {/if}
  {:else}
    <OverlayAoVivo {snap} {agoraDaEscutaS} {percursoId} />
    {#if snap.semVideo}<p class="aviso-video" role="status">{t(chaveDoSemVideo(snap.semVideo))}</p>{/if}
    <div class="canto">
      {#if botao}<BotaoSegurar acao={botao} {aoCancelar} {aoParar} aoCedo={mostrarDica} />{/if}
      {#if dica}<p class="dica" role="status">{t("tela_video.segure_dica")}</p>{/if}
    </div>
  {/if}
</dialog>

<style>
  /* A tela inteira, fundo preto (a câmera em `contain` deixa faixas). Texto claro sobre o preto; as caixas do overlay têm fundo próprio. */
  .tela-cheia {
    position: fixed; inset: 0; width: 100%; height: 100%; max-width: none; max-height: none; margin: 0; padding: 0; border: 0;
    background: black; color: white; overflow: hidden; box-sizing: border-box;
  }
  .tela-cheia::backdrop { background: black; }
  /* O botão no fundo, no centro (onde se espera o de parar de uma câmera); a faixa de baixo do overlay sobe acima dele (`reservaBaixo`), e a dica fica logo acima do botão. */
  .canto {
    position: absolute; bottom: max(0.8rem, env(safe-area-inset-bottom)); left: max(0.8rem, env(safe-area-inset-left)); right: max(0.8rem, env(safe-area-inset-right));
    display: flex; flex-direction: column-reverse; align-items: center; justify-content: flex-end; gap: 0.4rem;
  }
  .canto :global(button) { width: min(100%, 22rem); }
  .segurar-igual {
    display: grid; place-items: center; min-height: 4rem; padding: 0 1rem; box-sizing: border-box; border-radius: 1rem; border: 0.1875rem solid white;
    background: rgb(0 0 0 / 0.55); color: white; font-size: 1.3rem; font-weight: 700; cursor: pointer;
  }
  .segurar-igual:focus-visible { outline: 0.25rem solid var(--foco); outline-offset: 0.2rem; }
  :global(:root[data-tema="alto-contraste"]) .segurar-igual { background: black; }
  .dica, .aviso-video { margin: 0; padding: 0.5rem 0.7rem; border-radius: 0.6rem; background: black; color: white; border: 0.125rem solid white; font-weight: 600; }
  .aviso-video { position: absolute; left: max(0.8rem, env(safe-area-inset-left)); right: max(0.8rem, env(safe-area-inset-right)); top: max(0.8rem, env(safe-area-inset-top)); }
</style>
