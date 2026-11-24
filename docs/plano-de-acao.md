# Nicska — plano de ação pós-auditoria (261123)

> **Estado de cada item da auditoria (conferido em 2026-11-23):** `status.md` da auditoria (arquivo local) — 19 feitos, 16 parciais, 11 que dependem de você/aparelho/Etapa 1 e 11 pendentes sem dependência.
>
> **Fora das fases (2026-11-23):** o vídeo (V1 a V3) foi feito em paralelo ao plano: APK 032 a 045; ver [`ideia-gravar-video.md`](archive/ideia-gravar-video.md) e o Tezcat ainda precisa ser reexecutado nos 3 escopos (o código de vídeo é novo).
>
> **Andamento (2026-11-23):** Fases 0 e 1 **feitas e mescladas na `main`** (trilhas 0B, 1A, 1B, 1C, 1D; APK 023). Decisões: D1 = silêncio padrão 15 s (teto 60 s); D2 = voz ligada com aviso único no primeiro Standby; D3 = licença da voz continua pendente; D4 = Calibrar fica até a Etapa 1; D5 = opção C (`tezcat.toml` declara `src/lib/i18n/` como dados); D6 = HF com o tempo de 2 casas (confirmado: IPSC 9.2.1.1 e 9.7.1). **Fase 3 (L05a) e Fase 4 (4A a 4E) também feitas e mescladas (APK 024).** Regulamento IPSC Jan 2026 conferido: HF com tempo de 2 casas (9.2.1.1, 9.7.1), pontos de stage com 4 casas (9.2.2); CBTP: HF até 4 casas. **Fase 5A (timer ao vivo) feita (APK 025; Svelte strict 21 FAIL, Kotlin 1 FAIL).** **CONS-023 decidido e feito:** a interrupção durante a escuta, com tiros já detectados, entrega o resultado marcado como incompleto (`incompleta: true` no formato; o ranking a trata como duvidosa); sem tiros continua sendo erro. **Rodada dos 11 pendentes sem dependência feita (APK 028; 9A a 9E): ver o `status.md` da auditoria local (26 feitos, 20 parciais, 11 dependem de você). Antes disso, Fase 7B, 7C e 7D e a Fase 8 (WARN dos lotes L15, L16, L17 e o resto do L02/L03) feitas (APK 027). Tezcat strict (depois da Fase 8): Svelte 20 FAIL / 85 WARN (score 97,2; hoje 100 WARN, ver status.md), todos os FAIL no trio Calibrar (18) e `detector.ts` (2); Kotlin 1 FAIL; Rust 0.** **Próximo:** Fase 2 (campo, com você, destrava 5B/5C), Fase 6 (depende da Etapa 1), 7A (D3) e a segunda rodada de auditoria.

Origem: o `00-consolidado.md` da auditoria de 2026-11-23 (arquivo local) (57 itens `CONS-nnn`, lotes `L01…L18` do Tezcat strict). Metas:

1. **Teste de campo fechado** (Fases 1 e 2): fechar a Onda 1 e validar no estande.
2. **Strict sem nenhum FAIL e o mínimo de WARN** no Tezcat (Fases 3 a 6, 8; Rust já está limpo).
3. **Pronto para o primeiro push / MVP** (Fase 7).

## Como executar (regras comuns)

- **Trilha** = um conjunto de itens que **dependem entre si** (mesmos arquivos ou mesma regra): vai junto, em sequência, para **um** subagente. **Trilhas da mesma fase não dependem uma da outra**: rodam em **subagentes paralelos**, cada um em **worktree/branch própria** (`aud/<fase>-<trilha>`), e eu integro uma a uma na `main` local.
- **Cada subagente:** só mexe nos arquivos da sua trilha; escreve primeiro o teste (quando o plano diz); roda `npx vitest run` e `npm run check`; **não roda e2e, build Android nem emulador** (Chrome e portas são compartilhados) e **não faz push**. Commit local **sem co-autoria** (regra do nicska).
- **Integração (eu):** mescla a trilha, resolve conflito (os dicionários `pt/en/es.ts`, `tests/e2e/timer.mjs` e `Timer.svelte` são os pontos de conflito mais prováveis), roda e2e e `tzt --strict`, e só então libera a próxima trilha que dependa dela.
- **Portão de cada fase (gate):** `vitest` + `check` verdes; e2e verde; Tezcat strict reexecutado nos 3 escopos com a **nota e a contagem de FAIL/WARN anotadas** nos relatórios locais da auditoria; APK numerado só nas fases marcadas (entregue como em `apk-de-teste.md`); `roadmap-pendencias.md` e `roadmap-implementadas.md` atualizados.
- **Regra de ouro dos lotes de refatoração:** nenhum lote muda comportamento. Se aparecer bug, vira item novo no consolidado. Nenhum WARN justifica quebrar uma função só para agradar a ferramenta.

