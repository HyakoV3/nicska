// A montagem do Timer da aba (src/lib/Timer.svelte): liga a máquina de estados (timer.ts) à escuta, ao apito, ao serviço do Android e aos relógios reais.
import { armazenamento } from "./armazenamento";
import { montarTentativa, novoId } from "./registro";
import { atrasoDeSaida, type Apito } from "./apito";
import { motivoDoErro } from "./audioComum";
import { avisoTresDois, PADRAO_PARTIDA } from "./vibracao321";
import type { Escuta } from "./escuta";
import { lerQualidade, lerRegistro, lerRetencao, type PrefsTimer } from "./preferencias";
import { armarServico, desarmarServico, foneConectado } from "./servico";
import { Timer, type Dependencias, type OpcoesDeVideo, type Resultado } from "./timer";
import type { GravadorDeVideo } from "./video/gravadorDeVideo";

/** ISO 8601 com o fuso do aparelho ("2026-11-22T10:00:00-03:00"). */
export function agoraIso(d = new Date()): string {
  const dois = (n: number) => String(n).padStart(2, "0");
  const off = -d.getTimezoneOffset();
  const sinal = off >= 0 ? "+" : "-";
  return `${d.getFullYear()}-${dois(d.getMonth() + 1)}-${dois(d.getDate())}T${dois(d.getHours())}:${dois(d.getMinutes())}:${dois(d.getSeconds())}${sinal}${dois(Math.floor(Math.abs(off) / 60))}:${dois(Math.abs(off) % 60)}`;
}

/** O aviso de que o Standby começou: vibração longa (250 ms, diferente das de iniciar e cancelar por batida) e, se ligado, um bipe curto de outro tom. */
export function avisoDoStandby(apito: Apito): (p: PrefsTimer) => Promise<number> {
  return async (p) => {
    const v = p.vibracao321 ? avisoTresDois() : null; // em 3/2/1 os toques tomam o lugar da vibração longa e o atraso só conta depois deles
    if (v) navigator.vibrate?.(v.padrao);
    else if (p.standbyVibrar) navigator.vibrate?.(250);
    const som = p.standbyVoz ? await apito.falar() : p.standbyBipe ? await apito.avisar() : 0; // a voz tem precedência sobre o bipe; se não carregar, devolve 0
    return Math.max(som, v?.duracaoMs ?? 0);
  };
}

/** O 1 toque do sinal de partida (só em 3/2/1). Começa no instante agendado do apito; o apito real sai um pouco depois (latência de saída), então é uma estimativa. */
export const vibrarPartida = (p: PrefsTimer): void => void (p.vibracao321 && navigator.vibrate?.([...PADRAO_PARTIDA]));

/** Interrompe qualquer vibração em curso (cancelar). */
export const pararVibracao = (): void => void navigator.vibrate?.(0);

/** Relógio real: agenda `fn` e devolve o cancelamento. */
const emTimeout = (ms: number, fn: () => void) => {
  const id = setTimeout(fn, ms);
  return () => clearTimeout(id);
};

/** O que o aparelho realmente deu à escuta (para o teste no estande, Etapa 7); nulo antes de ela começar. */
export function diagnosticoDaEscuta(escuta: Escuta | null): { taxa: number; filtros: boolean | null; saidaMs: number } | null {
  const ctx = escuta?.contexto;
  if (!escuta || !ctx) return null;
  return { taxa: escuta.taxa, filtros: escuta.filtrosDesligados, saidaMs: Math.round(atrasoDeSaida(ctx) * 1000) };
}

/** Liga e solta o serviço Android; `aoProteger(true)`: ele assumiu a escuta com o serviço em primeiro plano (ela segue com a tela bloqueada). */
function servicoDoApp(aoProteger: (protegida: boolean) => void): Pick<Dependencias, "armarServico" | "desarmarServico"> {
  const armarServico_ = () => {
    const protegida = armarServico();
    aoProteger(protegida);
    return protegida;
  };
  const desarmarServico_ = () => {
    aoProteger(false);
    desarmarServico();
  };
  return { armarServico: armarServico_, desarmarServico: desarmarServico_ };
}

type PecasDoTimer = { escuta: Escuta; apito: Apito; video?: GravadorDeVideo; aoProteger: (protegida: boolean) => void };

/** Cria o Timer com as dependências reais. */
export function criarTimerDoApp({ escuta, apito, video, aoProteger }: PecasDoTimer): Timer {
  return new Timer({
    escuta,
    apito,
    video,
    novoId,
    em: emTimeout,
    sortear: Math.random,
    ...servicoDoApp(aoProteger),
    avisar: avisoDoStandby(apito),
    vibrarPartida,
    pararVibracao,
    foneConectado,
    motivoDoErro,
    agoraIso: () => agoraIso(),
  });
}

/**
 * O modo de registro escolhido (Ajustes → Registro): as opções do vídeo para o `Timer.iniciar`, ou nulo no modo só áudio. Lido a cada Standby.
 * `fluxoDaCamera`: a câmera da tela cheia, que o gravador usa em vez de abrir a câmera de novo (o Android não abre a mesma câmera duas vezes).
 */
export function opcoesDeVideoDoApp(fluxoDaCamera?: MediaStream | null): OpcoesDeVideo | null {
  const r = lerRegistro();
  if (r.modo !== "video") return null;
  return { camera: r.camera, qualidade: lerQualidade(), ...(fluxoDaCamera && { fluxoDaCamera }) };
}

type Salvamento = { r: Resultado | null; percursoId: string | null; video?: GravadorDeVideo | null };

/** Guarda a tentativa como ficou na revisão (e o áudio, se houver) no percurso escolhido; o vídeo dela (mesmo id) fica e a retenção de Ajustes é aplicada. */
export async function salvarResultado({ r, percursoId, video }: Salvamento, rev: Parameters<typeof montarTentativa>[2], id: string): Promise<void> {
  if (!r || !percursoId) throw new Error("sem percurso");
  const tentativa = await montarTentativa(r, percursoId, rev, id);
  await armazenamento.salvarTentativa(tentativa, r.audio ? { blob: r.audio.blob, tipo: r.audio.tipo, segundos: r.audio.segundos } : undefined);
  await video?.confirmar(id, lerRetencao(), rev.zeroNoAudioS); // nunca lança: uma limpeza que falha não desfaz o salvar
}
