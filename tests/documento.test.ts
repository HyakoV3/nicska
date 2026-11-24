import { describe, expect, it } from "vitest";
import { DRILLS_PRONTOS, ErroDeDocumento, agruparEmSessoes, lerBackup, lerCompartilhado, lerDocumento, montarBackup, montarCompartilhado, novidades, paraImportavel, type Percurso, type TentativaGuardada } from "../src/lib/documento";

const percurso = (id = "p1"): Percurso => ({ id, nome: "Bill Drill", disparos_minimos: 6, pontos_maximos: 30, divisao: "Production", criado_em: 1_700_000_000_000 });
const tentativa = (id: string, data: string, extra: Partial<TentativaGuardada> = {}): TentativaGuardada => ({
  id,
  percurso_id: "p1",
  data,
  quando: Date.parse(data),
  atraso_ms: 2310,
  inicio: "detectado",
  disparos_ms: [1480, 1730, 1975],
  editada: { apagados: 0, inseridos: 0 },
  detector: { versao: 1, sensibilidade: 0.6, tempo_morto_ms: 60 },
  ...extra,
});
const atirador = { id: "a1", nome: "Atirador Teste", divisao: "Production" };
const erro = (f: () => unknown): ErroDeDocumento => {
  try {
    f();
  } catch (e) {
    if (e instanceof ErroDeDocumento) return e;
    throw e;
  }
  throw new Error("não jogou erro");
};

describe("backup: montar e ler de volta (ida e volta exata)", () => {
  it("o que se exporta é o que se importa, sem o áudio", () => {
    const t1 = tentativa("t1", "2026-11-21T20:15:03-03:00", { pontos: { A: 5, C: 1, D: 0, M: 0, NS: 0, procedimentais: 0, fator: "minor" }, audio_sha256: "a".repeat(64), audio: { tipo: "audio/webm", segundos: 5, bytes: 100 } });
    const b = montarBackup("0.1.0 (abc)", { atirador, percursos: [percurso()], tentativas: [t1, tentativa("t2", "2026-11-22T09:00:00-03:00")] }, new Date("2026-11-22T12:00:00Z"));
    expect(b.tentativas[0]).not.toHaveProperty("audio");
    const texto = JSON.stringify(b);
    const lido = lerBackup(texto);
    expect(lido).toEqual(b);
    expect(JSON.stringify(lido)).toBe(texto);
  });
});

describe("tentativa incompleta (escuta cortada no meio)", () => {
  it("a marca vai e volta no backup; ausente ou false não cria o campo; outro valor é recusado", () => {
    const marcada = tentativa("t1", "2026-11-21T20:15:03-03:00", { incompleta: true });
    const lida = lerBackup(JSON.stringify(montarBackup("t", { atirador, percursos: [percurso()], tentativas: [marcada, tentativa("t2", "2026-11-21T20:16:03-03:00")] })));
    expect(lida.tentativas[0].incompleta).toBe(true);
    expect("incompleta" in lida.tentativas[1]).toBe(false);
    const texto = JSON.stringify(montarBackup("t", { atirador, percursos: [percurso()], tentativas: [marcada] }));
    expect(lerBackup(texto.replace('"incompleta":true', '"incompleta":false')).tentativas[0].incompleta).toBeUndefined();
    expect(JSON.stringify(erro(() => lerBackup(texto.replace('"incompleta":true', '"incompleta":"sim"'))).args)).toContain("incompleta");
  });
});

