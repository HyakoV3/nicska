// Teste de ponta a ponta do Nicska, num Chrome de verdade (headless e MUDO). Rodar: npm run test:e2e
//
// Sobe o servidor de desenvolvimento do Vite e um Chrome com microfone FALSO (`--use-fake-device-for-media-stream`; na Etapa 2 entra
// `--use-file-for-fake-audio-capture=<wav>` para o detector ouvir áudio real) e confere a concha do app: as abas, a troca entre elas e Ajustes.
// Precisa de um Chrome ou Chromium instalado (variável CHROME para indicar o caminho).
import { spawn, execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import process from "node:process";

const PORTA_VITE = Number(process.env.NK_PORTA_VITE ?? 5199);
const PORTA_CHROME = 9340;
const RAIZ = new URL("../../", import.meta.url).pathname;

// O microfone falso do Chrome toca este WAV (o apito de 2700 Hz e quatro tiros de ruído com cauda) em vez de captar. `%noloop`: toca uma vez só.
const TAXA_WAV = 48000;
const TIROS_S = [3.0, 3.4, 3.62, 5.0]; // instantes no arquivo; o apito começa em 1,0 s
function gerarWav() {
  const n = TAXA_WAV * 7;
  const x = new Int16Array(n);
  let sem = 11;
  const r = () => ((sem = (Math.imul(sem, 1664525) + 1013904223) >>> 0) / 0xffffffff) - 0.5;
  for (let i = 0; i < n; i++) x[i] = Math.round(0.002 * 2 * r() * 32767);
  for (let i = 0; i < TAXA_WAV / 2; i++) {
    const rampa = Math.min(1, i / (TAXA_WAV * 0.002));
    x[TAXA_WAV + i] += Math.round(0.5 * rampa * Math.sin((2 * Math.PI * 2700 * i) / TAXA_WAV) * 32767);
  }
  for (const t of TIROS_S) {
    const ini = Math.round(t * TAXA_WAV);
    for (let i = 0; i < TAXA_WAV && ini + i < n; i++) {
      const s = i / TAXA_WAV;
      x[ini + i] += Math.round((0.7 * Math.exp(-s / 0.015) + 0.084 * Math.exp(-s / 0.25)) * 2 * r() * 32767);
    }
  }
  const b = Buffer.alloc(44 + n * 2);
  b.write("RIFF", 0); b.writeUInt32LE(36 + n * 2, 4); b.write("WAVEfmt ", 8); b.writeUInt32LE(16, 16);
  b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22); b.writeUInt32LE(TAXA_WAV, 24); b.writeUInt32LE(TAXA_WAV * 2, 28);
  b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34); b.write("data", 36); b.writeUInt32LE(n * 2, 40);
  Buffer.from(x.buffer).copy(b, 44);
  return b;
}

const dormir = (ms) => new Promise((r) => setTimeout(r, ms));
const filhos = [];
let perfil = null;

// Encerra o processo e os filhos dele (o Chrome abre vários): sinal para o grupo de processos inteiro.
function encerrar(p, sinal) {
  try {
    if (process.platform === "win32") p.kill(sinal);
    else process.kill(-p.pid, sinal);
  } catch {
    /* já saiu */
  }
}

// O grupo de processos ainda tem alguém vivo? `kill(-pid, 0)` não envia nada: só falha com ESRCH quando o grupo
// esvaziou. O líder (o processo que o Node criou) pode sair antes dos filhos, então olhar só o `exit` dele não basta.
function grupoVivo(p) {
  if (process.platform === "win32") return p.exitCode === null;
  try {
    process.kill(-p.pid, 0);
    return true;
  } catch {
    return false;
  }
}

async function aguardarGrupo(p, ms) {
  const fim = Date.now() + ms;
  while (grupoVivo(p) && Date.now() < fim) await dormir(100);
}

let limpando = null;
function limpar() {
  limpando ??= (async () => {
    for (const p of filhos) encerrar(p, "SIGTERM");
    // O Chrome ainda escreve na pasta do perfil ao sair: espera o grupo inteiro sumir (e, se demorar, força).
    await Promise.all(filhos.map((p) => aguardarGrupo(p, 4000)));
    for (const p of filhos) if (grupoVivo(p)) encerrar(p, "SIGKILL");
    await Promise.all(filhos.map((p) => aguardarGrupo(p, 2000)));
    apagarPerfil();
  })();
  return limpando;
}

// Com `detached: true` o Ctrl-C do terminal não chega mais aos filhos: sem isto, interromper o teste (ou cancelar o job)
// deixaria o Chrome e o Vite órfãos, e o Vite seguiria na porta 5199 e quebraria a próxima execução.
for (const [sinal, codigo] of [["SIGINT", 130], ["SIGTERM", 143]]) {
  process.on(sinal, async () => {
    await limpar();
    process.exit(codigo);
  });
}

function apagarPerfil() {
  if (perfil) {
    try {
      rmSync(perfil, { recursive: true, force: true, maxRetries: 10, retryDelay: 300 });
    } catch (e) {
      // É só uma pasta temporária: não pode mudar o resultado do teste.
      console.warn(`aviso: não deu para apagar ${perfil}: ${e.code ?? e.message}`);
    }
  }
}

function acharChrome() {
  const candidatos = [process.env.CHROME, "google-chrome", "google-chrome-stable", "chromium", "chromium-browser"].filter(Boolean);
  for (const c of candidatos) {
    try {
      execFileSync(c, ["--version"], { stdio: "ignore" });
      return c;
    } catch {
      /* tenta o próximo */
    }
  }
  throw new Error("Chrome ou Chromium não encontrado (defina CHROME com o caminho do executável)");
}

async function esperarUrl(url, ms) {
  const fim = Date.now() + ms;
  while (Date.now() < fim) {
    try {
      if ((await fetch(url)).ok) return;
    } catch {
      /* ainda não subiu */
    }
    await dormir(300);
  }
  throw new Error(`não respondeu a tempo: ${url}`);
}

