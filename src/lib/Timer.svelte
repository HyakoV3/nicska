<script lang="ts">
  import { onMount } from "svelte";
  import Aviso from "./Aviso.svelte";
  import AvisoVoz from "./AvisoVoz.svelte";
  import DicaPrimeiroUso from "./DicaPrimeiroUso.svelte";
  import BarraFixa from "./BarraFixa.svelte";
  import Revisao from "./Revisao.svelte";
  import SeletorPercurso from "./SeletorPercurso.svelte";
  import TelaCheia from "./TelaCheia.svelte";
  import TimerAjustes from "./TimerAjustes.svelte";
  import TimerVivo from "./TimerVivo.svelte";
  import { tocarDescartavel, type montarTentativa } from "./registro";
  import { Apito } from "./apito";
  import { ESPERA_MAXIMA_DAS_BATIDAS_MS, GRACA_DO_CANCELAR_MS } from "./batidas";
  import { Escuta } from "./escuta";
  import { i18n } from "./i18n/index.svelte";
  import { ouvirBatidas } from "./ouvirBatidas";
  import { ultimaTaxaDoSensor } from "./taxaDoSensor";
  import { lerRegistro, lerTimer, salvarTimer, type PrefsTimer } from "./preferencias";
  import type { Timer, Instantaneo } from "./timer";
  import { criarTimerDoApp, diagnosticoDaEscuta, opcoesDeVideoDoApp, salvarResultado } from "./timerDoApp";
  import { cancelarAoEsconder, interromperVideoAoEsconder, ligarServicoAndroid } from "./timerCicloDeVida";
  import { armazenamento } from "./armazenamento";
  import { GravadorDeVideo } from "./video/gravadorDeVideo";
  import { anuncioDoTimer } from "./timerTexto";
  import { abrirTelaCheia, comecarNaTelaCheia, faseAposTimer, sairDaTelaCheia, type FaseDaTelaCheia } from "./video/telaCheia";

  // A aba Timer: o botão grande, o estado em texto (nunca só cor), o tempo do último disparo em dígitos grandes, o contador e os splits ao vivo.
  // O leitor de tela ouve só o Standby, o fim e o resultado (`anuncio`); nada no apito nem durante a escuta.
  let { ativa = true }: { ativa?: boolean } = $props();
  const t = (c: Parameters<typeof i18n.t>[0], p?: Record<string, string | number>) => i18n.t(c, p);

  const vazio: Instantaneo = { estado: "parado", erro: null, atrasoMs: null, disparosMs: [], inicio: null, avisoDeFone: false, resultado: null };
  let snap = $state<Instantaneo>(vazio);
  let prefs = $state<PrefsTimer>(lerTimer());
  let percursoId = $state<string | null>(null);
  let pontosMaximos = $state<number | undefined>(undefined);
  let timer: Timer | null = null;
  let escuta: Escuta | null = null;
  /** O vídeo da tentativa (modo Áudio + vídeo); só grava se o Standby pedir (`opcoesDeVideoDoApp`). */
  let video: GravadorDeVideo | null = null;
  /** A câmera da tela cheia (modo vídeo): o Standby a empresta ao gravador do vídeo. */
  let fluxoDaPrevia = $state<MediaStream | null>(null);
  /** A tela cheia do modo vídeo (V2b): fechada na aba normal; o passo segue o Timer depois do Começar (video/telaCheia.ts). */
  let tela = $state<FaseDaTelaCheia>("fechada");
  /** O Android assumiu a escuta com o serviço em primeiro plano: ela segue com a tela bloqueada. Senão para ao esconder o app. */
  let protegida = false;

  onMount(() => {
    const e = new Escuta();
    escuta = e;
    const apito = new Apito({ compartilhado: true, contexto: () => e.contexto! });
    const v = new GravadorDeVideo(armazenamento);
    video = v;
    const tm = criarTimerDoApp({ escuta: e, apito, video: v, aoProteger: (p) => (protegida = p) });
    tm.aoMudar = (i) => {
      snap = i;
      tela = faseAposTimer(tela, i.estado); // fim, cancelar ou erro fecham a tela cheia e voltam à aba (Revisão ou aviso)
    };
    timer = tm;
    // App em segundo plano: a escuta para, a menos que o serviço do Android a tenha assumido (`protegida`).
    const soltarEsconder = cancelarAoEsconder(tm, () => protegida);
    const soltarServico = ligarServicoAndroid(tm, (p) => (protegida = p));
    const soltarVideo = interromperVideoAoEsconder(v);
    return () => {
      soltarEsconder();
      soltarServico();
      soltarVideo();
      tm.cancelar();
      e.soltar();
    };
  });

  // Batidas (I-01): o acelerômetro espera um padrão de batidas no celular. Usado para INICIAR (2 ou 3 batidas, timer parado) e para CANCELAR (1 batida, durante a espera
  // antes do apito: um apito que ninguém esperava, no meio da linha, é o pior caso). A tela fica ligada enquanto espera (`wakeLock`), porque a WebView para de ler
  // sensores com a tela apagada, e por isso a espera de início tem limite de tempo.
  let sensor = $state<"esperando" | "ok" | "sem">("esperando");
  let batidasEsgotadas = $state(false);
  /** A taxa real do `devicemotion` (Hz), medida na escuta das batidas; fica a última (diagnóstico). */
  let taxaSensor = $state<number | null>(ultimaTaxaDoSensor());

  // Iniciar: timer parado, aba aberta. Vibra uma vez (80 ms) ao entender. Recomeça sozinho a cada uso do timer.
  $effect(() => {
    const alvo = prefs.batidas;
    if (!ativa || !alvo || snap.estado !== "parado") return;
    sensor = "esperando";
    batidasEsgotadas = false;
    return ouvirBatidas(
      alvo,
      () => {
        navigator.vibrate?.(80);
        standby();
      },
      { esgotarEm: ESPERA_MAXIMA_DAS_BATIDAS_MS, aoEsgotar: () => (batidasEsgotadas = true), aoSensor: (e) => (sensor = e), aoTaxa: (hz) => (taxaSensor = hz) },
    );
  });

  // Cancelar: durante a espera antes do apito, uma batida (ou o botão) cancela. Vibra duas vezes curtas, diferente da de iniciar.
  $effect(() => {
    if (!ativa || !prefs.batidas || snap.estado !== "atraso") return;
    return ouvirBatidas(
      1,
      () => {
        navigator.vibrate?.([40, 60, 40]);
        timer?.cancelar();
      },
      { graciaMs: GRACA_DO_CANCELAR_MS, aoSensor: (e) => (sensor = e), aoTaxa: (hz) => (taxaSensor = hz) },
    );
  });
  // Diagnóstico para o teste no estande (Etapa 7): o que o aparelho realmente deu à escuta. Lido quando a escuta começa; fica até a próxima.
  let diag = $state<{ taxa: number; filtros: boolean | null; saidaMs: number } | null>(null);
  $effect(() => {
    if (snap.estado === "escutando") diag = diagnosticoDaEscuta(escuta) ?? diag;
  });

  const ocupado = $derived(["preparando", "atraso", "apito", "escutando"].includes(snap.estado));
  const textoDoEstado = $derived(t(`timer.estado_${snap.estado}` as Parameters<typeof t>[0]));

  // O que o leitor de tela ouve: só o Standby ao armar e o resultado ao terminar (vazio no apito e na escuta).
  const anuncio = $derived(anuncioDoTimer(snap, textoDoEstado, { t, idioma: i18n.idioma }));

  /** Guarda a tentativa como ficou na revisão (e o áudio, se houver) no percurso escolhido. */
  const salvar = (rev: Parameters<typeof montarTentativa>[2], id: string) => salvarResultado({ r: snap.resultado, percursoId, video }, rev, id);

  /** Ainda há o que salvar no resultado (vem da Revisao): a Nova tentativa só vira a principal depois. */
  let salvarPendente = $state(false);
  /** Há uma tentativa NÃO salva no resultado: a Nova tentativa pede um 2º toque para jogá-la fora. */
  let naoSalva = $state(false);
  let descartando = $state(false);
  function nova() {
    const r = tocarDescartavel(naoSalva, descartando);
    descartando = r.armado;
    if (r.executa) standby();
  }
  $effect(() => {
    if (!naoSalva || snap.estado !== "resultado") descartando = false;
  });

  function iniciar() {
    void timer?.iniciar($state.snapshot(prefs), opcoesDeVideoDoApp(fluxoDaPrevia));
  }
  /** O Standby (botão, batidas, Nova tentativa): no modo vídeo abre a tela cheia para enquadrar e a tentativa só começa no Começar; no só áudio, já. */
  function standby() {
    if (lerRegistro().modo === "video") tela = abrirTelaCheia(tela);
    else iniciar();
  }
  /** Começar, na tela cheia: o Standby de verdade, com a câmera dela emprestada ao gravador. */
  function comecar() {
    tela = comecarNaTelaCheia(tela);
    iniciar();
  }
  function botao() {
    if (ocupado) void timer?.parar();
    else standby();
  }
  function mudarPref<K extends keyof PrefsTimer>(k: K, v: PrefsTimer[K]) {
    prefs = { ...prefs, [k]: v };
    if (k === "atrasoMinMs" && prefs.atrasoMaxMs < (v as number)) prefs.atrasoMaxMs = v as number;
    if (k === "atrasoMaxMs" && prefs.atrasoMinMs > (v as number)) prefs.atrasoMinMs = v as number;
    salvarTimer($state.snapshot(prefs));
  }
