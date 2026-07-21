export const TRY_DEMO_ID = "try-demo"; // must match DEMO_ID in site/try-sw.js

// site/try-sw.js answers the annotator's API calls (this static page has no backend)
// and catches native <img> loads that a plain fetch() patch would miss.
export async function installTryDemoMocks(): Promise<void> {
  if ("serviceWorker" in navigator) {
    await navigator.serviceWorker.register("/try-sw.js");
    await navigator.serviceWorker.ready;
  }
}
