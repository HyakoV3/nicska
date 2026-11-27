package io.github.hyakov3.nicska

import android.content.Context
import android.os.Build
import android.os.PowerManager
import android.webkit.JavascriptInterface

/**
 * Ponte da energia, exposta à WebView como `window.NkEnergia`. Só LÊ, para o diagnóstico de desempenho e o aviso da tela cheia de gravação: com a economia de
 * energia ligada o Android limita CPU e câmera. `economia()` devolve 1 (ligada), 0 (desligada) ou -1 (não sabe); `termico()` devolve o estado térmico
 * (`PowerManager.currentThermalStatus`: 0 nenhum ... 6 desligando; Android 10+) ou -1. Não pede permissão nenhuma. Não recebe nada do JavaScript e qualquer
 * falha vira -1 (nunca lança para a WebView).
 */
class PonteEnergia(private val contexto: Context) {
    private fun gerente(): PowerManager? = contexto.getSystemService(Context.POWER_SERVICE) as? PowerManager

    @JavascriptInterface
    fun economia(): Int = try {
        val g = gerente()
        if (g == null) -1 else if (g.isPowerSaveMode) 1 else 0
    } catch (e: Exception) {
        -1
    }

    @JavascriptInterface
    fun termico(): Int = try {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) gerente()?.currentThermalStatus ?: -1 else -1
    } catch (e: Exception) {
        -1
    }
}