## Decisões suas, que destravam fases

| # | Decisão | Destrava | Recomendação |
|---|---|---|---|
| D1 | **Padrão de "parar após silêncio"** (CONS-010): 5 s hoje encerra tentativa com deslocamento | Fase 1, trilha 1B | 15 a 20 s, teto acima de 30 s |
| D2 | **Voz "Standing by" ligada por padrão?** (CONS-012) | Fase 1, trilha 1B | Desligada por padrão ou aviso no primeiro Standby |
| D3 | **Licença da voz Spruce** (CONS-003): provar, trocar por TTS/voz livre, ou remover | Fase 7 | Decidir antes do primeiro push |
| D4 | **A aba Calibrar some depois da Etapa 1?** | Fase 3 (L03), Fase 6 (L05b) | **Feito antes (2026-11-23):** aba removida; some junto 18 dos 53 FAIL do Svelte |
| D5 | **Dicionários `pt/en/es.ts`** (FAIL só por tamanho de dados): dividir, aceitar o FAIL ou ajustar o limite | Fase 5 | Ajustar o perfil para arquivos de dados |
| D6 | **HF em ms ou arredondado** (CONS-027) e o que é "tentativa duvidosa" | Fase 4E (feito) | **Decidido e confirmado:** HF = pontos ÷ tempo de 2 casas (IPSC 9.2.1.1 e 9.7.1), mostrado com 4; o regulamento não define arredondar ou truncar (half up é convenção do app) |

## Visão geral

| Fase | Objetivo | Trilhas (paralelas) | Entrega |
|---|---|---|---|
| 0 | Preparar | 3 | Linha de base e backups |
| 1 | Onda 1: correções funcionais pequenas | 4 | **APK 023** |
| 2 | Campo e Etapa 1 (você) | 2 | Roteiro de campo feito, áudio cru gravado |
| 3 | Fundações do strict (portão) | 1 (sequencial) | L05a, L10 |
| 4 | Strict: módulos independentes | 5 | L04, L01→L03, L11→L06, L13 |
| 5 | Strict: núcleo do timer | 3 | L02a→L02b→L02c→L09, L07 |
| 6 | Strict: Calibrar e detector (depende da Etapa 1) | 2 | L08, L05b → **Svelte e Kotlin com 0 FAIL** |
| 7 | Pronto para o primeiro push / MVP | 6 | Voz, CI, assinatura, privacidade, ranking |
| 8 | WARN e revalidação | 5 + rodada 2 | L14 a L18, auditoria rodada 2, **APK final** |

---

## Fase 0 — Preparação (sem risco)

| Trilha | Itens | Quem | Validação |
|---|---|---|---|
| 0A | Fazer backup da debug keystore padrão do Android SDK (CONS-005, parte); corrigir o caminho da chave em `apk-de-teste.md` | **Você** (cópia) + eu (doc) | `apksigner verify --print-certs` do zip 022 igual ao novo |
| 0B | Corrigir os erros dos relatórios (contagens do 01, 17, 21, 22 e as 4 afirmações contraditas) e a doc: tabela de `--foco` do `design-tokens.md` (DOC-001), "último APK validado" único (DOC-002), UX-18 corrigido nas pendências | eu | `grep` e leitura; `check` |
| 0C | **Linha de base:** commit da auditoria; rodar `npm run test:e2e` **20 vezes** guardando a saída e a diferença ao vivo × reprocessado (CONS-035/036); registrar `tzt` strict atual como "antes" | eu | Taxa de falha do e2e conhecida |

**Gate 0:** auditoria commitada, e2e medido, decisões D1 a D2 respondidas.

## Fase 1 — Onda 1 (antes do campo)

Quatro trilhas paralelas. Cada uma tem testes novos no mesmo commit.

