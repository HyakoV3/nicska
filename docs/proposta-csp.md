# Proposta de CSP (NÃO ativa)

**Estado:** proposta da trilha 7D (CONS-015). `src-tauri/tauri.conf.json` continua com `"csp": null`. Uma CSP errada quebra o app (apito, escuta do microfone, gravações), então ela só entra depois de testada **no aparelho** pelo responsável.

## Por que
A WebView expõe três pontes nativas (`NkServico`, `NkCompartilhar`, `NkTema`). Sem CSP, qualquer injeção de script futura (por exemplo uma regressão no único `{@html}`, `Icone.svelte:20`, hoje com dado interno) alcançaria as pontes. A CSP é defesa em profundidade.

## O que o app usa (levantado no código)
- Scripts do próprio pacote; um `<script>` inline em `src/app.html:8` (o Tauri acrescenta nonce/hash aos inline do build quando há CSP).
- Worklet de escuta: `ctx.audioWorklet.addModule(workletUrl)` (`src/lib/escuta.ts:83`), arquivo emitido pelo Vite (`?worker&url`). `addModule` segue `script-src`.
- `fetch(vozUrl)` do `.ogg` empacotado (`src/lib/apito.ts:43`): `connect-src 'self'`.
- Áudio e downloads por `blob:` (`URL.createObjectURL` em `gravador.ts`, `ItemGravacao.svelte`, `ListaTentativas.svelte`, `dados.ts`): `media-src blob:`.
- Estilos inline (atributos `style=` do Svelte e `app.html:27`): `style-src 'unsafe-inline'`.
- Sem WebAssembly, sem rede, sem iframes.

## Proposta
```json
"security": {
  "csp": "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; media-src 'self' blob: data:; connect-src 'self' ipc: http://ipc.localhost; worker-src 'self' blob:; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'"
}
```
Observações: `ipc:` e `http://ipc.localhost` são exigidos pelo IPC do Tauri 2. Em `tauri dev`, o servidor `http://localhost:1420` e o HMR (`ws://localhost:1420`) precisam entrar em `connect-src` e `script-src` (use `devCsp`, separado da CSP de release). `'wasm-unsafe-eval'` não é necessário hoje; só acrescente se surgir WebAssembly.

## Como testar no aparelho (release arm64)
1. Ativar a CSP, gerar o APK de teste e instalar.
2. Armar o timer: o apito toca (fetch do `.ogg`), a escuta do microfone funciona (worklet carrega) e as batidas são detectadas.
3. Gravar e reproduzir uma tentativa (`blob:`); exportar e importar um JSON; compartilhar (as três pontes).
4. Ver o `logcat` (`chromium`/`Refused to ...`): nenhuma violação de CSP. Cada violação indica qual diretiva afrouxar.
5. Só então mudar o `csp` e ajustar o teste em `tests/manifesto.test.ts` (hoje ele registra `csp: null` como estado atual).
