importScripts(
  "https://www.gstatic.com/firebasejs/10.13.2/firebase-app-compat.js"
);

importScripts(
  "https://www.gstatic.com/firebasejs/10.13.2/firebase-messaging-compat.js"
);

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
  self.registration.showNotification(
    payload.notification?.title || "PC Motors",
    {
      body: payload.notification?.body || "",
      icon: "/logo-pcmotors.png"
    }
  );
});