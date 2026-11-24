// SPIKE S1, passo 3 (EXPERIMENTAL, descartável): o áudio pelo MESMO caminho do app (a `Escuta` real: microfone cru, worklet do detector e o gravador Opus 64 kbps = gravador A).
// A trilha de áudio é capturada pelas fábricas da escuta, sem mudar a `Escuta`, para o gravador B (vídeo + áudio) usar a mesma trilha.
import { Escuta } from "../escuta";
import { fabricasDoNavegador } from "../escutaNavegador";
import { evento } from "./estado.svelte";

export type Estalo = { tipo: string; tempoCtxS: number; chegouPerfMs: number };
export type AudioAberto = { escuta: Escuta; trilha: MediaStreamTrack | null; estalos: Estalo[]; inicioCtxS: number };

/** Abre a escuta (chamar a partir de um toque). `aoEstalo` recebe a contagem a cada estalo. O apito não é procurado: toda subida conta como disparo. */
export async function abrirAudio(aoEstalo: (total: number) => void): Promise<AudioAberto> {
  const captura: { fluxo: MediaStream | null } = { fluxo: null };
  const escuta = new Escuta({
    ...fabricasDoNavegador,
    abrirMicrofone: async () => (captura.fluxo = await fabricasDoNavegador.abrirMicrofone()),
  });
  const estalos: Estalo[] = [];
  escuta.aoEvento = (e) => {
    estalos.push({ tipo: e.tipo, tempoCtxS: e.tempo, chegouPerfMs: Math.round(performance.now()) });
    aoEstalo(estalos.length);
  };
  escuta.aoInterromper = () => evento("escuta-interrompida");
  await escuta.iniciar({ esperarApito: false });
  return { escuta, trilha: captura.fluxo?.getAudioTracks()[0] ?? null, estalos, inicioCtxS: escuta.contexto?.currentTime ?? 0 };
}
