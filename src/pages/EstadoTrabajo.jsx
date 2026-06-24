import { useEffect, useState } from "react";
import { supabase } from "../services/supabase";
import logoPC from "../assets/logo-pcmotors.png";

const etiquetasEstado = {
  diagnostico: "🔎 En diagnóstico",
  estimado_pendiente: "📋 Estimado pendiente",
  esperando_aprobacion: "⏳ Esperando aprobación",
  esperando_piezas: "📦 Esperando piezas",
  piezas_ordenadas: "🚚 Piezas ordenadas",
  piezas_recibidas: "📦 Piezas recibidas",
  trabajando: "🔧 En reparación",
  en_reparacion: "🔧 En reparación",
  reparacion: "🔧 En reparación",
  listo_para_entrega: "✅ Listo para recoger",
  terminado: "✅ Terminado",
  finalizado: "✅ Finalizado",
  completado: "✅ Completado",
  cancelado: "❌ Cancelado"
};

const pasos = [
  { id: "diagnostico", label: "Diagnóstico" },
  { id: "estimado_pendiente", label: "Estimado" },
  { id: "esperando_piezas", label: "Piezas" },
  { id: "trabajando", label: "Reparación" },
  { id: "listo_para_entrega", label: "Listo" }
];

function normalizarEstado(estado) {
  const valor = String(estado || "diagnostico").toLowerCase();
  if (valor.includes("ordenada")) return "piezas_ordenadas";
  if (valor.includes("recibida")) return "piezas_recibidas";
  if (valor.includes("pieza")) return "esperando_piezas";
  if (valor.includes("trabaj") || valor.includes("repar")) return "trabajando";
  if (valor.includes("listo") || valor.includes("entrega") || valor.includes("termin")) return "listo_para_entrega";
  if (valor.includes("estimado") || valor.includes("aprob")) return "estimado_pendiente";
  return valor || "diagnostico";
}

export default function EstadoTrabajo({ token }) {
  const [trabajo, setTrabajo] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [logoActual, setLogoActual] = useState(logoPC);

  useEffect(() => {
    cargarTrabajo();
  }, [token]);

  const cargarTrabajo = async () => {
    setError("");
    setTrabajo(null);

    const id = String(token || "").replace(/[^0-9]/g, "");

    if (!id) {
      setError("Link inválido.");
      setCargando(false);
      return;
    }

    setCargando(true);

    const { data, error: errorConsulta } = await supabase
      .from("trabajos_mecanicos")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    setCargando(false);

    if (errorConsulta || !data) {
      console.log(errorConsulta);
      setError("No encontramos el estado de este vehículo.");
      return;
    }

    setTrabajo(data);
  };

  const formatearFecha = (valor) => {
    if (!valor) return "";
    try {
      return new Date(valor).toLocaleString("en-US", {
        timeZone: "America/New_York",
        month: "2-digit",
        day: "2-digit",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit"
      });
    } catch {
      return "";
    }
  };

  const estadoNormalizado = normalizarEstado(trabajo?.estado || trabajo?.fase_actual);
  const indiceActivo = (() => {
    if (estadoNormalizado === "piezas_ordenadas" || estadoNormalizado === "piezas_recibidas") return 2;
    if (estadoNormalizado === "en_reparacion" || estadoNormalizado === "reparacion") return 3;
    if (estadoNormalizado === "terminado" || estadoNormalizado === "finalizado" || estadoNormalizado === "completado") return 4;
    const index = pasos.findIndex((paso) => paso.id === estadoNormalizado);
    return index >= 0 ? index : 0;
  })();

  const vehiculo =
    trabajo?.vehiculo ||
    `${trabajo?.anio || ""} ${trabajo?.marca || ""} ${trabajo?.modelo || ""}`.trim();

  return (
    <div style={pageStyle}>
      <div style={cardStyle}>
        <div style={logoBoxStyle}>
          <img
            src={logoActual}
            alt="PC MOTORS"
            style={logoStyle}
            onError={() => {
              if (logoActual !== "/logo-pc-motors.png.png") {
                setLogoActual("/logo-pc-motors.png.png");
              }
            }}
          />
        </div>

        <h1 style={titleStyle}>Estado de su vehículo</h1>

        {cargando && <div style={emptyStyle}>Cargando estado...</div>}

        {error && (
          <div style={errorStyle}>
            {error}
            <button onClick={() => (window.location.href = "/estado-cliente")} style={secondaryButton}>
              Buscar manualmente
            </button>
          </div>
        )}

        {trabajo && (
          <>
            <p style={subtitleStyle}>
              Aquí puede revisar el avance actual de su vehículo en PC Motors.
            </p>

            <div style={jobHeader}>
              <div>
                <h2 style={jobTitle}>{vehiculo || "Vehículo en servicio"}</h2>
                <p style={jobSubtitle}>Cliente: {trabajo.cliente_nombre || "No registrado"}</p>
              </div>

              <span style={statusBadge}>
                {etiquetasEstado[estadoNormalizado] || trabajo.estado || "🔎 En diagnóstico"}
              </span>
            </div>

            <div style={timelineStyle}>
              {pasos.map((paso, index) => (
                <div key={paso.id} style={stepWrap}>
                  <div
                    style={{
                      ...stepCircle,
                      background: index <= indiceActivo ? "#f59e0b" : "#374151",
                      color: index <= indiceActivo ? "#111827" : "#d1d5db"
                    }}
                  >
                    {index + 1}
                  </div>
                  <span style={stepText}>{paso.label}</span>
                </div>
              ))}
            </div>

            <div style={infoGrid}>
              {trabajo.placa && <p><strong>Placa:</strong><br />{trabajo.placa}</p>}
              {trabajo.vin && <p><strong>VIN:</strong><br />{trabajo.vin}</p>}
              {(trabajo.problema || trabajo.trabajo || trabajo.descripcion_trabajo) && (
                <p><strong>Trabajo:</strong><br />{trabajo.problema || trabajo.trabajo || trabajo.descripcion_trabajo}</p>
              )}
              {(trabajo.resultado_diagnostico || trabajo.notas_mecanico || trabajo.notas) && (
                <p><strong>Actualización:</strong><br />{trabajo.resultado_diagnostico || trabajo.notas_mecanico || trabajo.notas}</p>
              )}
              {(trabajo.hora_inicio || trabajo.created_at || trabajo.creado_en) && (
                <p><strong>Última referencia:</strong><br />{formatearFecha(trabajo.hora_inicio || trabajo.created_at || trabajo.creado_en)}</p>
              )}
            </div>

            <button onClick={cargarTrabajo} style={buttonStyle}>
              🔄 Actualizar estado
            </button>
          </>
        )}
      </div>
    </div>
  );
}

