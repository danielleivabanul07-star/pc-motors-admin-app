import { useState } from "react";
import { supabase } from "../services/supabase";

export default function SolicitarCita() {
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

  const [guardando, setGuardando] = useState(false);

  const actualizar = (campo, valor) => {
    setForm((prev) => ({ ...prev, [campo]: valor }));
  };

  const limpiar = (valor) => String(valor || "").trim();

  const enviarPushCita = async (payload) => {
    try {
      await fetch("/api/enviar-push", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          titulo: "📅 Nueva cita solicitada",
          mensaje: `${payload.nombre_cliente} - ${payload.fecha} ${payload.hora}`.trim(),
          url: "/"
        })
      });
    } catch (error) {
      console.log("No se pudo enviar push de cita:", error);
    }
  };

  const guardarCita = async () => {
    if (!limpiar(form.nombre_cliente)) {
      alert("Por favor escribe tu nombre.");
      return;
    }

    if (!limpiar(form.telefono)) {
      alert("Por favor escribe tu teléfono.");
      return;
    }

    if (!limpiar(form.motivo)) {
      alert("Por favor describe el motivo de la cita.");
      return;
    }

    if (!form.fecha_solicitada) {
      alert("Por favor selecciona la fecha deseada.");
      return;
    }

    if (!form.hora_solicitada) {
      alert("Por favor selecciona la hora deseada.");
      return;
    }

    setGuardando(true);

    const payload = {
      nombre_cliente: limpiar(form.nombre_cliente),
      telefono: limpiar(form.telefono),
      email: limpiar(form.email) || null,

      anio: limpiar(form.anio) || null,
      marca: limpiar(form.marca) || null,
      modelo: limpiar(form.modelo) || null,
      vin: limpiar(form.vin).toUpperCase() || null,
      placa: limpiar(form.placa).toUpperCase() || null,

      fecha: form.fecha_solicitada,
      hora: form.hora_solicitada,

      fecha_solicitada: form.fecha_solicitada,
      hora_solicitada: form.hora_solicitada,

      servicio_solicitado: limpiar(form.motivo),
      motivo: limpiar(form.motivo),

      estado: "solicitada",
      notas: limpiar(form.notas) || null,
      creado_por_admin: false
    };

    const { error } = await supabase.from("citas").insert([payload]);

    setGuardando(false);

    if (error) {
      console.log(error);
      alert(JSON.stringify(error, null, 2));
      return;
    }

    await enviarPushCita(payload);

    alert("Cita solicitada correctamente. PC Motors se comunicará contigo para confirmar.");

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
  };

  return (
    <div style={pageStyle}>
      <div style={cardStyle}>
        <h1 style={titleStyle}>📅 Solicitar Cita</h1>
        <p style={subtitleStyle}>
          Complete sus datos para solicitar una cita en PC Motors.
        </p>

        <h3 style={sectionTitle}>👤 Datos del Cliente</h3>

        <input placeholder="Nombre completo" value={form.nombre_cliente} onChange={(e) => actualizar("nombre_cliente", e.target.value)} style={inputStyle} />
        <input placeholder="Teléfono" value={form.telefono} onChange={(e) => actualizar("telefono", e.target.value)} style={inputStyle} />
        <input placeholder="Email opcional" value={form.email} onChange={(e) => actualizar("email", e.target.value)} style={inputStyle} />

        <h3 style={sectionTitle}>🚘 Vehículo</h3>

        <input placeholder="Año" value={form.anio} onChange={(e) => actualizar("anio", e.target.value)} style={inputStyle} />
        <input placeholder="Marca" value={form.marca} onChange={(e) => actualizar("marca", e.target.value)} style={inputStyle} />
        <input placeholder="Modelo" value={form.modelo} onChange={(e) => actualizar("modelo", e.target.value)} style={inputStyle} />
        <input placeholder="VIN opcional" value={form.vin} onChange={(e) => actualizar("vin", e.target.value)} style={inputStyle} />
        <input placeholder="Placa opcional" value={form.placa} onChange={(e) => actualizar("placa", e.target.value)} style={inputStyle} />

        <h3 style={sectionTitle}>🗓 Fecha y Hora</h3>

        <input type="date" value={form.fecha_solicitada} onChange={(e) => actualizar("fecha_solicitada", e.target.value)} style={inputStyle} />
        <input type="time" value={form.hora_solicitada} onChange={(e) => actualizar("hora_solicitada", e.target.value)} style={inputStyle} />

        <h3 style={sectionTitle}>🔧 Motivo de la cita</h3>

        <textarea
          placeholder="Ejemplo: diagnóstico, ruido, cambio de aceite, frenos, luz del motor..."
          value={form.motivo}
          onChange={(e) => actualizar("motivo", e.target.value)}
          style={{ ...inputStyle, minHeight: "110px" }}
        />

        <textarea
          placeholder="Notas adicionales opcionales"
          value={form.notas}
          onChange={(e) => actualizar("notas", e.target.value)}
          style={{ ...inputStyle, minHeight: "85px" }}
        />

        <button
          onClick={guardarCita}
          disabled={guardando}
          style={{
            ...buttonStyle,
            background: guardando ? "#9ca3af" : "#f59e0b",
            cursor: guardando ? "not-allowed" : "pointer"
          }}
        >
          {guardando ? "Enviando..." : "Solicitar Cita"}
        </button>
      </div>
    </div>
  );
}

const pageStyle = {
  minHeight: "100vh",
  background: "#111827",
  color: "white",
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
  padding: "20px"
};

const cardStyle = {
  width: "100%",
  maxWidth: "620px",
  background: "#1f2937",
  padding: "30px",
  borderRadius: "15px",
  border: "1px solid #f59e0b"
};

const titleStyle = {
  color: "#f59e0b",
  textAlign: "center",
  marginBottom: "10px"
};

const subtitleStyle = {
  textAlign: "center",
  marginBottom: "25px",
  color: "#d1d5db"
};

const sectionTitle = {
  color: "#f59e0b",
  marginTop: "20px",
  marginBottom: "12px"
};

const inputStyle = {
  width: "100%",
  padding: "12px",
  marginBottom: "15px",
  borderRadius: "8px",
  border: "1px solid #374151",
  background: "#111827",
  color: "white",
  boxSizing: "border-box"
};

const buttonStyle = {
  width: "100%",
  padding: "12px",
  color: "#111827",
  border: "none",
  borderRadius: "8px",
  fontWeight: "bold",
  fontSize: "16px"
};