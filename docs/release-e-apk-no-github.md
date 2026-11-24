# Release e APK no GitHub

O workflow [`.github/workflows/release.yml`](../.github/workflows/release.yml) gera os pacotes do Android.

| Gatilho | O que gera | Para quê |
|---|---|---|
| **Tag `vX.Y.Z`** (ex.: `v0.1.0`) | APK **e AAB assinados** com a chave de envio, `SHA256SUMS`, e o **GitHub Release** com tudo anexado (tag com sufixo, como `v0.2.0-rc1`, vira pré-lançamento) | Distribuir uma versão |
| **Sob demanda** (Actions → release → Run workflow) | APK de **teste** (chave descartável de 3 dias), só como artefato do job | Baixar um APK do que está na `main` ou numa branch |

A cada PR ou push o `ci.yml` roda (tipos, testes, e2e, Rust, `npm audit`/`cargo audit`); o release **não** roda a cada push (leva uns 15 minutos).

## Como lançar uma versão

1. Atualize a versão **nos três lugares** (têm que ser iguais; o workflow confere): `package.json`, `src-tauri/Cargo.toml`, `src-tauri/tauri.conf.json`. O `versionCode` do Android sai da versão (`0.1.0` → 1000, `0.1.1` → 1001, `0.2.0` → 2000); **nunca reutilize** uma versão que já foi para a Play Store.
2. Passe `npm run check`, `npm test`, `npm run test:e2e`.
3. `git tag v0.1.1 && git push origin v0.1.1`. O workflow confere a tag × versões, o portão (tipos e testes), compila, roda `apksigner verify` e `aapt dump permissions` (**falha se o APK pedir `INTERNET`**) e publica o release com notas geradas dos commits.

## Segredos (Settings → Secrets and variables → Actions)

| Nome | O quê |
|---|---|
| `ANDROID_KEYSTORE_BASE64` | a chave de envio (`.jks`) em base64 (`base64 -w0 nicska-upload.jks`) |
| `ANDROID_KEYSTORE_PASSWORD` | senha do keystore |
| `ANDROID_KEY_ALIAS` | alias da chave (`nicska`) |
| `ANDROID_KEY_PASSWORD` | senha da chave (se omitida, usa a do keystore) |
| `PLAY_SERVICE_ACCOUNT_JSON` | (opcional) conta de serviço do Play Console, para enviar o AAB |

Variáveis (não secretas): `ENVIAR_PLAY_STORE=true` liga o envio à faixa **interna** da Play Store (como rascunho) e `ANDROID_APPLICATION_ID` guarda o identificador do app.

**A chave nunca entra no Git** (`*.jks`, `*.keystore`, `keystore.properties` estão no `.gitignore`). Guarde uma cópia do `.jks` e das senhas num cofre seu. Com a Play App Signing ativa, a chave guardada é só a de **envio**: se for perdida, o Google permite trocá-la; a chave de assinatura final fica com o Google.

## Identificador do app (applicationId)

Hoje é `io.github.hyakov3.nicska` (`tauri.conf.json`, `build.gradle.kts`, pacote Kotlin e testes). **Não pode mudar depois de publicado na Play Store.** Decidir antes do primeiro envio (ver [`lojas.md`](lojas.md)); se mudar, é uma troca em bloco do identificador e da pasta `java/io/github/hyakov3/nicska`.

## Limites conhecidos

- Só **arm64** (`aarch64`); aparelhos de 32 bits e emuladores x86 não instalam. Dá para acrescentar `--target armv7` (e o alvo do Rust) quando fizer falta.
- O APK de release usa a chave de envio; o de teste usa uma chave descartável, **não serve para a loja nem para atualizar um APK de release já instalado**.
