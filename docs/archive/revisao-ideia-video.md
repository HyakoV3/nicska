> **Arquivado (2026-11-23).** As correções desta revisão já entraram no desenho e no código do vídeo; ver [`ideia-gravar-video.md`](ideia-gravar-video.md).

# Revisão técnica da ideia de gravar vídeo (2026-11-23)

Revisão cética feita por um subagente (Opus, só leitura) sobre `ideia-gravar-video.md` e o código. Legenda: **[F]** fato conferido no código ou em documento · **[I]** inferência · **[H]** hipótese que só o aparelho confirma. Este arquivo guarda o que a revisão achou; o rascunho foi corrigido em seguida e aponta para cá.

**Veredito:** a direção está certa (detector pelo áudio, vídeo cru, overlay na reprodução). Mas três coisas podiam inviabilizar a V1: o caminho atual de guardar e compartilhar arquivos quebra com vídeo; o celular longe do atirador muda a medição; o WebM do `MediaRecorder` sai sem duração e sem índice. Há afirmações do rascunho que estavam erradas.

## Críticos

1. **Compartilhar um vídeo hoje entrega só o áudio, sem avisar** [F]. `compartilharArquivo` sempre passa por `prepararOgg`; o leitor WebM pega a primeira faixa Opus e pula o resto (`compartilhar.ts:45-50`, `compartilhar/arquivo.ts`, `webm.ts:36-59`). `nomeDoArquivo` só conhece extensões de áudio (`mp4` vira `.m4a`). → caminho de vídeo **separado**, sem remux, com MIME e extensão certos, e teste de que um vídeo nunca passa por `prepararOgg`.
2. **Um gravador só (áudio + vídeo) quebra a revisão, o reprocesso e o `audio_sha256`** [F]. O blob gravado alimenta `decodificar`, o hash e o Ogg. → **dois `MediaRecorder` no mesmo fluxo**: o de hoje (só áudio, intocado) e um segundo com vídeo + áudio só para ver e compartilhar. Custo de um Opus a mais: desprezível [I].
3. **No tripé, o tempo medido cresce com a distância** [I, física]. O apito sai do celular: tiro chega com +d/343 s; o atirador ouve o apito d/343 s depois; erro ≈ 2d/c (5 m ≈ 29 ms, 10 m ≈ 58 ms), acima da meta de ±10 ms. → aviso no modo vídeo e marca local na tentativa; **não** usar o modo tripé como gabarito.
4. **O vídeo a 60 fps do mesmo aparelho não serve de gabarito** [F/I]. Um quadro vale 16,7 ms (±8 ms por evento, até ±16,7 ms por split); o 1º disparo compara o apito (áudio) com o tiro (imagem), e o desvio áudio × imagem entra inteiro; o `MediaRecorder` pode gravar taxa variável [H]; um gabarito precisa ser independente do aparelho medido. → gabarito = timer comercial, ou **um segundo aparelho** em câmera lenta (120/240 fps) com o tiro visível e audível. O modo vídeo do Nicska é conveniência, não gabarito. **Revê a decisão #4.**
5. **O WebM do `MediaRecorder` sai sem `Duration` nem `Cues`** [F, comportamento do Chromium]. No `<video>` a duração fica `Infinity` e o *seek* é lento e impreciso, o que quebra "a Revisão leva ao instante da marca". → reescrever o cabeçalho depois de gravar (há leitor EBML em `webm.ts`; avaliar `ts-ebml`/`mediabunny` antes de escrever), pedir keyframes a cada ~1 s; quadro a quadro de verdade pede WebCodecs.

## Importantes

