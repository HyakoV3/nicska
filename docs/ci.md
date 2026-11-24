# CI e cadeia de fornecimento (trilha 7B)

## Workflows herdados removidos (CONS-004)

Foram apagados `.github/workflows/claude-code-review.yml` e `claude-resolve-threads.yml`. Vinham de outro projeto e dependiam de
segredos e de um GitHub App que o Nicska não tem (`VANDAME_APP_ID`, `VANDAME_APP_PRIVATE_KEY`, `CLAUDE_CODE_OAUTH_TOKEN_ENTERPRISE`
e `_PESSOAL`), além de filtrar o autor de outro bot. Não eram reaproveitáveis sem segredos externos. Se um dia o Nicska quiser revisão
automática, cria-se um workflow novo com App e segredos próprios.

## O que o `ci.yml` faz agora (CONS-037)

- Ações fixadas por SHA de commit completo, com a versão em comentário: `actions/checkout` v7, `actions/setup-node` v7 e `Swatinem/rust-cache` v2
  (SHA do commit, não da tag anotada). O Dependabot (`github-actions`) propõe as atualizações.
- Toolchain Rust fixa em `rust-toolchain.toml` (1.99.1, com `rustfmt` e `clippy`).
- `npm audit --omit=dev --audit-level=high` e `cargo audit` (cargo-audit 0.23.0): só vulnerabilidade derruba; avisos de manutenção não.
- `permissions: contents: read` já valia no workflow inteiro; nenhum passo usa segredo.
- `.github/dependabot.yml`: npm, cargo (`src-tauri`), github-actions e gradle (`src-tauri/gen/android`), toda semana.

## Pendências

- **SBOM:** `npm sbom` falhou na máquina local (ESBOMPROBLEMS, dependência opcional ausente), então não entrou passo sem testar.
  Tentar de novo no CI depois do `npm ci` e, para o Rust, `cargo cyclonedx`; publicar o SBOM junto do release (trilha 7C).
- `cargo deny` (licenças transitivas, CONS-037/15·LDT-004) não foi adicionado.
- O primeiro run real do CI só acontece com o remoto no GitHub; `cargo install cargo-audit` e a toolchain fixa não foram exercitados lá.
