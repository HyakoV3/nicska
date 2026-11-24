> **Arquivado (2026-11-23).** V1a a V3 estão implementadas (APK 032 a 046). O que falta (V4, restos do vídeo, validação no aparelho) está em [`../roadmap-ideas.md`](../roadmap-ideas.md) e [`../roadmap-pendencias.md`](../roadmap-pendencias.md); o resumo do feito, em [`roadmap-implementadas.md`](roadmap-implementadas.md).

# Ideia: gravar vídeo junto com o Standby (rascunho)

> **Status: rascunho REVISADO (2026-11-23).** As 7 decisões de vídeo e as 6 do avatar estão tomadas, mas a revisão técnica ([`revisao-ideia-video.md`](revisao-ideia-video.md), 27 achados) corrigiu o desenho e **reverte a decisão #4**; a seção "Correções da revisão" abaixo **prevalece** sobre o que estiver dito antes. Implementados (2026-11-23): P0a (avatar local), V1a (base), V1b (captura), V1c (tela e Revisão com vídeo), V2 (overlay na reprodução) e V2b (tela cheia ao gravar, opções em Ajustes → Registro e aba Cronômetro limpa, envio em pílula); tudo no APK 033, ainda sem teste em câmera real. **Mudou depois do rascunho:** o seletor Só áudio/Áudio+vídeo e a câmera moram em Ajustes → Registro (a aba Cronômetro não tem nada de vídeo); ao tocar em Standby no modo vídeo abre a tela cheia (enquadrar → Começar), com o botão do alto (toque cancela antes do apito; segurar 1 s para parar). Escrito a partir do código atual (`escutaNavegador.ts`, `escutaGravador.ts`, `timer*.ts`) e do roadmap (I-04, Etapa 1). Os pontos marcados **[aparelho]** só se confirmam no celular.

> **Ferramenta do S1 pronta (2026-11-23, branch `aud/s1-spike-video`):** tela escondida `/spike-video` (Ajustes, rodapé) que mede câmera, gravação com detector ligado nos 3 modos, armazenamento, compartilhar e ciclo de vida, e gera um relatório JSON; falta **rodá-la no aparelho** e mandar o relatório. Como usar e os critérios: [`spike-video.md`](../spike-video.md). O manifesto ganhou `CAMERA` só por causa dela.

## Correções da revisão (valem sobre o resto do texto)

| # | Correção | Origem |
|---|---|---|
| C1 | **Dois gravadores no mesmo fluxo:** o de hoje (só áudio, Opus, intocado: alimenta `audios`, reprocesso, `audio_sha256`, Ogg) e um **segundo** com vídeo + áudio, só para ver e compartilhar. O blob de vídeo **nunca** passa por `prepararOgg`. | achados 1 e 2 |
| C2 | **Câmera num `getUserMedia` separado** do microfone; o de áudio fica exatamente como está. Se a câmera falhar, o timer segue em **só áudio** com aviso. | achado 7 |
| C3 | **Decisão #4 revista:** o modo vídeo **não** é gabarito da Etapa 1. Gabarito = timer comercial ou **segundo aparelho** em câmera lenta (120/240 fps). **Sem modo "alta taxa" no V1.** | achado 4 |
| C4 | **Tripé longe do atirador aumenta o tempo medido** (~2d/c: 5 m ≈ 29 ms). O modo vídeo mostra um aviso e a tentativa leva uma marca **local** (fora do JSON) para não entrar como gabarito. | achado 3 |
| C5 | **Pré-roll = o próprio atraso do Standby** (a gravação já começa antes do aviso e do atraso de 1 a 4 s). Sem buffer circular. | achado 12 |
| C6 | **WebM do `MediaRecorder` não tem `Duration` nem `Cues`:** reescrever o cabeçalho depois de gravar e pedir keyframes de ~1 s; quadro a quadro de verdade exige WebCodecs (V4). | achado 5 |
| C7 | **Armazenar em pedaços** (`videos_pedacos`, chave `[id, n]`), montar o Blob só para tocar; o "tem vídeo" fica na própria loja `videos`, **não** em `TentativaGuardada`. Confirmar no spike S2. | achados 8 e 9 |
| C8 | **Ciclo de vida:** app oculto ou tela bloqueada no modo vídeo → o **áudio segue** com o serviço, o vídeo para e a tentativa fica com **vídeo parcial**; sem serviço do tipo `camera` no V1. **Orientação travada** durante a gravação (ponte nativa). | achados 10 e 11 |
| C9 | **Bitrate fixo por qualidade (REVISTA 2026-11-23: a pessoa escolhe 720p/1080p e 30/60 fps em Ajustes → Qualidade do vídeo; padrão 720p30; 720p60 3,5 Mbps, 1080p30 4, 1080p60 6; 1080p e 60 fps dependem do que o S1 medir no aparelho):** 2 Mbps em 720p30, `frameRate: {ideal: 30}`, ler `getSettings()` (a taxa real pode ser menor). As contas de tamanho só valem assim. | achado 14 |
| C10 | **Compartilhar vídeo só na V3**, com caminho próprio e MIME/extensão de vídeo; exportar por **WebCodecs + muxer** se o spike S4 mostrar que é viável, senão `captureStream`. MP4 só se `isTypeSupported` e o WhatsApp tocarem. | achados 1, 13 e 19 |
| C11 | **Avatar do P0a:** só **galeria** (sem câmera) até existir `CAMERA` e o caminho no `file_paths.xml`; tratar HEIC com mensagem de recusa. | achado 6 |
| C12 | **P0b só depois de:** CONS-014 (aviso do nome no JSON), **CSP ativa** (CONS-015) e validador de **cabeçalho** do avatar (recusar acima de 96 × 96 antes de decodificar; limite no **base64**; exibir só por `blob:`/canvas). | achados 16 e 17 |
| C13 | `CAMERA` entra com `uses-feature camera required="false"`; atualizar `manifesto.test.ts`, `SECURITY.md` e a privacidade. | achado 18 |
| C14 | O clarão do apito é **só na reprodução** (CONS-033). "Fixar" vídeos é conceito **novo**, só local e fora do backup. A pré-visualização desliga fora da aba Timer e depois de 60 s parada. | achados 21, 22 e 15 |

