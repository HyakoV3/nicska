// Definidos em vite.config.js na hora do build (versão do package.json e commit do git).
declare const __APP_VERSAO__: string;
declare const __APP_COMMIT__: string;

declare module "*.ogg?url" {
  const url: string;
  export default url;
}
