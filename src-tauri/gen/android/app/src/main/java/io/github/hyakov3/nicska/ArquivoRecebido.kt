package io.github.hyakov3.nicska

import android.content.Intent
import android.net.Uri
import android.util.Log
import java.io.ByteArrayOutputStream
import java.io.IOException
import java.io.InputStream
import java.util.concurrent.Callable
import java.util.concurrent.ExecutorService
import java.util.concurrent.Executors
import java.util.concurrent.Future
import java.util.concurrent.ThreadFactory
import java.util.concurrent.TimeUnit

/** O limite do arquivo recebido (20 MB, como o limite do JSON no app). Um byte a mais é lido para o app recusar com a mensagem de "grande demais". */
private const val LIMITE_BYTES = 20 * 1024 * 1024

/** Lê no máximo `maximo` bytes de `entrada`. */
private fun lerAte(entrada: InputStream, maximo: Int): ByteArray {
    val saida = ByteArrayOutputStream()
    val bloco = ByteArray(8192)
    var total = 0
    while (total < maximo) {
        val n = entrada.read(bloco, 0, minOf(bloco.size, maximo - total))
        if (n < 0) break
        saida.write(bloco, 0, n)
        total += n
    }
    return saida.toByteArray()
}

/** O endereço do arquivo que o `intent` (VIEW ou SEND) traz, ou null se não traz. */
private fun enderecoDe(intent: Intent?): Uri? {
    if (intent == null) return null
    return when (intent.action) {
        Intent.ACTION_VIEW -> intent.data
        Intent.ACTION_SEND ->
            if (android.os.Build.VERSION.SDK_INT >= 33) intent.getParcelableExtra(Intent.EXTRA_STREAM, Uri::class.java)
            else @Suppress("DEPRECATION") intent.getParcelableExtra<Uri>(Intent.EXTRA_STREAM)
        else -> null
    }
}

/**
 * O texto de um arquivo que outro app mandou abrir no Nicska (VIEW/SEND), esperando o JavaScript pegar. Um só, o mais recente.
 * A leitura roda numa thread própria (não trava a thread principal, onde `receber` é chamado) e o JavaScript, que chama de uma thread da WebView, espera
 * o fim dela em `esperar`. Se a leitura falha, o motivo fica em `erro` (o JavaScript o pede em seguida), em vez de o arquivo sumir sem aviso.
 */
class ArquivoRecebido(private val atividade: MainActivity) {
    private val leitor: ExecutorService = Executors.newSingleThreadExecutor(ThreadFactory { r -> Thread(r, "nk-recebido").apply { isDaemon = true } })
    @Volatile private var leitura: Future<String>? = null
    @Volatile private var falha = ""

    /** Começa a ler o arquivo da `intent`. Chamado pela MainActivity, na thread principal: só agenda a leitura. */
    fun receber(intent: Intent?) {
        val uri = enderecoDe(intent) ?: return
        falha = ""
        leitura = leitor.submit(Callable { ler(uri) })
    }

    private fun ler(uri: Uri): String {
        val entrada = atividade.contentResolver.openInputStream(uri) ?: throw IOException("sem fluxo de leitura")
        return entrada.use { String(lerAte(it, LIMITE_BYTES + 1), Charsets.UTF_8) }
    }

    /** O texto do arquivo (esperando a leitura acabar, até 15 s) e esvazia. "" se não há arquivo ou se a leitura falhou (aí `erro` diz o motivo). */
    fun esperar(): String {
        val pendente = leitura ?: return ""
        leitura = null
        return try {
            pendente.get(15, TimeUnit.SECONDS)
        } catch (e: Exception) {
            Log.w("nk", "receber: não leu o arquivo", e)
            falha = e.cause?.javaClass?.simpleName ?: e.javaClass.simpleName
            pendente.cancel(true)
            ""
        }
    }

    /** O motivo da última leitura que falhou (e esvazia). "" se não houve falha. */
    fun erro(): String {
        val f = falha
        falha = ""
        return f
    }

    /** A Activity foi destruída: a thread de leitura não fica para trás. */
    fun soltar() {
        leitura = null
        leitor.shutdownNow()
    }
}