const pageStyle = {
  minHeight: "100vh",
  background: "linear-gradient(135deg, #020617, #111827)",
  color: "white",
  fontFamily: "Arial",
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
  padding: "18px",
  boxSizing: "border-box"
};

const cardStyle = {
  width: "100%",
  maxWidth: "920px",
  background: "rgba(31, 41, 55, 0.96)",
  border: "1px solid #f59e0b",
  borderRadius: "18px",
  padding: "clamp(20px, 5vw, 30px)",
  boxShadow: "0 20px 50px rgba(0,0,0,0.45)"
};

const logoBoxStyle = {
  width: "112px",
  height: "112px",
  margin: "0 auto 16px auto",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  background: "#020617",
  borderRadius: "14px",
  overflow: "hidden"
};

const logoStyle = {
  width: "100%",
  height: "100%",
  objectFit: "contain"
};

const titleStyle = {
  color: "#f59e0b",
  textAlign: "center",
  margin: "0 0 8px 0",
  fontSize: "clamp(28px, 8vw, 40px)"
};

const subtitleStyle = {
  color: "#d1d5db",
  textAlign: "center",
  marginBottom: "22px"
};

const jobHeader = {
  display: "flex",
  justifyContent: "space-between",
  gap: "14px",
  flexWrap: "wrap",
  alignItems: "center",
  background: "#111827",
  border: "1px solid #374151",
  borderRadius: "14px",
  padding: "16px"
};

const jobTitle = {
  color: "#f59e0b",
  margin: 0,
  fontSize: "22px"
};

const jobSubtitle = {
  color: "#d1d5db",
  margin: "5px 0 0 0"
};

const statusBadge = {
  background: "#0f172a",
  border: "1px solid #f59e0b",
  color: "#f59e0b",
  borderRadius: "999px",
  padding: "8px 12px",
  fontWeight: "bold"
};

const timelineStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(110px, 1fr))",
  gap: "10px",
  marginTop: "18px",
  marginBottom: "16px"
};

const stepWrap = {
  display: "grid",
  justifyItems: "center",
  gap: "6px"
};

const stepCircle = {
  width: "34px",
  height: "34px",
  borderRadius: "50%",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontWeight: "bold"
};

const stepText = {
  color: "#d1d5db",
  fontSize: "13px",
  textAlign: "center"
};

const infoGrid = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))",
  gap: "12px",
  color: "#d1d5db",
  background: "#111827",
  border: "1px solid #374151",
  borderRadius: "14px",
  padding: "16px"
};

const buttonStyle = {
  width: "100%",
  marginTop: "18px",
  padding: "14px",
  background: "#f59e0b",
  color: "#111827",
  border: "none",
  borderRadius: "10px",
  fontWeight: "bold",
  cursor: "pointer"
};

const secondaryButton = {
  width: "100%",
  marginTop: "12px",
  padding: "12px",
  background: "transparent",
  color: "#f59e0b",
  border: "1px solid #f59e0b",
  borderRadius: "10px",
  fontWeight: "bold",
  cursor: "pointer"
};

const errorStyle = {
  background: "#7f1d1d",
  border: "1px solid #ef4444",
  color: "white",
  padding: "12px",
  borderRadius: "10px",
  marginTop: "16px"
};

const emptyStyle = {
  background: "#111827",
  border: "1px solid #374151",
  color: "#d1d5db",
  padding: "14px",
  borderRadius: "10px"
};