**Ordem nova:** **S1** (capacidade do WebView) → **S2 ‖ S3** (armazenamento/envio; ciclo de vida) → **V1 enxuta** → **V2** → **S4** → **V3** → **V4**. O **P0a** (feito) corre em paralelo; o **P0b** espera o que está em C12. Detalhe dos spikes, critérios, estimativas e o plano B (câmera nativa): [`revisao-ideia-video.md`](revisao-ideia-video.md).

## A ideia

Hoje o Standby grava só o **áudio** (Opus a 64 kbps) e o detector mede em cima dele. A proposta: antes de tocar em Standby, a pessoa escolhe **como registrar** a tentativa:

- **Só áudio** (padrão, o que existe hoje): celular no bolso, na cintura ou na baia; tela pode apagar com o serviço em primeiro plano (a validar, CONS-007).
- **Áudio + vídeo**: alguém filma (ou o celular fica num tripé). O vídeo guarda a tentativa para rever, mostrar e compartilhar, com **overlays** (tempo, disparos, splits, dados do percurso).

O detector continua sendo feito **pelo áudio**, nos dois modos. O vídeo é registro e revisão, não medição.

## Como a pessoa vê

Na aba Timer, acima do botão Standby (a barra fixa), um seletor de duas posições, lembrado entre usos:

```
  Registrar:  [ Só áudio ]  [ Áudio + vídeo ]
```

- Em **Áudio + vídeo** aparece uma **pré-visualização da câmera** (para enquadrar o atirador) e um botão para trocar traseira/frontal. A pré-visualização só abre ao escolher o modo, não antes.
- Ao tocar em Standby no modo vídeo, o vídeo **já está rodando** (pré-roll: começa uns segundos antes do apito, para a revisão mostrar a postura de largada).
- No modo vídeo a tela fica **acesa** (a câmera para com a tela apagada, ver Limites). Um aviso curto diz isso.
- Primeira vez no modo vídeo: aviso de privacidade ("o vídeo fica só neste aparelho; avise quem está no estande"), uma vez, como o `AvisoVoz`.

## O que muda por baixo