describe("lerBackup: recusa o que não presta", () => {
  const base = () => montarBackup("x", { atirador, percursos: [percurso()], tentativas: [tentativa("t1", "2026-11-21T20:15:03-03:00")] });
  const com = (mudar: (b: Record<string, any>) => void) => {
    const b = JSON.parse(JSON.stringify(base()));
    mudar(b);
    return JSON.stringify(b);
  };

  it("JSON quebrado, objeto errado e arquivo grande demais", () => {
    expect(erro(() => lerBackup("{ quebrado")).codigo).toBe("json_invalido");
    expect(erro(() => lerBackup("[1,2]")).codigo).toBe("dados_invalidos");
    expect(erro(() => lerBackup('{"formato":"outro"}')).codigo).toBe("dados_invalidos");
    expect(erro(() => lerBackup("x".repeat(20 * 1024 * 1024 + 1))).codigo).toBe("grande_demais");
  });

  it("versão maior desconhecida é recusada com a versão", () => {
    const e = erro(() => lerBackup(com((b) => (b.formato = "nicska-backup/2"))));
    expect(e.codigo).toBe("versao");
    expect(e.args).toEqual({ versao: "2", esperado: "1" });
  });

  it("disparos fora de ordem, repetidos, negativos ou acima de 10 min", () => {
    for (const d of [[200, 100], [100, 100], [-1, 5], [0, 600_001], [1.5], ["x"]]) {
      expect(erro(() => lerBackup(com((b) => (b.tentativas[0].disparos_ms = d)))).codigo, JSON.stringify(d)).toBe("dados_invalidos");
    }
  });

  it("ids repetidos, tentativa de um percurso que não existe e data inválida", () => {
    expect(erro(() => lerBackup(com((b) => b.percursos.push(b.percursos[0])))).codigo).toBe("dados_invalidos");
    expect(erro(() => lerBackup(com((b) => b.tentativas.push(b.tentativas[0])))).codigo).toBe("dados_invalidos");
    expect(erro(() => lerBackup(com((b) => (b.tentativas[0].percurso_id = "nao-existe")))).codigo).toBe("dados_invalidos");
    expect(erro(() => lerBackup(com((b) => (b.tentativas[0].data = "ontem")))).codigo).toBe("dados_invalidos");
  });

  it("pontos, detector, hash e textos inválidos", () => {
    expect(erro(() => lerBackup(com((b) => (b.tentativas[0].pontos = { A: -1, C: 0, D: 0, M: 0, NS: 0, procedimentais: 0, fator: "minor" })))).codigo).toBe("dados_invalidos");
    expect(erro(() => lerBackup(com((b) => (b.tentativas[0].pontos = { A: 1, C: 0, D: 0, M: 0, NS: 0, procedimentais: 0, fator: "tanto-faz" })))).codigo).toBe("dados_invalidos");
    expect(erro(() => lerBackup(com((b) => (b.tentativas[0].detector.sensibilidade = 7)))).codigo).toBe("dados_invalidos");
    expect(erro(() => lerBackup(com((b) => (b.tentativas[0].audio_sha256 = "123")))).codigo).toBe("dados_invalidos");
    expect(erro(() => lerBackup(com((b) => (b.percursos[0].nome = "   ")))).codigo).toBe("dados_invalidos");
    expect(erro(() => lerBackup(com((b) => (b.percursos[0].nome = "x".repeat(81))))).codigo).toBe("dados_invalidos");
    expect(erro(() => lerBackup(com((b) => delete b.atirador))).codigo).toBe("dados_invalidos");
  });

  it("campos desconhecidos são ignorados e não voltam", () => {
    const b = lerBackup(com((x) => {
      x.novo = 1;
      x.tentativas[0].segredo = "x";
    }));
    expect(b).not.toHaveProperty("novo");
    expect(b.tentativas[0]).not.toHaveProperty("segredo");
  });
});

describe("novidades (importar sem duplicar)", () => {
  it("só entra o que ainda não existe; importar de novo não acrescenta nada", () => {
    const b = montarBackup("x", { atirador, percursos: [percurso("p1"), percurso("p2")], tentativas: [tentativa("t1", "2026-11-21T20:00:00-03:00"), tentativa("t2", "2026-11-21T20:10:00-03:00")] });
    const n = novidades(paraImportavel(b), { percursos: new Set(["p1"]), tentativas: new Set(["t1"]) });
    expect(n.percursos.map((p) => p.id)).toEqual(["p2"]);
    expect(n.tentativas.map((t) => t.id)).toEqual(["t2"]);
    expect(n.jaExistiam).toBe(1);
    const de_novo = novidades(paraImportavel(b), { percursos: new Set(["p1", "p2"]), tentativas: new Set(["t1", "t2"]) });
    expect(de_novo).toEqual({ atiradores: [], percursos: [], tentativas: [], jaExistiam: 2 });
  });
});

