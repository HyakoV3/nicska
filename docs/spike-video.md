# Spike de vídeo: ferramenta de medição (S1, parte do S2 e do S3)

> **EXPERIMENTAL e descartável.** Não é a gravação de vídeo do app: é uma tela escondida (`/spike-video`) que mede o que a câmera e o gravador da WebView do aparelho conseguem fazer, para decidir o V1 de [`archive/ideia-gravar-video.md`](archive/ideia-gravar-video.md). Os critérios vêm de [`archive/revisao-ideia-video.md`](archive/revisao-ideia-video.md). O código fica isolado em `src/lib/spike/` e `src/routes/spike-video/`; some quando a decisão for tomada.

## Como rodar no celular

1. **Instalar o APK de teste** feito a partir desta branch (já mesclada na `main`), em depuração ([`apk-de-teste.md`](apk-de-teste.md)). O manifesto agora tem a permissão `CAMERA` (só por causa do spike).
2. Abrir o app → **Ajustes** → rolar até o **rodapé** (abaixo da versão) → **Teste de câmera (experimental)**.
3. Ir em **silêncio e num lugar fixo**; apoiar o celular (tripé, livro). Deixar a tela ligada e a bateria acima de 50%. Anotar o que mais rodar em segundo plano.
4. Seguir os passos da tela, **nesta ordem**:

| Passo | O que fazer | Tempo |
|---|---|---|
| 1. Ambiente | Tocar **Medir o ambiente**. | 2 s |
| 2. Câmera | **Abrir câmera (720p, 30 fps)** (aceitar a permissão); depois **Pedir 60 fps**; depois **Trocar traseira/frontal** e voltar à traseira. Negar a permissão uma vez é opcional: o erro tem de aparecer sem travar. **Fechar a câmera** no fim. | 2 min |
| 3. Gravar | Duração **30 s**. Tocar **Só áudio**; quando aparecer **GRAVANDO**, bater **10 palmas, uma por segundo**. Repetir com **Áudio + vídeo 720p30** e **Áudio + vídeo 720p60**, no mesmo lugar e no mesmo ritmo. Depois, uma vez, **180 s** em 720p30 (10 palmas espalhadas). Cada execução termina tocando o vídeo sozinho, sem som (até 30 s). Para o S1 completo (10 gravações de 30 s), repetir o modo 720p30 mais algumas vezes. | ~8 min |
| 4. Armazenamento | **Testar com o vídeo gravado**; depois **Testar com 60 MB de teste** (demora). No fim, **Apagar dados do teste**. | 3 min |
| 5. Compartilhar | **Compartilhar o vídeo gravado** e escolher WhatsApp (mandar para si mesmo), Telegram e Galeria, um de cada vez. Ver se o vídeo toca e anotar no campo (ex.: "WhatsApp: tocou, sem som"). Sem dados pessoais. | 3 min |
| 6. Ciclo de vida | Começar uma gravação em modo vídeo (passo 3, 30 ou 180 s). **Bloquear a tela por 10 s** e voltar; **girar o aparelho**. Se der, receber uma ligação. A lista de eventos se preenche sozinha. | 2 min |
| 7. Relatório | **Copiar relatório** e colar na conversa. Se não copiar, o texto fica selecionado; ou **Compartilhar relatório** (arquivo `.json`). | 1 min |

O relatório só leva o `userAgent`, as medidas e as anotações do passo 5. **Não leva áudio nem vídeo.** Os vídeos de teste só saem do aparelho se você os compartilhar no passo 5.

## O que o relatório traz

`versao`, `quando`, `ambiente` (userAgent, restrições, `isTypeSupported` de 14 formatos, WebCodecs, armazenamento, memória, núcleos), `camera` (tempo até o 1º quadro, `getSettings`/`getCapabilities`, fps contado, dispositivos), `gravacoes` (por execução: áudio A e vídeo B com bytes, bytes por segundo, razão do esperado, duração gravada x pedida, `getSettings` no início e no fim, fps real por `requestVideoFrameCallback`, `duration` e se é `Infinity`, seek a 1/3, 1/2 e 2/3, quadros descartados, estalos do detector com instantes e intervalos entre eles, deriva `AudioContext` x `performance.now()`, bateria antes e depois), `comparacaoComSoAudio` (diferença de cada intervalo entre estalos contra o modo só áudio), `armazenamento` (3 formas: bloco ArrayBuffer, bloco Blob, pedaços), `compartilhar`, `cicloDeVida` (linha do tempo com `performance.now()`) e `erros`.

