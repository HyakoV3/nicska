// O modelo dos dados do Nicska e o documento de backup (docs/FORMATO.md), dividido em módulos coesos em `documento/`; este arquivo é só a fachada: quem usa
// importa daqui e não precisa saber da divisão.
//   tipos      os tipos, os formatos, os limites e o `ErroDeDocumento`
//   campos     os validadores de campo (e `util`, pequenos auxiliares)
//   percurso   ler percurso e atirador            tentativa  ler uma tentativa (tabela de leitores)
//   leitura    `lerDocumento`, `lerBackup`, `lerCompartilhado` (limite em bytes, BOM)
//   escrita    `montarBackup`, `montarCompartilhado`   novidades  o que é novo no aparelho e as sessões
export * from "./documento/tipos";
export { lerBackup, lerCompartilhado, lerDocumento, paraImportavel } from "./documento/leitura";
export { montarBackup, montarCompartilhado, type ConteudoDoBackup } from "./documento/escrita";
export { agruparEmSessoes, diaDaTentativa, novidades, type JaAqui } from "./documento/novidades";