async function principal() {
  // 1. servidor de desenvolvimento. Chama o Vite direto pelo Node (com `npx` ele viraria processo neto e sobraria rodando ao fim do teste).
  const vite = spawn(
    process.execPath,
    [join(RAIZ, "node_modules/vite/bin/vite.js"), "dev", "--port", String(PORTA_VITE), "--strictPort", "--host", "127.0.0.1"],
    { cwd: RAIZ, stdio: "ignore", detached: true },
  );
  filhos.push(vite);
  await esperarUrl(`http://127.0.0.1:${PORTA_VITE}/`, 60000);

  // 2. Chrome mudo, com microfone falso.
  perfil = mkdtempSync(join(tmpdir(), "nk-e2e-"));
  const wav = join(perfil, "microfone.wav");
  writeFileSync(wav, gerarWav());
  const chrome = spawn(
    acharChrome(),
    [
      "--headless=new", "--no-sandbox", "--disable-gpu", "--mute-audio", "--autoplay-policy=no-user-gesture-required",
      "--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream", `--use-file-for-fake-audio-capture=${wav}%noloop`,
      "--window-size=412,915", `--user-data-dir=${perfil}`, `--remote-debugging-port=${PORTA_CHROME}`, "about:blank",
    ],
    { stdio: "ignore", detached: true },
  );
  filhos.push(chrome);
  await esperarUrl(`http://127.0.0.1:${PORTA_CHROME}/json/version`, 30000);

  // 3. protocolo de depuração do Chrome
  const alvos = await (await fetch(`http://127.0.0.1:${PORTA_CHROME}/json`)).json();
  const ws = new WebSocket(alvos.find((t) => t.type === "page").webSocketDebuggerUrl);
  await new Promise((r) => (ws.onopen = r));
  let n = 0;
  const espera = new Map();
  const erros = [];
  ws.onmessage = (ev) => {
    const m = JSON.parse(ev.data);
    if (m.id && espera.has(m.id)) espera.get(m.id)(m);
    if (m.method === "Runtime.exceptionThrown") erros.push(JSON.stringify(m.params.exceptionDetails).slice(0, 300));
  };
  const enviar = (method, params = {}) =>
    new Promise((r) => {
      const id = ++n;
      espera.set(id, r);
      ws.send(JSON.stringify({ id, method, params }));
    });
  const av = async (expressao) => {
    const r = await enviar("Runtime.evaluate", { expression: expressao, returnByValue: true, awaitPromise: true });
    if (r.result?.exceptionDetails) throw new Error(JSON.stringify(r.result.exceptionDetails).slice(0, 300));
    return r.result?.result?.value;
  };
  await enviar("Runtime.enable");
  await enviar("Page.enable");

  let falhas = 0;
  const confere = (ok, texto) => {
    console.log(`${ok ? "ok  " : "FALHOU"} ${texto}`);
    if (!ok) falhas++;
  };
  const esperarAte = async (expressao, ms = 8000) => {
    const fim = Date.now() + ms;
    while (Date.now() < fim) {
      if (await av(expressao).catch(() => false)) return true;
      await dormir(100);
    }
    return false;
  };

  // Prints para a revisão de UX/UI (NK_FOTO=pasta): 390 x 800 em português, a página inteira.
  let nFoto = 0;
  const foto = async (nome) => {
    if (!process.env.NK_FOTO) return;
    await dormir(500);
    const { result: { data } } = await enviar("Page.captureScreenshot", { format: "png", captureBeyondViewport: true });
    (await import("node:fs")).writeFileSync(`${process.env.NK_FOTO}/${String(++nFoto).padStart(2, "0")}-${nome}.png`, Buffer.from(data, "base64"));
  };
  // UX-01 (docs/archive/roadmap-ux-ui.md): rolando até o fim, nada acionável pode ficar sob a barra de abas fixa. Mede no viewport real (sem captura de página inteira).
  const livreDaBarra = async (nome) => {
    await av(`window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'instant' })`);
    await dormir(900);
    const r = await av(`(() => {
      window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'instant' });
      const nav = document.querySelector('.barra-fixa') ?? document.querySelector('#aba-timer')?.closest('[role=tablist]'); if (!nav) return null;
      const topo = nav.getBoundingClientRect().top;
      const vis = (e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && e.checkVisibility({ visibilityProperty: true, contentVisibilityAuto: true }); };
      const fixa = document.querySelector('.barra-fixa');
      const barraAbas = document.querySelector('#aba-timer')?.closest('[role=tablist]');
      const colada = fixa ? Math.round(barraAbas.getBoundingClientRect().top - fixa.getBoundingClientRect().bottom) : 0;
      const fim = Math.max(...[...document.querySelectorAll('main *')].filter((e) => !e.closest('.barra-fixa')).filter(vis).map((e) => e.getBoundingClientRect().bottom));
      const culpado = [...document.querySelectorAll('main *')].filter(vis).sort((a, b) => b.getBoundingClientRect().bottom - a.getBoundingClientRect().bottom)[0];
      return { colada, culpado: culpado.tagName + '.' + culpado.className + ' ' + (culpado.textContent || '').trim().slice(0, 30), y: Math.round(scrollY), topo: Math.round(topo), fim: Math.round(fim), alto: innerHeight, rolagem: Math.round(document.documentElement.scrollHeight) };
    })()`);
    confere(r !== null && r.fim <= r.topo + 1 && Math.abs(r.colada) <= 1, `${nome}: no fim da rolagem o conteúdo termina em ${r?.fim} px e a barra de abas (ou a ação fixa) começa em ${r?.topo} px, a ação fixa encosta nas abas (folga ${r?.colada} px) (viewport ${r?.alto} px, scrollY ${r?.y}, último: ${r?.culpado})`);
    await av(`window.scrollTo({ top: 0, behavior: 'instant' })`);
  };
  if (process.env.NK_FOTO) {
    await enviar("Emulation.setDeviceMetricsOverride", { width: 390, height: 800, deviceScaleFactor: 2, mobile: true });
    await enviar("Emulation.setLocaleOverride", { locale: "pt-BR" }).catch(() => {});
  }

  // 4. a tela inicial: duas abas, Cronômetro aberta
  await enviar("Page.navigate", { url: `http://127.0.0.1:${PORTA_VITE}/` });
  if (process.env.NK_FOTO) { await av(`localStorage.setItem('idioma', 'pt')`); await enviar("Page.reload"); }
  confere(await esperarAte(`document.querySelectorAll('[role=tab]').length === 2`), "a tela inicial tem 2 abas");
  const abas = await av(`[...document.querySelectorAll('[role=tab]')].map((a) => a.id)`);
  confere(JSON.stringify(abas) === JSON.stringify(["aba-timer", "aba-historico"]), `abas: ${abas}`);
  confere((await av(`document.querySelector('#painel-timer').hidden`)) === false, "Timer abre primeiro");

  // 4b. a fonte Sora (números grandes e STAND BY) carrega do próprio app, e os dígitos têm largura fixa (o tempo não pode "dançar")
  const sora = await av(`(async () => {
    await document.fonts.load('700 48px Sora');
    const largura = (txt) => { const e = document.createElement('span'); e.style.cssText = "font: 700 48px Sora; font-variant-numeric: tabular-nums; position: absolute; visibility: hidden; white-space: pre"; e.textContent = txt; document.body.appendChild(e); const w = e.getBoundingClientRect().width; e.remove(); return w; };
    return { carregou: document.fonts.check('700 48px Sora'), w111: largura('1111'), w000: largura('0000'), w888: largura('8888') };
  })()`);
  confere(sora.carregou, "a fonte Sora carrega (arquivo embutido em /fontes/)");
  confere(Math.abs(sora.w111 - sora.w000) < 0.5 && Math.abs(sora.w000 - sora.w888) < 0.5, `os dígitos da Sora têm largura fixa com tabular-nums (1111=${sora.w111.toFixed(1)}, 0000=${sora.w000.toFixed(1)}, 8888=${sora.w888.toFixed(1)})`);

  // 5. trocar de aba
  for (const id of ["historico", "timer"]) {
    await av(`document.querySelector('#aba-${id}').click()`);
    confere(await esperarAte(`document.querySelector('#painel-${id}').hidden === false`), `aba ${id} abre o seu painel`);
  }

  // 6. Ajustes abre
  await enviar("Page.navigate", { url: `http://127.0.0.1:${PORTA_VITE}/ajustes` });
  confere(await esperarAte(`!!document.querySelector('#cartao-aparencia')`), "Ajustes mostra o cartão de aparência");
  confere(await esperarAte(`!!document.querySelector('#cartao-registro')`), "Ajustes mostra o cartão Registro (Só áudio / Áudio + vídeo saiu da aba Cronômetro, V2b)");
  await foto("ajustes");

  // 7. a escuta (Etapa 2): o worklet carrega no build do Vite, o microfone falso toca o WAV e o detector acha o apito e os tiros
  await enviar("Page.navigate", { url: `http://127.0.0.1:${PORTA_VITE}/` });
  await esperarAte(`document.querySelectorAll('[role=tab]').length === 3`);
  const inicio = await av(`(async () => {
    const { Escuta } = await import('/src/lib/escuta.ts');
    const e = new Escuta(); window.__escuta = e; window.__eventos = [];
    e.aoEvento = (ev) => window.__eventos.push(ev);
    await e.iniciar();
    return { taxa: e.taxa, filtros: e.filtrosDesligados };
  })()`);
  confere(inicio?.taxa > 0, `a escuta abriu o worklet e o microfone (taxa ${inicio?.taxa} Hz, filtros desligados: ${inicio?.filtros})`);
  confere(await esperarAte(`window.__eventos.filter((e) => e.tipo === 'disparo').length >= ${TIROS_S.length}`, 15000), "o detector achou os 4 disparos");
  const ev = await av(`window.__eventos`);
  const apitos = ev.filter((e) => e.tipo === "apito");
  const tiros = ev.filter((e) => e.tipo === "disparo");
  confere(apitos.length === 1 && tiros.length === TIROS_S.length, `1 apito e ${TIROS_S.length} disparos (veio ${apitos.length} e ${tiros.length})`);
  if (apitos.length === 1) {
    const rel = tiros.map((t) => t.tempo - apitos[0].tempo);
    const esperado = TIROS_S.map((t) => t - 1.0);
    const dif = rel.map((v, i) => Math.round((v - esperado[i]) * 1000));
    confere(dif.every((d) => Math.abs(d) <= 25), `tempos desde o apito batem com o arquivo (diferença em ms: ${dif.join(", ")})`);
  }
  // O MediaRecorder entrega o Opus com atraso (quadros de 20 ms): parar na hora em que o ao vivo acha o último tiro corta o áudio gravado antes da
  // confirmação dele (30 ms) e o reprocessamento acha só 3 disparos. Deixa a cauda do último tiro chegar à gravação.
  await dormir(500);
  const tentativa = await av(`(async () => { const t = await window.__escuta.parar(); window.__ultimaTentativa = t; return t ? { bytes: t.blob.size, tipo: t.tipo } : null; })()`);
  // o reprocessamento do áudio GUARDADO (Opus decodificado) acha o mesmo que a escuta ao vivo (Etapa 4)
  const rep = await av(`(async () => {
    const { decodificar } = await import('/src/lib/revisaoAudio.ts');
    const { reprocessar } = await import('/src/lib/revisao.ts');
    const t = window.__ultimaTentativa;
    const { amostras, taxa } = await decodificar(t.blob);
    return reprocessar({ amostras, taxa }, { zeroEstimadoS: null });
  })()`).catch((e) => ({ erro: String(e) }));
  confere(rep && rep.inicio === "detectado" && rep.disparosMs?.length === TIROS_S.length, `o reprocessamento do áudio guardado acha o apito e ${TIROS_S.length} disparos`);
  if (rep?.disparosMs && apitos.length === 1) {
    const vivo = tiros.map((t) => Math.round((t.tempo - apitos[0].tempo) * 1000));
    const dif = rep.disparosMs.map((v, i) => v - vivo[i]);
    // 12 ms: o microfone falso do Chrome entrega o arquivo em blocos de 10 ms e, às vezes (~1 em 10 execuções), o caminho até o AudioContext (o worklet) recebe
    // um bloco a mais entre o apito e o 1º tiro: o envelope ao vivo mede 2010 ms de apito a tiro em vez de 2000, em TODOS os disparos, enquanto o Opus gravado
    // (que vai direto do fluxo ao MediaRecorder) mede 2000. O detector está certo sobre o que ouviu (sem "furo" no worklet): é o bloco de 10 ms do microfone
    // falso, +1 ms do arredondamento/Opus. Com microfone real não há esse bloco. Ver CONS-035 (auditoria local).
    confere(dif.every((d) => Math.abs(d) <= 12), `ao vivo e reprocessado batem (diferença em ms: ${dif.join(", ")})`);
  }
  // o áudio REAL gravado pelo app (Opus do MediaRecorder do Chrome) vira Ogg/Opus mono para enviar (I-02)
  const ogg = await av(`(async () => {
    const { webmParaOgg } = await import('/src/lib/ogg.ts');
    const t = window.__ultimaTentativa;
    const o = webmParaOgg(new Uint8Array(await t.blob.arrayBuffer()));
    if (!o) return null;
    let b64 = ''; for (let i = 0; i < o.length; i += 0x8000) b64 += String.fromCharCode(...o.subarray(i, i + 0x8000));
    const cab = String.fromCharCode(...o.subarray(0, 4)), canais = o[28 + 9];
    return { cab, canais, bytes: o.length, b64: btoa(b64) };
  })()`);
  confere(ogg && ogg.cab === "OggS" && (ogg.canais === 1 || ogg.canais === 2), `o áudio gravado vira Ogg/Opus (o microfone falso do Chrome grava em estéreo; no celular costuma sair mono) (${ogg?.bytes} bytes, cabeçalho ${ogg?.cab}, ${ogg?.canais} canal)`);
  if (ogg && process.env.NK_OGG) (await import("node:fs")).writeFileSync(process.env.NK_OGG, Buffer.from(ogg.b64, "base64"));
  confere(tentativa && tentativa.bytes > 1000, `o áudio da tentativa foi guardado (${tentativa?.bytes} bytes, ${tentativa?.tipo})`);

  // 7b. a voz "Standing by" embutida no app carrega e decodifica no Chrome de verdade (Ogg/Opus pelo decodeAudioData), e a duração bate
  const voz = await av(`(async () => {
    const { Apito } = await import('/src/lib/apito.ts');
    const a = new Apito();
    const ms = await a.falar();
    a.fechar();
    return ms;
  })()`);
  confere(voz >= 900 && voz <= 1200, `a voz do Standby decodifica e dura ${voz} ms (voz de ~0,7 s + 300 ms de folga)`);

  // 8. a aba Timer de ponta a ponta: o atraso fixo de 1 s coincide com o apito do WAV, o microfone falso toca os tiros e o silêncio de 3 s encerra
  await enviar("Page.navigate", { url: `http://127.0.0.1:${PORTA_VITE}/` });
  await av(`localStorage.setItem('prefs.timer', JSON.stringify({ atrasoMinMs: 1000, atrasoMaxMs: 1000, sensibilidade: 0.6, tempoMortoMs: 60, silencioMs: 3000, standbyVoz: false, standbyVibrar: false }))`);
  await enviar("Page.reload");
  confere(await esperarAte(`!!document.querySelector('.grande-botao')`), "a aba Timer mostra o botão grande");
  confere(await av(`!document.querySelector('#painel-timer [name=registro-modo]') && !document.querySelector('#painel-timer video')`), "a aba Timer fica limpa: sem seletor de vídeo nem prévia da câmera (V2b)");
  // 8a. sem percurso ainda: o formulário aparece e cria o primeiro
  confere(await esperarAte(`!!document.querySelector('.percurso') && !document.querySelector('.percurso form') && !!document.querySelector('.grande-botao')`), "sem percurso, só a dica e o botão Novo percurso: o Standby fica logo à vista");
  await foto("timer-sem-percurso");
  await livreDaBarra("Timer sem percurso");
  await av(`document.querySelector('.percurso .pilula .mais').click()`);
  confere(await esperarAte(`!!document.querySelector('.percurso form')`), "Novo percurso abre o formulário");
  await foto("timer-novo-percurso");
  // CONS-001: banco vazio, SEM criar o percurso antes: o Standby roda, o resultado aparece com Salvar desabilitado e o seletor de percurso ao lado
  await av(`[...document.querySelectorAll('.percurso form button[type=button]')].find((b) => /^(cancelar|cancel)$/i.test(b.textContent.trim())).click()`);
  await av(`document.querySelector('.grande-botao').click()`);
  confere(await esperarAte(`document.querySelector('#titulo-resultado') !== null`, 30000), "a tentativa termina sozinha (silêncio de 3 s) e mostra o resultado");
  const botaoSalvar = `[...document.querySelectorAll('.resultado button')].find((b) => /^(salvar|save|guardar)$/i.test(b.textContent.trim()))`;
  confere(await esperarAte(`!!document.querySelector('.resultado .escolher-percurso') && !document.querySelector('.resultado .percurso') && ${botaoSalvar}?.disabled === true`), "primeiro uso: o resultado não traz o seletor, só o botão Escolher percurso, e o Salvar está desabilitado");
  await av(`document.querySelector('.resultado .escolher-percurso').click()`);
  await av(`document.querySelector('.resultado .percurso .pilula .mais').click()`);
  confere(await esperarAte(`!!document.querySelector('.resultado .percurso form')`), "no resultado, Novo percurso abre o formulário");
  await av(`(() => { const i = document.querySelector('.resultado .percurso form input[type=text]'); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(i, 'Bill Drill'); i.dispatchEvent(new Event('input', { bubbles: true })); })()`);
  await av(`document.querySelector('.resultado .percurso form button[type=submit]').click()`);
  confere(await esperarAte(`document.querySelector('.resultado .salva-em')?.textContent.includes('Bill Drill') === true && !document.querySelector('.resultado dialog[open]')`), "o percurso é criado pela janela do resultado, fica escolhido e a janela fecha");
  confere(await esperarAte(`${botaoSalvar}?.disabled === false`), "depois de criar o percurso, o Salvar fica habilitado");
  const res = await av(`({ linhas: document.querySelectorAll('.resultado tbody tr').length, total: document.querySelector('.resultado .digitos')?.textContent, aviso: document.querySelector('.resultado .aviso')?.textContent ?? null })`);
  confere(res?.linhas === TIROS_S.length, `a tabela tem ${TIROS_S.length} disparos (veio ${res?.linhas})`);
  const total = parseFloat(String(res?.total).replace(",", "."));
  confere(Math.abs(total - (TIROS_S.at(-1) - 1.0)) <= 0.03, `o total é ${TIROS_S.at(-1) - 1.0} s ±0,03 (veio ${res?.total})`);
  confere(res?.aviso === null, "o início foi detectado no microfone (sem aviso de estimado)");
  // 8b. a revisão: linha do tempo, apagar (duplo toque) e inserir recalculam na hora
  confere(await esperarAte(`!!document.querySelector('.resultado .linha')`, 15000), "a linha do tempo aparece (o áudio guardado foi decodificado)");
  await foto("resultado-da-tentativa");
  if (process.env.NK_FOTO) {
    // As seis paletas (3 estilos x claro/escuro) e o alto contraste na mesma tela de resultado, só a primeira tela (viewport), para comparar lado a lado.
    for (const [estilo, modo] of [["normal", "claro"], ["normal", "escuro"], ["titanio", "claro"], ["titanio", "escuro"], ["telemetria", "claro"], ["telemetria", "escuro"], ["normal", "alto-contraste"]]) {
      await av(`(() => { const d = document.documentElement.dataset; d.tema = '${modo}'; if ('${estilo}' === 'normal') delete d.estilo; else d.estilo = '${estilo}'; })()`);
      await dormir(400);
      const { result: { data } } = await enviar("Page.captureScreenshot", { format: "png" });
      (await import("node:fs")).writeFileSync(`${process.env.NK_FOTO}/tema-${estilo}-${modo}.png`, Buffer.from(data, "base64"));
    }
    await av(`(() => { const d = document.documentElement.dataset; delete d.tema; delete d.estilo; })()`);
  }
  await livreDaBarra("Resultado da tentativa");
  const clicar = (re, ultimo = false) => av(`(() => { const b = [...document.querySelectorAll('.resultado tbody button.botao')]${ultimo ? ".at(-1)" : "[0]"}; b.click(); return b.textContent.trim(); })()`);
  await clicar(null, true);
  await clicar(null, true); // o primeiro toque pede confirmação; o segundo apaga
  confere(await esperarAte(`document.querySelectorAll('.resultado tbody tr').length === ${TIROS_S.length - 1}`), "apagar (duplo toque) tira o último disparo");
  const apagado = await av(`({ total: document.querySelector('.resultado .digitos')?.textContent, editada: !!document.querySelector('.resultado .aviso') })`);
  confere(Math.abs(parseFloat(apagado.total.replace(",", ".")) - (TIROS_S.at(-2) - 1.0)) <= 0.03 && apagado.editada, `o total recalcula (${apagado.total}) e a tentativa fica marcada como editada`);
  await av(`(() => { const r = document.querySelector('.resultado input[type=range]'); const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set; set.call(r, '4000'); r.dispatchEvent(new Event('input', { bubbles: true })); })()`);
  await av(`[...document.querySelectorAll('.resultado .botoes-linha button')][1].click()`);
  confere(await esperarAte(`document.querySelectorAll('.resultado tbody tr').length === ${TIROS_S.length}`), "inserir põe o disparo de volta em 4,00 s");
  // 8c. pontuar (5 Alfa, fator minor: 25 pontos), salvar no percurso e ver no histórico
  await av(`[...document.querySelectorAll('.pontuacao button')].find((b) => /^(pontuar esta tentativa|score this attempt|puntuar este intento)$/i.test(b.textContent.trim())).click()`);
  confere(await esperarAte(`!!document.querySelector('.pontuacao .campos')`), "pontuar abre os contadores");
  await foto("pontuacao");
  for (let i = 0; i < 5; i++) await av(`document.querySelector('.pontuacao .campos li:nth-child(1) button:last-of-type').click()`);
  confere(await esperarAte(`document.querySelector('.pontuacao .resultado-pontos strong')?.textContent.includes('25')`), "5 Alfa valem 25 pontos");
  const hfTela = await av(`document.querySelectorAll('.pontuacao .resultado-pontos strong')[1]?.textContent ?? ''`);
  const hfEsperado = 25 / (TIROS_S.at(-1) - 1.0);
  confere(Math.abs(parseFloat(hfTela.replace(/[^0-9,.]/g, "").replace(",", ".")) - hfEsperado) <= 0.2, `o HF na tela é ~${hfEsperado.toFixed(2)} (veio "${hfTela}")`);
  // CONS-008: tentativa NÃO salva: um toque em Descartar ou em Nova tentativa não joga nada fora, só pede confirmação
  await av(`document.querySelector('.resultado .linha-descartar .perigo').click()`);
  confere(await esperarAte(`!![...document.querySelectorAll('.resultado button.perigo.confirmar')].find((b) => /\\?$/.test(b.textContent.trim()))`), "um toque em Descartar (não salva) pede confirmação");
  confere((await av(`document.querySelector('#titulo-resultado') !== null`)) === true, "um toque em Descartar não descarta a tentativa");
  await av(`document.querySelector('.barra-fixa .grande-botao').click()`);
  confere(await esperarAte(`document.querySelector('.barra-fixa .grande-botao.perigo.confirmar') !== null`), "um toque em Nova tentativa (não salva) pede confirmação");
  confere((await av(`document.querySelector('#titulo-resultado') !== null`)) === true, "um toque em Nova tentativa não descarta a tentativa");
  // CONS-002: a revisão fica montada ao trocar de aba (a edição e a pontuação continuam)
  await av(`document.querySelector('#aba-historico').click()`);
  await av(`document.querySelector('#aba-timer').click()`);
  confere(await esperarAte(`document.querySelectorAll('.resultado tbody tr').length === ${TIROS_S.length} && document.querySelector('.pontuacao .resultado-pontos strong')?.textContent.includes('25')`), "ao trocar de aba e voltar, a revisão mantém os disparos e a pontuação");
  await av(`${botaoSalvar}.click()`);
  confere(await esperarAte(`!!document.querySelector('.resultado .aviso.sucesso')`, 15000), "salvar guarda a tentativa e confirma");
  // salva: o botão da barra fixa volta a Nova tentativa direta; editar depois de salvar e salvar de novo ATUALIZA o mesmo registro
  confere(await esperarAte(`document.querySelector('.barra-fixa .grande-botao:not(.perigo)') !== null`), "depois de salva, a Nova tentativa deixa de pedir confirmação");
  await av(`document.querySelector('#aba-historico').click()`);
  await av(`document.querySelector('#aba-timer').click()`);
  confere(await esperarAte(`!!document.querySelector('.resultado .aviso.sucesso')`), "ao trocar de aba e voltar, a revisão salva continua como estava");
  await clicar(null, true);
  await clicar(null, true);
  confere(await esperarAte(`document.querySelectorAll('.resultado tbody tr').length === ${TIROS_S.length - 1} && !document.querySelector('.resultado .aviso.sucesso')`), "editar depois de salvar deixa a tentativa não salva de novo");
  await av(`(() => { const r = document.querySelector('.resultado input[type=range]'); const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set; set.call(r, '4000'); r.dispatchEvent(new Event('input', { bubbles: true })); })()`);
  await av(`[...document.querySelectorAll('.resultado .botoes-linha button')][1].click()`);
  confere(await esperarAte(`document.querySelectorAll('.resultado tbody tr').length === ${TIROS_S.length}`), "inserir de novo o disparo antes de salvar a 2ª vez");
  await av(`${botaoSalvar}.click()`);
  confere(await esperarAte(`!!document.querySelector('.resultado .aviso.sucesso')`, 15000), "salvar de novo confirma");
  await av(`document.querySelector('.resultado .linha-descartar .perigo').click()`);
  confere(await esperarAte(`document.querySelector('#titulo-resultado') === null`), "descartar volta ao início");
  await av(`document.querySelector('#aba-historico').click()`);
  confere(await esperarAte(`document.querySelector('.historico .percurso')?.textContent.includes('Bill Drill')`, 15000), "o histórico lista o percurso");
  await foto("historico-lista-de-percursos");
  await livreDaBarra("Histórico, lista");
  confere((await av(`document.querySelector('.historico .percurso').textContent`)).includes("1 "), "o percurso mostra 1 tentativa");
  await av(`document.querySelector('.historico .percurso').click()`);
  confere(await esperarAte(`document.querySelectorAll('.historico .tentativas li').length === 1`, 15000), "o percurso abre com a tentativa salva numa sessão (salvar duas vezes grava um só registro)");
  const salvaNoHistorico = await av(`document.querySelector('.historico .tentativas li .total').textContent`);
  confere(Math.abs(parseFloat(salvaNoHistorico.replace(",", ".")) - (TIROS_S.at(-1) - 1.0)) <= 0.03, `a tentativa salva mostra o total ${TIROS_S.at(-1) - 1.0} s (veio ${salvaNoHistorico})`);
  confere((await av(`document.querySelector('.historico .tentativas li').textContent`)).includes("25"), "o histórico mostra os 25 pontos da tentativa");
  await foto("percurso-aberto");
  for (const sec of ["tentativas", "analises", "comparar"]) {
    await av(`document.querySelector('#hist-aba-${sec}').click()`);
    confere(await esperarAte(`document.querySelector('#hist-painel-${sec}').hidden === false`), `a aba interna ${sec} abre o seu painel`);
    await foto(`percurso-aba-${sec}`);
  }
  // CONS-052: o 2º toque de apagar não fica armado para sempre (prazo de 4 s)
  await av(`document.querySelector('#hist-aba-tentativas').click()`);
  await av(`document.querySelector('.historico .tentativas li button.perigo').click()`);
  confere(await esperarAte(`document.querySelector('.historico .tentativas li button.perigo.confirmar') !== null`), "um toque em Apagar (tentativa) pede confirmação");
  confere(await esperarAte(`document.querySelector('.historico .tentativas li button.perigo.confirmar') === null`, 8000), "a confirmação de apagar desarma sozinha depois do prazo");
  confere((await av(`document.querySelectorAll('.historico .tentativas li').length`)) === 1, "a tentativa continua lá (o prazo não apagou nada)");
  await av(`document.querySelector('#hist-aba-visao').click()`);
  await livreDaBarra("Histórico, percurso aberto");

  // 9. gráficos e comparação (Etapa 6): três sessões sintéticas no mesmo percurso, para comparar
  const percId = await av(`(async () => { const { armazenamento } = await import('/src/lib/armazenamento.ts'); return (await armazenamento.percursos())[0].id; })()`);
  await av(`(async () => {
    const { armazenamento } = await import('/src/lib/armazenamento.ts');
    const dias = ['2026-11-10', '2026-11-14', '2026-11-18'];
    let n = 0;
    for (const [d, dia] of dias.entries()) for (let k = 0; k < 4; k++) {
      const base = 1700 - d * 120 - k * 20;
      const disparos = [base, base + 260 - d * 15, base + 520 - d * 25, base + 800 - d * 30 + (k === 2 ? 400 : 0), base + 1080 - d * 40 + (k === 2 ? 400 : 0)];
      const data = dia + 'T1' + k + ':00:00-03:00';
      await armazenamento.salvarTentativa({ id: 'seed' + (n++), percurso_id: ${JSON.stringify("__PID__")}, data, quando: Date.parse(data), atraso_ms: 2000, inicio: 'detectado', disparos_ms: disparos, editada: { apagados: 0, inseridos: 0 }, detector: { versao: 1, sensibilidade: 0.6, tempo_morto_ms: 60 } });
    }
  })()`.replace("__PID__", percId));
  // CONS-029: a aba interna escolhida sobrevive à recarga do Histórico (sair e voltar)
  await av(`document.querySelector('#hist-aba-analises').click()`);
  await av(`document.querySelector('#aba-timer').click()`);
  await av(`document.querySelector('#aba-historico').click()`);
  confere(await esperarAte(`document.querySelector('#hist-painel-analises')?.hidden === false && document.querySelector('#hist-painel-visao').hidden === true`, 15000), "ao recarregar o Histórico, o percurso aberto continua na aba interna escolhida (não volta à Visão geral)");
  await av(`document.querySelector('#hist-aba-visao').click()`);
  // a aba recarrega ao reaparecer e o percurso continua aberto, agora com as tentativas novas
  confere(await esperarAte(`document.querySelectorAll('.graficos figure.grafico svg path.linha').length >= 4`, 15000), "os gráficos de linha aparecem (evolução, tempo até cada disparo, distribuição)");
  confere((await av(`document.querySelectorAll('.graficos figure.grafico').length`)) >= 4, "há 4 gráficos: evolução, splits, tempo até cada disparo e distribuição");
  confere((await av(`document.querySelectorAll('.graficos table thead th').length`)) >= 4, "a tabela de comparação tem 3 sessões (e a coluna das medidas)");
  confere((await av(`document.querySelectorAll('.graficos details').length`)) >= 4, "cada gráfico tem a sua tabela equivalente");
  confere((await av(`document.querySelectorAll('.graficos figure svg rect.barra.destaque').length`)) === 1, "o maior split fica em destaque no gráfico de barras");
  confere((await av(`new Set([...document.querySelectorAll('.graficos .legenda')][0].querySelectorAll('path.marca')).size`)) === 2, "a legenda mostra marcadores diferentes por série");
  if (process.env.NK_FOTO) {
    for (const [nome, w, h, fonte] of [["pe", 390, 800, 1], ["deitado", 800, 390, 1], ["fonte200", 390, 800, 2]]) {
      await enviar("Emulation.setDeviceMetricsOverride", { width: w, height: h, deviceScaleFactor: 1, mobile: true });
      await av(`document.documentElement.style.fontSize = '${fonte * 100}%'`);
      await new Promise((r) => setTimeout(r, 600));
      const larguraPagina = await av(`document.documentElement.scrollWidth`);
      confere(larguraPagina <= w, `sem rolagem horizontal em ${nome} (página ${larguraPagina} px, tela ${w} px)`);
      const { result: { data } } = await enviar("Page.captureScreenshot", { format: "png", captureBeyondViewport: true });
      (await import("node:fs")).writeFileSync(`${process.env.NK_FOTO}/graficos-${nome}.png`, Buffer.from(data, "base64"));
    }
    // volta ao normal: os prints seguintes são em retrato, fonte 100%, resolução dupla
    await av(`document.documentElement.style.fontSize = ''`);
    await enviar("Emulation.setDeviceMetricsOverride", { width: 390, height: 800, deviceScaleFactor: 2, mobile: true });
  }

  // 9b. ranking (Etapa 9): duas pessoas importadas de arquivos nicska/1 (uma delas de novo, para provar que não duplica)
  const importado = await av(`(async () => {
    const { armazenamento } = await import('/src/lib/armazenamento.ts');
    const { lerDocumento, novidades, montarCompartilhado } = await import('/src/lib/documento.ts');
    const { lerAtirador } = await import('/src/lib/registro.ts');
    const perc = (await armazenamento.percursos())[0];
    const arq = (id, nome, divisao, base, k) => JSON.stringify(montarCompartilhado('e2e', { id, nome, divisao }, perc, [0, 1].map((i) => {
      const data = '2026-11-20T1' + i + ':00:00-03:00';
      return { id: id + i, percurso_id: perc.id, data, quando: Date.parse(data), atraso_ms: 1500, inicio: 'detectado', disparos_ms: [base + i * 50, base + 300 + k], editada: { apagados: 0, inseridos: 0 }, detector: { versao: 1, sensibilidade: 0.6, tempo_morto_ms: 60 } };
    })));
    let novas = 0;
    for (const texto of [arq('ana', 'Ana', 'Open', 800, 0), arq('beto', 'Beto', 'Production', 1000, 200), arq('ana', 'Ana', 'Open', 800, 0)]) {
      const n = novidades(lerDocumento(texto), await armazenamento.ids(), lerAtirador().id);
      await armazenamento.importar(n);
      novas += n.tentativas.length;
    }
    return novas;
  })()`);
  confere(importado === 4, `importar 3 arquivos (um repetido) traz 4 tentativas novas (vieram ${importado})`);
  await av(`document.querySelector('#aba-timer').click()`);
  await av(`document.querySelector('#aba-historico').click()`);
  confere(await esperarAte(`document.querySelectorAll('.ranking tbody tr').length === 3`, 15000), "o ranking lista 3 atiradores (eu, Ana e Beto)");
  const nomesDoRanking = await av(`[...document.querySelectorAll('.ranking tbody tr')].map((l) => { const c = l.querySelector('th .quem').cloneNode(true); c.querySelectorAll('.avatar').forEach((a) => a.remove()); return c.textContent.trim(); }).join('|')`);
  confere(nomesDoRanking.startsWith("Ana|"), "Ana (melhor tempo) vem em primeiro");
  await av(`document.querySelector('#hist-aba-comparar').click()`);
  await foto("ranking");
  confere((await av(`document.querySelector('.ranking .eu th').textContent`)).match(/\((você|you|tú)\)/), "a minha linha é marcada");
  if (process.env.NK_FOTO) {
    await av(`document.documentElement.style.fontSize = '200%'`);
    await foto("ranking-fonte200");
    const m = await av(`(() => {
      const nome = document.querySelector('header .titulo, header h1, header [class*=titulo]') ?? document.querySelector('header');
      const abas = [...document.querySelectorAll('[role=tab]')].map((a) => ({ t: a.textContent.trim(), corta: a.scrollWidth > a.clientWidth + 1 }));
      const marca = [...document.querySelectorAll('header *')].find((e) => e.children.length === 0 && /Nic/.test(e.textContent));
      return { paginaLarga: document.documentElement.scrollWidth > innerWidth, abasCortadas: abas.filter((a) => a.corta).map((a) => a.t), marcaEmLinhas: marca ? Math.round(marca.getBoundingClientRect().height / parseFloat(getComputedStyle(marca).lineHeight || '1')) : null };
    })()`);
    console.log("info fonte 200%:", JSON.stringify(m));
    await av(`document.documentElement.style.fontSize = ''`);
  }
  await av(`(() => { const s = document.querySelector('.ranking select'); s.value = 'Production'; s.dispatchEvent(new Event('change', { bubbles: true })); })()`);
  confere(await esperarAte(`document.querySelectorAll('.ranking tbody tr').length === 1`, 15000), "filtrar por Production deixa só Beto (eu não declarei divisão)");

  // 9b2. CONS-014: um arquivo recebido de outro app só é gravado depois da confirmação (e o backup de outra pessoa pergunta de quem são as tentativas)
  const recebido = (texto) => av(`import('/src/lib/inicio.svelte.ts').then(({ inicio }) => { inicio.recebido = ${JSON.stringify(texto)}; })`);
  const temTentativa = (id) => av(`import('/src/lib/armazenamento.ts').then(async ({ armazenamento }) => (await armazenamento.ids()).tentativas.has(${JSON.stringify(id)}))`);
  const umaTentativa = (id) => ({ id, data: "2026-11-21T10:00:00-03:00", atraso_ms: 1500, inicio: "detectado", disparos_ms: [900, 1200], editada: { apagados: 0, inseridos: 0 }, detector: { versao: 1, sensibilidade: 0.6, tempo_morto_ms: 60 } });
  const compartilhado = JSON.stringify({ formato: "nicska/1", app: "e2e", atirador: { id: "caio", nome: "Caio" }, percurso: { id: percId, nome: "Bill Drill" }, tentativas: [umaTentativa("caio0")] });
  await recebido(compartilhado);
  confere(await esperarAte(`!!document.querySelector('.historico .importacao') && document.querySelector('.historico .importacao').textContent.includes('Caio')`, 15000), "um arquivo recebido mostra a confirmação (de quem é) em vez de importar direto");
  confere((await temTentativa("caio0")) === false, "antes de confirmar, nada foi gravado");
  confere((await av(`document.querySelectorAll('.historico .importacao input[name=dono]').length`)) === 0, "um percurso compartilhado não pergunta de quem são as tentativas");
  await av(`[...document.querySelectorAll('.historico .importacao button')].find((b) => /^(cancelar|cancel)$/i.test(b.textContent.trim())).click()`);
  confere(await esperarAte(`!document.querySelector('.historico .importacao')`), "Cancelar fecha a confirmação");
  confere((await temTentativa("caio0")) === false, "depois de Cancelar, nada foi gravado");
  await recebido(compartilhado);
  confere(await esperarAte(`!!document.querySelector('.historico .importacao')`, 15000), "o mesmo arquivo pede confirmação de novo");
  await av(`document.querySelector('.historico .importacao button.primario').click()`);
  confere(await esperarAte(`!!document.querySelector('.historico .aviso.sucesso') && !document.querySelector('.historico .importacao')`, 15000), "Importar grava e confirma");
  confere((await temTentativa("caio0")) === true, "depois de Importar, a tentativa está gravada");
  // backup de OUTRA pessoa (tentativas sem atirador_id): pergunta de quem são e só libera Importar depois da escolha
  const backup = JSON.stringify({ formato: "nicska-backup/1", app: "e2e", exportado_em: "2026-11-21T12:00:00Z", atirador: { id: "dora", nome: "Dora" }, percursos: [{ id: percId, nome: "Bill Drill", criado_em: 1 }], tentativas: [{ ...umaTentativa("dora0"), percurso_id: percId }] });
  await recebido(backup);
  confere(await esperarAte(`document.querySelectorAll('.historico .importacao input[name=dono]').length === 2`, 15000), "o backup de outra pessoa pergunta de quem são as tentativas");
  confere((await av(`document.querySelector('.historico .importacao button.primario').disabled`)) === true, "Importar fica desligado até escolher de quem são");
  await av(`document.querySelector('.historico .importacao input[name=dono][value=outro]').click()`);
  confere(await esperarAte(`document.querySelector('.historico .importacao button.primario').disabled === false`), "escolhida a opção, Importar liga");
  await av(`document.querySelector('.historico .importacao button.primario').click()`);
  confere(await esperarAte(`!document.querySelector('.historico .importacao')`, 15000), "Importar fecha a confirmação");
  const donoDora = await av(`import('/src/lib/armazenamento.ts').then(async ({ armazenamento }) => (await armazenamento.todasDoPercurso(${JSON.stringify(percId)}, 'dora')).map((x) => x.atirador_id))`);
  confere(donoDora.filter((x) => x === "dora").length === 1, `"de outra pessoa" grava as tentativas com o atirador_id dela (veio ${JSON.stringify(donoDora)})`);
  // um arquivo que não presta não chega à confirmação
  await recebido("isto não é um arquivo do Nicska");
  confere(await esperarAte(`!!document.querySelector('.historico .aviso.erro') && !document.querySelector('.historico .importacao')`, 15000), "um arquivo inválido mostra o erro, sem a confirmação");

  // 9c. matriz de larguras (docs/archive/roadmap-ux-ui.md, passo 7): nenhuma tela da lista estoura na horizontal, com a fonte normal e a 200%
  for (const largura of [320, 360, 390, 430, 768, 1024, 1440]) {
    await enviar("Emulation.setDeviceMetricsOverride", { width: largura, height: 900, deviceScaleFactor: 1, mobile: largura < 800 });
    for (const [nome, preparar] of [
      ["Histórico, lista", `document.querySelector('#aba-timer').click(); document.querySelector('#aba-historico').click(); document.querySelector('.historico button.botao:not(.percurso)')?.click?.(); 0`],
      ["Percurso, Comparar", `document.querySelector('#hist-aba-comparar')?.click(); 0`],
      ["Percurso, Tentativas", `document.querySelector('#hist-aba-tentativas')?.click(); 0`],
    ]) {
      await av(preparar);
      await dormir(250);
      for (const fonte of [100, 200]) {
        await av(`document.documentElement.style.fontSize = '${fonte}%'`);
        await dormir(150);
        const sobra = await av(`document.documentElement.scrollWidth - innerWidth`);
        confere(sobra <= 0, `${nome} a ${largura} px, fonte ${fonte}%: sem rolagem horizontal da página (sobra ${sobra} px)`);
      }
      await av(`document.documentElement.style.fontSize = ''`);
    }
  }
  await enviar("Emulation.setDeviceMetricsOverride", { width: 390, height: 800, deviceScaleFactor: 1, mobile: true });
  await av(`document.querySelector('#hist-aba-visao')?.click(); 0`);

  // 10. iniciar por batidas (I-01): eventos de movimento inventados a 60 Hz, com 2 batidas secas e o silêncio depois
  await enviar("Emulation.setDeviceMetricsOverride", { width: 390, height: 800, deviceScaleFactor: 1, mobile: true });
  await enviar("Page.navigate", { url: `http://127.0.0.1:${PORTA_VITE}/` });
  await av(`localStorage.setItem('prefs.timer', JSON.stringify({ atrasoMinMs: 4000, atrasoMaxMs: 4000, sensibilidade: 0.6, tempoMortoMs: 60, silencioMs: 3000, batidas: 2 }))`);
  await enviar("Page.reload");
  confere(await esperarAte(`!!document.querySelector('.dica')`, 15000), "com batidas ligadas, o Timer mostra a dica de quantas batidas dar");
  const mexer = (z) => `window.dispatchEvent(new DeviceMotionEvent('devicemotion', { accelerationIncludingGravity: { x: 0, y: 0, z: ${z} } }))`;
  const antes = await av(`document.querySelector('.grande-botao').textContent.trim()`);
  await av(`(async () => {
    const espera = (ms) => new Promise((r) => setTimeout(r, ms));
    const g = 9.81;
    for (let i = 0; i < 20; i++) { window.dispatchEvent(new DeviceMotionEvent('devicemotion', { accelerationIncludingGravity: { x: 0, y: 0, z: g } })); await espera(16); }
    for (let b = 0; b < 2; b++) {
      window.dispatchEvent(new DeviceMotionEvent('devicemotion', { accelerationIncludingGravity: { x: 0, y: 0, z: g + 16 } }));
      for (let i = 0; i < 15; i++) { await espera(16); window.dispatchEvent(new DeviceMotionEvent('devicemotion', { accelerationIncludingGravity: { x: 0, y: 0, z: g } })); }
    }
    for (let i = 0; i < 40; i++) { await espera(16); window.dispatchEvent(new DeviceMotionEvent('devicemotion', { accelerationIncludingGravity: { x: 0, y: 0, z: g } })); }
  })()`);
  confere(await esperarAte(`document.querySelector('.grande-botao').textContent.trim() !== ${JSON.stringify(antes)}`, 8000), "2 batidas iniciam o Standby (o botão deixa de ser Standby)");
  confere(await esperarAte(`document.querySelector('.standby-grande')?.textContent.trim() === 'STAND BY'`, 8000), "ao começar o Standby, a tela mostra STAND BY grande");
  // durante a espera antes do apito, UMA batida cancela (depois da graça de 0,8 s)
  confere(await esperarAte(`!!document.querySelector('.dica') && /cancel/i.test(document.querySelector('.dica').textContent)`, 8000), "durante a espera, a dica diz que uma batida cancela");
  await av(`(async () => {
    const espera = (ms) => new Promise((r) => setTimeout(r, ms));
    await espera(900);
    for (let i = 0; i < 20; i++) { ${mexer(9.81)}; await espera(16); }
    ${mexer(25)};
    for (let i = 0; i < 40; i++) { await espera(16); ${mexer(9.81)}; }
  })()`);
  confere(await esperarAte(`document.querySelector('.grande-botao').textContent.trim() === ${JSON.stringify(antes)}`, 8000), "uma batida durante a espera cancela e volta ao Standby");
  // uma batida só não inicia
  await av(`(async () => {
    const espera = (ms) => new Promise((r) => setTimeout(r, ms));
    for (let i = 0; i < 20; i++) { ${mexer(9.81)}; await espera(16); }
    ${mexer(25)};
    for (let i = 0; i < 60; i++) { await espera(16); ${mexer(9.81)}; }
  })()`);
  confere((await av(`document.querySelector('.grande-botao').textContent.trim()`)) === antes, "uma batida só não inicia");

  // 11. CONS-009: Standby (atraso de 4 s) e troca de aba: o Cancelar segue visível e funcional na outra aba
  await av(`document.querySelector('.grande-botao').click()`);
  confere(await esperarAte(`document.querySelector('.standby-grande') !== null`, 8000), "o Standby começou (atraso antes do apito)");
  await av(`document.querySelector('#aba-historico').click()`);
  confere(await esperarAte(`document.querySelector('.timer').hidden === true && !!document.querySelector('.barra-fixa .grande-botao.perigo') && document.querySelector('.barra-fixa').getBoundingClientRect().height > 0`), "trocando de aba durante o Standby, o Cancelar continua visível");
  await av(`document.querySelector('.barra-fixa .grande-botao.perigo').click()`);
  confere(await esperarAte(`!document.querySelector('.barra-fixa')`), "o Cancelar da outra aba cancela o Standby (a barra some, pois o timer voltou a parado)");
  await av(`document.querySelector('#aba-timer').click()`);
  confere(await esperarAte(`document.querySelector('.grande-botao')?.textContent.trim() === ${JSON.stringify(antes)}`), "de volta ao Timer, o botão é o Standby de novo");

  confere(erros.length === 0, `nenhuma exceção na página${erros.length ? `: ${erros[0]}` : ""}`);
  ws.close();
  return falhas;
}

principal().then(
  async (falhas) => {
    await limpar();
    process.exit(falhas ? 1 : 0);
  },
  async (e) => {
    console.error(e);
    await limpar();
    process.exit(1);
  },
);
