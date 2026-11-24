// Leitor mínimo de WebM/Matroska só para áudio Opus: acha o cabeçalho `OpusHead` (CodecPrivate) e a lista de pacotes. É o que o remux para Ogg precisa (docs/archive/ideia-enviar-audio-por-app.md).
// Os elementos "mestre" (Segment, Tracks, TrackEntry, Cluster, BlockGroup) são percorridos por dentro, sem usar o tamanho: assim o tamanho desconhecido
// (que o MediaRecorder do Chrome escreve ao gravar ao vivo) não atrapalha. Os demais são pulados pelo tamanho. Arquivo cortado no fim: usa o que deu para ler.

import { lerElemento, lerInteiro, lerTamanho, texto, type Elemento } from "./webm/ebml";

/** `descarte`: amostras (48 kHz) do fim do último bloco que não são áudio (DiscardPadding). */
export type OpusEmWebm = { cabecalho: Uint8Array; pacotes: Uint8Array[]; descarte: number };

const ID_TRACK_ENTRY = 0xae;
const MESTRES = new Set([0x18538067, 0x1654ae6b, ID_TRACK_ENTRY, 0x1f43b675, 0xa0]);
const ID = { codec: 0x86, privado: 0x63a2, numero: 0xd7, bloco: 0xa3, blocoGrupo: 0xa1, descarte: 0x75a2 };

/** Estado da leitura: a faixa Opus escolhida, a faixa que está sendo lida (TrackEntry aberto) e o que já foi coletado. */
type Leitura = {
  entrada: Uint8Array;
  faixaOpus: number;
  faixaAtual: number;
  codecAtual: string;
  privado: Uint8Array | null;
  cabecalho: Uint8Array | null;
  pacotes: Uint8Array[];
  descarte: number;
};
/** O conteúdo de um elemento-folha. `completo`: o elemento não foi cortado no fim do arquivo. */
type Folha = { dados: Uint8Array; completo: boolean };
/** Trata um elemento-folha. `false` aborta a leitura toda (resultado `null`). */
type TratarFolha = (l: Leitura, folha: Folha) => boolean;
type Bloco = { faixa: number; lacing: boolean; carga: Uint8Array };

const PARAR = -1; // fim da leitura, usando o que já foi lido
const ABORTAR = -2; // arquivo que não se entende

const novaLeitura = (entrada: Uint8Array): Leitura => ({ entrada, faixaOpus: -1, faixaAtual: -1, codecAtual: "", privado: null, cabecalho: null, pacotes: [], descarte: 0 });

/** Um TrackEntry novo (ou um bloco) fecha o anterior: se for a primeira faixa Opus, guarda o número e o `OpusHead`. */
function fechaFaixa(l: Leitura): void {
  if (l.codecAtual === "A_OPUS" && l.faixaOpus < 0 && l.faixaAtual >= 0) {
    l.faixaOpus = l.faixaAtual;
    l.cabecalho = l.privado;
  }
  l.faixaAtual = -1;
  l.codecAtual = "";
  l.privado = null;
}

/** Cabeçalho do (Simple)Block: número da faixa, flag de lacing e o pacote. `null` se for curto demais. */
function lerBloco(dados: Uint8Array): Bloco | null {
  const num = lerTamanho(dados, 0);
  if (!num || dados.length < num.n + 3) return null;
  return { faixa: num.v, lacing: (dados[num.n + 2]! & 0x06) !== 0, carga: dados.subarray(num.n + 3) };
}

/** Bloco na faixa Opus vira pacote (só se não foi cortado); lacing não é tratado e bloco de outra faixa é pulado. */
function registrarBloco(l: Leitura, { dados, completo }: Folha): boolean {
  fechaFaixa(l);
  const bloco = l.faixaOpus < 0 ? null : lerBloco(dados);
  if (!bloco) return false;
  if (bloco.faixa !== l.faixaOpus) return true;
  if (bloco.lacing) return false;
  if (completo) l.pacotes.push(bloco.carga);
  return true;
}

/** DiscardPadding: inteiro com sinal, em nanossegundos: o fim do último bloco que o player deve ignorar. */
function registrarDescarte(l: Leitura, { dados }: Folha): boolean {
  if (dados.length > 0 && dados.length <= 6) l.descarte = Math.max(0, Math.round((lerInteiro(dados, true) * 48) / 1000000));
  return true;
}

const FOLHAS = new Map<number, TratarFolha>([
  [ID.codec, (l, { dados }) => ((l.codecAtual = texto(dados)), true)],
  [ID.privado, (l, { dados }) => ((l.privado = dados), true)],
  [ID.descarte, registrarDescarte],
  [ID.numero, (l, { dados }) => ((l.faixaAtual = lerInteiro(dados)), true)],
  [ID.bloco, registrarBloco],
  [ID.blocoGrupo, registrarBloco],
]);

/** Mestre: entra por dentro (os dados são os elementos seguintes). Um TrackEntry novo fecha o anterior. */
function entrarNoMestre(l: Leitura, { id, ini }: Elemento): number {
  if (id === ID_TRACK_ENTRY) fechaFaixa(l);
  return ini;
}

/** Folha: trata os dados e pula pelo tamanho. */
function tratarElemento(l: Leitura, { id, tam, ini }: Elemento): number {
  if (tam < 0) return ABORTAR; // tamanho desconhecido num elemento que não é mestre: não é um arquivo que se entenda
  const fim = Math.min(ini + tam, l.entrada.length);
  const ok = FOLHAS.get(id)?.(l, { dados: l.entrada.subarray(ini, fim), completo: fim - ini === tam }) ?? true;
  return ok ? fim : ABORTAR;
}

/** Lê o elemento em `i` e devolve a posição do próximo, `PARAR` ou `ABORTAR`. */
function avancar(l: Leitura, i: number): number {
  const el = lerElemento(l.entrada, i);
  if (!el) return PARAR;
  return MESTRES.has(el.id) ? entrarNoMestre(l, el) : tratarElemento(l, el);
}

/** Devolve o Opus do WebM, ou `null` se não for WebM com áudio Opus (ou se usar "lacing", que o Chrome não usa). */
export function lerOpusDoWebm(b: Uint8Array): OpusEmWebm | null {
  const l = novaLeitura(b);
  let i = 0;
  while (i >= 0 && i < b.length) i = avancar(l, i);
  if (i === ABORTAR) return null;
  fechaFaixa(l);
  if (!l.cabecalho || l.pacotes.length === 0 || !opusHeadValido(l.cabecalho)) return null;
  return { cabecalho: l.cabecalho, pacotes: l.pacotes, descarte: l.descarte };
}

/** `OpusHead` (RFC 7845 §5.1): versão 0, ao menos 1 canal e, se o mapeamento não for o 0, a tabela de canais inteira. */
export function opusHeadValido(c: Uint8Array): boolean {
  if (c.length < 19 || String.fromCharCode(...c.subarray(0, 8)) !== "OpusHead") return false;
  if ((c[8]! >> 4) !== 0 || c[9] === 0) return false;
  return c[18] === 0 || c.length >= 21 + c[9]!;
}
