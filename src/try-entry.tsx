import { createRoot } from "react-dom/client";
import { AnnotatorApp } from "./annotator.tsx";
import { installTryDemoMocks } from "./try-bootstrap.ts";

installTryDemoMocks().then(() => {
  createRoot(document.body).render(<AnnotatorApp />);
});