| Trilha | Itens | Arquivos | Por que juntos |
|---|---|---|---|
| **1A — Timer e Revisão** | CONS-001 (percurso padrão ou seletor no Resultado), CONS-002 (Revisão montada e id estável), CONS-008 (confirmar Descartar e Nova tentativa), CONS-009 (cancelar ao sair da aba, ou manter Parar visível) | `Timer.svelte`, `Revisao.svelte`, `registro.ts`, `SeletorPercurso.svelte`, `tests/e2e/timer.mjs` | Mesmo estado `resultado` e a mesma barra fixa; um corrige o que o outro monta |
| **1B — Padrões e textos** | CONS-010 (silêncio), CONS-012 (voz), CONS-013 ("Biblioteca Musical" → "Nicska" nos 3 idiomas e no vendor do Opus), L10 (`preferencias.ts` 1 FAIL) | `preferencias.ts`, `timer.ts` (só o teto), `i18n/*.ts`, `ogg.ts` | Mesma região de preferências; depende de **D1 e D2**; teste que falha se um dicionário contiver "Biblioteca" |
| **1C — Manifesto e vibração** | CONS-011 (`VIBRATE` no template **e** no `gen/`), conferir `aapt dump permissions` | `src-tauri/**/AndroidManifest.xml` | Isolada |
| **1D — Roteiro de campo** | Escrever `docs/roteiro-de-campo.md`: escuta com tela bloqueada em 2 aparelhos (CONS-007), batidas, voz, JSON recebido, ranking; folha de anotação | só docs | Isolada |

**Atenção de conflito:** 1A e 1B adicionam chaves nos dicionários; eu mesclo nessa ordem (1B, depois 1A).
**Gate 1:** testes + e2e (os novos de 1A incluídos), **APK 023**.

## Fase 2 — Campo e Etapa 1 (você, com apoio meu)

| Trilha | O quê | Saída |
|---|---|---|
| **2A — Roteiro de campo** (1D) com o APK 023 | CONS-007 primeiro: armar, bloquear a tela, atirar | Folha preenchida; abre ou não o item de `ServicoAudio`/`onPause` na Fase 5 |
| **2B — Etapa 1** | 10 a 20 tentativas com o Gravador (áudio cru) e um timer comercial como gabarito; casos difíceis (baia vizinha, eco, splits rápidos) | Áudio + gabarito, base de `tools/analisar-tentativas.py`, `calibracao.md` e das fixtures (CONS-006) |

**Gate 2:** resultados anotados; D4 decidida com base no campo.

## Fase 3 — Fundações do strict (um portão sequencial)

Uma trilha só, curta, **antes** de abrir as paralelas, porque mexe em arquivos que várias trilhas importam.

| Trilha | Itens | Arquivos |
|---|---|---|
| **3A** | **L05a**: tirar de `gravador.ts` os utilitários compartilhados (`escolherFormato`, `BITS_POR_SEGUNDO`, `motivoDoErro`, `rastro`) para módulo próprio; ajustar imports em `escuta.ts`, `Timer.svelte`, `banco.ts`, `gravacoes.ts` | `gravador.ts` + importadores |

**Gate 3:** `vitest`, `check`, e2e; Tezcat strict reexecutado (nenhuma regressão).

## Fase 4 — Strict: módulos independentes (5 trilhas paralelas)

Arquivos sem sobreposição entre si, **fora** do trio do Timer.

| Trilha | Lotes e itens | Ordem interna |
|---|---|---|
| **4A — Áudio de envio** | **L04** `ogg.ts`/`webm.ts` (4 FAIL, 4 WARN) | **`webm.test.ts` primeiro** (contêiner truncado e vazio), depois a refatoração |
| **4B — Dados** | **L01** `documento.ts` (6 FAIL) com CONS-044 e CONS-039 → **L03** `armazenamento.ts`/`banco.ts` (5 FAIL) | L01 antes de L03: `armazenamento` consome o que `documento` valida; dividir `documento.ts` é o momento de corrigir data 31/02, `detector.versao` futuro, limite em bytes e BOM |
| **4C — Histórico e envio** | **L11** `Historico.svelte` (CONS-029, 052) → **L06** `compartilhar.ts` + `PonteCompartilhar.kt` (CONS-032, 044) → CONS-014 (confirmar importação, toca `Historico`, `Dados.svelte` e `compartilhar`) | Sequencial: L11 → L06 → CONS-014 |
| **4D — Dicionários** | **L13** `pt/en/es.ts` + CONS-041 (chave `.zero`) | Depende de **D5**; rodar `verificar-traducoes.py`; **mesclar por último** (todo mundo mexe nos dicionários) |
| **4E — Ranking** (adianta o P2) | CONS-025/026/027 (duvidosa por `disparos_minimos`, id estável de drills, HF) + L16 | Depende de **D6** |

**4D — configuração do Tezcat (D5 = C).** `tezcat.toml` na raiz desliga só o princípio `clean` (via `[rules]`, por caminho) para `src/lib/i18n/pt.ts`, `en.ts` e `es.ts`: são arquivos de dados, sem lógica, e o único achado era Clean/Tamanho (linhas). `index.svelte.ts` e o resto do projeto seguem no strict. Resultado no strict: 53 FAIL / 161 WARN → 50 FAIL / 161 WARN (os 3 FAIL dos dicionários saem; nada mais muda).