describe("sessões (um percurso num dia)", () => {
  it("agrupa por dia, da mais nova para a mais antiga, também dentro do dia", () => {
    const ts = [
      tentativa("a", "2026-11-20T19:00:00-03:00"),
      tentativa("b", "2026-11-22T09:00:00-03:00"),
      tentativa("c", "2026-11-22T09:30:00-03:00"),
      tentativa("d", "2026-11-20T19:05:00-03:00"),
    ];
    const s = agruparEmSessoes(ts);
    expect(s.map((x) => x.dia)).toEqual(["2026-11-22", "2026-11-20"]);
    expect(s[0].tentativas.map((t) => t.id)).toEqual(["c", "b"]);
    expect(s[1].tentativas.map((t) => t.id)).toEqual(["d", "a"]);
    expect(agruparEmSessoes([])).toEqual([]);
  });

  it("tentativas de percursos diferentes no mesmo dia são sessões diferentes", () => {
    const s = agruparEmSessoes([tentativa("a", "2026-11-22T09:00:00-03:00"), { ...tentativa("b", "2026-11-22T09:10:00-03:00"), percurso_id: "p2" }]);
    expect(s).toHaveLength(2);
  });
});

describe("drills prontos", () => {
  it("têm nome e pelo menos um disparo", () => {
    expect(DRILLS_PRONTOS.length).toBeGreaterThan(0);
    for (const d of DRILLS_PRONTOS) {
      expect(d.nome).not.toBe("");
      expect(d.disparos_minimos).toBeGreaterThanOrEqual(1);
    }
  });
});


