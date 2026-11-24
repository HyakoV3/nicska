package io.github.hyakov3.nicska

import android.Manifest
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.media.AudioDeviceInfo
import android.media.AudioManager
import android.os.Build
import android.webkit.JavascriptInterface
import android.webkit.WebView
import java.lang.ref.WeakReference

/**
 * Ponte entre o JavaScript do app e o serviço do timer, exposta à WebView como `window.NkServico`. O app só carrega conteúdo local, e a ponte
 * só aceita o pedido de armar ou desarmar o serviço e responde se há fone; não lê nada do aparelho além disso. Os métodos chegam em uma
 * thread da WebView, então tudo o que mexe no Android passa para a thread principal.
 */
class PonteServico(private val atividade: MainActivity, webView: WebView) {
    private var pediuNotificacao = false

    init {
        // O campo é estático e sobrevive à Activity, então só guarda uma referência FRACA da WebView; a `MainActivity` o limpa em `onDestroy`.
        val fraca = WeakReference(webView)
        ServicoAudio.aoParar = {
            fraca.get()?.let { wv ->
                wv.post { wv.evaluateJavascript("window.__nkParadoPelaNotificacao && window.__nkParadoPelaNotificacao()", null) }
            }
        }
        ServicoAudio.aoFalhar = {
            fraca.get()?.let { wv ->
                wv.post { wv.evaluateJavascript("window.__nkServicoFalhou && window.__nkServicoFalhou()", null) }
            }
        }
    }

    /** Solta os avisos quando a Activity é destruída (ela e a WebView não podem ficar presas a um campo estático). */
    fun soltar() {
        ServicoAudio.aoParar = null
        ServicoAudio.aoFalhar = null
    }

    /** O timer foi armado: o serviço (microfone + apito, wake lock sem limite) mantém tudo vivo com a tela bloqueada. */
    @JavascriptInterface
    fun armar() {
        atividade.runOnUiThread {
            ServicoAudio.armado = true
            ligar()
        }
    }

    @JavascriptInterface
    fun desarmar() {
        atividade.runOnUiThread {
            ServicoAudio.armado = false
            desligar()
        }
    }

    /** Há fone ligado (com fio, USB ou Bluetooth)? Com ele o apito sai nele e o início da tentativa fica estimado. */
    @JavascriptInterface
    fun temFone(): Boolean {
        return try {
            val audio = atividade.getSystemService(Context.AUDIO_SERVICE) as AudioManager
            audio.getDevices(AudioManager.GET_DEVICES_OUTPUTS).any { d ->
                when (d.type) {
                    AudioDeviceInfo.TYPE_WIRED_HEADPHONES, AudioDeviceInfo.TYPE_WIRED_HEADSET, AudioDeviceInfo.TYPE_USB_HEADSET,
                    AudioDeviceInfo.TYPE_BLUETOOTH_A2DP, AudioDeviceInfo.TYPE_BLUETOOTH_SCO -> true
                    else -> Build.VERSION.SDK_INT >= Build.VERSION_CODES.S && d.type == AudioDeviceInfo.TYPE_BLE_HEADSET
                }
            }
        } catch (e: Exception) {
            android.util.Log.w("nk", "não deu para saber se há fone", e)
            false
        }
    }

    private fun ligar() {
        val intent = Intent(atividade, ServicoAudio::class.java)
        ServicoAudio.paradaPendente = false
        if (ServicoAudio.ativo) return
        pedirPermissaoDeNotificacao()
        ServicoAudio.aguardandoPrimeiroPlano = true
        try {
            atividade.startForegroundService(intent)
        } catch (e: Exception) {
            ServicoAudio.aguardandoPrimeiroPlano = false
            // O Android pode recusar (app fora da tela, restrição do fabricante): o timer segue como antes, só sem a proteção.
            android.util.Log.w("nk", "serviço do timer não iniciou", e)
            ServicoAudio.armado = false
            ServicoAudio.aoFalhar?.invoke()
        }
    }

    private fun desligar() {
        if (ServicoAudio.aguardandoPrimeiroPlano) {
            // O serviço ainda está subindo: parar agora o destruiria sem ele ter chamado `startForeground` (o Android derrubaria o app).
            ServicoAudio.paradaPendente = true
        } else {
            atividade.stopService(Intent(atividade, ServicoAudio::class.java))
        }
    }

    /** Android 13 em diante: sem a permissão o serviço roda, mas a notificação (e o botão "Parar") não aparece. Pede uma vez por abertura do app. */
    private fun pedirPermissaoDeNotificacao() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU || pediuNotificacao) return
        if (atividade.checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED) return
        pediuNotificacao = true
        atividade.requestPermissions(arrayOf(Manifest.permission.POST_NOTIFICATIONS)) { }
    }
}
