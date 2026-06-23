import { useState } from "react";
import { supabase } from "../services/supabase";

export default function RegistroCliente() {
  const [form, setForm] = useState({
    nombre_cliente: "",
    telefono: "",
    email: "",
    direccion: "",
    ciudad: "",
    estado_ubicacion: "",
    zip_code: "",
    anio: "",
    marca: "",
    modelo: "",
    color: "",
    placa: "",
    vin: "",
    millaje: "",
    problema: ""
  });

  const [guardando, setGuardando] = useState(false);

  const enviarPushClienteNuevo = async (payload) => {
    try {
      const vehiculo = `${payload.anio || ""} ${payload.marca || ""} ${payload.modelo || ""}`.trim();

      const respuesta = await fetch("/api/enviar-push", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          titulo: "🚗 Nuevo cliente registrado",
          mensaje: `${payload.nombre_cliente}${vehiculo ? ` - ${vehiculo}` : ""}`,
          url: "/"
        })
      });

      if (!respuesta.ok) {
        const resultado = await respuesta.json().catch(() => null);
        console.log("Push cliente nuevo no enviado:", resultado);
      }
    } catch (error) {
      console.log("No se pudo enviar push de cliente nuevo:", error);
    }
  };

  const guardarSolicitud = async () => {
    if (!form.nombre_cliente.trim()) {
      alert("Por favor escribe el nombre del cliente.");
      return;
    }

    if (!form.telefono.trim()) {
      alert("Por favor escribe el teléfono del cliente.");
      return;
    }

    if (!form.problema.trim()) {
      alert("Por favor describe el problema del vehículo.");
      return;
    }

    setGuardando(true);

    const direccionCompleta = [
      form.direccion.trim(),
      form.ciudad.trim(),
      form.estado_ubicacion.trim(),
      form.zip_code.trim()
    ]
      .filter(Boolean)
      .join(", ");

    const payload = {
      nombre_cliente: form.nombre_cliente.trim(),
      telefono: form.telefono.trim(),
      email: form.email.trim() || null,

      direccion: direccionCompleta || null,
      ciudad: form.ciudad.trim() || null,
      estado_ubicacion: form.estado_ubicacion.trim() || null,
      zip_code: form.zip_code.trim() || null,

      anio: form.anio ? Number(form.anio) : null,
      marca: form.marca.trim() || null,
      modelo: form.modelo.trim() || null,
      color: form.color.trim() || null,
      placa: form.placa.trim() || null,
      vin: form.vin.trim() || null,
      millaje: form.millaje.trim() || null,
      problema: form.problema.trim()
    };

    console.log("Enviando a Supabase:", payload);

    const { data, error } = await supabase
      .from("solicitudes_clientes")
      .insert([payload])
      .select();

    setGuardando(false);

    if (error) {
      console.log("Error Supabase:", error);
      alert(JSON.stringify(error, null, 2));
      return;
    }

    console.log("Solicitud guardada:", data);

    await enviarPushClienteNuevo(payload);

    alert("Solicitud enviada correctamente");

    setForm({
      nombre_cliente: "",
      telefono: "",
      email: "",
      direccion: "",
      ciudad: "",
      estado_ubicacion: "",
      zip_code: "",
      anio: "",
      marca: "",
      modelo: "",
      color: "",
      placa: "",
      vin: "",
      millaje: "",
      problema: ""
    });
  };

  return (
    <div style={pageStyle}>
      <div style={cardStyle}>
        <h1 style={titleStyle}>🚗 Solicitud de Servicio</h1>

        <p style={subtitleStyle}>
          Complete sus datos y describa el problema de su vehículo.
        </p>

        <h3 style={sectionTitle}>👤 Datos del Cliente</h3>

        <input
          placeholder="Nombre completo"
          value={form.nombre_cliente}
          onChange={(e) =>
            setForm({ ...form, nombre_cliente: e.target.value })
          }
          style={inputStyle}
        />

        <input
          placeholder="Teléfono"
          value={form.telefono}
          onChange={(e) => setForm({ ...form, telefono: e.target.value })}
          style={inputStyle}
        />

        <input
          placeholder="Email"
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
          style={inputStyle}
        />

        <h3 style={sectionTitle}>📍 Dirección</h3>

        <input
          placeholder="Dirección"
          value={form.direccion}
          onChange={(e) => setForm({ ...form, direccion: e.target.value })}
          style={inputStyle}
        />

        <input
          placeholder="Ciudad"
          value={form.ciudad}
          onChange={(e) => setForm({ ...form, ciudad: e.target.value })}
          style={inputStyle}
        />

        <input
          placeholder="Estado"
          value={form.estado_ubicacion}
          onChange={(e) =>
            setForm({ ...form, estado_ubicacion: e.target.value })
          }
          style={inputStyle}
        />

        <input
          placeholder="ZIP Code"
          value={form.zip_code}
          onChange={(e) => setForm({ ...form, zip_code: e.target.value })}
          style={inputStyle}
        />

        <h3 style={sectionTitle}>🚘 Datos del Vehículo</h3>

        <input
          placeholder="Año"
          value={form.anio}
          onChange={(e) => setForm({ ...form, anio: e.target.value })}
          style={inputStyle}
        />

        <input
          placeholder="Marca"
          value={form.marca}
          onChange={(e) => setForm({ ...form, marca: e.target.value })}
          style={inputStyle}
        />

        <input
          placeholder="Modelo"
          value={form.modelo}
          onChange={(e) => setForm({ ...form, modelo: e.target.value })}
          style={inputStyle}
        />

        <input
          placeholder="Color del vehículo"
          value={form.color}
          onChange={(e) => setForm({ ...form, color: e.target.value })}
          style={inputStyle}
        />

        <input
          placeholder="Número de placa / Plate number"
          value={form.placa}
          onChange={(e) => setForm({ ...form, placa: e.target.value })}
          style={inputStyle}
        />

        <input
          placeholder="VIN Number"
          value={form.vin}
          onChange={(e) => setForm({ ...form, vin: e.target.value })}
          style={inputStyle}
        />

        <input
          placeholder="Millaje"
          value={form.millaje}
          onChange={(e) => setForm({ ...form, millaje: e.target.value })}
          style={inputStyle}
        />

        <textarea
          placeholder="Describe el problema"
          value={form.problema}
          onChange={(e) => setForm({ ...form, problema: e.target.value })}
          style={{
            ...inputStyle,
            minHeight: "120px"
          }}
        />

        <button
          onClick={guardarSolicitud}
          disabled={guardando}
          style={{
            ...buttonStyle,
            background: guardando ? "#9ca3af" : "#f59e0b",
            cursor: guardando ? "not-allowed" : "pointer"
          }}
        >
          {guardando ? "Enviando..." : "Enviar Solicitud"}
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
  maxWidth: "600px",
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
