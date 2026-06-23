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

const app = initializeApp(firebaseConfig);

export async function obtenerTokenNotificaciones() {
  try {
    const soportado = await isSupported();

    if (!soportado) {
      alert("Este dispositivo no es compatible con Firebase Push.");
      return null;
    }

    if (!("serviceWorker" in navigator)) {
      alert("Este dispositivo no soporta Service Worker.");
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

    const registro = await navigator.serviceWorker.register(
      "/firebase-messaging-sw.js"
    );

    const messaging = getMessaging(app);

    const token = await getToken(messaging, {
      vapidKey:
        "BGrGuBo5uJ5MbJr3H9BsJjDCtygofWBZjZPGg-hhgr83tnaPNn0oHmhCKWYbpoefx61Y9YKIaNoWbWA3rnvPudE",
      serviceWorkerRegistration: registro
    });

    console.log("TOKEN FCM:", token);
    return token || null;
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