#!/usr/bin/env node
// Mede o aliasing do saturador (tanh) do apito. Sintetiza o apito como o app faz (src/lib/apito.ts: seno de 2700 Hz -> tanh(4x)/tanh(4), pico 1,0)
// a 48 kHz, tira o espectro (FFT radix-2, janela de Hann) e soma a energia nos bins que são ALIASES das harmônicas altas (acima de Nyquist, 24 kHz)
// e caem dentro da banda do detector (1500 a 4000 Hz), comparada à fundamental.
// Simula dois casos: sem sobreamostragem (pior caso: tanh a 48 kHz) e com 2x (o `oversample = "2x"` do WaveShaper do app: tanh a 96 kHz, filtro, decimação).
// Uso: node tools/medir-aliasing-apito.mjs   (sai com código 1 se algum alias passar de -30 dB da fundamental)
const FS = 48000, F0 = 2700, SAT = 4, N = 1 << 15, BANDA = [1500, 4000], LIMIAR_DB = -30;

function fft(re, im) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) { [re[i], re[j]] = [re[j], re[i]]; [im[i], im[j]] = [im[j], im[i]]; }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (-2 * Math.PI) / len;
    for (let i = 0; i < n; i += len) {
      for (let k = 0; k < len / 2; k++) {
        const wr = Math.cos(ang * k), wi = Math.sin(ang * k);
        const a = i + k, b = a + len / 2;
        const tr = re[b] * wr - im[b] * wi, ti = re[b] * wi + im[b] * wr;
        re[b] = re[a] - tr; im[b] = im[a] - ti; re[a] += tr; im[a] += ti;
      }
    }
  }
}

// Frequência coerente: um número inteiro de ciclos na janela, para a fundamental cair num bin só e o vazamento não sujar a medida.
const ciclos = Math.round((F0 * N) / FS);
const f0 = (ciclos * FS) / N;
const norma = Math.tanh(SAT);
const saturar = (x) => Math.tanh(SAT * x) / norma;

function sintetizar(sobre) {
  const x = new Float64Array(N);
  if (sobre === 1) {
    for (let i = 0; i < N; i++) x[i] = saturar(Math.sin((2 * Math.PI * f0 * i) / FS));
    return x;
  }
  // Sobreamostra por `sobre` (gera o sinal direto na taxa alta: o seno é analítico), satura e decima com FIR de sinc janelada (corte em 0,45·FS).
  const fh = FS * sobre, M = N * sobre;
  const alto = new Float64Array(M);
  for (let i = 0; i < M; i++) alto[i] = saturar(Math.sin((2 * Math.PI * f0 * i) / fh));
  const T = 255, h = new Float64Array(T), fc = (0.45 * FS) / fh;
  for (let k = 0; k < T; k++) {
    const m = k - (T - 1) / 2;
    const s = m === 0 ? 2 * fc : Math.sin(2 * Math.PI * fc * m) / (Math.PI * m);
    h[k] = s * (0.5 - 0.5 * Math.cos((2 * Math.PI * k) / (T - 1)));
  }
  for (let i = 0; i < N; i++) {
    let a = 0;
    const c = i * sobre;
    for (let k = 0; k < T; k++) {
      const j = c + k - (T - 1) / 2;
      if (j >= 0 && j < M) a += alto[j] * h[k];
    }
    x[i] = a;
  }
  return x;
}

function medir(x) {
  const re = new Float64Array(N), im = new Float64Array(N);
  for (let i = 0; i < N; i++) re[i] = x[i] * (0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (N - 1)));
  fft(re, im);
  const p = new Float64Array(N / 2 + 1);
  for (let k = 0; k <= N / 2; k++) p[k] = re[k] ** 2 + im[k] ** 2;
  const bin = (f) => Math.round((f * N) / FS);
  const somar = (c, r = 2) => { let s = 0; for (let k = Math.max(0, c - r); k <= Math.min(N / 2, c + r); k++) s += p[k]; return s; };
  const fund = somar(bin(f0));
  const db = (v) => 10 * Math.log10(v / fund);
  // Harmônicas ímpares (a tanh é ímpar) acima de Nyquist: o alias de h·f0 é |h·f0 - m·FS| (dobrado em [0, FS/2]).
  const linhas = [];
  let totalBanda = 0;
  for (let h = 3; h <= 41; h += 2) {
    let f = (h * f0) % FS;
    if (f > FS / 2) f = FS - f;
    if (h * f0 <= FS / 2) continue; // harmônica real (não é alias)
    const e = somar(bin(f));
    const dentro = f >= BANDA[0] && f <= BANDA[1];
    if (dentro) totalBanda += e;
    linhas.push({ h, real: h * f0, alias: f, dB: db(e), dentro });
  }
  // Energia total na banda do detector excluindo a fundamental (inclui harmônicas reais e aliases) e o piso de ruído do resto da banda.
  let banda = 0;
  for (let k = bin(BANDA[0]); k <= bin(BANDA[1]); k++) if (Math.abs(k - bin(f0)) > 2) banda += p[k];
  return { fund, linhas, totalAliasBandaDb: totalBanda > 0 ? db(totalBanda) : -Infinity, bandaForaDaFundamentalDb: db(banda), maxAliasDb: Math.max(...linhas.filter((l) => l.dentro).map((l) => l.dB), -Infinity) };
}

let falhou = false;
console.log(`Apito: ${f0.toFixed(1)} Hz (pedido ${F0}), tanh(${SAT}·x)/tanh(${SAT}), FS = ${FS} Hz, banda do detector ${BANDA[0]}-${BANDA[1]} Hz, limiar ${LIMIAR_DB} dB`);
for (const [nome, sobre] of [["SEM sobreamostragem (tanh direto a 48 kHz, pior caso)", 1], ["COM oversample 2x (como o WaveShaper do app)", 2]]) {
  const r = medir(sintetizar(sobre));
  console.log(`\n${nome}`);
  for (const l of r.linhas.filter((l) => l.dentro)) console.log(`  h${String(l.h).padStart(2)} (${l.real.toFixed(0)} Hz) -> alias em ${l.alias.toFixed(0)} Hz: ${l.dB.toFixed(1)} dB`);
  console.log(`  soma dos aliases dentro da banda: ${r.totalAliasBandaDb.toFixed(1)} dB; maior alias: ${r.maxAliasDb.toFixed(1)} dB; banda toda sem a fundamental: ${r.bandaForaDaFundamentalDb.toFixed(1)} dB`);
  const ruim = r.maxAliasDb > LIMIAR_DB;
  console.log(`  ${ruim ? "PROBLEMA: alias acima de" : "ok: alias abaixo de"} ${LIMIAR_DB} dB da fundamental`);
  if (ruim) falhou = true;
}
process.exit(falhou ? 1 : 0);
