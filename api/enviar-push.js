import admin from "firebase-admin";

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({
        error: "Método no permitido"
      });
    }

    const { token, titulo, mensaje } = req.body;

    if (!token) {
      return res.status(400).json({
        error: "Token requerido"
      });
    }

    const response = await admin.messaging().send({
      token,
      notification: {
        title: titulo || "PC Motors",
        body: mensaje || "Nueva notificación"
      }
    });

    return res.status(200).json({
      ok: true,
      messageId: response
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      error: error.message
    });
  }
}