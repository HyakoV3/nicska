// Os tipos e as constantes do modelo de dados do Nicska (docs/FORMATO.md). O armazenamento local guarda os MESMOS campos que o JSON compartilhado.
import type { Pontos } from "../tentativa";

export type Percurso = {
  id: string;
  nome: string;
  /** Quantos disparos o percurso pede, se pede. */
  disparos_minimos?: number;
  /** Pontos máximos da pista (para o HF relativo), se se conhece. */
  pontos_maximos?: number;
  divisao?: string;
  /** ms desde 1970. */
  criado_em: number;
};

export type TentativaGuardada = {
  id: string;
  percurso_id: string;
  /** ISO 8601 com o fuso de quando a tentativa começou; os 10 primeiros caracteres são o DIA da sessão. */
  data: string;
  /** `data` em ms desde 1970 (para ordenar). */
  quando: number;
  atraso_ms: number;
  inicio: "detectado" | "estimado";
  disparos_ms: number[];
  editada: { apagados: number; inseridos: number };
  /** A escuta foi cortada no meio (ligação, microfone tirado): só vale o que foi detectado até ali. Ausente = tentativa inteira. */
  incompleta?: true;
  pontos?: Pontos;
  /**
   * `versao` é a do detector que gravou a tentativa. O app grava 1; um arquivo de um app mais novo pode trazer uma versão maior, que é aceita e guardada como veio
   * (só se leem `sensibilidade` e `tempo_morto_ms`; o significado deles numa versão futura não é interpretado aqui).
   */
  detector: { versao: number; sensibilidade: number; tempo_morto_ms: number };
  audio_sha256?: string;
  /** De quem é a tentativa: ausente ou igual ao atirador deste aparelho = é minha; outro `id` = veio de um arquivo de outra pessoa (Etapa 8). */
  atirador_id?: string;
  /** Há áudio guardado neste aparelho (nunca vai no backup nem no JSON compartilhado). */
  audio?: { tipo: string; segundos: number; bytes: number };
};

export type Atirador = { id: string; nome: string; divisao?: string };

export const FORMATO_BACKUP = "nicska-backup/1";
export const FORMATO_COMPARTILHADO = "nicska/1";

export type Backup = {
  formato: typeof FORMATO_BACKUP;
  app: string;
  exportado_em: string;
  atirador: Atirador;
  /** As outras pessoas cujas tentativas foram importadas (as minhas estão em `atirador`). */
  atiradores?: Atirador[];
  percursos: Percurso[];
  tentativas: TentativaGuardada[];
};

export type Compartilhado = {
  formato: typeof FORMATO_COMPARTILHADO;
  app: string;
  atirador: { id: string; nome: string };
  divisao?: string;
  percurso: { id: string; nome: string; disparos_minimos?: number; pontos_maximos?: number };
  tentativas: Omit<TentativaGuardada, "percurso_id" | "quando" | "audio" | "atirador_id">[];
};

/** O que um arquivo importado traz, de qualquer um dos dois formatos, já validado. */
export type Importavel = {
  origem: "backup" | "compartilhado";
  /** O dono do arquivo: quem exportou o backup ou quem compartilhou o percurso. */
  atirador: Atirador;
  /** Outras pessoas citadas (só no backup). */
  atiradores: Atirador[];
  percursos: Percurso[];
  tentativas: TentativaGuardada[];
};

/** Limites do arquivo importado. */
export const LIMITES = {
  /** Tamanho do arquivo em BYTES (UTF-8), não em caracteres. */
  bytes: 20 * 1024 * 1024,
  percursos: 1000,
  tentativas: 100_000,
  disparos: 500,
  /** Um disparo depois de 10 min do apito não é uma tentativa de IPSC. */
  disparoMs: 600_000,
  texto: 80,
  id: 64,
  atiradores: 1000,
} as const;

/** Erro de documento: um código estável (`erro.rust.<codigo>` na interface) e os dados. */
export class ErroDeDocumento extends Error {
  constructor(
    readonly codigo: "json_invalido" | "versao" | "grande_demais" | "dados_invalidos",
    readonly args: Record<string, string | number> = {},
  ) {
    super(codigo);
  }
}

export type Novidades = { atiradores: Atirador[]; percursos: Percurso[]; tentativas: TentativaGuardada[]; jaExistiam: number };

export type Sessao = { percursoId: string; dia: string; tentativas: TentativaGuardada[] };

/** `chave`: se há, o nome vem do dicionário de idiomas (nome próprio como "Bill Drill" não se traduz). */
type DrillPronto = { nome: string; disparos_minimos: number; chave?: "drill.saque" };

/** Os drills prontos oferecidos ao criar um percurso (sugestão: o nome e os disparos podem ser mudados). */
export const DRILLS_PRONTOS: readonly DrillPronto[] = [
  { nome: "Bill Drill", disparos_minimos: 6 },
  { nome: "El Presidente", disparos_minimos: 12 },
  { nome: "Mozambique", disparos_minimos: 3 },
  { nome: "Saque (1 disparo)", disparos_minimos: 1, chave: "drill.saque" },
];

export const DIVISOES = ["Production", "Standard", "Open", "Classic", "Revolver", "PCC", "Production Optics"] as const;
