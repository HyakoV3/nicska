// A máquina de estados do timer: parado → preparando ("Standby") → atraso → apito → escutando → resultado, com cancelar em qualquer ponto.
// Sem navegador nem relógio de verdade: a escuta, o apito, o serviço Android e os temporizadores entram como dependências, e os testes usam falsos.
//
// O instante zero da tentativa é o início do apito COMO O MICROFONE O OUVIU (anula a latência de saída). Se o apito não foi ouvido (com fone, ou
// abafado), usa-se o instante agendado mais a latência de saída e marca-se `inicio: "estimado"`.
//
// Os tipos e constantes estão em timerTipos.ts (reexportados aqui); a fase de escuta, os temporizadores e a montagem do resultado, em colaboradores.
import type { PrefsTimer } from "./preferencias";
import type { Agenda } from "./timerAgenda";
import { criarColaboradores } from "./timerColaboradores";
import type { Acao, FaseDeEscuta } from "./timerFase";
import type { Painel } from "./timerPainel";
import { abrirEscuta, avisarSemFalha, pararEscuta, sortearAtraso } from "./timerPartida";
import { montarResultado } from "./timerResultado";
import {
  DURACAO_DO_APITO_MS, ESPERA_DO_APITO_MS, TEMPO_MAXIMO_MS,
  type Dependencias, type Instantaneo, type OpcoesDeVideo,
} from "./timerTipos";

export * from "./timerTipos";
export { sortearAtraso } from "./timerPartida";

export class Timer {
  /** Chamado a cada mudança, com uma cópia do estado (a tela guarda no `$state`). */
  aoMudar: ((i: Instantaneo) => void) | null = null;

  private readonly agenda: Agenda;
  private readonly fase: FaseDeEscuta;
  private readonly painel: Painel;
  /** Muda a cada tentativa e a cada cancelamento: o que ainda esperava uma tentativa antiga vê o número mudado e se descarta. */
  private geracao = 0;
  private inicioIso = "";
  /** O id da tentativa em andamento: nasce no Standby para o vídeo ser guardado com ele desde o começo. */
  private id = "";
  private prefs: PrefsTimer | null = null;
  private encerrando = false;
  /** O que fazer com cada ação que a fase de escuta devolve para um evento. */
  private readonly acoes = {
    reabrir: () => this.d.escuta.reabrirApito?.(), // não é o nosso apito: o detector continua procurando o verdadeiro
    comecar: (a: { tempo: number }) => this.comecarAEscutar(a.tempo, "detectado"),
    /** O microfone ou o áudio foram tirados do app (ligação, outro app): a tentativa em andamento termina com erro. */
    interromper: () => {
      if (!this.ocupado) return;
      // Com tiros já detectados, vale o que há: o resultado sai marcado como incompleto (CONS-023). Antes da escuta ou sem tiros, não há o que guardar: é erro.
      if (this.painel.atual.estado === "escutando" && this.painel.atual.disparosMs.length > 0) return void this.encerrar(true);
      this.geracao++;
      this.liberar();
      this.painel.mudar({ estado: "erro", erro: "audio_perdido" });
    },
    disparo: (a: { ms: number }) => {
      this.painel.mudar({ disparosMs: [...this.painel.atual.disparosMs, a.ms] });
      this.agenda.reiniciarSilencio(this.prefs!.silencioMs, () => void this.parar());
    },
  };

  /** A tentativa `minha` ainda é a vigente (não foi cancelada nem substituída)? */
  private readonly ehVigente = (minha: number) => minha === this.geracao;

  /** Executa a ação que a fase de escuta devolveu para um evento (nenhuma, se a fase o ignora). */
  private readonly despachar = (a: Acao) => a && (this.acoes[a.acao] as (x: typeof a) => void)(a);

  constructor(private readonly d: Dependencias) {
    ({ agenda: this.agenda, fase: this.fase, painel: this.painel } = criarColaboradores(d, (i) => this.aoMudar?.(i)));
    d.escuta.aoEvento = (e) => this.despachar(this.encerrando ? null : this.fase.classificar(e, this.painel.atual.estado));
    d.escuta.aoInterromper = this.acoes.interromper;
  }

  get instantaneo(): Instantaneo {
    return this.painel.atual;
  }

  /** Há uma tentativa em andamento (do Standby ao fim da escuta)? */
  get ocupado(): boolean {
    return ["preparando", "atraso", "apito", "escutando"].includes(this.painel.atual.estado);
  }

  /**
   * O botão grande: começa uma tentativa. Chamar a partir de um toque (o áudio só inicia depois de um gesto). Com `video`, grava também o vídeo
   * (a câmera abre depois do microfone; se falhar, segue só com áudio e `semVideo` diz por quê). Um vídeo da tentativa anterior não salvo é apagado.
   */
  async iniciar(prefs: PrefsTimer, video: OpcoesDeVideo | null = null): Promise<void> {
    if (this.ocupado) return;
    const minha = ++this.geracao;
    this.prefs = prefs;
    this.fase.reiniciar();
    this.encerrando = false;
    this.agenda.cancelarTudo();
    void this.d.video?.cancelar();
    const fone = this.d.foneConectado();
    this.inicioIso = this.d.agoraIso();
    this.id = this.d.novoId();
    this.painel.recomecar({ estado: "preparando", avisoDeFone: fone });
    const erro = await abrirEscuta(this.d, { prefs, fone, minha, vigente: this.ehVigente });
    if (erro === "obsoleta") return;
    if (erro) {
      this.liberar();
      return this.painel.mudar({ estado: "erro", erro });
    }
    if (video && !(await this.abrirVideo(minha, video))) return;
    await this.esperarOApito(minha);
  }

