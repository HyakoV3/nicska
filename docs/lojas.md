# Lojas: Play Store e App Store

O que o GitHub já faz e o que falta para publicar. Decisões marcadas **[mantenedor]**.

## Google Play

**Já pronto:** AAB assinado pelo `release.yml`, `targetSdk` 37, `minSdk` 24, sem `INTERNET`, ícone adaptativo e monocromático, textos em 3 idiomas, política de privacidade em [`privacidade.md`](privacidade.md).

**Passo a passo (feito uma vez, no navegador):**
1. **[mantenedor]** Conta de desenvolvedor do Google Play (taxa única de US$ 25). Contas pessoais novas precisam de **teste fechado com 12 testadores por 14 dias** antes da produção.
2. **[mantenedor]** Decidir o **applicationId** definitivo (hoje `io.github.hyakov3.nicska`; o domínio `nicska.driit.co` daria `co.driit.nicska`). Não muda depois de publicar.
3. Criar o app no Play Console; ativar a **Play App Signing**; gerar a chave de envio (`keytool -genkeypair -keystore nicska-upload.jks -alias nicska -keyalg RSA -keysize 4096 -validity 9125`) e cadastrar os segredos (ver [`release-e-apk-no-github.md`](release-e-apk-no-github.md)).
4. Preencher: **política de privacidade** (URL de [`privacidade.md`](privacidade.md) servida pelo GitHub Pages ou pelo site), **Segurança dos dados** (nada coletado ou compartilhado; câmera e microfone só no aparelho), **classificação de conteúdo** (o tema é tiro esportivo: responder com honestidade ao questionário), **público-alvo** (adultos), **permissões sensíveis** (`CAMERA`, `RECORD_AUDIO`, serviço em primeiro plano do tipo microfone: justificar com um vídeo curto), ficha da loja (título, descrição curta/longa, ícone 512, gráfico 1024×500, capturas de tela de celular).
5. Primeiro envio **manual** do AAB (o Play exige que o app exista com uma versão antes de aceitar envios por API). Depois ligue `ENVIAR_PLAY_STORE=true` e crie a **conta de serviço** (Play Console → Configurações → Acesso à API) com permissão de lançar na faixa interna; guarde o JSON em `PLAY_SERVICE_ACCOUNT_JSON`.
6. Promover a versão da faixa interna → fechada → produção pelo Play Console.

**Pontos de atenção:** o app lida com **disparos de arma de fogo (tiro esportivo)**. A política do Google permite apps de esporte e treino; evite imagens de arma apontada e descrições que sugiram violência. Deixe claro na ficha que é **não oficial** e não substitui o cronômetro de um Range Officer. A voz embutida do Standby ainda tem a licença a confirmar (ver [`licencas-de-terceiros.md`](licencas-de-terceiros.md)).

## Apple App Store (depois)

O Tauri 2 compila para iOS (`npm run tauri ios init` gera o projeto Xcode; hoje só há ícones em `src-tauri/icons/ios`). Falta, nesta ordem:
1. **[mantenedor]** Apple Developer Program (US$ 99 por ano) e um identificador (Bundle ID; pode ser o mesmo do Android).
2. Rodar `tauri ios init` num Mac (ou no runner `macos-latest`) e versionar `src-tauri/gen/apple`. **Adaptar o que é Android**: as pontes Kotlin (`NkTema`, `NkTela`, `NkOrientacao`, `NkServico`, compartilhar) precisam de equivalentes em Swift (ou o app cai nos recursos Web: Web Share, `screen.orientation`, `navigator.vibrate` **não existe no Safari/WKWebView**, o que muda as batidas e a vibração 3/2/1).
3. Conferir no WKWebView: `getUserMedia` com microfone cru, `MediaRecorder` (iOS grava MP4/AAC, não WebM/Opus: o remux Ogg e o leitor WebM não se aplicam), `AudioWorklet`, `devicemotion` (exige permissão explícita no iOS), WebCodecs (iOS 16.4+).
4. Workflow `release-ios.yml` em `macos-latest` (assinatura via certificado e perfil de provisionamento em segredos, ou `fastlane match`), envio ao **TestFlight** pela API App Store Connect.
5. Revisão da Apple: política de privacidade, descrição das permissões de câmera/microfone/movimento, classificação etária.

Esta é uma frente à parte (o ganho principal é o Android, onde o shot timer roda ao lado do atirador); só vale começar depois da validação no estande.
