// A ligação da exportação com os tempos (V3) ao app: o que a tentativa tem (vídeo, zero, disparos ATUAIS), o tema, os textos no idioma da tela e a foto do
// atirador viram a entrada dos motores (exportacao.ts). O zero e os dados saem pelos mesmos caminhos do player (encaixeDoVideo + dadosDoOverlay): o arquivo
// mostra o que a Revisão (disparos editados) ou o Histórico (disparos salvos) mostra. As opções do que desenhar são as de Ajustes (lerOverlay).
import urlDaMarca from "../assets/marca-nicska.webp";
import { armazenamento } from "../armazenamento";
import { videoParaEnviar } from "../compartilhar";
import { i18n } from "../i18n/index.svelte";
import { lerOverlay } from "../preferencias";
import { lerAtirador } from "../registro";
import { formatarSegundos } from "../tentativa";
import { lerCapacidades, motoresDoAparelho } from "./capacidades";
import { dadosDoOverlay, type FonteDoOverlay } from "./dadosDoOverlay";
import { conferirSinal, motoresPossiveis, type EntradaDaExportacao, type MotorDeExportacao } from "./exportacao";
import type { Disponibilidade } from "./janelaDeExportacao";
import { dataDoCabecalho } from "./overlay";
import { paletaDoTema } from "./overlayCanvas";
import type { TextosDoOverlay } from "./overlayLayout";
import { encaixeDoVideo } from "./reproducao";

/** O pedido de quem envia: a tentativa, o que o overlay mostra e o zero da Revisão (ausente no Histórico, que usa o guardado ao salvar). */
export type PedidoDeExportacao = { id: string; fonte: FonteDoOverlay; zeroNoAudioS?: number | null };

/** Os textos do overlay no idioma da tela (os mesmos do OverlayDoVideo). */
export function textosDoOverlay(): TextosDoOverlay {
  const t = i18n.t.bind(i18n);
  const hf = new Intl.NumberFormat(i18n.idioma, { minimumFractionDigits: 4, maximumFractionDigits: 4 });
  return {
    marca: t("overlay.marca"),
    standby: t("timer.standby_grande"),
    apito: t("overlay.apito"),
    total: t("timer.total"),
    primeiro: t("timer.primeiro"),
    nDisparos: t("timer.n_disparos"),
    incompleta: t("overlay.incompleta"),
    seg: (ms) => formatarSegundos(ms, i18n.idioma),
    pontos: (n) => t("pontos.total", { n }),
    hf: (v) => t("pontos.hf", { hf: hf.format(v) }),
    data: (iso) => dataDoCabecalho(iso, i18n.idioma),
  };
}

/** O que dá para fazer com esta tentativa neste aparelho: os motores que rodam e se o zero é conhecido. Nunca joga. */
export async function disponibilidade(p: PedidoDeExportacao): Promise<Disponibilidade & { motores: MotorDeExportacao[] }> {
  const [meta, cap] = await Promise.all([armazenamento.metaDoVideo(p.id).catch(() => null), lerCapacidades()]);
  const temZero = !!meta && encaixeDoVideo(meta, p.zeroNoAudioS) !== null;
  return { ids: motoresPossiveis(cap), motores: motoresDoAparelho(cap), temZero };
}

/** A foto do atirador decodificada para o canvas, ou nula (sem foto, ou não decodificou: o layout põe as iniciais). */
async function fotoDoAtirador(id: string): Promise<ImageBitmap | null> {
  try {
    const a = await armazenamento.lerAvatar(id);
    return a && typeof createImageBitmap === "function" ? await createImageBitmap(a.dados) : null;
  } catch {
    return null;
  }
}

/** O ícone da marca (empacotado no app), decodificado; sem ele a marca sai só com o nome. */
async function logoDaMarca(): Promise<ImageBitmap | null> {
  try {
    const resposta = await fetch(urlDaMarca);
    return typeof createImageBitmap === "function" ? await createImageBitmap(await resposta.blob()) : null;
  } catch {
    return null;
  }
}

/** Espera as fontes do overlay (a Sora dos números vem por @font-face): sem isso o primeiro quadro sairia na fonte de recuo. */
async function carregarFontes(): Promise<void> {
  await Promise.all(["700 40px Sora", "800 40px Sora"].map((f) => document.fonts?.load(f))).catch(() => {});
}

/** Monta a entrada dos motores, ou nulo se não há vídeo ou zero. `soltar` fecha a foto decodificada. */
export async function prepararEntrada(p: PedidoDeExportacao, sinal: AbortSignal): Promise<EntradaDaExportacao | null> {
  const meta = await armazenamento.metaDoVideo(p.id);
  const encaixe = meta && encaixeDoVideo(meta, p.zeroNoAudioS);
  const atirador = p.fonte.atirador ?? lerAtirador(i18n.t("atirador.padrao"));
  const dados = dadosDoOverlay(encaixe ?? null, { ...p.fonte, atirador });
  const video = dados && (await videoParaEnviar(armazenamento, p.id));
  if (!dados || !video) return null;
  const prefs = lerOverlay();
  const avatar = prefs.avatar ? await fotoDoAtirador(atirador.id) : null;
  const logo = prefs.marca ? await logoDaMarca() : null;
  await carregarFontes();
  const soltar = () => {
    avatar?.close();
    logo?.close();
  };
  if (sinal.aborted) soltar();
  conferirSinal(sinal);
  const raiz = document.documentElement;
  const estilo = getComputedStyle(raiz);
  const desenho = { dados, prefs, textos: textosDoOverlay(), paleta: paletaDoTema((n) => estilo.getPropertyValue(n)), avatar, logo, altoContraste: raiz.dataset.tema === "alto-contraste" };
  return { video, desenho, soltar };
}
