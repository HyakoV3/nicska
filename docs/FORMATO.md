# Formato do JSON do Nicska (`nicska/1`)

Só os **instantes dos disparos** são guardados, em milissegundos desde o apito. Splits, total e hit factor (HF) são **derivados**. O
armazenamento local guarda o **mesmo documento** que é compartilhado, então exportar é copiar. A validação do arquivo importado é feita hoje só em TypeScript
(`src/lib/documento.ts`, com limites de tamanho e de conteúdo); não existe `importar_json` em Rust (planejado na Etapa 8, não feito). Fonte da decisão: seção 6 de [`roadmap-desenvolvimento.md`](archive/roadmap-desenvolvimento.md).

```json
{
  "formato": "nicska/1",
  "app": "0.1.0 (a1b2c3d)",
  "atirador": { "id": "6f1c…", "nome": "Atirador" },
  "divisao": "Production",
  "percurso": { "id": "3e9a…", "nome": "Bill Drill", "disparos_minimos": 6, "pontos_maximos": 30 },
  "tentativas": [
    {
      "id": "b7d2…",
      "data": "2026-11-21T20:15:03-03:00",
      "atraso_ms": 2310,
      "inicio": "detectado",
      "disparos_ms": [1480, 1730, 1975, 2210, 2460, 2700],
      "editada": { "apagados": 0, "inseridos": 0 },
      "pontos": { "A": 5, "C": 1, "D": 0, "M": 0, "NS": 0, "procedimentais": 0, "fator": "minor" },
      "detector": { "versao": 1, "sensibilidade": 0.6, "tempo_morto_ms": 60 },
      "audio_sha256": "9c4e…"
    }
  ]
}
```

O exemplo dá: 1º disparo **1,48 s**; splits 0,250 / 0,245 / 0,235 / 0,250 / 0,240; total **2,70 s**; pontos 5×5 + 1×3 = 28;
HF = 28 ÷ 2,70 = **10,3704** (tempo arredondado a centésimos; veja "Hit factor").

## Campos

| Campo | Significado |
|---|---|
| `formato` | `nicska/<versão maior>`. Versão maior nova = formato incompatível; o app recusa o que não conhece |
| `atirador` | só o apelido (`nome`) e um `id` aleatório. **Nada sensível:** sem número de série da arma, sem CR ou documento |
| `divisao` | Production, Standard, Open… (lista fixa ou texto livre: pergunta aberta 5 do roadmap) |
| `percurso` | nome, disparos mínimos e pontos máximos (opcional) |
| `tentativas[].id` | identificador único; a importação deduplica por ele |
| `tentativas[].inicio` | `detectado` (o apito foi ouvido no microfone) ou `estimado` (usou o instante agendado + latência de saída) |
| `tentativas[].disparos_ms` | crescentes, positivos e abaixo de 10 min |
| `tentativas[].editada` | quantos disparos a pessoa apagou e inseriu na revisão |
| `tentativas[].incompleta` | opcional, só `true`: a escuta foi cortada no meio (ligação, outro app tirou o microfone) e vale o que foi detectado até ali. Ausente = tentativa inteira. O ranking a trata como duvidosa |
| `tentativas[].pontos` | opcional: só tempo também vale |
| `tentativas[].audio_sha256` | amarra o áudio guardado à tentativa (auditoria) |

Campos novos dentro de `nicska/1` são ignorados por versões antigas.

## Backup do aparelho (`nicska-backup/1`)

O backup é **outro documento**, para guardar e restaurar tudo o que está no aparelho (vários percursos de uma vez); o `nicska/1` acima é o que se
**compartilha** (um percurso). As tentativas têm **os mesmos campos**; no backup elas ficam numa lista só e apontam o percurso por `percurso_id`, e
levam também `quando` (a `data` em ms desde 1970, para ordenar).

```json
{
  "formato": "nicska-backup/1",
  "app": "0.1.0 (a1b2c3d)",
  "exportado_em": "2026-11-22T15:00:00.000Z",
  "atirador": { "id": "6f1c…", "nome": "Atirador" },
  "percursos": [
    { "id": "3e9a…", "nome": "Bill Drill", "disparos_minimos": 6, "pontos_maximos": 30, "divisao": "Production", "criado_em": 1763762103000 }
  ],
  "tentativas": [
    {
      "id": "b7d2…", "percurso_id": "3e9a…", "data": "2026-11-21T20:15:03-03:00", "quando": 1763766903000,
      "atraso_ms": 2310, "inicio": "detectado", "disparos_ms": [1480, 1730, 1975, 2210, 2460, 2700],
      "editada": { "apagados": 0, "inseridos": 0 },
      "pontos": { "A": 5, "C": 1, "D": 0, "M": 0, "NS": 0, "procedimentais": 0, "fator": "minor" },
      "detector": { "versao": 1, "sensibilidade": 0.6, "tempo_morto_ms": 60 },
      "audio_sha256": "9c4e…"
    }
  ]
}
```

