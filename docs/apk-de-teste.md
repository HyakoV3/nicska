# APK de teste

O APK de teste do Nicska **não leva conteúdo embutido**: o app só tem código e as tentativas ficam no aparelho.

## Estado de validação

**Último APK validado em aparelho real: nenhum desde o 009.** Os APKs 010 a 046 só foram vistos no emulador e no Chrome (o e2e roda no Chrome). O 027 é o primeiro **sem a permissão `INTERNET`** no release: abrir no aparelho é o teste que falta.

## Gerar

```bash
npm install
npm run tauri android init      # só se src-tauri/gen/android não existir
npm run tauri android build -- --apk --target aarch64
```

O arquivo sai em `src-tauri/gen/android/app/build/outputs/apk/universal/release/`.

## Assinar (obrigatório para instalar)

O APK sem assinatura não instala. Os APKs de teste são assinados com a **debug keystore padrão do Android SDK** (alias `androiddebugkey`, senha padrão `android`), que fica fora do repositório. Use o `apksigner` do Android SDK (`build-tools`):

```bash
apksigner sign --ks <debug.keystore> --ks-key-alias androiddebugkey --ks-pass pass:android \
  --out nicska-teste-<commit>.apk app-universal-release-unsigned.apk
apksigner verify --print-certs nicska-teste-<commit>.apk
```

O `verify --print-certs` mostra o certificado: o SHA-256 tem de ser o mesmo da debug keystore em todos os APKs (outro valor faz o Android recusar a atualização por cima de um APK já instalado).

**É chave de DEBUG, só para teste.** A chave de **release** (publicação) é outra decisão (CONS-005, Fase 7 do [`plano-de-acao.md`](plano-de-acao.md)).

### Chave de release (publicação): procedimento

O `build.gradle.kts` aceita uma chave de release, **de forma condicional**: se existir `src-tauri/gen/android/keystore.properties` (modelo em `keystore.properties.example`) ou as variáveis `NICSKA_KEYSTORE`, `NICSKA_KEYSTORE_PASSWORD`, `NICSKA_KEY_ALIAS`, `NICSKA_KEY_PASSWORD`, o build release já sai assinado; sem isso sai `unsigned` e o fluxo acima segue valendo. Para gerar a chave (uma vez, fora do repositório):

```bash
keytool -genkeypair -v -keystore nicska-release.jks -alias nicska \
  -keyalg RSA -keysize 4096 -validity 10000   # 10000 dias = mais de 27 anos (mínimo 25 anos)
```

Guarde o `.jks` e as senhas **fora do Git** (`*.jks`, `*.keystore`, `keystore.properties` e `*.idsig` estão no `.gitignore`) e faça **cópia de segurança** em pelo menos dois lugares: perdê-la impede atualizar o app já instalado. Depois de gerar, registre o SHA-256 do certificado (`keytool -list -v -keystore ...`) e confira cada APK com `apksigner verify --print-certs`.

## Conferir as permissões

```bash
aapt dump permissions nicska-teste-<commit>.apk
```

O release não deve listar `android.permission.INTERNET`. Esperadas: microfone (`RECORD_AUDIO`), notificações, vibração e o serviço em primeiro plano do microfone.

## Nome do arquivo

Termina no commit, para saber de onde veio: `nicska-teste-<AAAA-MM-DD>-<commit>.apk`.

## Instalar no celular

1. Copie o `.apk` para o celular e abra-o (permita "instalar apps desconhecidos" para o app de arquivos).
2. Ao armar o timer pela primeira vez, o Android pede a permissão de **microfone** e, no Android 13 ou mais novo, a de **notificações**
   (a notificação "Nicska · Parar" é a que segura o app vivo com a tela bloqueada).

## Entregas

A partir da v0.1.0, os APKs saem pelo **GitHub Releases** (workflow `release.yml`). Os zips numerados (001 a 046) eram do período de desenvolvimento local; o histórico completo não é mantido aqui. As últimas entregas locais e a próxima:

| Zip | Versão | Commit | Data | SHA-256 do zip | O que traz |
|---|---|---|---|---|---|
| 043 | 0.1.0 | `282dc6c` | 2026-11-23 | `b5a47d71dd78b7cfb1265f39fd825beb0ba22a4c436d21227707176d751d23c8` | Botão de fechar das janelas é um **X** (antes era a seta dos cartões). Resto igual ao 042. Sem `INTERNET`. |
| 044 | 0.1.0 | `7953798` | 2026-11-23 | `5518aca44c6797df2c2591f470a35b037572affbe4b03cde0698c1aaefd4dddf` | **Marca do overlay = ícone do Nicska (fase 4) com "Nicska" embaixo**, na tela e no vídeo exportado (some em Ajustes → Overlay do vídeo → Marca); o texto "treino, não oficial" saiu; o resultado final desceu para não bater na marca. Sem `INTERNET`. |
| 045 | 0.1.0 | `189180d` | 2026-11-23 | `8907a1e9d8c1c1dd4d1b988fd71b7fdf7fc5d77e17cc871be515b225528309c7` | Ícone da marca do overlay trocado para a **fase 3** (o desenho no vídeo exportado não estica a imagem). Resto igual ao 044. Sem `INTERNET`. |
| 046 | 0.1.0 | `5b0512e` | 2026-11-23 | `cbe8f004f022482ceeafef37c54d43ac00b8a8d85201069767d652f65796f49c` | Doação mais simples: texto curto e **sem o aviso** "abre o PayPal no navegador". Resto igual ao 045. Sem `INTERNET`. |
| 047 | 0.1.0 | | | | Próxima entrega local; depois dela, o APK vem da release do GitHub. |
