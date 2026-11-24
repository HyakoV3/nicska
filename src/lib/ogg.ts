// Escreve um arquivo Ogg/Opus (RFC 7845) a partir dos pacotes Opus: é um "remux", o áudio não é recodificado. Páginas com CRC (RFC 3533),
// `OpusHead` e `OpusTags` cada um na sua página, granule position em amostras a 48 kHz contando o pre-skip.
import { crcOgg } from "./ogg/crc";
import { lerOpusDoWebm, opusHeadValido, type OpusEmWebm } from "./webm";

export { crcOgg };

/** Duração de um pacote Opus em amostras a 48 kHz, pelo byte TOC (RFC 6716 §3.1). 0 se o pacote for inválido. */
export function amostrasDoPacote(p: Uint8Array): number {
  if (p.length === 0) return 0;
  const toc = p[0]!;
  const cfg = toc >> 3;
  const quadro = cfg < 12 ? [480, 960, 1920, 2880][cfg % 4]! : cfg < 16 ? [480, 960][cfg % 2]! : [120, 240, 480, 960][cfg % 4]!;
  const c = toc & 3;
  const n = c === 0 ? 1 : c < 3 ? 2 : p.length > 1 ? p[1]! & 0x3f : 0;
  return n === 0 || n * quadro > 5760 ? 0 : n * quadro; // até 120 ms por pacote (RFC 6716 §3.2.5)
}

const PACOTES_POR_PAGINA = 50;
const SEGMENTOS_POR_PAGINA = 255;
/** Número do fluxo lógico (qualquer um serve; só há um fluxo no arquivo). */
const SERIE_DO_FLUXO = 0x42494d55;
/** Quantos valores de lacing o pacote usa. */
const segmentosDe = (p: Uint8Array) => Math.floor(p.length / 255) + 1;

type DadosPagina = { tipo: number; granule: number; serie: number; seq: number; pacotes: Uint8Array[] };

/** Valores de lacing da página: cada pacote vira N x 255 e o resto (sempre há um valor < 255 no fim). */
function valoresDeLacing(pacotes: Uint8Array[]): number[] {
  const segs: number[] = [];
  for (const p of pacotes) {
    for (let r = p.length; r >= 255; r -= 255) segs.push(255);
    segs.push(p.length % 255);
  }
  if (segs.length > SEGMENTOS_POR_PAGINA) throw new Error("pacote grande demais para uma página");
  return segs;
}

/** Cabeçalho fixo da página (27 bytes + tabela de lacing); o CRC fica zerado. */
function cabecalhoDaPagina({ tipo, granule, serie, seq }: DadosPagina, segs: number[]): Uint8Array {
  const out = new Uint8Array(27 + segs.length);
  const v = new DataView(out.buffer);
  out.set([0x4f, 0x67, 0x67, 0x53, 0, tipo], 0);
  v.setUint32(6, granule % 0x100000000, true);
  v.setUint32(10, Math.floor(granule / 0x100000000), true);
  v.setUint32(14, serie, true);
  v.setUint32(18, seq, true);
  out[26] = segs.length;
  out.set(segs, 27);
  return out;
}

/** Junta os pedaços num só `Uint8Array`. */
function concatenar(partes: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(partes.reduce((s, p) => s + p.length, 0));
  let o = 0;
  for (const p of partes) {
    out.set(p, o);
    o += p.length;
  }
  return out;
}

function pagina(dados: DadosPagina): Uint8Array {
  const out = concatenar([cabecalhoDaPagina(dados, valoresDeLacing(dados.pacotes)), ...dados.pacotes]);
  new DataView(out.buffer).setUint32(22, crcOgg(out), true); // o campo do CRC está zerado até aqui
  return out;
}

function opusTags(): Uint8Array {
  const vendor = new TextEncoder().encode("Nicska");
  const t = new Uint8Array(8 + 4 + vendor.length + 4);
  t.set(new TextEncoder().encode("OpusTags"), 0);
  const v = new DataView(t.buffer);
  v.setUint32(8, vendor.length, true);
  t.set(vendor, 12);
  return t;
}

/** Divide os pacotes em páginas: até 50 pacotes e 255 valores de lacing; um pacote grande (alto bitrate) enche a página com menos. Devolve os intervalos [início, fim). */
function dividirEmPaginas(pacotes: Uint8Array[]): [number, number][] {
  const grupos: [number, number][] = [];
  let i = 0;
  while (i < pacotes.length) {
    let segs = 0;
    let fim = i;
    while (fim < pacotes.length && fim - i < PACOTES_POR_PAGINA && segs + segmentosDe(pacotes[fim]!) <= SEGMENTOS_POR_PAGINA) segs += segmentosDe(pacotes[fim++]!);
    if (fim === i) throw new Error("pacote grande demais para uma página");
    grupos.push([i, fim]);
    i = fim;
  }
  return grupos;
}

const somar = (valores: number[]): number => valores.reduce((s, v) => s + v, 0);

/** Monta o Ogg/Opus com o cabeçalho `OpusHead` e os pacotes. `descarte`: amostras do fim que não são áudio (DiscardPadding do WebM). */
export function escreverOgg(cabecalho: Uint8Array, pacotes: Uint8Array[], { descarte = 0 }: { descarte?: number } = {}): Uint8Array {
  if (!opusHeadValido(cabecalho)) throw new Error("OpusHead inválido");
  if (pacotes.length === 0) throw new Error("sem pacotes");
  const duracoes = pacotes.map(amostrasDoPacote);
  if (duracoes.includes(0)) throw new Error("pacote Opus inválido");
  const preSkip = new DataView(cabecalho.buffer, cabecalho.byteOffset, cabecalho.byteLength).getUint16(10, true);
  const serie = SERIE_DO_FLUXO;
  const partes: Uint8Array[] = [pagina({ tipo: 0x02, granule: 0, serie, seq: 0, pacotes: [cabecalho] }), pagina({ tipo: 0, granule: 0, serie, seq: 1, pacotes: [opusTags()] })];
  let amostras = preSkip;
  for (const [i, fim] of dividirEmPaginas(pacotes)) {
    amostras += somar(duracoes.slice(i, fim));
    const ultima = fim >= pacotes.length;
    // O fim da última página desconta o DiscardPadding do WebM (o resto do último quadro, que não é áudio).
    const granule = ultima ? Math.max(preSkip, amostras - descarte) : amostras;
    partes.push(pagina({ tipo: ultima ? 0x04 : 0, granule, serie, seq: partes.length, pacotes: pacotes.slice(i, fim) }));
  }
  return concatenar(partes);
}


const remontar = (o: OpusEmWebm): Uint8Array => escreverOgg(o.cabecalho, o.pacotes, { descarte: o.descarte });

/** WebM com Opus → Ogg com Opus, sem recodificar. `null` quando o arquivo não é um WebM/Opus que se consiga ler ou o remux falha. */
export function webmParaOgg(webm: Uint8Array): Uint8Array | null {
  try {
    const o = lerOpusDoWebm(webm);
    return o ? remontar(o) : null;
  } catch (e) {
    console.warn("ogg: o remux falhou", e);
    return null;
  }
}
