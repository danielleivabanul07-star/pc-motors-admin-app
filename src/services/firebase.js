import { initializeApp } from "firebase/app";
import { getMessaging, getToken, isSupported } from "firebase/messaging";

const firebaseConfig = {
  apiKey: "AIzaSyBlNrIsAXEj5JcVbtjbR5vazm8cj0XYzTI",
  authDomain: "pc-motors-admin.firebaseapp.com",
  projectId: "pc-motors-admin",
  storageBucket: "pc-motors-admin.firebasestorage.app",
  messagingSenderId: "167744412400",
  appId: "1:167744412400:web:ce84033472eba7374e4035"
};

const VAPID_KEY =
  "BGrGuBo5uJ5MbJr3H9BsJjDCtygofWBZjZPGg-hhgr83tnaPNn0oHmhCKWYbpoefx61Y9YKIaNoWbWA3rnvPudE";

const app = initializeApp(firebaseConfig);

export async function obtenerTokenNotificaciones() {
  try {
    const soportado = await isSupported();

    if (!soportado) {
      alert("Este navegador no es compatible con Firebase Push.");
      return null;
    }

    if (!("serviceWorker" in navigator)) {
      alert("Este navegador no soporta Service Worker.");
      return null;
    }

    if (!("Notification" in window)) {
      alert("Este navegador no soporta notificaciones.");
      return null;
    }

    const permiso = await Notification.requestPermission();

    if (permiso !== "granted") {
      alert("Permiso de notificaciones denegado.");
      return null;
    }

    let registro = await navigator.serviceWorker.getRegistration(
      "/firebase-cloud-messaging-push-scope"
    );

    if (!registro) {
      registro = await navigator.serviceWorker.register(
        "/firebase-messaging-sw.js",
        {
          scope: "/firebase-cloud-messaging-push-scope"
        }
      );
    }

    await navigator.serviceWorker.ready;

    const messaging = getMessaging(app);

    const token = await getToken(messaging, {
      vapidKey: VAPID_KEY,
      serviceWorkerRegistration: registro
    });

    console.log("TOKEN FCM:", token);

    if (!token) {
      alert("Firebase no devolvió token push.");
      return null;
    }

    return token;
  } catch (error) {
    console.error("ERROR FCM TOKEN:", error);

    alert(
      `Error obteniendo token push: ${
        error?.code || error?.message || "Error desconocido"
      }`
    );

    return null;
  }
}