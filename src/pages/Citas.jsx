import { useEffect, useState } from "react";
import { supabase } from "../services/supabase";

const estados = [
  "solicitada",
  "pendiente_confirmacion",
  "confirmada",
  "en_proceso",
  "completada",
  "cancelada"
];

const crearToken = () => {
  if (window.crypto?.randomUUID) return window.crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
};

export default function Citas() {
  const [citas, setCitas] = useState([]);
  const [cargando, setCargando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [mostrarFormulario, setMostrarFormulario] = useState(false);
  const [filtro, setFiltro] = useState("todas");
  const [busqueda, setBusqueda] = useState("");

  const [form, setForm] = useState({
    nombre_cliente: "",
    telefono: "",
    email: "",
    anio: "",
    marca: "",
    modelo: "",
    vin: "",
    placa: "",
    motivo: "",
    fecha_solicitada: "",
    hora_solicitada: "",
    notas: ""
  });

  useEffect(() => {
    cargarCitas();
  }, []);

  const limpiar = (valor) => String(valor || "").trim();

  const actualizarForm = (campo, valor) => {
    setForm((prev) => ({ ...prev, [campo]: valor }));
  };

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
    const { error } = await supabase.from("citas").update(cambios).eq("id", id);

    if (error) {
      console.log(error);
      alert(JSON.stringify(error, null, 2));
      return;
    }

    await cargarCitas();
  };

  const eliminarCita = async (id) => {
    const confirmar = confirm("¿Eliminar esta cita?");
    if (!confirmar) return;

    const { error } = await supabase.from("citas").delete().eq("id", id);

    if (error) {
      console.log(error);
      alert(JSON.stringify(error, null, 2));
      return;
    }

    await cargarCitas();
  };

  const crearCitaManual = async () => {
    if (!limpiar(form.nombre_cliente)) {
      alert("Escribe el nombre del cliente.");
      return;
    }

    if (!limpiar(form.telefono)) {
      alert("Escribe el teléfono del cliente.");
      return;
    }

    if (!form.fecha_solicitada) {
      alert("Selecciona la fecha.");
      return;
    }

    if (!form.hora_solicitada) {
      alert("Selecciona la hora.");
      return;
    }

    const tokenConfirmacion = crearToken();

    const payload = {
      nombre_cliente: limpiar(form.nombre_cliente),
      telefono: limpiar(form.telefono),
      email: limpiar(form.email) || null,
      anio: limpiar(form.anio) || null,
      marca: limpiar(form.marca) || null,
      modelo: limpiar(form.modelo) || null,
      vin: limpiar(form.vin).toUpperCase() || null,
      placa: limpiar(form.placa).toUpperCase() || null,
      motivo: limpiar(form.motivo) || "Cita creada por PC Motors",
      fecha_solicitada: form.fecha_solicitada,
      hora_solicitada: form.hora_solicitada,
      estado: "pendiente_confirmacion",
      notas: limpiar(form.notas) || null,
      token_confirmacion: tokenConfirmacion,
      creado_por_admin: true
    };

    setGuardando(true);

    const { data, error } = await supabase
      .from("citas")
      .insert([payload])
      .select()
      .single();

    setGuardando(false);

    if (error) {
      console.log(error);
      alert(JSON.stringify(error, null, 2));
      return;
    }

    const link = construirLinkConfirmacion(data || payload);

    try {
      await navigator.clipboard.writeText(link);
      alert(`Cita creada correctamente.\n\nLink copiado:\n${link}`);
    } catch {
      alert(`Cita creada correctamente.\n\nLink:\n${link}`);
    }

    setForm({
      nombre_cliente: "",
      telefono: "",
      email: "",
      anio: "",
      marca: "",
      modelo: "",
      vin: "",
      placa: "",
      motivo: "",
      fecha_solicitada: "",
      hora_solicitada: "",
      notas: ""
    });

    setMostrarFormulario(false);
    await cargarCitas();
  };

  const construirLinkConfirmacion = (cita) => {
    return `${window.location.origin}/confirmar-cita/${cita.token_confirmacion}`;
  };

  const copiarLink = async (cita) => {
    if (!cita?.token_confirmacion) {
      alert("Esta cita no tiene link de confirmación.");
      return;
    }

    const link = construirLinkConfirmacion(cita);

    try {
      await navigator.clipboard.writeText(link);
      alert("Link copiado.");
    } catch {
      prompt("Copia este link:", link);
    }
  };

  const abrirWhatsApp = (cita) => {
    if (!cita?.token_confirmacion) {
      alert("Esta cita no tiene link de confirmación.");
      return;
    }

    const telefono = String(cita.telefono || "").replace(/\D/g, "");
    const link = construirLinkConfirmacion(cita);
    const mensaje = encodeURIComponent(
      `Hola ${cita.nombre_cliente || ""}, PC Motors necesita que confirmes tu cita aquí:\n${link}`
    );

    const url = telefono
      ? `https://wa.me/1${telefono}?text=${mensaje}`
      : `https://wa.me/?text=${mensaje}`;

    window.open(url, "_blank", "noopener,noreferrer");
  };

  const formatearFecha = (fecha) => {
    if (!fecha) return "Sin fecha";
    return new Date(`${fecha}T00:00:00`).toLocaleDateString("en-US", {
      timeZone: "America/New_York",
      month: "2-digit",
      day: "2-digit",
      year: "numeric"
    });
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

  const citasFiltradas = citas.filter((cita) => {
    const coincideEstado = filtro === "todas" || cita.estado === filtro;
    const texto = `${cita.nombre_cliente || ""} ${cita.telefono || ""} ${cita.anio || ""} ${cita.marca || ""} ${cita.modelo || ""} ${cita.motivo || ""} ${cita.placa || ""} ${cita.vin || ""}`.toLowerCase();
    return coincideEstado && texto.includes(busqueda.toLowerCase());
  });

  return (
    <div style={pageBox}>
      <h1 style={titleStyle}>📅 Citas</h1>
      <p style={subtitleStyle}>
        Citas del taller. Link público para solicitud: <strong>/solicitar-cita</strong>
      </p>

      <div style={actionsBox}>
        <button onClick={cargarCitas} style={refreshButton} disabled={cargando}>
          {cargando ? "Cargando..." : "🔄 Refrescar"}
        </button>

        <button onClick={() => setMostrarFormulario(!mostrarFormulario)} style={manualButton}>
          ➕ Agregar cita manual
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

      {mostrarFormulario && (
        <div style={formBox}>
          <h2 style={sectionTitle}>➕ Agregar cita manual</h2>
          <p style={subtitleStyle}>
            Al guardar, se genera un link para enviárselo al cliente. La notificación llega cuando el cliente confirma.
          </p>

          <div style={gridStyle}>
            <Input label="Cliente" value={form.nombre_cliente} onChange={(v) => actualizarForm("nombre_cliente", v)} />
            <Input label="Teléfono" value={form.telefono} onChange={(v) => actualizarForm("telefono", v)} />
            <Input label="Email opcional" value={form.email} onChange={(v) => actualizarForm("email", v)} />
            <Input label="Fecha" type="date" value={form.fecha_solicitada} onChange={(v) => actualizarForm("fecha_solicitada", v)} />
            <Input label="Hora" type="time" value={form.hora_solicitada} onChange={(v) => actualizarForm("hora_solicitada", v)} />
            <Input label="Año" value={form.anio} onChange={(v) => actualizarForm("anio", v)} />
            <Input label="Marca" value={form.marca} onChange={(v) => actualizarForm("marca", v)} />
            <Input label="Modelo" value={form.modelo} onChange={(v) => actualizarForm("modelo", v)} />
            <Input label="VIN" value={form.vin} onChange={(v) => actualizarForm("vin", v.toUpperCase())} />
            <Input label="Placa" value={form.placa} onChange={(v) => actualizarForm("placa", v.toUpperCase())} />
          </div>

          <Textarea label="Motivo" value={form.motivo} onChange={(v) => actualizarForm("motivo", v)} />
          <Textarea label="Notas internas" value={form.notas} onChange={(v) => actualizarForm("notas", v)} />

          <div style={actionsBox}>
            <button onClick={crearCitaManual} style={confirmButton} disabled={guardando}>
              {guardando ? "Guardando..." : "💾 Guardar y generar link"}
            </button>

            <button onClick={() => setMostrarFormulario(false)} style={cancelButton}>
              Cancelar
            </button>
          </div>
        </div>
      )}

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

                {cita.confirmado_en && (
                  <p style={confirmedText}>
                    Confirmada por cliente: {new Date(cita.confirmado_en).toLocaleString()}
                  </p>
                )}
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

                <button onClick={() => copiarLink(cita)} style={copyButton}>
                  🔗 Copiar link
                </button>

                <button onClick={() => abrirWhatsApp(cita)} style={whatsappButton}>
                  🟢 Enviar WhatsApp
                </button>

                <button onClick={() => actualizarCita(cita.id, { estado: "completada" })} style={doneButton}>
                  🏁 Completar
                </button>

                <button onClick={() => eliminarCita(cita.id)} style={deleteButton}>
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

function Input({ label, value, onChange, type = "text" }) {
  return (
    <label style={labelStyle}>
      {label}
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)} style={inputStyle} />
    </label>
  );
}

function Textarea({ label, value, onChange }) {
  return (
    <label style={labelStyleFull}>
      {label}
      <textarea value={value} onChange={(e) => onChange(e.target.value)} style={textareaStyle} />
    </label>
  );
}

const pageBox = { color: "white" };
const titleStyle = { color: "#f59e0b", fontSize: "42px", marginBottom: "8px" };
const subtitleStyle = { color: "#d1d5db", fontSize: "16px" };
const actionsBox = { display: "flex", gap: "12px", flexWrap: "wrap", marginTop: "25px", marginBottom: "20px", alignItems: "center" };
const refreshButton = { padding: "12px 16px", background: "#2563eb", color: "white", border: "none", borderRadius: "8px", cursor: "pointer", fontWeight: "bold" };
const manualButton = { padding: "12px 16px", background: "#16a34a", color: "white", border: "none", borderRadius: "8px", cursor: "pointer", fontWeight: "bold" };
const selectStyle = { padding: "12px", background: "#111827", color: "white", border: "1px solid #374151", borderRadius: "8px" };
const searchInput = { flex: 1, minWidth: "240px", padding: "12px", background: "#111827", color: "white", border: "1px solid #374151", borderRadius: "8px" };
const emptyStyle = { background: "rgba(31, 41, 55, 0.95)", padding: "20px", borderRadius: "12px", border: "1px solid #374151", color: "white" };
const listBox = { display: "grid", gap: "14px" };
const cardStyle = { display: "grid", gridTemplateColumns: "1fr auto", gap: "16px", background: "rgba(31,41,55,0.95)", border: "1px solid #374151", borderRadius: "12px", padding: "16px" };
const cardHeader = { display: "flex", justifyContent: "space-between", gap: "12px", flexWrap: "wrap", marginBottom: "10px" };
const badgeStyle = { background: "#0f172a", border: "1px solid #f59e0b", color: "#f59e0b", borderRadius: "999px", padding: "5px 10px", fontWeight: "bold" };
const textStyle = { color: "#d1d5db", margin: "6px 0" };
const confirmedText = { color: "#86efac", margin: "6px 0", fontWeight: "bold" };
const sideActions = { display: "grid", gap: "8px", alignContent: "start", minWidth: "180px" };
const confirmButton = { padding: "10px 12px", background: "#16a34a", color: "white", border: "none", borderRadius: "8px", cursor: "pointer", fontWeight: "bold" };
const doneButton = { padding: "10px 12px", background: "#9333ea", color: "white", border: "none", borderRadius: "8px", cursor: "pointer", fontWeight: "bold" };
const deleteButton = { padding: "10px 12px", background: "#dc2626", color: "white", border: "none", borderRadius: "8px", cursor: "pointer", fontWeight: "bold" };
const copyButton = { padding: "10px 12px", background: "#0ea5e9", color: "white", border: "none", borderRadius: "8px", cursor: "pointer", fontWeight: "bold" };
const whatsappButton = { padding: "10px 12px", background: "#22c55e", color: "#052e16", border: "none", borderRadius: "8px", cursor: "pointer", fontWeight: "bold" };
const cancelButton = { padding: "10px 12px", background: "#6b7280", color: "white", border: "none", borderRadius: "8px", cursor: "pointer", fontWeight: "bold" };
const formBox = { background: "rgba(31,41,55,0.95)", border: "1px solid #f59e0b", borderRadius: "12px", padding: "16px", marginBottom: "18px" };
const sectionTitle = { color: "#f59e0b", marginTop: 0 };
const gridStyle = { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: "12px" };
const labelStyle = { display: "grid", gap: "6px", color: "white", fontWeight: "bold" };
const labelStyleFull = { display: "grid", gap: "6px", color: "white", fontWeight: "bold", marginTop: "12px" };
const inputStyle = { width: "100%", padding: "12px", background: "#111827", color: "white", border: "1px solid #374151", borderRadius: "8px", boxSizing: "border-box" };
const textareaStyle = { ...inputStyle, minHeight: "90px", resize: "vertical" };