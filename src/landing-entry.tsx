import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Landing } from "./landing.tsx";
import "./global.css";

const saved = localStorage.getItem("pinpoint-theme");
const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
const dark = saved === "dark" || (saved == null && prefersDark);
document.documentElement.dataset.theme = dark ? "dark" : "light";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Landing />
  </StrictMode>
);
