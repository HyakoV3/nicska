> **Arquivado (2026-11-23).** Implementado (Ogg/Opus, APK 019 em diante); o teste nos apps de mensagem está em [`../roadmap-pendencias.md`](../roadmap-pendencias.md).

# Ideia: enviar a gravação no formato que o app de destino aceita (rascunho)

**Status:** implementado na PR #133 e **funcionou no aparelho do responsável** (2026-11-22): a gravação sai como `.ogg` (Ogg/Opus) e o WhatsApp aceita como áudio. Falta só a limpeza (ver "Pendências"). O texto abaixo é o rascunho original, mantido pelo raciocínio.

## O problema (teste no aparelho do responsável, WhatsApp)

- Enviar a gravação como **`.webm`**: o WhatsApp recusou ("formato não compatível").
- Enviar como **`.weba`** (o mesmo conteúdo, outro nome; o interruptor da PR #120): o WhatsApp aceitou, mas **como arquivo** (documento), não como **áudio** tocável na conversa.
- O conteúdo é Opus dentro de WebM (`audio/webm;codecs=opus`, 64 kbps, mono: `channelCount: 1` no `getUserMedia`), que o `MediaRecorder` do WebView grava. Esse formato é pequeno, mas não é o que os apps de mensagem esperam.

### Provável causa dos dois resultados (achado na revisão)

O app de destino não vê só o `type` do Intent: ele costuma perguntar o tipo ao `FileProvider` (`ContentResolver.getType`), e o `FileProvider` deduz o MIME **pela extensão** (`MimeTypeMap`). Nas tabelas de MIME do Android:

- `.webm` → `video/webm` (não há `audio/webm`): o WhatsApp tenta tratar como **vídeo** e recusa.
- `.weba` → **não existe** na tabela → `application/octet-stream`: vira **documento**.
- `.ogg`, `.oga`, `.opus` → `audio/ogg`. `.m4a` → `audio/mpeg` (sim, errado; o Signal corrige isso no próprio código). `.aac` → `audio/aac`.

Fontes: [mime.types do Android](https://android.googlesource.com/platform/external/mime-support/+/refs/heads/main/mime.types), [android.mime.types](https://android.googlesource.com/platform/frameworks/base/+/refs/heads/main/mime/java-res/android.mime.types), [Signal MediaUtil](https://github.com/signalapp/Signal-Android/blob/main/app/src/main/java/org/thoughtcrime/securesms/util/MediaUtil.java) (corrige `audio/mpeg`+`.m4a` para `audio/mp4`). Confiança: **alta** para a tabela (ramo `main`; aparelhos antigos podem ter outra); **média** para "o WhatsApp usa `getType`" (dedução, sem fonte do WhatsApp).

Consequência: **trocar só o nome não resolve**; é preciso o conteúdo certo **e** a extensão certa (que dá o MIME certo).

## Como é hoje

- O Gravador grava em `FORMATOS_PREFERIDOS` (`src/lib/gravador.ts`): `audio/ogg;codecs=opus` → `audio/webm;codecs=opus` → `audio/mp4` → `audio/webm`. No Chrome Android, na prática, sai WebM/Opus (o Ogg não é aceito pelo `MediaRecorder` do Chrome; observado no aparelho, sem fonte oficial nesta pesquisa).
- A gravação fica guardada nesse formato (pequena).
- "Enviar" (`src/lib/compartilhar.ts`, `PonteCompartilhar.kt`) copia o arquivo para `cache/compartilhar/<instante>/`, gera a URI pelo `FileProvider` (`${applicationId}.fileprovider`, `res/xml/file_paths.xml`) e abre a folha do sistema (`ACTION_SEND` + `EXTRA_STREAM`, `type` = o MIME sem parâmetros). A ponte só aceita MIME no padrão `[a-z]+/[a-z0-9.+-]+`: um `audio/ogg; codecs=opus` hoje cairia para `audio/*`.
- O app de destino só aparece **depois** de a pessoa escolher na folha: o app não sabe qual será.

## A ideia

1. **Guardar** como hoje (WebM/Opus, pequeno).
2. **Na hora de enviar**, a pessoa escolhe o **app de destino** (uma lista nossa, com os apps de mensagem instalados) e o app **converte** o arquivo para o formato que aquele app mais usa para áudio: uma tabela **de-para** (app → contêiner/codec/MIME/extensão).
3. Depois de converter, envia direto para o app escolhido (`setPackage`), com o MIME certo.

A revisão abaixo conclui que **a tabela de-para não é necessária**: um único formato (Ogg/Opus) serve a todos os destinos pesquisados. Ver "Recomendação".

## Tabela de-para (pesquisada)

Legenda de confiança: **C** = confirmado em fonte oficial ou no código-fonte do app; **P** = provável (dedução de fonte próxima); **N** = não confirmado.

| App (pacote) | Aceita como áudio | Vira nota de voz? | Formato recomendado | MIME | Observações e fonte |
|---|---|---|---|---|---|
| WhatsApp (`com.whatsapp`) | Ogg/Opus, MP3, M4A (AAC), AAC, AMR: **C** na API do WhatsApp Business; no app comum via `ACTION_SEND`: **P** | Ogg/Opus é o formato exigido para nota de voz na API: **C**. Recebido pela folha de compartilhar virar nota de voz (e não áudio comum): **N** | `.ogg` (Opus, mono) | `audio/ogg` (a API diz "OPUS codec only"; Ogg com outro codec não vale) | [Meta, audio messages](https://developers.facebook.com/documentation/business-messaging/whatsapp/messages/audio-messages): formatos, "Voice messages require .ogg files encoded with the OPUS codec", "mono input only". É a API de empresas, não o app; não há documentação pública do `ACTION_SEND` do app. WebM recusado e `.weba` como documento: explicados acima. |
| WhatsApp Business (`com.whatsapp.w4b`) | Igual ao WhatsApp: **N** (mesmo cliente, presumido) | **N** | `.ogg` (Opus) | `audio/ogg` | Testar no aparelho. |
| Telegram (`org.telegram.messenger`) | Sim, qualquer áudio (mp3/m4a viram "música", com título): **C** | **Sim**, se o Intent tiver `type` começando por `audio/ogg` **e** contendo `codecs=opus` e o arquivo for Opus de verdade; ou, como documento, extensão `.ogg` + Opus: **C** | `.ogg` (Opus) | `audio/ogg; codecs=opus` no `type` do Intent | Código do app: [LaunchActivity.java](https://github.com/DrKLO/Telegram/blob/master/TMessagesProj/src/main/java/org/telegram/ui/LaunchActivity.java) (`type.startsWith("audio/ogg") && type.contains("codecs=opus") && isOpusFile(path)` → `voicePath`) e [SendMessagesHelper.java](https://github.com/DrKLO/Telegram/blob/master/TMessagesProj/src/main/java/org/telegram/messenger/SendMessagesHelper.java) (`.ogg` + `isOpusFile` → `voice = true`). |
| Signal (`org.thoughtcrime.securesms`) | Sim, qualquer `audio/*` vira anexo de áudio (`AudioSlide`): **C** no código. Tocar Ogg/Opus: **P** | Não: a nota de voz do Signal é AAC gravada pelo próprio app; anexo de fora fica como áudio comum: **P** | `.ogg` (Opus); `.m4a` se não tocar | `audio/ogg` | [MediaUtil.java](https://github.com/signalapp/Signal-Android/blob/main/app/src/main/java/org/thoughtcrime/securesms/util/MediaUtil.java), [AudioRecorder.java](https://github.com/signalapp/Signal-Android/blob/main/app/src/main/java/org/thoughtcrime/securesms/audio/AudioRecorder.java) (`AUDIO_AAC`). |
| Gmail / e-mail (`com.google.android.gm`) | Anexo de qualquer tipo: **P** | n/a | `.ogg` | `audio/ogg` | Sem fonte oficial sobre áudio; o destinatário (iPhone, Outlook) pode não tocar Ogg: **N**. |
| Google Drive / nuvem própria | Guarda qualquer arquivo; o Drive "abre arquivos de áudio": **C** (sem lista de formatos) | n/a | `.ogg` | `audio/ogg` | [Drive, tipos de arquivo](https://support.google.com/drive/answer/2423485). Prévia de Ogg no Drive: **N**. |
| Mensagens (Google Messages, `com.google.android.apps.messaging`) | RCS envia "arquivos de áudio": **C** (sem lista de formatos). Ogg: **N**; MP3/AAC são os mais aceitos em RCS: **P** | **N** | `.ogg`; testar; MMS (sem RCS) tem limite de tamanho da operadora | `audio/ogg` | [Ajuda do Messages](https://support.google.com/messages/answer/6159880), [AWS, RCS file messages](https://docs.aws.amazon.com/sms-voice/latest/userguide/rcs-file-messages.html) (aceita `audio/mp3` e `audio/aac`; é API de empresas). |

## Pontos para decidir (respondidos)

- **Sem reencodar quando der:** sim. O Android lê Opus em Matroska/WebM (`MediaExtractor`, Android 5+) e o `MediaMuxer` grava Ogg (`MUXER_OUTPUT_OGG`) **só a partir do API 29** (Android 10). O projeto tem `minSdk = 24`, então Android 7 a 9 ficariam sem. Remux em JS/TS ou Rust funciona em qualquer versão (e no desktop). **C**: [MediaMuxer.OutputFormat](https://developer.android.com/reference/android/media/MediaMuxer.OutputFormat), [formatos suportados](https://developer.android.com/media/platform/supported-formats). Robustez do `MediaMuxer` Ogg com Opus: **N**. Decisão: **remux em TS** (ver Recomendação).
- **Quando precisa reencodar:** só se algum destino recusar Ogg (candidatos: Messages/MMS, e-mail para iPhone). Opus → AAC `.m4a` com `MediaCodec` (decodificador Opus Android 5+, codificador AAC sempre) é perda de qualidade e tempo proporcional à duração (tempo real em aparelho: **N**). Fica como etapa opcional.
- **Como o WhatsApp trata:** pela API, `.ogg` com Opus é o único formato de nota de voz; MP3/M4A/AAC são áudio comum. Pelo `ACTION_SEND` do app, **N**: testar se Ogg/Opus chega como nota de voz (microfone) ou como áudio (fone). O MIME importa porque decide áudio × vídeo × documento (ver "Provável causa").
- **Descobrir o app de destino:** não fazer lista própria. `queryIntentActivities` exige `<queries>` com `<intent>` `SEND` + `mimeType` no Android 11+ ([visibilidade de pacotes](https://developer.android.com/training/package-visibility/declaring)), e o Google orienta a **não** montar lista própria ("Don't display your app's own list of share targets", [Sharesheet](https://developer.android.com/training/sharing/send)). O `ChooserResult`/`EXTRA_CHOSEN_COMPONENT` chega por `IntentSender` **depois** da escolha (tarde para converter); `ChooserTarget` está obsoleto desde o Android 11. **C**.
- **Padrão sem escolher app:** Ogg/Opus (`.ogg`, `audio/ogg`, e `type` do Intent `audio/ogg; codecs=opus`). Plano B universal: AAC em `.m4a` (`audio/mp4`).
- **Alternativas modernas:** `ContentProvider` com `getStreamTypes`/`openTypedAssetFile` existe e é feito para conversão ([ContentProvider](https://developer.android.com/reference/android/content/ContentProvider#openTypedAssetFile(android.net.Uri,%20java.lang.String,%20android.os.Bundle))), mas só funciona se o app de destino chamar `openTypedAssetFileDescriptor`. O Telegram não chama (usa `getType` e copia o fluxo: **C** no código); WhatsApp e Signal: **N**, improvável. `ClipData` com vários itens/MIME: o app de destino escolhe o que entende, e o Google desaconselha misturar tipos. Descartados.
- **Tamanho e privacidade:** remux não muda o tamanho (só a caixa, alguns bytes por página Ogg). Tudo local. A limpeza por hora do cache já cobre o arquivo convertido.
- **O interruptor `.webm | .weba`** da PR #120: **sai** quando o Ogg estiver testado. Nenhuma das duas opções dá áudio no WhatsApp (explicado acima). Se quiser, fica um "enviar o original (WebM)" escondido em avançado, sem o `.weba`.

## Recomendação

**Guardar WebM/Opus como hoje e, ao enviar, remuxar (sem reencodar) para Ogg/Opus em TypeScript, entregando `.ogg` pela folha do sistema com o `type` `audio/ogg; codecs=opus`.** Um formato só, sem tabela de-para, sem lista de apps.

Por quê:
- É o formato de nota de voz do WhatsApp (API) e do Telegram (código), e é áudio comum aceito pelos outros pesquisados.
- Sem perda, rápido, mesmo tamanho.
- Em TS fica no mesmo caminho de hoje (o `Blob` já está no JS), é testável no Vitest e vale para Android 7+ e desktop. A ponte Kotlin muda pouco (aceitar `;codecs=opus` no MIME).
- Trabalho do remux: ler o EBML do WebM (`CodecPrivate` = `OpusHead`, `SimpleBlock`s), escrever páginas Ogg com CRC, `OpusTags` e granule position = amostras a 48 kHz (com pre-skip), como manda a [RFC 7845](https://www.rfc-editor.org/rfc/rfc7845) e o [mapeamento Opus do Matroska](https://www.matroska.org/technical/codec_specs.html). Duração das amostras sai do TOC de cada pacote Opus ([RFC 6716 §3.1](https://www.rfc-editor.org/rfc/rfc6716#section-3.1)). Bônus: o Ogg resultante tem duração conhecida (o WebM ao vivo não tem).

Alternativas descartadas:
- **Lista própria de apps + tabela de-para + `setPackage`:** mais código e manutenção, `<queries>` no manifesto, contra a orientação do Google; e a pesquisa não mostrou destino que precise de formato diferente.
- **`MediaMuxer` (Kotlin):** só API 29+ (o app aceita 24) e robustez do Ogg/Opus não confirmada; exigiria também `MediaExtractor` lendo o WebM sem duração do Chrome (**N**).
- **Remux em Rust:** tão bom quanto TS, mas obriga levar os bytes JS → Rust → Kotlin; ganha só se o remux precisar rodar fora do WebView. Segunda opção.
- **`ContentProvider` que converte sob demanda:** os apps de mensagem não pedem tipo (ver acima).
- **Gravar direto no formato final:** Ogg não sai do `MediaRecorder` do Chrome. MP4/AAC existe no Chrome desde a 126 (`audio/mp4;codecs=mp4a.40.2`, [intent to ship](https://groups.google.com/a/chromium.org/g/blink-dev/c/p1OMVj1FrMI), versão por [fonte secundária](https://blog.addpipe.com/duration-in-mp4-files-produced-by-chrome-safari/)), mas o suporte no WebView Android é **N**, o MP4 do Chrome também sai sem duração, e AAC não vira nota de voz em lugar nenhum. Vale só como plano B se o Ogg falhar no WhatsApp.

## Plano em etapas pequenas

1. *(dispensada: o teste foi direto com o APK 077)* **Prova manual (sem código no app; arquivos de teste prontos em 2026-11-22: `gravacao-teste.ogg`, Opus mono 48 kHz, 9 s, 3 notas, e `gravacao-teste.m4a`, AAC, para comparar):** converter uma gravação real com `ffmpeg -i g.webm -c:a copy g.ogg`, copiar para o celular e compartilhar pelo gerenciador de arquivos para WhatsApp, Telegram, Signal e Messages. Anotar: áudio, nota de voz ou documento. Se o WhatsApp não aceitar Ogg como áudio, parar e reavaliar (plano B: `.m4a`).
2. *(feito na PR #133)* **Ler WebM em TS** (`src/lib/webm.ts`): extrair `OpusHead` e a lista de pacotes com tempo. Teste no Vitest com uma gravação pequena real como fixture (canais = 1, 48 kHz, contagem de pacotes).
3. *(feito na PR #133)* **Escrever Ogg em TS** (`src/lib/ogg.ts`): páginas, CRC, `OpusHead`/`OpusTags`, granule. Teste: CRC de página conhecido; e conferir a saída com `ffprobe`/`opusinfo` fora do app (duração certa, sem erro).
4. *(feito na PR #133)* **Ligar no envio:** `compartilharGravacao` converte quando o tipo for WebM/Opus; nome `.ogg`; se o remux falhar, envia o original (como hoje). Teste no Vitest do fluxo (com ponte falsa).
5. *(feito; testado no aparelho)* **Ponte Kotlin:** o `type` do Intent fica `audio/ogg` **sem parâmetros** (decisão da revisão: o Android compara o tipo por igualdade com o que os apps declaram; o `;codecs=opus` faria apps que declaram `audio/ogg` não aparecerem). Mantém a extensão `.ogg` (o `FileProvider` dá `audio/ogg`). Teste no aparelho: Telegram deve mostrar nota de voz.
6. **Teste no aparelho** com a lista de "Riscos" abaixo; depois **tirar o interruptor `.webm | .weba`** e o `compartilharPrefs.ts` (com a limpeza da chave antiga).
7. **Opcional (só se a etapa 1 ou 6 mostrar recusa de Ogg em algum destino):** conversão para `.m4a`/AAC com `MediaCodec`, oferecida como "enviar como MP4 (compatível)".

## Riscos e o que testar no aparelho

- **WhatsApp via folha de compartilhar:** Ogg/Opus chega como nota de voz, áudio comum ou documento? É a maior incerteza (sem fonte). Testar também WhatsApp Business.
- **Gravações longas:** 10, 30 e 60 min; tamanho (WhatsApp aceita até 16 MB de áudio pela API; 64 kbps dá ~480 KB por minuto: 16 MB ≈ 34 min; uma hora ≈ 29 MB, **acima do limite**; o limite do app comum é **N**), tempo do remux e memória do WebView.
- **Mono:** a API do WhatsApp diz "mono input only" para Ogg. Conferir que o `OpusHead` sai com 1 canal (o `channelCount: 1` é pedido, não garantido).
- **WebM do Chrome:** pacotes com `BlockGroup` em vez de `SimpleBlock`, clusters de tamanho desconhecido, pausa/retomada da gravação. Cobrir com fixtures reais.
- **MIME no aparelho do responsável:** conferir que `.ogg` dá `audio/ogg` nesse Android (as tabelas citadas são do ramo atual).
- **Destinos sem Ogg:** Messages por MMS e e-mail aberto em iPhone podem não tocar. Aceitável no início; plano B `.m4a`.
- **Fora do escopo, mas visto:** `file_paths.xml` expõe `external-path "."` (todo o armazenamento externo) pelo `FileProvider`; o envio só precisa de `cache-path`. Vale apertar numa PR à parte.

## Pendências (2026-11-22)

**Do lado do código (Claude):**
- [x] Interruptor `.webm | .weba` removido na PR #133 (com `compartilharPrefs.ts`, `compartilharFormato.svelte.ts`, as traduções e a limpeza da chave antiga `prefs.compartilhar` ao abrir o app).
- [x] APK 078 com o código final da PR #133.
- [x] `file_paths.xml` apertado (só `cache-path`), em PR à parte.
- Opcional: `.m4a`/AAC com `MediaCodec` (etapa 7), só se algum destino recusar Ogg (anotado em `roadmap-pendencias.md`).

**Do lado do responsável:**
- Testar o `.ogg` nos outros destinos (Telegram: deve virar nota de voz; Signal; Messages) e no WhatsApp Business; anotar áudio, nota de voz ou documento.
- Testar gravações longas (10, 30 e 60 min): tamanho, tempo da conversão e memória. Acima de uns 34 min o arquivo passa de 16 MB.
- Fazer o merge da PR #133 depois do CI.

## Como levar isto para outro projeto

Os arquivos a copiar são `src/lib/webm.ts` (leitor de WebM/Opus), `src/lib/ogg.ts` (escritor de Ogg, CRC e a função `webmParaOgg`), `tests/ogg.test.ts` com `tests/fixtures/opus.ts` (duas gravações de 0,5 s em base64) e o trecho `prepararOgg` de `src/lib/compartilhar.ts`. Lições da revisão: fechar a página Ogg por 255 valores de lacing (não só por contagem de pacotes); validar `OpusHead` e o TOC; descontar o `DiscardPadding`; mandar o tipo `audio/ogg` sem parâmetros ao Intent; se a conversão falhar, enviar o original.
