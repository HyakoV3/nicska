# Contribuindo com o Nicska

Obrigado pelo interesse! O projeto é pequeno e em português; issues e PRs em português ou inglês são bem-vindos.

## Antes de abrir um PR
- Abra uma *issue* descrevendo o problema ou a ideia (ideias em aberto: [`docs/roadmap-ideas.md`](docs/roadmap-ideas.md); pendências: [`docs/roadmap-pendencias.md`](docs/roadmap-pendencias.md)).
- Rode localmente: `npm run check`, `npm test`, `npm run test:e2e` (precisa de Chrome/Chromium) e `python3 tools/verificar-traducoes.py && python3 tools/verificar-movimento.py && python3 tools/contraste.py`.
- Texto de interface: use as chaves de `src/lib/i18n/` e traduza **pt, en e es** (o teste de dicionários confere).
- CSS em `rem` (sem `px`, salvo medidas lidas do layout em JS) e respeitando "reduzir movimento".
- Não commite dados pessoais, áudios/vídeos reais de treino com voz de pessoas, chaves (`*.jks`, `keystore.properties`) nem arquivos `.env`.

## Mensagem de commit
Em português, no imperativo curto ("Corrige a vírgula do split"), explicando o porquê quando não for óbvio.

## Segurança
Falhas de segurança: use o relato privado (veja [`SECURITY.md`](SECURITY.md)), não uma issue pública.

## Licença
Ao contribuir, você concorda que o seu código segue a licença [MIT](LICENSE) do projeto.
