# Segurança

## Como relatar uma vulnerabilidade

Não abra uma *issue* pública com detalhes de uma falha de segurança. Use **Security, Report a vulnerability** neste
repositório (relato privado do GitHub). Se essa opção não aparecer, abra uma *issue* só pedindo um contato privado,
sem descrever a falha.

## O que o app faz com a rede e com os dados

- Não tem conta nem login, e não envia dados de uso.
- **O MVP não acessa a rede.** Nenhuma permissão de rede do Tauri está liberada em `src-tauri/capabilities/default.json`
  (a permissão `INTERNET` do Android fica só no manifesto de debug, `src/debug/AndroidManifest.xml`, para o servidor de desenvolvimento; o release não a declara). O plugin `opener` foi removido, e o backup do Android está desligado (`allowBackup="false"`).
- **O app não tem nenhuma saída de rede própria.** Já houve um botão de doação (PayPal, aberto no navegador do sistema por uma ponte nativa); foi removido em 2026-11-24 a pedido do mantenedor e pode voltar no futuro.
- O microfone só é usado enquanto o timer está armado, e o áudio das tentativas fica só no aparelho.
- A permissão `CAMERA` (com `uses-feature` não obrigatório) serve ao **modo Áudio + vídeo** (Ajustes → Registro): a câmera só abre quando a pessoa escolhe esse modo e toca em Standby, e o vídeo fica **só no aparelho**, fora do backup e do JSON; só sai se a pessoa tocar em Vídeo (enviar) e escolher o app. A tela escondida `/spike-video` (medição, EXPERIMENTAL) também a usa. O release continua **sem** `INTERNET`. A exportação com os tempos roda no aparelho (WebCodecs + `mp4-muxer`, MIT) e nada vai para a rede. A política de privacidade está em [`docs/privacidade.md`](docs/privacidade.md).
- Nada sai do aparelho sem a pessoa mandar (compartilhar um arquivo pela folha do sistema).
- O JSON importado é validado em TypeScript (`src/lib/documento.ts`), com limites de tamanho e de conteúdo, antes de ser guardado. Não há validação em Rust hoje.

## Assinatura do APK

- Os APKs de **release** (GitHub Releases) são assinados com a chave de envio guardada nos *secrets* do GitHub; os APKs de teste locais usam a chave de **debug**. O `build.gradle.kts` assina o release só se houver `keystore.properties` ou variáveis `NICSKA_*`.
- A chave de release (`keytool`, validade de 25 anos ou mais) é gerada e guardada **fora do Git**, com cópia de segurança, e nunca é versionada (`*.jks`, `*.keystore`, `keystore.properties`, `*.idsig` no `.gitignore`). Procedimento em [`docs/apk-de-teste.md`](docs/apk-de-teste.md).
- O workflow de release roda `apksigner verify --print-certs` e falha se o APK pedir `INTERNET`.
- A CSP do Tauri ainda está desligada; há uma proposta em [`docs/proposta-csp.md`](docs/proposta-csp.md), a testar no aparelho antes de ativar.

## Versões

O projeto está em desenvolvimento (0.x). Só a versão mais recente recebe correções de segurança, que entram na `main` e saem num novo release.
