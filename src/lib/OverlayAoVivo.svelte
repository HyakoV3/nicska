<script lang="ts">
  import OverlayDoVideo from "./OverlayDoVideo.svelte";
  import { armazenamento } from "./armazenamento";
  import type { Percurso } from "./documento";
  import { i18n } from "./i18n/index.svelte";
  import { lerLaboratorio, lerOverlay } from "./preferencias";
  import { lerAtirador } from "./registro";
  import type { Instantaneo } from "./timer";
  import { centesimosDe, dadosAoVivo, deveAtualizar, opcoesAoVivo, tempoAoVivoS } from "./video/aoVivo";

  // O overlay AO VIVO da tela cheia (V2b): o mesmo OverlayDoVideo da Revisão, por cima da câmera, com STAND BY antes do apito e depois o cronômetro, os
  // splits e os disparos do Timer na hora. Só visual: o vídeo é gravado cru e o overlay da Revisão é redesenhado com os disparos revisados. O cronômetro
  // anda no relógio do áudio da escuta, o mesmo dos disparos; fora da escuta o laço nem roda. O laço (requestAnimationFrame) só ATRIBUI o tempo quando o centésimo
  // mostrado mudou e passou o intervalo da taxa do Laboratório (padrão 30 Hz): nada de redesenhar o overlay inteiro a cada quadro da tela, por cima da câmera e dos
  // dois gravadores (deveAtualizar, video/aoVivo.ts).
  let { snap, agoraDaEscutaS, percursoId }: {
    snap: Instantaneo;
    /** O relógio do áudio da escuta agora (s), ou nulo sem escuta. */
    agoraDaEscutaS: () => number | null;
    percursoId: string | null;
  } = $props();

  const opcoes = opcoesAoVivo(lerOverlay());
  const atirador = lerAtirador(i18n.t("atirador.padrao"));
  /** A data do cabeçalho: hoje (a tentativa começa agora). */
  const data = new Date().toISOString();
  let percurso = $state<Percurso | null>(null);
  let tempoS = $state(-1);
  const taxaHz = lerLaboratorio().taxaHz;
  // Só o que o cronômetro usa, como valores simples: o laço não recomeça a cada disparo (o `snap` é um objeto novo a cada um).
  const estado = $derived(snap.estado);
  const zeroS = $derived(snap.zeroS);
  const dados = $derived(dadosAoVivo(snap, { atirador, percurso: percurso?.nome, divisao: percurso?.divisao, data }));

  // O nome e a divisão do percurso escolhido, para o cabeçalho.
  $effect(() => {
    const pid = percursoId;
    if (!pid) return void (percurso = null);
    let vivo = true;
    armazenamento.percursos().then((ps) => vivo && (percurso = ps.find((p) => p.id === pid) ?? null), () => {});
    return () => void (vivo = false);
  });
  // O cronômetro: um quadro por vez enquanto a escuta corre; antes dela, STAND BY (-1).
  $effect(() => {
    const e = estado;
    const z = zeroS;
    const inicial = tempoAoVivoS(e, z, agoraDaEscutaS());
    tempoS = inicial;
    if (e !== "escutando") return;
    // Nunca ler `tempoS` aqui dentro: o efeito o escreve, e lê-lo o tornaria dependência (cada atualização reiniciaria o laço e anularia o limite de taxa).
    let ultimoCs = centesimosDe(inicial);
    let ultimoTs = performance.now();
    let id = 0;
    const quadro = () => {
      const novo = tempoAoVivoS(e, z, agoraDaEscutaS());
      const cs = centesimosDe(novo);
      const agora = performance.now();
      if (deveAtualizar(ultimoCs, cs, ultimoTs, agora, taxaHz)) {
        tempoS = novo;
        ultimoCs = cs;
        ultimoTs = agora;
      }
      id = requestAnimationFrame(quadro);
    };
    id = requestAnimationFrame(quadro);
    return () => cancelAnimationFrame(id);
  });
</script>

<OverlayDoVideo {tempoS} {dados} {opcoes} reservaBaixo />
