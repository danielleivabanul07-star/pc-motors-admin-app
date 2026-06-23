import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.jsx";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <App />
  </StrictMode>
);

if ("serviceWorker" in navigator) {
  window.addEventListener("load", async () => {
    try {
      const registroPWA = await navigator.serviceWorker.register("/service-worker.js");
      console.log("Service Worker PWA registrado correctamente:", registroPWA);

      const registroFirebase = await navigator.serviceWorker.register(
        "/firebase-messaging-sw.js"
      );
      console.log("Service Worker Firebase registrado correctamente:", registroFirebase);
    } catch (error) {
      console.log("Error registrando Service Worker:", error);
    }
  });
}