import "@fontsource-variable/bricolage-grotesque/wdth.css";
import "./styles.css";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./components/App";
import { I18nProvider } from "./lib/i18n";
import { StoreProvider } from "./lib/store";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <StoreProvider>
      <I18nProvider>
        <App />
      </I18nProvider>
    </StoreProvider>
  </StrictMode>,
);
