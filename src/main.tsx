import { StrictMode, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { appMounted } from "./lib/boot";
import { initTheme } from "./lib/theme";
import "./styles.css";

// Tells the boot splash in index.html that the first screen is on the page.
function BootDone() {
  useEffect(appMounted, []);
  return null;
}

initTheme();
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
    <BootDone />
  </StrictMode>,
);