describe("percurso compartilhado (nicska/1)", () => {
  const meu = { id: "a1", nome: "Atirador Teste", divisao: "Production" };
  const tentativas = [tentativa("t1", "2026-11-21T20:15:03-03:00", { pontos: { A: 5, C: 1, D: 0, M: 0, NS: 0, procedimentais: 0, fator: "minor" }, audio: { tipo: "audio/webm", segundos: 3, bytes: 10 }, audio_sha256: "b".repeat(64) }), tentativa("t2", "2026-11-22T09:00:00-03:00")];

  it("monta como o FORMATO.md manda: um percurso, o atirador, sem áudio nem campos internos", () => {
    const c = montarCompartilhado("0.1.0", meu, percurso(), tentativas);
    expect(c.formato).toBe("nicska/1");
    expect(c.atirador).toEqual({ id: "a1", nome: "Atirador Teste" });
    expect(c.divisao).toBe("Production");
    expect(c.percurso).toEqual({ id: "p1", nome: "Bill Drill", disparos_minimos: 6, pontos_maximos: 30 });
    for (const t of c.tentativas) for (const k of ["audio", "quando", "percurso_id", "atirador_id"]) expect(t).not.toHaveProperty(k);
    expect(c.tentativas[0].audio_sha256).toBe("b".repeat(64));
  });

  it("ida e volta: o que se compartilha é o que se lê, com as tentativas marcadas como de quem compartilhou", () => {
    const texto = JSON.stringify(montarCompartilhado("0.1.0", meu, percurso(), tentativas));
    const lido = lerCompartilhado(texto);
    expect(lido.origem).toBe("compartilhado");
    expect(lido.atirador).toEqual(meu);
    expect(lido.percursos.map((p) => p.id)).toEqual(["p1"]);
    expect(lido.tentativas.every((t) => t.atirador_id === "a1" && t.percurso_id === "p1")).toBe(true);
    expect(lido.tentativas[0].quando).toBe(Date.parse("2026-11-21T20:15:03-03:00"));
    expect(lerDocumento(texto)).toEqual(lido); // o leitor geral reconhece os dois formatos
  });

  it("lerDocumento também abre um backup", () => {
    const b = montarBackup("x", { atirador: meu, percursos: [percurso()], tentativas });
    expect(lerDocumento(JSON.stringify(b)).origem).toBe("backup");
  });

  it("importar de outra pessoa registra o atirador dela e não duplica ao repetir", () => {
    const imp = lerCompartilhado(JSON.stringify(montarCompartilhado("x", meu, percurso(), tentativas)));
    const aqui = { percursos: new Set<string>(), tentativas: new Set<string>(), atiradores: new Set<string>() };
    const n = novidades(imp, aqui, "eu");
    expect(n.atiradores).toEqual([meu]);
    expect(n.tentativas).toHaveLength(2);
    const depois = novidades(imp, { percursos: new Set(["p1"]), tentativas: new Set(["t1", "t2"]), atiradores: new Set(["a1"]) }, "eu");
    expect(depois).toEqual({ atiradores: [], percursos: [], tentativas: [], jaExistiam: 2 });
  });

  it("o meu próprio arquivo, importado de volta, não cria um 'outro atirador' e as tentativas voltam como minhas", () => {
    const imp = lerCompartilhado(JSON.stringify(montarCompartilhado("x", meu, percurso(), tentativas)));
    const n = novidades(imp, { percursos: new Set(), tentativas: new Set(), atiradores: new Set() }, "a1");
    expect(n.atiradores).toEqual([]);
    expect(n.tentativas.every((t) => !("atirador_id" in t))).toBe(true);
  });

  const erro = (f: () => unknown): ErroDeDocumento => {
    try {
      f();
    } catch (e) {
      if (e instanceof ErroDeDocumento) return e;
      throw e;
    }
    throw new Error("não jogou erro");
  };
  const com = (mudar: (c: Record<string, any>) => void) => {
    const c = JSON.parse(JSON.stringify(montarCompartilhado("x", meu, percurso(), tentativas)));
    mudar(c);
    return JSON.stringify(c);
  };

  it("recusa versão desconhecida, formato de outro tipo e dados ruins", () => {
    const v = erro(() => lerCompartilhado(com((c) => (c.formato = "nicska/2"))));
    expect([v.codigo, v.args]).toEqual(["versao", { versao: "2", esperado: "1" }]);
    expect(erro(() => lerCompartilhado('{"formato":"outro"}')).codigo).toBe("dados_invalidos");
    expect(erro(() => lerCompartilhado("{ quebrado")).codigo).toBe("json_invalido");
    expect(erro(() => lerCompartilhado("x".repeat(20 * 1024 * 1024 + 1))).codigo).toBe("grande_demais");
    for (const mudar of [
      (c: any) => delete c.percurso,
      (c: any) => delete c.atirador,
      (c: any) => (c.tentativas[0].disparos_ms = [300, 100]),
      (c: any) => (c.tentativas[0].disparos_ms = [0, 600_001]),
      (c: any) => (c.tentativas[1].id = c.tentativas[0].id),
      (c: any) => (c.tentativas[0].data = "ontem"),
      (c: any) => (c.tentativas[0].inicio = "talvez"),
      (c: any) => (c.atirador.nome = ""),
    ]) expect(erro(() => lerCompartilhado(com(mudar))).codigo).toBe("dados_invalidos");
  });
});

