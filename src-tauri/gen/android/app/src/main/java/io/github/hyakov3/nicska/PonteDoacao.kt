package io.github.hyakov3.nicska

import android.content.ActivityNotFoundException
import android.content.Intent
import android.net.Uri
import android.webkit.JavascriptInterface
import java.util.concurrent.FutureTask
import java.util.concurrent.TimeUnit

/**
 * Ponte da doação, exposta à WebView como `window.NkDoacao`. O release NÃO tem a permissão INTERNET: um link dentro da WebView não carregaria. Esta ponte
 * entrega a página de doação ao NAVEGADOR do sistema (que tem rede própria). A URL é fixa AQUI, no código nativo: o JavaScript não passa endereço nenhum,
 * então nenhum script injetado consegue usar a ponte para abrir outra página. Devolve false se o aparelho não tem navegador.
 */
class PonteDoacao(private val atividade: MainActivity) {
    @JavascriptInterface
    fun abrir(): Boolean {
        val intent = Intent(Intent.ACTION_VIEW, Uri.parse(URL_DA_DOACAO))
            .addCategory(Intent.CATEGORY_BROWSABLE)
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        val tarefa = FutureTask<Boolean> {
            try {
                atividade.startActivity(intent)
                true
            } catch (e: ActivityNotFoundException) {
                false
            }
        }
        atividade.runOnUiThread(tarefa)
        return try { tarefa.get(3, TimeUnit.SECONDS) } catch (e: Exception) { false }
    }

    private companion object {
        const val URL_DA_DOACAO = "https://www.paypal.com/donate?business=ZTYE426U4GSXN&no_recurring=0&currency_code=BRL"
    }
}
