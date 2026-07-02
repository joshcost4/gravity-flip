import { registerSW } from 'virtual:pwa-register';

export function enablePwa() {
  if (typeof window === 'undefined') return;
  registerSW({
    immediate: true,
    onRegisteredSW(swUrl, r) {
      // Optional hook. Keeping no UI here to avoid extra runtime cost.
    },
    onNeedRefresh() {
      // Keep it simple: reload handled by the browser when users reopen.
    },
  });
}
