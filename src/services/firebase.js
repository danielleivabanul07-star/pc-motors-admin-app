import { initializeApp } from "firebase/app";
import { getMessaging, getToken } from "firebase/messaging";

const firebaseConfig = {
  apiKey: "AIzaSyBlNrIsAXEj5JcVbtjbR5vazm8cj0XYzTI",
  authDomain: "pc-motors-admin.firebaseapp.com",
  projectId: "pc-motors-admin",
  storageBucket: "pc-motors-admin.firebasestorage.app",
  messagingSenderId: "167744412400",
  appId: "1:167744412400:web:ce84033472eba7374e4035"
};

const app = initializeApp(firebaseConfig);

export const messaging = getMessaging(app);

export async function obtenerTokenNotificaciones() {
  try {
    const permiso = await Notification.requestPermission();

    if (permiso !== "granted") {
      console.log("Permiso denegado");
      return null;
    }

    const token = await getToken(messaging, {
      vapidKey:
        "BGrGuBo5uJ5MbJr3H9BsJjDCtygofWBZjZPGg-hhgr83tnaPNn0oHmhCKWYbpoefx61Y9YKIaNoWbWA3rnvPudE"
    });

    console.log("TOKEN FCM:", token);

    return token;
  } catch (error) {
    console.error(error);
    return null;
  }
}