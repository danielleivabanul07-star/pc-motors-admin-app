import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getMessaging } from "firebase-admin/messaging";
import { createClient } from "@supabase/supabase-js";

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT || "{}");

if (!getApps().length) {
  initializeApp({
    credential: cert(serviceAccount)
  });
}

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Método no permitido. Usa POST." });
    }

    const { titulo, mensaje, url = "/" } = req.body || {};

    const { data: dispositivos, error } = await supabase
      .from("dispositivos_push")
      .select("token")
      .eq("activo", true);

    if (error) {
      return res.status(500).json({ ok: false, error: error.message });
    }

    const tokens = [
      ...new Set((dispositivos || []).map((d) => d.token).filter(Boolean))
    ];

    if (tokens.length === 0) {
      return res.status(400).json({
        ok: false,
        error: "No hay dispositivos activos."
      });
    }

    const response = await getMessaging().sendEachForMulticast({
      tokens,
      notification: {
        title: titulo || "PC Motors",
        body: mensaje || "Nueva notificación"
      },
      data: {
        url: String(url || "/")
      }
    });

    const tokensInvalidos = [];

    response.responses.forEach((resultado, index) => {
      const codigo = resultado.error?.code || "";

      if (
        codigo.includes("registration-token-not-registered") ||
        codigo.includes("invalid-registration-token")
      ) {
        tokensInvalidos.push(tokens[index]);
      }
    });

    if (tokensInvalidos.length > 0) {
      await supabase
        .from("dispositivos_push")
        .update({ activo: false })
        .in("token", tokensInvalidos);
    }

    return res.status(200).json({
      ok: true,
      enviados: response.successCount,
      fallidos: response.failureCount,
      tokens_invalidos_desactivados: tokensInvalidos.length
    });
  } catch (error) {
    console.error("ERROR ENVIAR PUSH:", error);

    return res.status(500).json({
      ok: false,
      error: error?.message || "Error desconocido"
    });
  }
}
