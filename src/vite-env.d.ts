/// <reference types="vite/client" />
interface ImportMetaEnv {
  readonly VITE_FIREBASE_API_KEY?: string;
  readonly VITE_FIREBASE_AUTH_DOMAIN?: string;
  readonly VITE_FIREBASE_PROJECT_ID?: string;
  readonly VITE_FIREBASE_APP_ID?: string;
  readonly VITE_FIREBASE_MESSAGING_SENDER_ID?: string;
  readonly VITE_GITHUB_REPO?: string;
}
interface ImportMeta { readonly env: ImportMetaEnv }
declare module 'mammoth/mammoth.browser.js' {
  export function extractRawText(input: { arrayBuffer: ArrayBuffer }): Promise<{ value: string }>;
}
