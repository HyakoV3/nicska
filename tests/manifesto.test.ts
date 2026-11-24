import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// Guarda do manifesto Android: o gen/ é versionado e é a fonte (o Tauri só gera o manifesto na criação do projeto, não o sobrescreve).
const manifesto = readFileSync("src-tauri/gen/android/app/src/main/AndroidManifest.xml", "utf8").replace(/<!--[\s\S]*?-->/g, "");
const permissoes = [...manifesto.matchAll(/<uses-permission\s+android:name="([^"]+)"/g)].map((m) => m[1]);

describe("AndroidManifest.xml", () => {
  it.each([
    "VIBRATE",
    "RECORD_AUDIO",
    "MODIFY_AUDIO_SETTINGS",
    "FOREGROUND_SERVICE",
    "FOREGROUND_SERVICE_MEDIA_PLAYBACK",
    "FOREGROUND_SERVICE_MICROPHONE",
    "POST_NOTIFICATIONS",
    "WAKE_LOCK",
    "CAMERA", // só pelo spike EXPERIMENTAL de vídeo (docs/spike-video.md): reavaliar antes do release
  ])("declara android.permission.%s", (nome) => {
    expect(permissoes).toContain(`android.permission.${nome}`);
  });

  it("a câmera e o autofoco não são obrigatórios (uses-feature required=false)", () => {
    for (const f of ["android.hardware.camera", "android.hardware.camera.autofocus"]) {
      expect(manifesto).toMatch(new RegExp(`<uses-feature\\s+android:name="${f.replace(/\./g, "\\.")}"\\s+android:required="false"`));
    }
  });
});

const aplicacao = manifesto.match(/<application[\s\S]*?>/)?.[0] ?? "";
const debug = readFileSync("src-tauri/gen/android/app/src/debug/AndroidManifest.xml", "utf8");

describe("superfície e privacidade (7D)", () => {
  it("release não pede INTERNET (só o manifesto de debug, para o servidor de desenvolvimento)", () => {
    expect(permissoes).not.toContain("android.permission.INTERNET");
    expect(debug).toContain("android.permission.INTERNET");
  });

  it("desliga o backup (CONS-017)", () => {
    expect(aplicacao).toContain('android:allowBackup="false"');
  });

  it("sem plugin opener no Tauri (capability, crate, pacote)", () => {
    const cap = readFileSync("src-tauri/capabilities/default.json", "utf8");
    expect(cap).not.toContain("opener");
    expect(readFileSync("src-tauri/Cargo.toml", "utf8")).not.toContain("opener");
    expect(readFileSync("package.json", "utf8")).not.toContain("opener");
  });

  it("CSP ainda nula: proposta em docs/proposta-csp.md, a ativar só após teste no aparelho", () => {
    const conf = JSON.parse(readFileSync("src-tauri/tauri.conf.json", "utf8"));
    expect(conf.app.security.csp).toBeNull();
  });

  it("build.gradle.kts só assina o release se houver chave (senão sai unsigned)", () => {
    const g = readFileSync("src-tauri/gen/android/app/build.gradle.kts", "utf8");
    expect(g).toContain("assinaturaConfigurada");
    expect(g).toContain("keystore.properties");
    expect(g).not.toMatch(/storePassword\s*=\s*"/);
  });
});