| Parte | Hoje | Com vídeo |
|---|---|---|
| Captura | `getUserMedia({ audio })` com filtros desligados | `getUserMedia({ audio, video })` **só no modo vídeo**: o mesmo fluxo alimenta o detector (áudio) e o gravador |
| Gravador | `MediaRecorder` só áudio (Opus, 64 kbps) | `MediaRecorder` com vídeo + áudio (WebM VP8/VP9 ou MP4/H.264 conforme o WebView aceitar) |
| Detector | worklet no mesmo fluxo | **igual** (não toca no vídeo) |
| Zero do tempo | `zeroNoAudioS` (apito no áudio) | o mesmo zero vale para o vídeo: o arquivo é um só, áudio e vídeo sincronizados pelo próprio contêiner |
| Armazenamento | store `audios` no IndexedDB, **fora do backup e do JSON** | store novo `videos`, também **fora do backup e do JSON** |
| Permissão | `RECORD_AUDIO` | acrescenta `CAMERA`, pedida só ao escolher o modo vídeo |

Formato do documento (`nicska/1` e backup): **não muda** no começo. A tentativa só ganha um indicador local ("tem vídeo", como já existe `audio` local). Se um dia o JSON precisar dizer que o registro foi em vídeo, entra como campo opcional (a leitura ignora campos novos).

## Overlays: três caminhos

O que aparece sobre o vídeo, em ordem de prioridade:

1. **Durante a largada:** "STAND BY" e um aviso do apito (um clarão curto na hora do apito ajuda a achar o zero no vídeo).
2. **Cronômetro ao vivo:** tempo desde o apito (00,00 s), com a fonte dos números do app.
3. **Disparos:** uma marca e o número a cada tiro, com o **split** ao lado; o total ao fim.
4. **Cabeçalho:** percurso, divisão e data, pequenos, no alto. O **nome e o avatar** do atirador ficam no canto inferior esquerdo (quase sempre filmam a pessoa de costas, então o avatar mostra quem é; ver a seção do avatar).
5. **Resultado final:** total, primeiro disparo, nº de disparos, HF/pontos se pontuado, selo de "incompleta" se for o caso (CONS-023).
6. **Marca discreta:** "Nicska" e "treino, não oficial" (decisão de estilo sua).

Onde desenhar:

| Caminho | Como | Vantagem | Custo |
|---|---|---|---|
| **A. Gravar já com overlay** | desenhar vídeo + overlay num `<canvas>` e gravar o `canvas.captureStream()` | o arquivo já sai pronto para compartilhar em qualquer app | CPU e bateria subindo junto com o detector; risco de quadros perdidos; a revisão (apagar/inserir disparo) **não** muda o que foi gravado |
| **B. Vídeo cru + overlay na reprodução** | gravar o vídeo limpo; na Revisão, desenhar o overlay por cima com DOM/SVG/canvas, sincronizado ao tempo do vídeo | gravação leve e robusta; o overlay acompanha a **revisão** (se a pessoa corrige um disparo, o overlay corrige junto); dá para ligar e desligar partes | para compartilhar com overlay é preciso gerar um arquivo (caminho C) |
| **C. Exportar com overlay sob demanda** | ao tocar em "Compartilhar vídeo com tempos", reproduzir o vídeo cru num canvas com o overlay e gravar o `captureStream()` (tempo real: 30 s de vídeo levam 30 s) | arquivo pronto, com os tempos já corrigidos | demora igual à duração do vídeo; app precisa ficar aberto **[aparelho]** |

**Recomendação:** **B + C**. Gravar cru (barato, confiável, não atrapalha o detector) e dar o overlay na reprodução; exportar com overlay só quando a pessoa pedir. O caminho A fica como opção futura, se a CPU permitir.

## Limites e riscos

