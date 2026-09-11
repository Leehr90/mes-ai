/// <reference types="vite/client" />

// Build-time constants injected by vite.config.ts `define`
declare const __MES_VERSION__: string;
declare const __MES_RELEASE_DATE__: string;
/** Program argument (1): default tracking type — "lot" or "unit". */
declare const __WIP_TRACKING__: "lot" | "unit";