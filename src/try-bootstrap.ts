export const TRY_DEMO_ID = "try-demo";

// site/try-sw.js answers the annotator's API calls (this static page has no backend)
// and catches native <img> loads that a plain fetch() patch would miss.
export async function installTryDemoMocks(): Promise<void> {
  if ("serviceWorker" in navigator) {
    await navigator.serviceWorker.register("/try-sw.js");
    await navigator.serviceWorker.ready;
  }
  history.replaceState(null, "", `/review/${TRY_DEMO_ID}`);
}