- **Tela apagada:** a câmera para quando o app sai de primeiro plano e a tela apaga (Android 9+; o bloqueio real aqui é o WebView pausado em `onPause`, e um serviço `camera` só ajudaria do Android 11 em diante, com `FOREGROUND_SERVICE_CAMERA` no 14). O modo vídeo exige tela acesa (wake lock) e o app aberto; é exatamente por isso que o modo **só áudio** continua sendo o do bolso. O serviço em primeiro plano atual (`ServicoAudio`, tipo microfone) não resolve câmera. **[aparelho]**
- **Carga do aparelho:** vídeo + codificação + detector no mesmo celular (calor, bateria, quadros perdidos, áudio picotado). Medir antes de prometer; começar em 720p/30 fps.
- **Tamanho:** a 720p e 1,5 a 2,5 Mbps, um vídeo de 3 min (o teto da tentativa, `TEMPO_MAXIMO_MS`) tem cerca de 35 a 55 MB; a tentativa típica de 15 a 30 s, cerca de 3 a 9 MB. Precisa de política (abaixo).
- **Contêiner e compartilhamento:** o `MediaRecorder` do Android WebView grava WebM **sem duração nem índice** (C6); o **WhatsApp e vários apps tocam mal WebM**. MP4 no `MediaRecorder` só existe em WebView novo. **[aparelho]** Se só houver WebM, o caminho C pode precisar entregar MP4 por outro meio (a verificar; Tauri não traz codificador de vídeo).
- **Sincronia:** o áudio e o vídeo do mesmo `MediaRecorder` ficam alinhados pelo contêiner, mas o **zero** (apito) é achado no áudio; o desvio entre áudio e imagem do aparelho (alguns quadros, ~30 a 60 ms) não afeta o tempo medido, só o encaixe do overlay.
- **Privacidade:** o vídeo pega rostos de pessoas no estande. Fica só no aparelho, **nunca** no backup nem no JSON compartilhado, e só sai por um toque em "Compartilhar". Com `INTERNET` removida do release, não há envio escondido; a pergunta é só o que a pessoa compartilha.
- **Permissões:** `CAMERA` entra no manifesto (muda `tests/manifesto.test.ts`, `SECURITY.md` e o texto de privacidade). A CSP proposta (`docs/proposta-csp.md`) precisa continuar permitindo `blob:` e `media-src`.

## Avatar da pessoa no overlay (bônus)

Quem filma costuma pegar o atirador **de costas**: o avatar mostra quem é, no canto inferior esquerdo do overlay e, de bônus, no Ranking e no Histórico.

### Onde a pessoa "sobe" o avatar

Hoje o Nicska é **offline** (o release nem tem a permissão `INTERNET`) e não existe servidor. Então a resposta é:

- **V1 (agora): só neste aparelho.** Ajustes → **Meu perfil** (junto com nome e divisão): tocar em "Escolher foto" abre o seletor do Android (galeria **ou** câmera, por `<input type="file" accept="image/*">`, sem permissão nova). O app recorta em círculo (arrastar e dar zoom), aplica um filtro e guarda uma imagem pequena no IndexedDB (store `avatares`, 256 × 256, WebP, ~10 a 25 KB).
- **Compartilhar o avatar com outras pessoas (opt-in):** uma **miniatura de 96 × 96** (~3 a 8 KB) pode ir **dentro do JSON** (`atirador.avatar`, campo **opcional**, compatível: quem não conhece o campo ignora), **só se a pessoa marcar** "mandar minha foto junto". Assim o ranking entre amigos mostra o rosto de cada um. **Desligado por padrão**: é foto de rosto, dado pessoal. Quem recebe pode **ignorar** os avatares dos outros.
- **Futuro (Etapas 10/11 do roadmap, site e identidade):** quando houver conta e servidor, o avatar sobe lá. O campo fica **separado e pequeno** justamente para isso ser trocar a origem, não refazer. Hoje **não** há onde subir.

### Filtros e "IA"

**Locais (baratos, no `<canvas>`, sem rede):** Original · Preto e branco · Sépia · Alto contraste · Duotone na cor do tema · "Quadrinho" (reduzir cores) · Pixel. Escolhidos numa fileira de miniaturas, com prévia imediata.

**3D, caricatura, IA generativa:** **não rodam bem no aparelho** (modelo de dezenas de MB, bateria, tempo) e na nuvem exigiriam `INTERNET`, conta, custo e enviar o rosto para um terceiro: **fora do V1**. O caminho recomendado é **a pessoa gerar o avatar no app que quiser** (qualquer app de IA ou filtro) e **importar a imagem**; o Nicska só recorta, filtra e guarda. Custo zero para nós, liberdade total para ela, e nenhum rosto sai do aparelho por nossa conta. Se um dia valer um modelo no aparelho (MediaPipe/ONNX), entra como pacote opcional, com consentimento.

### Como entra no overlay

