// O Nicska não tem comandos próprios no MVP: tudo roda na interface (Svelte) e no serviço Android.
// A validação do JSON compartilhado é toda em TypeScript (`src/lib/documento/`); não há comando em Rust para isso.

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[cfg(test)]
mod testes {
    #[test]
    fn compila() {}
}