  /** Abre a câmera e começa o vídeo (o pré-roll é o próprio atraso do Standby, C5). Falso se a tentativa foi cancelada enquanto a câmera abria. */
  private async abrirVideo(minha: number, video: OpcoesDeVideo): Promise<boolean> {
    const inicioDoAudioMs = this.d.escuta.inicioDaGravacaoMs ?? undefined;
    const pedido = { id: this.id, audio: this.d.escuta.fluxoDoMicrofone ?? null, ...video, ...(inicioDoAudioMs !== undefined && { inicioDoAudioMs }) };
    const semVideo = this.d.video ? await this.d.video.iniciar(pedido) : "falhou";
    if (minha !== this.geracao) return false;
    if (semVideo) this.painel.mudar({ semVideo });
    return true;
  }

  /** Arma o serviço, sorteia o atraso, faz o aviso do Standby ("STAND BY" na tela já está) e agenda o apito; se o microfone não o ouvir a tempo (ou com fone, que nunca o ouve), o início passa a ser o instante agendado. */
  private async esperarOApito(minha: number): Promise<void> {
    const prefs = this.prefs!;
    this.d.armarServico();
    const atrasoMs = sortearAtraso({ minMs: prefs.atrasoMinMs, maxMs: prefs.atrasoMaxMs }, this.d.sortear());
    this.painel.mudar({ estado: "atraso", atrasoMs });
    // O atraso de 1 a 4 s conta do FIM do aviso, como a regra pede (entre o comando e o sinal).
    const aviso = await avisarSemFalha(this.d, prefs);
    if (minha !== this.geracao) return;
    const agendado = await this.d.apito.agendar((aviso + atrasoMs) / 1000);
    if (minha !== this.geracao || !agendado) return; // cancelado enquanto o áudio iniciava
    this.fase.definirApito(agendado.quando, agendado.atraso);
    const fone = this.painel.atual.avisoDeFone;
    this.agenda.agendar(aviso + atrasoMs, () => {
      if (this.painel.atual.estado === "atraso") this.painel.mudar({ estado: "apito" });
      this.d.vibrarPartida?.(prefs);
    });
    this.agenda.agendar(aviso + atrasoMs + (fone ? DURACAO_DO_APITO_MS : ESPERA_DO_APITO_MS), () => {
      if (this.fase.podeEstimar(this.painel.atual.estado)) this.comecarAEscutar(this.fase.estimado!, "estimado");
    });
  }

  private comecarAEscutar(zero: number, inicio: "detectado" | "estimado"): void {
    const antes = this.fase.comecar(zero);
    this.painel.mudar({ estado: "escutando", inicio, disparosMs: antes, zeroS: zero });
    this.agenda.reiniciarSilencio(this.prefs!.silencioMs, () => void this.parar());
    this.agenda.agendar(TEMPO_MAXIMO_MS, () => void this.parar());
  }
  /** O botão "Parar": na escuta, encerra e mostra o resultado; antes dela, é o mesmo que cancelar. */
  async parar(): Promise<void> {
    if (this.painel.atual.estado !== "escutando") return this.cancelar();
    return this.encerrar(false);
  }

  /** Para a escuta e mostra o resultado. `incompleta`: a escuta foi cortada com tiros já feitos; entrega o que foi detectado e o áudio parcial (se o gravador ainda o tem), marcado como incompleto (a parada do gravador então pode falhar). */
  private async encerrar(incompleta: boolean): Promise<void> {
    if (this.encerrando) return;
    this.encerrando = true;
    const minha = this.geracao;
    this.agenda.cancelarTudo();
    this.d.apito.cancelar();
    // O vídeo para junto (e antes) do áudio: o gravador dele pede o fim enquanto a faixa do microfone ainda está aberta.
    const [, audio] = await Promise.all([this.d.video?.parar(), pararEscuta(this.d, incompleta)]);
    if (minha !== this.geracao) return;
    this.d.desarmarServico();
    const resultado = montarResultado({ id: this.id, inicioIso: this.inicioIso, estado: this.painel.atual, prefs: this.prefs!, audio, zero: this.fase.zero, ...(incompleta && { incompleta }) });
    this.painel.mudar({ estado: "resultado", resultado });
  }

  /** Cancela a tentativa em qualquer ponto: nada é guardado e o microfone volta ao aparelho. */
  cancelar(): void {
    this.geracao++;
    this.liberar();
    this.painel.recomecar();
  }

  /** Fecha o resultado e volta ao início. */
  descartar(): void {
    const e = this.painel.atual.estado;
    if (e === "resultado" || e === "erro") this.cancelar();
  }

  private liberar(): void {
    this.encerrando = true;
    this.agenda.cancelarTudo();
    this.d.apito.cancelar();
    this.d.pararVibracao?.();
    void this.d.video?.cancelar();
    this.d.escuta.soltar();
    this.d.desarmarServico();
  }
}