**Gate 4:** `vitest`, `check`, e2e, Tezcat strict (anotar a queda de FAIL).

## Fase 5 — Strict: núcleo do timer (3 trilhas)

| Trilha | Lotes e itens | Ordem interna |
|---|---|---|
| **5A — Timer ao vivo** | **L02a** `Timer.svelte` (CONS-019: extrair `ouvirBatidas`; soltar o wake lock no esgotar e repor ao voltar) → **L02b** `Revisao.svelte` → **L02c** `timer.ts` (CONS-022 apito em `preparando`, CONS-023 interrupção com disparos) → **L09** `escuta.ts`/`escuta.worklet.ts` (CONS-022, corrida cancelar/iniciar) | **UI primeiro, depois a classe.** L09 só depois de **`tests/escuta.test.ts`** (hoje só o e2e cobre). Tudo na mesma trilha: `timer.ts` e `escuta.ts` são acoplados |
| **5B — Serviço Android** | **L07** `ServicoAudio.kt` (CONS-047 `acquire()` sem teto) + correção de `onPause`/`onResume` (`MainActivity.kt`, `WryActivity` pausa a WebView) | **Só depois do resultado do CONS-007 no campo (Fase 2A).** Validar no aparelho |
| **5C — Resíduos Kotlin** | **L18** (WARN de `PonteCompartilhar.kt`, `ServicoAudio.kt`, `PonteServico.kt`) | Depende de 4C (L06) e 5B |

**Gate 5:** e2e completo (a rede de segurança são os e2e novos da Fase 1); campo de novo no que mudou; **APK 025**.

## Fase 6 — Strict: Calibrar e detector (depende da Etapa 1)

| Trilha | Itens | Condição |
|---|---|---|
| **6A — Detector** | **L08** `detector.ts` (2 FAIL, 10 WARN) com CONS-021 (apito mascarando os primeiros tiros) | **Só depois da Etapa 1 (gabarito real).** Sem mudar parâmetros no mesmo commit; `detector.test.ts`, `apito.test.ts` e `detector-real.test.ts` verdes |
| **6B — Calibrar** | **L05b**: **FEITO em 2026-11-23: aba removida** (antes: refatorar o trio `Gravador.svelte`/`gravador.ts`/`gravacoes.ts`/`ItemGravacao.svelte`, 18 FAIL, 36 WARN); CONS-028 | Depois de L05a (Fase 3) e de a Etapa 1 estar gravada |

**Gate 6 / marco:** **Tezcat strict: Svelte 0 FAIL e Kotlin 0 FAIL**; nota anotada.

## Fase 7 — Pronto para o primeiro push (MVP)

Seis trilhas independentes (exceto onde indicado):

| Trilha | Itens | Depende de |
|---|---|---|
| **7A — Voz** | CONS-003 (provar a licença **ou** trocar/remover o `.ogg`), CONS-018 (Créditos e aviso de marcas), `licencas-de-terceiros.md:4` | **D3**; mexe em `apito.ts` (L14 da Fase 8) |
| **7B — CI** | CONS-004 (remover ou recriar os workflows `claude-*` herdados), CONS-037/038 (Dependabot, `cargo audit`, ações por SHA, toolchain fixa, SBOM) | — |
| **7C — Assinatura** | CONS-005 completo: chave de release, `signingConfigs` condicional, `.gitignore` com `*.jks`/`keystore.properties`, `apksigner` no CI 
| | **Feito (branch `aud/7cd-assinatura-privacidade`):** `signingConfigs.release` condicional (`keystore.properties` ou `NICSKA_*`), `.gitignore`, `keystore.properties.example`, procedimento em `apk-de-teste.md` e `SECURITY.md`. **Falta:** gerar a chave (responsável) e `apksigner verify --print-certs` no CI (7B). | |
| **7D — Privacidade e superfície** | CONS-015/016/017 (CSP restritiva testada no aparelho, remover `INTERNET` e `opener` do release, `allowBackup="false"` ou regras de extração) | Manifesto (depois da 1C) |
| | **Feito:** `allowBackup="false"`; `INTERNET` só em `src/debug/AndroidManifest.xml`; plugin `opener` removido (capability, crate, pacote); `tests/manifesto.test.ts` atualizado; CSP **proposta** em `docs/proposta-csp.md`, **não ativada**. **Falta (aparelho):** testar o release sem `INTERNET` (a WebView carrega os assets locais; o `processArm64ReleaseManifest` não rodou porque o Gradle depende de arquivos gerados pelo Tauri) e testar/ativar a CSP. | |
| **7E — Precisão** | CONS-006: fixtures curtas com gabarito no Git, teste obrigatório no CI, `tools/analisar-tentativas.py`, `calibracao.md` | Etapa 1 (2B) e L08 (6A) |
| **7F — Estande (Etapa 7)** | Validação contra o timer comercial: contagem ≥ 95% e ±10 ms | 7E |

