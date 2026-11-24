<script lang="ts">
  import { armazenamento } from "./armazenamento";
  import { corDasIniciais, iniciais } from "./avatar";
  import { i18n } from "./i18n/index.svelte";

  // O avatar de um atirador: a foto guardada neste aparelho (se há e se `comFoto`) ou, sem ela, as iniciais do nome num círculo colorido. `tamanho` em rem.
  // `oculto` esconde o avatar do leitor de tela (quando o nome já está escrito ao lado). `versao` muda quando a foto foi trocada, para recarregar.
  // `lado` troca o `tamanho` por qualquer medida CSS (o overlay do vídeo usa uma fração da altura do vídeo, em cqh).
  let { id, nome, tamanho = 2.5, lado, oculto = false, comFoto = true, versao = 0 }: { id: string; nome: string; tamanho?: number; lado?: string; oculto?: boolean; comFoto?: boolean; versao?: number } = $props();
  const medida = $derived(lado ?? `${tamanho}rem`);

  let url = $state<string | null>(null);

  $effect(() => {
    void versao;
    if (!comFoto) return void (url = null);
    let vivo = true;
    let criada: string | null = null;
    armazenamento.lerAvatar(id).then(
      (a) => {
        if (!vivo) return;
        criada = a ? URL.createObjectURL(a.dados) : null;
        url = criada;
      },
      () => vivo && (url = null),
    );
    return () => {
      vivo = false;
      if (criada) URL.revokeObjectURL(criada);
    };
  });
</script>

<span class="avatar" style:width={medida} style:height={medida} style:font-size="calc({medida} * 0.4)" style:background={url ? "var(--superficie-alt)" : corDasIniciais(id)} aria-hidden={oculto ? "true" : undefined} role={oculto ? undefined : "img"} aria-label={oculto ? undefined : i18n.t("perfil.avatar_de", { nome })}>
  {#if url}<img src={url} alt="" />{:else}{iniciais(nome)}{/if}
</span>

<style>
  .avatar { display: inline-flex; align-items: center; justify-content: center; flex: none; box-sizing: border-box; overflow: hidden; border-radius: 50%; border: 0.0625rem solid var(--borda-controle); color: var(--fundo); font-weight: 700; line-height: 1; user-select: none; }
  img { width: 100%; height: 100%; object-fit: cover; display: block; }
</style>
