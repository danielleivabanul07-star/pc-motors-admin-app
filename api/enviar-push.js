import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getMessaging } from "firebase-admin/messaging";

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT || "{}");

if (!getApps().length) {
  initializeApp({
    credential: cert(serviceAccount)
  });
}

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({
        error: "Método no permitido. Usa POST."
      });
    }

    const { token, titulo, mensaje } = req.body || {};

    if (!token) {
      return res.status(400).json({
        error: "Token requerido"
      });
    }

    const response = await getMessaging().send({
      token,
      notification: {
        title: titulo || "PC Motors",
        body: mensaje || "Nueva notificación"
      },
      data: {
        url: "/"
      }
    });

    return res.status(200).json({
      ok: true,
      messageId: response
    });
  } catch (error) {
    console.error("ERROR ENVIAR PUSH:", error);

    return res.status(500).json({
      ok: false,
      error: error?.message || "Error desconocido"
    });
  }
}