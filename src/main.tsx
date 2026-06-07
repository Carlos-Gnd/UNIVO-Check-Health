
  import { createRoot } from "react-dom/client";
  import App from "./app/App.tsx";
  import "./styles/index.css";

  createRoot(document.getElementById("root")!).render(<App />);

  // PWA instalable (siempre online). Registra el SW mínimo de paso-a-red. Si FCM
  // está configurado, su propio SW puede tomar el control del scope '/' más tarde
  // (también trae fetch handler) — en ambos casos la app queda instalable.
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("/app-sw.js").catch(() => undefined);
    });
  }