- Círculo de ~**14% da altura** do vídeo, borda na cor do tema, no canto **inferior esquerdo** (quem filma de costas pega o atirador de pé, o avatar fica perto do pé dele), com o **nome** ao lado. O **cronômetro grande** e a lista de splits ficam no canto **inferior direito** (os tempos empilhados acima do total); o cabeçalho (percurso, data, divisão) fica no alto, pequeno. A posição de cada bloco é ajustável em Ajustes (padrão: avatar embaixo à esquerda, tempo embaixo à direita).
- Sem avatar: **iniciais** do nome num círculo colorido (também serve de avatar padrão no Ranking).
- Ligar/desligar o avatar e o nome no overlay em Ajustes (privacidade: dá para filmar e exportar sem rosto).

### Segurança e privacidade

- Avatar **recebido de outra pessoa** é dado não confiável: aceitar só `data:image/webp|jpeg|png;base64,`, **até ~16 KB**, conferir os bytes de assinatura do arquivo, redesenhar no `<canvas>` antes de exibir (descarta metadados) e nunca inserir como HTML.
- Aviso de privacidade ao ligar "mandar minha foto junto" ("quem receber o arquivo verá seu rosto; você pode desligar a qualquer hora, mas arquivos já enviados não voltam").
- **Backup:** leva o avatar do próprio usuário (o backup serve para restaurar o aparelho). **JSON compartilhado:** só leva a miniatura com o opt-in acima. (Proposta; confirmar na pergunta 2.)
- LGPD: foto de rosto é dado pessoal; tudo local, apagar o avatar apaga o arquivo e o campo.

## Armazenamento (política proposta)

- Store `videos` à parte, como `audios`; lido só ao reproduzir.
- Ajuste "Guardar vídeos": os **N mais recentes** (padrão 20) ou até **X MB** (padrão 500 MB), apagando os mais antigos; os **fixados** (estrela) não são apagados.
- Tela de armazenamento em Ajustes (quanto os vídeos ocupam) e "apagar todos os vídeos".
- Aviso quando `navigator.storage.estimate()` mostrar pouco espaço.
- **Apagar a tentativa apaga o vídeo** (como o áudio hoje).

## Ligação com o que já existe

- **Etapa 1 (gabarito):** **corrigido pela revisão (C3).** O vídeo do mesmo aparelho **não** serve de gabarito: o gabarito segue sendo timer comercial ou um **segundo aparelho** filmando em câmera lenta. O modo vídeo ajuda a **rever** as tentativas, mas não substitui o gabarito nem a aba Calibrar.
- **I-04 (tempos desenhados sobre vídeo importado):** é o mesmo overlay do caminho B/C, mas partindo de um vídeo de fora. Os dois compartilham o desenho do overlay; fazer o overlay como componente independente do `<video>`.
- **Revisão:** o player de vídeo entra na Revisão (hoje há o áudio e a linha do tempo); clicar numa marca leva o vídeo àquele quadro.
- **Calibrar:** a aba foi removida em 2026-11-23; o vídeo nunca dependeu dela.

## Fatias (cada uma entrega algo)

0. **P0 — (P0a feito, ver abaixo) Perfil com avatar (independente do vídeo, pode sair antes):** Ajustes → Meu perfil, escolher foto, recorte, filtros locais, iniciais como padrão; avatar no Ranking e no Histórico. Opt-in de mandar a miniatura no JSON só se decidir já (depende do formato).
1. **V1 — Gravar:** seletor Só áudio / Áudio + vídeo, `CAMERA`, captura de vídeo + áudio, pré-visualização, armazenamento (store `videos`, limite por quantidade), aviso de privacidade. Revisão toca o vídeo e leva ao instante da marca.
2. **V2 — Overlay na reprodução:** cronômetro, disparos, splits e **avatar com nome** sobre o vídeo, componente independente; acompanha a revisão.
3. **V3 — Exportar com overlay:** gerar o arquivo com os tempos e compartilhar; decidir contêiner (MP4 se o WebView deixar).
4. **V4 — Quadro a quadro e comparação:** navegar quadro a quadro, medir contra o detector (ferramenta de gabarito), I-04.

Cada fatia nasce com testes: estado da escolha (puro, em `preferencias`), escolha do formato (como `escolherFormato`), política de armazenamento (pura), e o e2e com câmera falsa do Chrome (`--use-fake-device-for-media-stream`, sem som, como o e2e atual).

## Decisões tomadas (2026-11-23: "vamos de recomendação nas 7")

