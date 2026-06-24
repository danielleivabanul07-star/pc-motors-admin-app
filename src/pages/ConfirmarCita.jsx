import { useEffect, useState } from "react";
import { supabase } from "../services/supabase";

export default function ConfirmarCita({ token }) {
  const [cita, setCita] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [confirmando, setConfirmando] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    cargarCita();
  }, [token]);

  const cargarCita = async () => {
    if (!token) {
      setError("Link inválido.");
      setCargando(false);
      return;
    }

    const { data, error } = await supabase
      .from("citas")
      .select("*")
      .eq("token_confirmacion", token)
      .maybeSingle();

    if (error || !data) {
      setError("No se encontró esta cita.");
      setCargando(false);
      return;
    }

    setCita(data);
    setCargando(false);
  };

  const formatearFecha = (fecha) => {
    if (!fecha) return "Sin fecha";
    return new Date(`${fecha}T00:00:00`).toLocaleDateString("en-US");
  };

  const formatearHora = (hora) => {
    if (!hora) return "Sin hora";
    const [h, m] = String(hora).split(":");
    const fecha = new Date();
    fecha.setHours(Number(h || 0), Number(m || 0), 0, 0);

    return fecha.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true
    });
  };

  const enviarPushConfirmacion = async (citaConfirmada) => {
    try {
      const fechaCita =
        citaConfirmada.fecha ||
        citaConfirmada.fecha_solicitada ||
        "";

      const horaCita =
        citaConfirmada.hora ||
        citaConfirmada.hora_solicitada ||
        "";

      const mensaje = `${citaConfirmada.nombre_cliente || "Cliente"} confirmó su cita para ${formatearFecha(
        fechaCita
      )} ${formatearHora(horaCita)}`;

      const respuesta = await fetch("/api/enviar-push", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          titulo: "✅ Cita confirmada",
          mensaje,
          url: "/admin"
        })
      });

      const resultado = await respuesta.json().catch(() => null);

      console.log("Resultado push cita confirmada:", {
        okHttp: respuesta.ok,
        status: respuesta.status,
        resultado
      });

      return respuesta.ok;
    } catch (error) {
      console.log("Error enviando push de cita confirmada:", error);
      return false;
    }
  };

  const confirmarCita = async () => {
    if (!cita?.id) return;

    if (cita.estado === "confirmada") {
      alert("Esta cita ya fue confirmada.");
      return;
    }

    setConfirmando(true);

    const cambios = {
      estado: "confirmada",
      confirmado_en: new Date().toISOString()
    };

    const { error } = await supabase
      .from("citas")
      .update(cambios)
      .eq("id", cita.id)
      .eq("token_confirmacion", token);

    if (error) {
      console.log(error);
      setConfirmando(false);
      alert("No se pudo confirmar la cita.");
      return;
    }

    const citaActualizada = { ...cita, ...cambios };
    setCita(citaActualizada);

    await enviarPushConfirmacion(citaActualizada);

    setConfirmando(false);
    alert("Cita confirmada correctamente.");
  };

  if (cargando) {
    return (
      <div style={pageStyle}>
        <div style={cardStyle}>Cargando cita...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={pageStyle}>
        <div style={cardStyle}>
          <h1 style={titleStyle}>PC MOTORS</h1>
          <p>{error}</p>
        </div>
      </div>
    );
  }

  const yaConfirmada = cita?.estado === "confirmada";

  return (
    <div style={pageStyle}>
      <div style={cardStyle}>
        <h1 style={titleStyle}>PC MOTORS</h1>
        <h2 style={subtitleStyle}>Confirmación de Cita</h2>

        {yaConfirmada && (
          <div style={approvedBox}>✅ Esta cita ya fue confirmada.</div>
        )}

        <div style={infoBox}>
          <p><strong>Cliente:</strong><br />{cita.nombre_cliente}</p>
          <p><strong>Teléfono:</strong><br />{cita.telefono}</p>
          <p><strong>Fecha:</strong><br />{formatearFecha(cita.fecha || cita.fecha_solicitada)}</p>
          <p><strong>Hora:</strong><br />{formatearHora(cita.hora || cita.hora_solicitada)}</p>
          <p>
            <strong>Vehículo:</strong><br />
            {`${cita.anio || ""} ${cita.marca || ""} ${cita.modelo || ""}`.trim() ||
              "No registrado"}
          </p>
          <p><strong>Motivo:</strong><br />{cita.motivo || cita.servicio_solicitado || "Cita de servicio"}</p>
        </div>

        {!yaConfirmada && (
          <button onClick={confirmarCita} style={confirmButton} disabled={confirmando}>
            {confirmando ? "Confirmando..." : "✅ Confirmar mi cita"}
          </button>
        )}

        <p style={smallText}>
          Si necesitas cambiar la fecha u hora, comunícate directamente con PC Motors.
        </p>
      </div>
    </div>
  );
}

const pageStyle = {
  minHeight: "100vh",
  background: "#020617",
  color: "white",
  padding: "20px",
  fontFamily: "Arial, sans-serif"
};

const cardStyle = {
  maxWidth: "680px",
  margin: "0 auto",
  background: "#111827",
  border: "1px solid #f59e0b",
  borderRadius: "18px",
  padding: "22px"
};

const titleStyle = {
  textAlign: "center",
  color: "#f59e0b",
  marginBottom: "5px"
};

const subtitleStyle = {
  textAlign: "center",
  marginTop: 0
};

const infoBox = {
  background: "#020617",
  border: "1px solid #374151",
  borderRadius: "12px",
  padding: "16px",
  marginTop: "18px",
  marginBottom: "18px"
};

const confirmButton = {
  width: "100%",
  padding: "15px",
  border: "none",
  borderRadius: "10px",
  background: "#16a34a",
  color: "white",
  fontWeight: "bold",
  fontSize: "17px",
  cursor: "pointer"
};

const approvedBox = {
  background: "#052e16",
  border: "1px solid #22c55e",
  color: "#dcfce7",
  borderRadius: "12px",
  padding: "14px",
  marginBottom: "16px",
  fontWeight: "bold",
  textAlign: "center"
};

const smallText = {
  color: "#d1d5db",
  textAlign: "center",
  marginTop: "16px"
};