> **7B feita na branch `aud/7b-ci`** (detalhes e pendências, como SBOM e `cargo deny`, em `docs/ci.md`).

**Gate 7:** repositório no GitHub (primeiro push) **só depois de D3, 7A, 7B e 7C**; CI verde.

## Fase 8 — WARN e revalidação

| Trilha | Lote | Itens |
|---|---|---|
| **8A** | **L14** `apito.ts` (6 WARN) | CONS-003 (depois de 7A) e CONS-021 |
| **8B** | **L15** `revisao.ts`, `revisaoAudio.ts` (8) | CONS-024 (reprocesso com janela do apito e modo fone; `reprocessar` recebe objeto de opções) |
| **8C** | **L16** `ranking.ts`, `estatisticas.ts` (6) | Se não foi feito em 4E |
| **8D** | **L17** `batidas.ts`, `index.svelte.ts`, `registro.ts`, `licencas.ts`, `Dados.svelte`, `Abas.svelte`, `Grafico.svelte`, `Ranking.svelte`, `SeletorPercurso.svelte` (14) | CONS-041, 043 |
| **8E** | Dívida da Onda 3 do consolidado (CONS-020 a 024 restantes, 028 a 034, 039 a 057) | Por prioridade: 021 e 022 (afetam o tempo), 031 (medir no aparelho), 046 |

Depois: **auditoria rodada 2** (reexecutar os 17 perfis e o coordenador numa pasta nova `docs/auditoriaAAMMDD/`), Tezcat strict nos 3 escopos com a nota final e **APK final**.

---

## Mapa de dependências (o que NÃO pode rodar em paralelo)

| Par | Motivo |
|---|---|
| 1A × 1B | Dicionários e `Timer.svelte`; mesclar 1B antes |
| 3A → quase tudo | `gravador.ts` é importado por `escuta.ts`, `Timer.svelte`, `banco.ts`, `gravacoes.ts` |
| L01 → L03 | `armazenamento` consome o que `documento` valida (CONS-044) |
| L11 → L06 → CONS-014 | `Historico.svelte`, `Dados.svelte`, `compartilhar.ts` |
| L02a → L02b → L02c → L09 | UI primeiro; `timer.ts` e `escuta.ts` acoplados (CONS-022 nos dois) |
| L07 → Fase 2A | O desenho do serviço depende do que o campo mostrar (CONS-007) |
| L08, 7E, 7F → Etapa 1 | Qualquer mudança no detector sem gabarito é no escuro |
| L05b | Calibrar removida em 2026-11-23 |
| L13 e qualquer trilha que adiciona texto | Os 3 dicionários; L13 por último |
| e2e de qualquer trilha | Chrome e portas compartilhadas: **só eu rodo**, na integração |

## O que não entra neste plano (decisão consciente)

`BuildTask.kt` e `RustPlugin.kt` (código do template do Tauri: pedir ao Tezcat para ignorar `buildSrc`); WARN dos arquivos de `tests/` (excluir do escopo do Tezcat ou aceitar); o escopo `--backend --js` do Tezcat, que não acha classe (a cobertura de `src/lib` vem só do escopo Svelte).

## Acompanhamento

Uma linha por trilha: `docs/roadmap-pendencias.md` ganha a seção "Plano de ação" apontando para este arquivo; ao fechar cada fase, o resumo vai para `docs/archive/roadmap-implementadas.md` e a nota do Tezcat strict da época entra na tabela abaixo.

| Marco | Svelte (nota, FAIL/WARN) | Kotlin (nota, FAIL/WARN) | Rust |
|---|---|---|---|
| Hoje (strict) | 90,9 — 53 / 162 | 92,6 — 2 / 13 | 100,0 — 0 / 0 |
| **Gate 1 (feito, 2026-11-23)** | 91,1 — 53 / 162 (108 unidades) | 92,6 — 2 / 13 | 100,0 — 0 / 0 |
| Gate 4 | | | |
| Gate 5 | | | |
| Gate 6 (meta) | **0 FAIL** | **0 FAIL** | 0 |
| Gate 8 (meta) | 0 FAIL, mínimo de WARN | 0 FAIL, mínimo de WARN | 0 |
