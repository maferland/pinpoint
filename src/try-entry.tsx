import { createRoot } from "react-dom/client";
import { AnnotatorApp } from "./annotator.tsx";
import { TRY_DEMO_ID, installTryDemoMocks } from "./try-bootstrap.ts";

installTryDemoMocks().then(() => {
  createRoot(document.body).render(<AnnotatorApp reviewId={TRY_DEMO_ID} />);
});