6. **"Galeria ou câmera por `<input accept=image/*>`, sem permissão nova" está errado no WebView do wry** [F]: sem `capture` abre só o seletor de arquivos; com `capture` o wry tenta `ACTION_IMAGE_CAPTURE` com `getUriForFile`, que falha porque `file_paths.xml` só expõe `cache/compartilhar/`. → o avatar usa **só galeria** até existir `CAMERA` e o caminho certo; tratar HEIC com mensagem de recusa [H].
7. **Câmera e microfone no mesmo `getUserMedia`: uma câmera negada derruba o timer** [F]. → o `getUserMedia` de áudio fica exatamente como está; a câmera vem de um `getUserMedia({video})` **separado** (a pré-visualização); o gravador de vídeo recebe `new MediaStream([vídeo, áudio])`; se a câmera falhar, o timer segue em só áudio com aviso. Protege as restrições de áudio cru.
8. **Guardar o vídeo como `audios` não escala** [F/I]: o áudio entra como ArrayBuffer inteiro, numa transação, com limite de 10 s; com 35 a 55 MB o pico passa de 100 MB (OOM, estouro de 10 s). → guardar em **pedaços** (`videos_pedacos`, chave `[id, n]`, um por `timeslice`; também salva o que foi gravado se o app cair), montar o Blob só para tocar; ou arquivo do app por ponte nativa. Medir no spike S2.
9. **Um campo local "tem vídeo" vazaria para o backup e o JSON** [F]: a limpeza é por lista negra (`semAudio`, `Omit`). → lista branca na escrita, ou teste "o exportado não contém chave local"; melhor guardar o "tem vídeo" **fora** de `TentativaGuardada` (na loja `videos`).
10. **Ciclo de vida no modo vídeo indefinido** [F]: o wry pausa a WebView em `onPause`; `cancelarAoEsconder` cancela a tentativa; `ServicoAudio` só tem `mediaPlayback|microphone`. A câmera em segundo plano: desde o Android 9 se perde; do 11 em diante um serviço `camera` em primeiro plano a mantém; do 14 exige `FOREGROUND_SERVICE_CAMERA`. O bloqueio real é o **WebView pausado**. → o áudio segue com o serviço, o vídeo para, a tentativa fica com "vídeo parcial"; sem tipo `camera` na V1.
11. **Girar o aparelho no meio da gravação** [F/H]: a Activity não recria (`configChanges`), mas os quadros giram e a resolução muda no meio do fluxo; MP4 pode não tocar. → travar a orientação durante a gravação (ponte nativa `setRequestedOrientation`).
12. **Pré-roll:** o `MediaRecorder` não tem buffer circular; mas a gravação já começa no Standby, antes do aviso e do atraso de 1 a 4 s. → **o pré-roll é o próprio atraso do Standby** (falso requisito removido).
13. **"MP4 só em WebView novo" é impreciso:** MP4 no `MediaRecorder` chegou ao Chrome 126 (jun/2024), fragmentado; a data no Android WebView **não foi confirmada**. → decidir por `isTypeSupported` no aparelho (S1) e testar fMP4 no WhatsApp.
14. **`videoBitsPerSecond` ausente** [F]: hoje só `audioBitsPerSecond`. As contas de tamanho (34 a 56 MB em 3 min; 3 a 9 MB em 15 a 30 s) estão certas **se** o bitrate for fixado. → 2 Mbps em 720p30, `frameRate: {ideal: 30}` e ler `getSettings()`.
15. **CPU e calor** com detector + pré-visualização + encoder [H]. → critério do S1: mesmos estalos com e sem vídeo dão os mesmos tempos (±2 ms); medir temperatura e bateria após 10 tentativas; desligar a pré-visualização fora da aba Timer e depois de 60 s parada.
16. **Avatar recebido: faltam a "bomba de descompressão" e as dimensões** [I/F]: uma WebP de 16 KB pode declarar 16383 × 16383 px e derrubar o WebView ao decodificar; o limite de ~16 KB precisa valer no **base64** (≈12 KB binário); `LIMITES.atiradores = 1000` × 16 KB ≈ 16 MB perto do teto de 20 MiB; a deduplicação impede atualizar a foto de um amigo. → ler as dimensões no cabeçalho (WebP/PNG/JPEG) e recusar acima de 96 × 96 **antes** de decodificar; validador em `campos.ts`; exibir só por `<img src=blob:>`/canvas; na escolha local usar `createImageBitmap(file, {resizeWidth})`.
17. **A CSP está desligada** (`csp: null`) [F]: com dado hostil (o avatar) entrando na interface, ativar a CSP (CONS-015) vira **pré-requisito do P0b**.
18. **`CAMERA` e loja:** declarar `CAMERA` implica `uses-feature camera` obrigatório e o manifesto tem leanback. → `uses-feature android.hardware.camera required="false"`; atualizar `manifesto.test.ts`, `SECURITY.md` e o texto de privacidade.
19. **Exportar com overlay por `canvas.captureStream` (caminho C) é frágil:** reencoda, o `requestAnimationFrame` para com a tela apagada, quadros se perdem. Alternativa: WebCodecs (`VideoDecoder` → overlay → `VideoEncoder` → mux MP4 com `mediabunny`/`mp4-muxer`), possivelmente **mais rápido que o tempo real** e MP4 de verdade. → avaliar no spike S4.
20. **Mandar 50 MB pela ponte** [F]: base64 em pedaços de 192 KiB (~270 chamadas, ~67 MB de texto), espera de 5 s para abrir a folha, sem progresso nem cancelamento. → progresso, cancelamento e limpeza no próximo envio.

## Menores

