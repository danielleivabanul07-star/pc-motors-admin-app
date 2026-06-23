import { useEffect, useState } from "react";
import { supabase } from "../services/supabase";

const estados = [
  "solicitada",
  "confirmada",
  "en_proceso",
  "completada",
  "cancelada"
];

export default function Citas() {
  const [citas, setCitas] = useState([]);
  const [cargando, setCargando] = useState(false);
  const [filtro, setFiltro] = useState("todas");
  const [busqueda, setBusqueda] = useState("");

  useEffect(() => {
    cargarCitas();
  }, []);

  const cargarCitas = async () => {
    setCargando(true);

    const { data, error } = await supabase
      .from("citas")
      .select("*")
      .order("fecha_solicitada", { ascending: true })
      .order("hora_solicitada", { ascending: true });

    setCargando(false);

    if (error) {
      console.log(error);
      alert("Error cargando citas.");
      setCitas([]);
      return;
    }

    setCitas(data || []);
  };

  const actualizarCita = async (id, cambios) => {
    const { error } = await supabase
      .from("citas")
      .update(cambios)
      .eq("id", id);

    if (error) {
      console.log(error);
      alert(JSON.stringify(error, null, 2));
      return;
    }

    await cargarCitas();
  };

  const eliminarCita = async (id) => {
    const confirmar = confirm("¿Eliminar esta cita? Esta acción no se puede deshacer.");
    if (!confirmar) return;

    const { error } = await supabase
      .from("citas")
      .delete()
      .eq("id", id);

    if (error) {
      console.log(error);
      alert(JSON.stringify(error, null, 2));
      return;
    }

    await cargarCitas();
  };

  const formatearFecha = (fecha) => {
    if (!fecha) return "Sin fecha";
    try {
      return new Date(`${fecha}T00:00:00`).toLocaleDateString("en-US", {
        timeZone: "America/New_York",
        month: "2-digit",
        day: "2-digit",
        year: "numeric"
      });
    } catch {
      return fecha;
    }
  };

  const formatearHora = (hora) => {
    if (!hora) return "Sin hora";
    try {
      const [h, m] = String(hora).split(":");
      const fecha = new Date();
      fecha.setHours(Number(h || 0), Number(m || 0), 0, 0);
      return fecha.toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
        hour12: true
      });
    } catch {
      return hora;
    }
  };

  const citasFiltradas = citas.filter((cita) => {
    const coincideEstado = filtro === "todas" || cita.estado === filtro;
    const texto = `${cita.nombre_cliente || ""} ${cita.telefono || ""} ${cita.anio || ""} ${cita.marca || ""} ${cita.modelo || ""} ${cita.motivo || ""} ${cita.placa || ""} ${cita.vin || ""}`.toLowerCase();
    const coincideBusqueda = texto.includes(busqueda.toLowerCase());
    return coincideEstado && coincideBusqueda;
  });

  return (
    <div style={pageBox}>
      <h1 style={titleStyle}>📅 Citas</h1>
      <p style={subtitleStyle}>
        Solicitudes de citas de clientes. Link público: <strong>/solicitar-cita</strong>
      </p>

      <div style={actionsBox}>
        <button onClick={cargarCitas} style={refreshButton} disabled={cargando}>
          {cargando ? "Cargando..." : "🔄 Refrescar"}
        </button>

        <select value={filtro} onChange={(e) => setFiltro(e.target.value)} style={selectStyle}>
          <option value="todas">Todas</option>
          {estados.map((estado) => (
            <option key={estado} value={estado}>{estado}</option>
          ))}
        </select>

        <input
          placeholder="Buscar cita..."
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          style={searchInput}
        />
      </div>

      {citasFiltradas.length === 0 ? (
        <div style={emptyStyle}>No hay citas para mostrar.</div>
      ) : (
        <div style={listBox}>
          {citasFiltradas.map((cita) => (
            <div key={cita.id} style={cardStyle}>
              <div>
                <div style={cardHeader}>
                  <strong style={{ color: "#f59e0b" }}>
                    {formatearFecha(cita.fecha_solicitada)} - {formatearHora(cita.hora_solicitada)}
                  </strong>
                  <span style={badgeStyle}>{cita.estado || "solicitada"}</span>
                </div>

                <p style={textStyle}><strong>Cliente:</strong> {cita.nombre_cliente}</p>
                <p style={textStyle}><strong>Teléfono:</strong> {cita.telefono}</p>
                {cita.email && <p style={textStyle}><strong>Email:</strong> {cita.email}</p>}
                <p style={textStyle}>
                  <strong>Vehículo:</strong>{" "}
                  {`${cita.anio || ""} ${cita.marca || ""} ${cita.modelo || ""}`.trim() || "No registrado"}
                </p>
                {cita.placa && <p style={textStyle}><strong>Placa:</strong> {cita.placa}</p>}
                {cita.vin && <p style={textStyle}><strong>VIN:</strong> {cita.vin}</p>}
                <p style={textStyle}><strong>Motivo:</strong> {cita.motivo}</p>
                {cita.notas && <p style={textStyle}><strong>Notas:</strong> {cita.notas}</p>}
              </div>

              <div style={sideActions}>
                <select
                  value={cita.estado || "solicitada"}
                  onChange={(e) => actualizarCita(cita.id, { estado: e.target.value })}
                  style={selectStyle}
                >
                  {estados.map((estado) => (
                    <option key={estado} value={estado}>{estado}</option>
                  ))}
                </select>

                <button
                  onClick={() => actualizarCita(cita.id, { estado: "confirmada" })}
                  style={confirmButton}
                >
                  ✅ Confirmar
                </button>

                <button
                  onClick={() => actualizarCita(cita.id, { estado: "completada" })}
                  style={doneButton}
                >
                  🏁 Completar
                </button>

                <button
                  onClick={() => eliminarCita(cita.id)}
                  style={deleteButton}
                >
                  🗑 Eliminar
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const pageBox = { color: "white" };
const titleStyle = { color: "#f59e0b", fontSize: "42px", marginBottom: "8px" };
const subtitleStyle = { color: "#d1d5db", fontSize: "16px" };
const actionsBox = { display: "flex", gap: "12px", flexWrap: "wrap", marginTop: "25px", marginBottom: "20px", alignItems: "center" };
const refreshButton = { padding: "12px 16px", background: "#2563eb", color: "white", border: "none", borderRadius: "8px", cursor: "pointer", fontWeight: "bold" };
const selectStyle = { padding: "12px", background: "#111827", color: "white", border: "1px solid #374151", borderRadius: "8px" };
const searchInput = { flex: 1, minWidth: "240px", padding: "12px", background: "#111827", color: "white", border: "1px solid #374151", borderRadius: "8px" };
const emptyStyle = { background: "rgba(31, 41, 55, 0.95)", padding: "20px", borderRadius: "12px", border: "1px solid #374151", color: "white" };
const listBox = { display: "grid", gap: "14px" };
const cardStyle = { display: "grid", gridTemplateColumns: "1fr auto", gap: "16px", background: "rgba(31,41,55,0.95)", border: "1px solid #374151", borderRadius: "12px", padding: "16px" };
const cardHeader = { display: "flex", justifyContent: "space-between", gap: "12px", flexWrap: "wrap", marginBottom: "10px" };
const badgeStyle = { background: "#0f172a", border: "1px solid #f59e0b", color: "#f59e0b", borderRadius: "999px", padding: "5px 10px", fontWeight: "bold" };
const textStyle = { color: "#d1d5db", margin: "6px 0" };
const sideActions = { display: "grid", gap: "8px", alignContent: "start", minWidth: "170px" };
const confirmButton = { padding: "10px 12px", background: "#16a34a", color: "white", border: "none", borderRadius: "8px", cursor: "pointer", fontWeight: "bold" };
const doneButton = { padding: "10px 12px", background: "#9333ea", color: "white", border: "none", borderRadius: "8px", cursor: "pointer", fontWeight: "bold" };
const deleteButton = { padding: "10px 12px", background: "#dc2626", color: "white", border: "none", borderRadius: "8px", cursor: "pointer", fontWeight: "bold" };
