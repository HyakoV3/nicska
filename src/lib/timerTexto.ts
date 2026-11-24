// O texto que a aba Timer fala ao leitor de tela: o Standby ao armar e o resultado ao terminar. Nada durante o preparo, o apito e a escuta (nem a cada
// disparo): o leitor falando por cima do apito e dos tiros atrapalha a detecção e a pessoa (CONS-033). A tela continua mostrando o estado.
import { formatarSegundos } from "./tentativa";
import type { Instantaneo } from "./timer";

/** Estados em que o leitor de tela fica calado: a largada e os tiros são sonoros. */
export const ESTADOS_SEM_ANUNCIO: readonly Instantaneo["estado"][] = ["preparando", "apito", "escutando"];

/** `t` traduz a chave; `seg` formata milissegundos como segundos no idioma. */
export function anuncioDoTimer(snap: Instantaneo, textoDoEstado: string, { t, idioma }: { t: (c: any, p?: Record<string, string | number>) => string; idioma: string }): string {
  const r = snap.estado === "resultado" ? snap.resultado?.resumo : undefined;
  if (r) return r.n === 0 ? t("timer.anuncio_sem_disparos") : t("timer.anuncio_resultado", { n: r.n, total: formatarSegundos(r.total!, idioma), primeiro: formatarSegundos(r.primeiro!, idioma) });
  if (snap.estado === "erro" && snap.erro) return t(`timer.erro_${snap.erro}`);
  if (ESTADOS_SEM_ANUNCIO.includes(snap.estado)) return "";
  return textoDoEstado;
}