</script>

<!-- A ação principal fica FIXA logo acima das abas: Standby, Parar/Cancelar ou, no resultado, Nova tentativa. Com o timer ocupado (atraso ou escuta) o Parar/Cancelar
     aparece em TODAS as abas (CONS-009): quem troca de aba no meio do Standby ainda o alcança. Parado ou no resultado, só na aba Timer. -->
{#if ativa || ocupado}
  <BarraFixa>
    {#if snap.estado === "resultado"}
      <button class="botao grande-botao" class:primario={!salvarPendente && !descartando} class:secundario={salvarPendente && !descartando} class:perigo={descartando} class:confirmar={descartando} onclick={nova}>{descartando ? t("timer.nova_mesmo") : t("timer.nova")}</button>
    {:else}
      <button class="botao grande-botao" class:primario={!ocupado} class:perigo={ocupado} onclick={botao} disabled={snap.estado === "preparando"}>
        {ocupado ? t(snap.estado === "escutando" ? "timer.parar" : "timer.cancelar") : t("timer.standby")}
      </button>
    {/if}
  </BarraFixa>
{/if}
{#if tela !== "fechada"}
  <TelaCheia fase={tela} {snap} {anuncio} {percursoId} bind:fluxo={fluxoDaPrevia} gravador={() => video} agoraDaEscutaS={() => escuta?.contexto?.currentTime ?? null}
    aoComecar={comecar} aoSair={() => (tela = sairDaTelaCheia(tela))} aoCancelar={() => timer?.cancelar()} aoParar={() => void timer?.parar()} />
{/if}
{#snippet seletorDePercurso()}
  <!-- Remonta ao voltar para a aba: a lista de percursos pode ter mudado no Histórico. -->
  {#key ativa}<SeletorPercurso bind:percursoId bind:pontosMaximos desabilitado={ocupado} />{/key}
{/snippet}
<!-- O conteúdo fica montado e só escondido nas outras abas: a Revisão não perde edições nem pontuação ao trocar de aba. -->
<div class="timer" class:escutando={snap.estado === "escutando"} hidden={!ativa}>
    <p class="so-leitor" role="status">{anuncio}</p>

    <p class="estado" aria-hidden="true">{textoDoEstado}</p>
    {#if ativa && prefs.batidas && snap.estado === "parado"}
      <p class="meta dica" role="status">{batidasEsgotadas ? t("timer.batidas_esgotadas") : sensor === "sem" ? t("timer.sem_sensor") : t("timer.aguardando_batidas", { n: prefs.batidas })}</p>
    {:else if ativa && prefs.batidas && snap.estado === "atraso"}
      <p class="meta dica" role="status">{t("timer.batida_cancela")}</p>
    {/if}

    {#if snap.estado === "erro" && snap.erro}
      <Aviso tipo="erro">{t(`timer.erro_${snap.erro}` as Parameters<typeof t>[0])}</Aviso>
    {/if}
    {#if snap.avisoDeFone}<Aviso tipo="info">{t("timer.aviso_fone")}</Aviso>{/if}
    <DicaPrimeiroUso parado={snap.estado === "parado"} />
    <AvisoVoz standby={ocupado} voz={prefs.standbyVoz} aoDesligar={() => mudarPref("standbyVoz", false)} />

    {#if snap.estado === "resultado" && snap.resultado}
      {#key snap.resultado}
        <Revisao resultado={snap.resultado} aoPendente={(p) => (salvarPendente = p)} aoNaoSalva={(n) => (naoSalva = n)} aoDescartar={() => timer?.descartar()} aoSalvar={salvar} temPercurso={percursoId !== null} {percursoId} pontosMaximos={pontosMaximos} seletor={seletorDePercurso} />
      {/key}
    {:else}
      <TimerVivo {snap} />
    {/if}

    {#if snap.estado === "parado" || snap.estado === "erro"}
      {@render seletorDePercurso()}
    {/if}

    {#if snap.estado === "erro"}<button class="botao" onclick={() => timer?.descartar()}>{t("timer.fechar")}</button>{/if}

    <TimerAjustes {prefs} {ocupado} {mudarPref} {diag} {taxaSensor} />
</div>

<style>
  .timer { display: grid; gap: 0.6rem; }
  .timer[hidden] { display: none; }
  .estado { margin: 0.4rem 0 0; text-align: center; font-size: 1.1rem; font-weight: 600; }
  .dica { margin: 0; text-align: center; }
  .grande-botao { min-height: 4.5rem; font-size: 1.4rem; }
</style>