21. O clarão "para achar o zero" é circular (o overlay nasce do zero que já se conhece pelo áudio) e um clarão ao vivo esbarra no CONS-033. → só na reprodução.
22. "Fixados (estrela)" não existe no app: conceito novo (onde guardar, se vai no backup).
23. `storage.persist()`/`estimate()` não são usados; "20 vídeos ou 500 MB" na prática é 500 MB (~11 vídeos de 3 min).
24. Instalar um APK mais antigo depois da migração v2→v3 dá `VersionError`; tratar com mensagem.
25. e2e com vídeo: `--use-fake-device-for-media-stream` já existe; para reprodutibilidade usar `--use-file-for-fake-video-capture`; teste de que o tempo do detector com vídeo bate com o só áudio.
26. Acessibilidade: overlay com caixa sólida para contraste, seletor como `radiogroup`, posição ajustável é escopo a mais para a V2.
27. Quem filma outro com o **meu** celular: a tentativa entra como **minha** (`atirador_id` ausente). Pendência.

## O que está certo e deve ficar

Detector pelo áudio nos dois modos · B + C como direção · "Só áudio" como padrão e câmera só ao escolher o modo · vídeo fora do backup e do JSON, nada sai sem toque, sem `INTERNET` · avatar local, filtros locais, sem IA embarcada, opt-in desligado · `nicska/1` sem mudar de versão · overlay como componente independente do `<video>` (reaproveitado no I-04) · as contas de tamanho, com bitrate fixado.

## Spikes (num APK de depuração, tela escondida), em ordem

- **S1 — capacidade do WebView (3 a 4 h):** `isTypeSupported` (vp8, vp9, h264, mp4); `getSettings()` em 720p30/60; 10 gravações de 30 s e 1 de 180 s a 2 Mbps **com o detector ligado**, contando estalos de palma. Sucesso: ≥ 28 fps reais, ≤ 1% de quadros perdidos, tempos do detector a ±2 ms do só áudio, tamanho a ±30% do esperado, sem furo no worklet, calor e bateria toleráveis; medir também o desvio áudio × imagem. Fracasso: plano B nativo ou adiar.
- **S2 — armazenamento e envio (2 a 3 h):** 60 MB em pedaços × bloco único no IndexedDB, pico de memória, corrigir `Duration`/`Cues` e conferir o *seek*, enviar `video/webm` e fMP4 ao WhatsApp, Telegram e Galeria. Sucesso: sem OOM no aparelho mais fraco, *seek* < 100 ms, WhatsApp toca ao menos um formato.
- **S3 — ciclo de vida (2 h):** bloquear a tela, ir à Home, girar, receber ligação no meio do modo vídeo; registrar trilha, gravador e a tentativa de áudio. Sucesso: comportamento definido, sem queda, tentativa de áudio sobrevive.
- **S4 — exportar por WebCodecs (2 a 3 h, antes da V3):** decodificar → overlay → `VideoEncoder` H.264 → `mediabunny`, 30 s de vídeo. Sucesso: ≤ 1× o tempo real e MP4 que toca no WhatsApp; senão, caminho C.

**Ordem:** S1 → (S2 ‖ S3) → V1 enxuta → V2 → S4 → V3 → V4. P0a corre em paralelo (útil sozinho, no Ranking); P0b espera o CONS-014, a CSP ativa e os validadores de cabeçalho. A V4 não bloqueia a Etapa 1.

**Menor V1 com valor:** seletor, câmera traseira com pré-visualização, segundo gravador, vídeo em pedaços, limite por quantidade, a Revisão toca o vídeo e pula até a marca, aviso de privacidade e de distância. **Fora da V1:** compartilhar, overlay, 60 fps, "fixar" e a câmera frontal.

## Estimativas

| Fatia | Esforço | Risco |
|---|---|---|
| S1 + S2 + S3 | P (1 a 1,5 dia) | decidem tudo |
| P0a | M | baixo/médio |
| P0b | M | médio (formato, validador de cabeçalho, CSP, atualização, arquivo hostil) |
| V1 | G | alto (câmera, 2 gravadores, pedaços, correção do WebM, ciclo de vida, orientação, `CAMERA`, e2e com vídeo falso) |
| V2 | M | médio |
| V3 | G | alto |
| V4 | G | alto |

**Plano B** se o S1 falhar: câmera nativa (CameraX/`MediaRecorder` por ponte Kotlin): V1 vira G+ de risco alto (pré-visualização nativa sob a WebView, dois microfones, dois relógios: alinhar pelo apito no áudio do vídeo); ganhos: MP4/H.264 nativo, rotação em metadado, gravação com tela apagada por serviço `camera` (Android 14+).

Fontes: [intent to ship MP4 no MediaRecorder](https://groups.google.com/a/chromium.org/g/blink-dev/c/p1OMVj1FrMI) · [addpipe (Chrome 126)](https://blog.addpipe.com/duration-in-mp4-files-produced-by-chrome-safari/) · [tipos de serviço em primeiro plano](https://developer.android.com/develop/background-work/services/fgs/service-types) · [Android 14 fgs-types-required](https://developer.android.com/about/versions/14/changes/fgs-types-required). Não confirmado: data do MP4 no Android WebView, fps real da câmera pelo WebView, desvio áudio × imagem de 30 a 60 ms, `decodeAudioData` sobre WebM com vídeo.