Limites conhecidos da ferramenta: não há API de temperatura (só a bateria); o worklet não expõe "furos", então se usa a deriva do relógio; o bipe do "depois do bipe" é o aviso GRAVANDO na tela (um bipe seria detectado pelo microfone); `performance.memory` só existe no Chromium; a reprodução completa é limitada a 30 s.

## Critérios (copiados da revisão)

- **S1: capacidade do WebView.** `isTypeSupported` (vp8, vp9, h264, mp4); `getSettings()` em 720p30/60; 10 gravações de 30 s e 1 de 180 s a 2 Mbps **com o detector ligado**, contando estalos. **Sucesso:** >= 28 fps reais, <= 1% de quadros perdidos, tempos do detector a +-2 ms do só áudio, tamanho a +-30% do esperado, sem furo no worklet, calor e bateria toleráveis; medir também o desvio áudio x imagem. **Fracasso:** plano B nativo ou adiar.
- **S2: armazenamento e envio.** 60 MB em pedaços x bloco único no IndexedDB, pico de memória, corrigir `Duration`/`Cues` e conferir o seek, enviar `video/webm` e fMP4 ao WhatsApp, Telegram e Galeria. **Sucesso:** sem OOM no aparelho mais fraco, seek < 100 ms, WhatsApp toca ao menos um formato. (Esta ferramenta mede tudo menos a correção de `Duration`/`Cues`.)
- **S3: ciclo de vida.** Bloquear a tela, ir à Home, girar, receber ligação no meio do modo vídeo; registrar trilha, gravador e a tentativa de áudio. **Sucesso:** comportamento definido, sem queda, tentativa de áudio sobrevive.

## Como me mandar o relatório

Passo 7: **Copiar relatório**, abrir a conversa e **colar** (é um texto JSON de algumas centenas de linhas). Mande também, em palavras: o modelo do aparelho, a versão do Android, se o calor incomodou e o que o WhatsApp, o Telegram e a Galeria fizeram com o vídeo.

## Como a câmera chega à WebView (conferido no código do wry 0.57.2)

`RustWebChromeClient.onPermissionRequest` recebe o pedido do `getUserMedia({video})` (`RESOURCE_VIDEO_CAPTURE`), consulta o handler em Rust (o app não registra nenhum: resposta `Default`) e, para os recursos conhecidos, chama `activity.requestPermissions([Manifest.permission.CAMERA])`; concedida a permissão do Android, faz `request.grant`. O pedido é **por demanda**, só ao abrir a câmera. Como o `requestPermissions` do Android nega sem mostrar diálogo uma permissão que **não está declarada no manifesto**, a `CAMERA` precisa estar em `AndroidManifest.xml` (agora está). Nada em `generated/` precisou mudar (o projeto nem tem essa pasta: o código Kotlin do wry vem da crate). Quem nega a permissão recebe `NotAllowedError` no `getUserMedia`, que a tela mostra no relatório.

## Achado sobre a ponte de compartilhamento

A ponte nativa (`PonteCompartilhar.kt`) **não é só de áudio**: aceita qualquer MIME no formato `tipo/subtipo` (cai em `audio/*` só se o tipo for inválido) e grava o arquivo em `cache/compartilhar/` (coberto pelo `file_paths.xml`). O que quebra o vídeo é a camada TypeScript (`compartilharArquivo` sempre passa por `prepararOgg`). O spike usa `compartilharVideoDeTeste`, que chama `enviarPelaPonte` direto. Custo: base64 em pedaços de 192 KiB (50 MB são cerca de 270 chamadas), sem progresso nem cancelamento.
