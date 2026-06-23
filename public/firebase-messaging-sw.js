importScripts("https://www.gstatic.com/firebasejs/10.13.2/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.13.2/firebase-messaging-compat.js");

firebase.initializeApp({
  apiKey: "AIzaSyBlNrIsAXEj5JcVbtjbR5vazm8cj0XYzTI",
  authDomain: "pc-motors-admin.firebaseapp.com",
  projectId: "pc-motors-admin",
  storageBucket: "pc-motors-admin.firebasestorage.app",
  messagingSenderId: "167744412400",
  appId: "1:167744412400:web:ce84033472eba7374e4035"
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const titulo =
    payload?.notification?.title ||
    payload?.data?.title ||
    "PC Motors Admin";

  const opciones = {
    body:
      payload?.notification?.body ||
      payload?.data?.body ||
      "Nueva notificación de PC Motors.",
    icon: "/logo-pcmotors.png",
    badge: "/logo-pcmotors.png",
    data: {
      url: payload?.data?.url || "/"
    }
  };

  self.registration.showNotification(titulo, opciones);
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const url = event.notification?.data?.url || "/";

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ("focus" in client) {
          client.focus();
          return;
        }
      }

      if (clients.openWindow) {
        return clients.openWindow(url);
      }
    })
  );
});