describe("CONS-044: data, versão do detector, tamanho em bytes e BOM", () => {
  const base = () => montarBackup("x", { atirador, percursos: [percurso()], tentativas: [tentativa("t1", "2026-11-21T20:15:03-03:00")] });
  const com = (mudar: (b: Record<string, any>) => void) => {
    const b = JSON.parse(JSON.stringify(base()));
    mudar(b);
    return JSON.stringify(b);
  };

  it("recusa data que não existe no calendário (31/02, 30/02, 29/02 de ano comum, mês 13) e aceita 29/02 de ano bissexto", () => {
    for (const data of ["2026-02-31T10:00:00-03:00", "2026-02-30T10:00:00Z", "2026-02-29T10:00:00Z", "2026-13-01T10:00:00Z", "2026-04-31T10:00:00Z"]) {
      expect(erro(() => lerBackup(com((b) => (b.tentativas[0].data = data)))).codigo, data).toBe("dados_invalidos");
    }
    const ok = lerBackup(com((b) => (b.tentativas[0].data = "2028-02-29T10:00:00-03:00")));
    expect(ok.tentativas[0].data.slice(0, 10)).toBe("2028-02-29");
  });

  it("o detalhe do erro de dados é um código técnico (caminho e regra), não uma frase em português", () => {
    const e = erro(() => lerBackup(com((b) => (b.tentativas[0].data = "2026-02-31T10:00:00Z"))));
    expect(e.args.detalhe).toBe("tentativas[0].data: data_iso_8601");
  });

  it("detector.versao futuro é aceito e guardado como veio; versão 0, fracionária ou ausente continua recusada", () => {
    const futuro = lerBackup(com((b) => (b.tentativas[0].detector.versao = 2)));
    expect(futuro.tentativas[0].detector).toEqual({ versao: 2, sensibilidade: 0.6, tempo_morto_ms: 60 });
    expect(JSON.stringify(lerBackup(JSON.stringify(futuro)))).toBe(JSON.stringify(futuro)); // ida e volta
    for (const v of [0, -1, 1.5, "1", null]) expect(erro(() => lerBackup(com((b) => (b.tentativas[0].detector.versao = v)))).codigo, String(v)).toBe("dados_invalidos");
    expect(erro(() => lerBackup(com((b) => delete b.tentativas[0].detector.versao))).codigo).toBe("dados_invalidos");
    // o detector futuro vale também no formato compartilhado
    const c = JSON.parse(JSON.stringify(montarCompartilhado("x", atirador, percurso(), [tentativa("t1", "2026-11-21T20:15:03-03:00")])));
    c.tentativas[0].detector.versao = 3;
    expect(lerCompartilhado(JSON.stringify(c)).tentativas[0].detector.versao).toBe(3);
  });

  it("o limite é em BYTES: texto multibyte abaixo de 20 MiB em caracteres, mas acima em bytes, é grande_demais", () => {
    const limite = 20 * 1024 * 1024;
    const acentos = "é".repeat(limite / 2 + 1); // 10 Mi + 1 caracteres, 20 MiB + 2 bytes
    expect(acentos.length).toBeLessThan(limite);
    expect(erro(() => lerBackup(acentos)).codigo).toBe("grande_demais");
    expect(erro(() => lerDocumento(acentos)).codigo).toBe("grande_demais");
    expect(erro(() => lerCompartilhado(acentos)).codigo).toBe("grande_demais");
    // logo abaixo do limite em bytes passa pelo tamanho e só falha por não ser JSON
    expect(erro(() => lerBackup("é".repeat(limite / 2 - 1))).codigo).toBe("json_invalido");
  });

  it("ignora o BOM no início do arquivo, nos dois formatos e em lerDocumento", () => {
    const b = base();
    expect(lerBackup("﻿" + JSON.stringify(b))).toEqual(b);
    expect(lerDocumento("﻿" + JSON.stringify(b)).origem).toBe("backup");
    const c = montarCompartilhado("x", atirador, percurso(), [tentativa("t1", "2026-11-21T20:15:03-03:00")]);
    expect(lerCompartilhado("﻿" + JSON.stringify(c)).origem).toBe("compartilhado");
    expect(lerDocumento("﻿" + JSON.stringify(c)).origem).toBe("compartilhado");
  });
});