| # | Decisão |
|---|---|
| 1 | **Overlay:** gravar o vídeo **cru**, desenhar o overlay na reprodução (B) e exportar com overlay sob demanda (C). Gravar o overlay direto (A) fica como opção futura. |
| 2 | **Padrão:** o seletor começa em **Só áudio** e lembra a última escolha. |
| 3 | **Câmera:** **traseira** como padrão, com troca para a frontal. |
| 4 | ~~O V1 serve de gabarito a 60 fps.~~ **REVISTA (C3):** o modo vídeo não é gabarito (16,7 ms por quadro, desvio áudio × imagem, aparelho medido = aparelho gabarito); a Etapa 1 usa timer comercial ou segundo aparelho em câmera lenta. Uso comum em 720p/30. |
| 5 | **Marca no overlay:** "Nicska" e "treino, não oficial" em canto discreto, **desligável** em Ajustes. |
| 6 | **Espaço (REVISTA 2026-11-23):** a pessoa escolhe em Ajustes → **Retenção de vídeos**: **espaço reservado** (controle de 100 MB a 8 GB, padrão 1 GB) e **prazo** (7 dias, 1 mês, 3 meses ou sem prazo, padrão 1 mês). Apaga primeiro o que passou do prazo e depois os mais antigos até caber; **fixados** ficam. Feito na V1a (`video/politica.ts`, `RetencaoDeVideo.svelte`). |
| 7 | **Compartilhar:** tentar **MP4** no V3 se o WebView do aparelho deixar; senão, WebM com aviso de que alguns apps (WhatsApp) tocam mal. Decidir depois de testar o aparelho. |

## Decisões do avatar (2026-11-23: "vamos de recomendação")

| # | Decisão |
|---|---|
| 1 | **Só local no V1**; servidor fica para as Etapas 10/11. |
| 2 | **Backup leva o avatar**; o **JSON compartilhado só leva a miniatura com opt-in** (desligado por padrão). |
| 3 | **Filtros locais do V1:** Original, P&B, Sépia, Alto contraste, Duotone do tema, Quadrinho, Pixel. |
| 4 | **Sem IA dentro do Nicska no V1**: a pessoa gera o avatar no app que quiser e **importa a imagem**. |
| 5 | **Ranking mostra o avatar dos outros** (quando mandarem), com opção de ocultar; sem foto, **iniciais**. |
| 6 | **P0 (perfil com avatar) antes do vídeo.** Posição no overlay: **avatar embaixo à esquerda**, tempo embaixo à direita. |

**P0a feito (2026-11-23, branch `aud/p0a-avatar`, falta validar no aparelho):** Ajustes → **Meu perfil** (nome + foto), editor com arrastar, zoom e setas, 7 filtros locais com miniaturas (`avatarFiltros.ts`, `avatarRecorte.ts`, `avatarImagem.ts`), saída 256 × 256 em WebP (recuo para JPEG/PNG), componente `Avatar.svelte` (foto ou iniciais) e Ranking com avatar (foto só para "eu"; iniciais para os outros). Armazenamento: loja `avatares` (IndexedDB v3, migra da v2 sem perder nada), `salvarAvatar`/`lerAvatar`/`apagarAvatar`; `apagarTudo` também apaga. **Ficou fora (P0b):** avatar no Histórico, campo `atirador.avatar` no formato, opt-in no JSON, avatares dos outros, ocultar, e o avatar no backup. `docs/FORMATO.md` **não muda**: nesta fatia o avatar não entra no backup nem no JSON compartilhado. Não há campo de divisão do atirador na interface (a divisão é do percurso), então o perfil só tem nome e foto.

Divisão do P0: **P0a** (local: perfil, recorte, filtros, iniciais, Ranking) primeiro; **P0b** (campo opcional no formato, opt-in no JSON, avatares dos outros e ocultar) depois, porque mexe em `documento/*` e `armazenamento/*`.

## Itens da auditoria que isto toca

CONS-007 (tela bloqueada: o vídeo não funciona assim), CONS-015/016/017 (CSP, `INTERNET`, backup: `CAMERA` e vídeo fora do backup), CONS-018 (créditos), CONS-014 (JSON leva o nome; o avatar é dado de rosto), CONS-031 (layout, paisagem), CONS-048 (desempenho: reprocesso e carga), CONS-054 (testes de componente). Uma rodada de auditoria deve olhar privacidade, permissões e carga do aparelho **antes** da V1 ir para o APK.
