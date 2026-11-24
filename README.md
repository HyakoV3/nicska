# Nicska

[![CI](../../actions/workflows/ci.yml/badge.svg)](../../actions/workflows/ci.yml) [![Licença: MIT](https://img.shields.io/badge/licen%C3%A7a-MIT-blue.svg)](LICENSE)

Aplicativo Android gratuito e de código aberto que faz o papel de um **shot timer de IPSC**: dá o apito (com atraso aleatório), escuta o
microfone, marca cada disparo e mostra o 1º disparo, os splits e o tempo total. Depois compara dias, compartilha JSON pelo WhatsApp e, no
futuro, alimenta um site com ranking. Feito com **Rust + Tauri 2** e interface em **Svelte 5 (SvelteKit) + TypeScript**.

**Pronúncia:** "Nísca" (não há "tch" no meio).

> **Aviso:** projeto **não oficial**, sem vínculo com a IPSC, a CBTP nem com fabricantes de shot timers.
>
> IPSC e outras marcas citadas pertencem aos seus donos. O Nicska é um projeto independente, **não homologado nem afiliado** à IPSC, à CBTP nem a fabricantes. Também **não é cronômetro oficial de prova**: pela regra 9.10.1 da IPSC, só o timer operado por um Range Officer vale como tempo oficial. Use o app para treinar.

## Baixar e instalar

Os APKs assinados saem em [**Releases**](../../releases) (arquivo `nicska-X.Y.Z.apk`, com `SHA256SUMS`). No Android: baixe o APK, permita a instalação de fontes desconhecidas para o navegador/gerenciador que o abriu e instale. Confira o SHA-256 se quiser. Android 7.0 (API 24) ou mais novo; hoje só arm64.

**Estado (v0.1.3):** o app funciona (timer com apito e detecção de disparos, revisão, percursos, histórico, gráficos, ranking local, JSON, voz "Standing by", batidas, vibração 3/2/1 para surdos, temas, 3 idiomas) e **grava vídeo da tentativa** (Ajustes → Registro: só áudio ou áudio + vídeo, 720p/1080p/4K, tela cheia ao gravar com o cronômetro e os disparos ao vivo; a Revisão toca o vídeo com os tempos por cima e exporta o MP4 com eles; retenção por espaço e prazo). O vídeo e o 4K ainda **não foram validados em câmera real** e o app ainda **não foi validado no estande**: trate esta versão como teste. O que falta: [`docs/roadmap-pendencias.md`](docs/roadmap-pendencias.md); as ideias: [`docs/roadmap-ideas.md`](docs/roadmap-ideas.md).

## Como vai funcionar

- O app detecta o **próprio apito no microfone** e mede tudo a partir dele: o apito e os tiros passam pelo mesmo caminho de áudio, então a
  latência se anula (até com caixa Bluetooth).
- **Nada sai do aparelho sem a pessoa mandar.** Sem conta, sem anúncio, funciona offline. O MVP não acessa a rede.
- Acessibilidade: alvos de toque de 48 px, contraste conferido, respeito a "reduzir movimento", nada passado só por cor.
- Interface em português, espanhol e inglês ([`docs/TRADUCOES.md`](docs/TRADUCOES.md)).

## Origem do código

A base (tema, idiomas, testes, CI, microfone cru, serviço Android com microfone e tela bloqueada, compartilhamento e IndexedDB) vem do
[biblioteca-musical](https://github.com/HyakoV3/biblioteca-musical) (commit `e4ac474`), do mesmo autor, MIT, copiada sem o histórico.

## Roadmap

O que falta fazer: [`docs/roadmap-pendencias.md`](docs/roadmap-pendencias.md). O que já foi feito, em resumo, com links para os roadmaps
completos (decisões, detecção, formato, riscos, critérios): [`docs/archive/roadmap-implementadas.md`](docs/archive/roadmap-implementadas.md).
O formato do JSON está em [`docs/FORMATO.md`](docs/FORMATO.md); as cores e os temas em [`docs/design-tokens.md`](docs/design-tokens.md).

## Desenvolvimento

Requisitos: Rust, Node.js e as [dependências do Tauri](https://tauri.app/start/prerequisites/)
(no Linux: webkit2gtk e rsvg2).

```bash
npm install
npm run tauri dev            # desktop
npm run tauri android dev    # Android (o projeto em src-tauri/gen/android já existe)
npm run check                # tipos (svelte-check, inclui tests/)
npm test                     # testes da lógica (Vitest)
npm run test:e2e             # concha do app num Chrome de verdade, mudo (precisa de Chrome ou Chromium)
python3 tools/verificar-traducoes.py && python3 tools/verificar-movimento.py && python3 tools/contraste.py
```

Os testes em Rust (também rodam no CI): `cargo test --lib` em `src-tauri`. APK de teste local: [`docs/apk-de-teste.md`](docs/apk-de-teste.md).

## Releases e lojas

Uma tag `vX.Y.Z` roda o workflow [`release.yml`](.github/workflows/release.yml): compila o APK e o AAB assinados, confere assinatura e permissões e publica o GitHub Release. Como funciona, os segredos e o caminho para a Play Store e a App Store: [`docs/release-e-apk-no-github.md`](docs/release-e-apk-no-github.md) e [`docs/lojas.md`](docs/lojas.md). Política de privacidade: [`docs/privacidade.md`](docs/privacidade.md). Como contribuir: [`CONTRIBUTING.md`](CONTRIBUTING.md).

## Licença

[MIT](LICENSE). Licenças de terceiros: [`docs/licencas-de-terceiros.md`](docs/licencas-de-terceiros.md).
