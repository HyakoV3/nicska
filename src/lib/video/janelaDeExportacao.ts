// As regras da janela de enviar o vídeo (V3), separadas da tela para testar: que escolhas aparecem ("Com os tempos" só se há motor e zero), qual vem marcada
// (a chave "Tempos sobre o vídeo" lembrada em Ajustes; escolher aqui NÃO muda a preferência), quando avisar que demora o tamanho do vídeo, a porcentagem
// do progresso e o aviso de cada fim (os mesmos tipos de aviso dos outros envios).
import type { FimDaExportacao, IdDoMotor } from "./exportacao";

export type Escolha = "com" | "sem";
/** O que a tentativa e o aparelho permitem: os motores que rodam (na ordem) e se o zero (apito) é conhecido. */
export type Disponibilidade = { ids: readonly IdDoMotor[]; temZero: boolean };
/** Por que "Com os tempos" não aparece: sem o apito não há tempo para desenhar; sem motor o aparelho não gera o vídeo. */
export type MotivoSemTempos = "sem_zero" | "sem_motor" | null;
export type FaseDaJanela = "carregando" | "escolhendo" | "exportando" | "enviando";

export function motivoSemTempos(d: Disponibilidade): MotivoSemTempos {
  if (!d.temZero) return "sem_zero";
  return d.ids.length ? null : "sem_motor";
}

/** As escolhas que a janela mostra: as duas, ou só "Sem os tempos" (com a explicação do motivo). */
export const escolhasDaJanela = (d: Disponibilidade): Escolha[] => (motivoSemTempos(d) ? ["sem"] : ["com", "sem"]);

/** A escolha marcada ao abrir: a preferência dos tempos sobre o vídeo, se der para exportar com eles. */
export const escolhaInicial = (temposLigados: boolean, d: Disponibilidade): Escolha => (temposLigados && !motivoSemTempos(d) ? "com" : "sem");

/** O motor preferido é o de tempo real (sem WebCodecs com H.264): a janela avisa que demora o tamanho do vídeo. */
export const demoraOTamanho = (d: Disponibilidade): boolean => d.ids[0] === "tempo-real";

/** A porcentagem inteira (0 a 100) do progresso, ou nula se não se sabe (a barra fica indeterminada). */
export function porcentagem(fracao: number | null): number | null {
  if (fracao === null || !Number.isFinite(fracao)) return null;
  return Math.round(Math.min(1, Math.max(0, fracao)) * 100);
}

/** O aviso de cada fim: nada se enviou ou se a pessoa só fechou a folha; os outros dizem o que houve. As chaves são as do i18n. */
export type AvisoDoFim = { tipo: "erro" | "info"; chave: "exportar.interrompida" | "exportar.erro" | "compartilhar_video.sem" | "compartilhar_video.erro" } | null;

export function avisoDoFim(fim: FimDaExportacao, entregou: boolean): AvisoDoFim {
  if (fim === "interrompida") return { tipo: "info", chave: "exportar.interrompida" };
  if (fim === "sem") return { tipo: "erro", chave: "compartilhar_video.sem" };
  // O erro depois de pronto é da entrega (a ponte, a folha), não da exportação: o aviso é o mesmo do envio sem os tempos.
  if (fim === "erro") return { tipo: "erro", chave: entregou ? "compartilhar_video.erro" : "exportar.erro" };
  return null;
}
