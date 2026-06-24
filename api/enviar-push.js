import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getMessaging } from "firebase-admin/messaging";
import { createClient } from "@supabase/supabase-js";

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT || "{}");

if (!getApps().length) {
  initializeApp({
    credential: cert({
      ...serviceAccount,
      private_key: serviceAccount.private_key?.replace(/\\n/g, "\n")
    })
  });
}

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY
);

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ ok: false, error: "Método no permitido. Usa POST." });
    }

    const { titulo, mensaje, url = "/admin" } = req.body || {};

    const { data: dispositivos, error } = await supabase
      .from("dispositivos_push")
      .select("token, activo")
      .eq("activo", true);

    if (error) {
      return res.status(500).json({ ok: false, error: error.message });
    }

    const tokens = [...new Set((dispositivos || []).map((d) => d.token).filter(Boolean))];

    if (tokens.length === 0) {
      return res.status(200).json({
        ok: false,
        error: "No hay dispositivos activos registrados.",
        total_tokens: 0
      });
    }

    const response = await getMessaging().sendEachForMulticast({
      tokens,
      notification: {
        title: titulo || "PC Motors",
        body: mensaje || "Nueva notificación"
      },
      data: {
        url: String(url || "/admin")
      },
      webpush: {
        fcmOptions: {
          link: String(url || "/admin")
        },
        notification: {
          icon: "/logo-pcmotors.png",
          badge: "/logo-pcmotors.png"
        }
      }
    });

    const errores = [];
    const tokensInvalidos = [];

    response.responses.forEach((resultado, index) => {
      if (!resultado.success) {
        const codigo = resultado.error?.code || "error-desconocido";
        const message = resultado.error?.message || "";

        errores.push({
          token: tokens[index]?.slice(0, 18) + "...",
          code: codigo,
          message
        });

        if (
          codigo.includes("registration-token-not-registered") ||
          codigo.includes("invalid-registration-token")
        ) {
          tokensInvalidos.push(tokens[index]);
        }
      }
    });

    if (tokensInvalidos.length > 0) {
      await supabase
        .from("dispositivos_push")
        .update({ activo: false })
        .in("token", tokensInvalidos);
    }

    return res.status(200).json({
      ok: response.successCount > 0,
      total_tokens: tokens.length,
      enviados: response.successCount,
      fallidos: response.failureCount,
      tokens_invalidos_desactivados: tokensInvalidos.length,
      errores
    });
  } catch (error) {
    console.error("ERROR ENVIAR PUSH:", error);

    return res.status(500).json({
      ok: false,
      error: error?.message || "Error desconocido"
    });
  }
}