- **Sem áudio:** o áudio fica só no aparelho (IndexedDB `nk-dados`, loja `audios`); o backup leva apenas o `audio_sha256`.
- **Sessão não é guardada:** é um percurso num dia, tirada de `data` (os 10 primeiros caracteres, `AAAA-MM-DD`) por `agruparEmSessoes`.
- **Importar não apaga nem sobrescreve:** entra só o que ainda não existe, por `id` (percursos e tentativas). Importar duas vezes não duplica. Ler os ids que já existem e gravar o novo é **uma transação só** (`Armazenamento.importarDocumento`): duas importações ao mesmo tempo não se atropelam, e uma falha na gravação não deixa nada pela metade.
- **Validação** (`src/lib/documento.ts` e `src/lib/documento/`, `lerBackup`): arquivo de até 20 MiB **em bytes** (UTF-8, não em caracteres); um BOM no início é ignorado; até 1000 percursos e 100 000 tentativas; até 500 disparos por tentativa,
  crescentes e de 0 a 600 000 ms; ids únicos; toda tentativa aponta um percurso do arquivo; datas ISO 8601 que existem no calendário (31/02 é recusado); `detector.versao` inteiro de 1 em diante (uma versão futura é aceita e guardada como veio, lendo só `sensibilidade` e `tempo_morto_ms`); `inicio` só `detectado` ou `estimado`;
  contagens de pontos de 0 a 1000; `audio_sha256` com 64 dígitos hexadecimais; textos de 1 a 80 caracteres. Campos desconhecidos são ignorados e não
  voltam. Erros têm código estável (`json_invalido`, `versao`, `grande_demais`, `dados_invalidos`), traduzido na interface. O `detalhe` de `dados_invalidos` é `<caminho do campo>: <regra>` em código técnico (ex.: `tentativas[0].data: data_iso_8601`), não uma frase.
- **Sem indentação:** o app exporta o JSON compacto (uma linha) para caber nos 20 MiB da importação; se ainda assim passar, `exportarBackup` devolve `grandeDemais: true` (o aviso na tela depende de chave i18n nova). A leitura aceita com e sem indentação.
- **Ida e volta exata:** ler e escrever de volta dá o mesmo texto (a ordem das chaves é a deste documento). Testado em `tests/documento.test.ts` e
  `tests/armazenamento.test.ts` (exportar, limpar tudo, importar).

## Hit factor

HF = pontos ÷ tempo (s), com o tempo sendo o do último disparo **arredondado a centésimos de segundo** (half up), o mesmo que a tela mostra, e o HF
exibido com 4 casas: 28 pontos em 2,704 s mostram 2,70 s e HF 10,3704 (não 10,3550). Decisão D6; **confirmado: IPSC 9.2.1.1 e 9.7.1** (tempo com 2 casas; HF com 4 casas, CBTP Art.13 III). O regulamento **não diz** se o tempo cronometrado
é arredondado ou truncado: o half up é **convenção do app**. O HF é **sempre derivado, nunca guardado** no arquivo: tentativas antigas passam a mostrar o HF pela regra nova ao serem abertas, sem migração
de dados (só o valor exibido muda, de uma ou duas casas decimais). Major: A5, C4, D2. Minor: A5, C3, D1. Miss, no-shoot e procedimental valem −10 cada.
Os pontos nunca ficam abaixo de zero para o HF (HF = 0). Sem disparos não há HF. Com `pontos_maximos` no percurso, o app também mostra a fração dos
pontos do percurso. A pontuação é **opcional**: pode ser dada ao salvar ou depois, no Histórico, e pode ser tirada.


## Importar de outra pessoa (Etapa 8)

- O app abre os dois formatos: `nicska-backup/1` (tudo) e `nicska/1` (um percurso e as tentativas de UMA pessoa). Instala-se como destino de "Abrir com" e "Compartilhar" para `application/json` e `application/octet-stream` (o WhatsApp às vezes manda esse tipo); o conteúdo é conferido, então um arquivo de outro tipo é recusado com aviso.
- As tentativas importadas de outra pessoa guardam `atirador_id` (o `atirador.id` do arquivo) e a pessoa entra numa lista local de atiradores (`atiradores` no backup). Não aparecem no Histórico nem nos gráficos de quem importou; servem ao ranking (Etapa 9).
- Deduplicação por `id` da tentativa: importar o mesmo arquivo duas vezes não acrescenta nada, e nada existente é sobrescrito. O meu próprio arquivo importado de volta não cria "outro atirador".
- Limites: 20 MiB (em bytes), BOM ignorado, até 100 000 tentativas por arquivo, disparos crescentes de 0 a 10 min.
