// SPIKE S1, passo 1 (EXPERIMENTAL, descartável): o que o aparelho e a WebView dizem saber fazer. Nada daqui é dado pessoal além do `userAgent`.
import { tabelaDeSuporte } from "./mime";
import { memoriaJs, simples } from "./util";

type Codec = { nome: string; codec: string };
const CODECS: Codec[] = [
  { nome: "h264", codec: "avc1.42001f" },
  { nome: "vp8", codec: "vp8" },
  { nome: "vp9", codec: "vp09.00.10.08" },
];

type Suporte = { encoder?: unknown; decoder?: unknown };

async function suporteDeCodec({ nome, codec }: Codec): Promise<[string, Suporte]> {
  const saida: Suporte = {};
  const g = globalThis as unknown as Record<string, { isConfigSupported(c: object): Promise<{ supported?: boolean }> } | undefined>;
  try {
    if (g.VideoEncoder) saida.encoder = (await g.VideoEncoder.isConfigSupported({ codec, width: 1280, height: 720, framerate: 30, bitrate: 2_000_000 })).supported;
    if (g.VideoDecoder) saida.decoder = (await g.VideoDecoder.isConfigSupported({ codec, codedWidth: 1280, codedHeight: 720 })).supported;
  } catch (e) {
    saida.encoder = `erro: ${(e as Error).name}`;
  }
  return [`${nome} (${codec})`, saida];
}

async function armazenamentoDoNavegador(): Promise<Record<string, unknown>> {
  const s = navigator.storage;
  if (!s) return { disponivel: false };
  const [estimativa, persistente] = await Promise.all([s.estimate?.().catch(() => null), s.persisted?.().catch(() => null)]);
  return { estimativa: estimativa ?? null, persistente: persistente ?? null };
}

const tipoSuportado = (t: string): boolean => typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(t);

/** Coleta o ambiente completo do passo 1. */
export async function coletarAmbiente(): Promise<Record<string, unknown>> {
  const nav = navigator as unknown as { deviceMemory?: number };
  const codecs = Object.fromEntries(await Promise.all(CODECS.map(suporteDeCodec)));
  return simples({
    userAgent: navigator.userAgent,
    restricoesSuportadas: navigator.mediaDevices?.getSupportedConstraints?.() ?? null,
    mediaRecorder: typeof MediaRecorder === "undefined" ? null : tabelaDeSuporte(tipoSuportado),
    webCodecs: { VideoEncoder: typeof VideoEncoder, VideoDecoder: typeof VideoDecoder, ImageDecoder: typeof ImageDecoder, codecs1280x720x30: codecs },
    armazenamento: await armazenamentoDoNavegador(),
    memoriaJsUsada: memoriaJs(),
    orientacao: screen.orientation?.type ?? null,
    devicePixelRatio: window.devicePixelRatio,
    nucleos: navigator.hardwareConcurrency ?? null,
    memoriaGb: nav.deviceMemory ?? null,
    wakeLock: "wakeLock" in navigator,
  });
}
