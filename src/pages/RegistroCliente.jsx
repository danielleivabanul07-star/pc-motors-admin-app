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

  const limpiar = (valor) => String(valor || "").trim();

  const extraerAnioVehiculo = (anio) => {
    const numero = Number(anio || 0);
    if (!numero || Number.isNaN(numero)) return null;
    return numero;
  };

  const construirVehiculoTexto = (payload) => {
    return `${payload.anio || ""} ${payload.marca || ""} ${payload.modelo || ""}`.trim() || "Vehículo sin datos";
  };

  const enviarPushClienteNuevo = async (payload) => {
    try {
      const vehiculo = construirVehiculoTexto(payload);

      const respuesta = await fetch("/api/enviar-push", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          titulo: "🚗 Nuevo cliente registrado",
          mensaje: `${payload.nombre_cliente}${vehiculo ? ` - ${vehiculo}` : ""}`,
          url: "/admin"
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

  const insertarTrabajoMecanico = async ({
    clienteCreado,
    vehiculoCreado,
    ordenCreada,
    payload,
    solicitudId
  }) => {
    const ahora = new Date().toISOString();
    const vehiculoTexto = construirVehiculoTexto(payload);

    const trabajoCompleto = {
      mecanico_id: null,
      mecanico_nombre: null,
      cliente_nombre: payload.nombre_cliente,
      cliente_telefono: payload.telefono || null,
      telefono_cliente: payload.telefono || null,
      vehiculo: vehiculoTexto,
      anio: payload.anio || null,
      marca: payload.marca || null,
      modelo: payload.modelo || null,
      color: payload.color || null,
      placa: payload.placa || null,
      vin: payload.vin || null,
      millaje: payload.millaje || null,
      trabajo: payload.problema || "Solicitud de servicio",
      problema: payload.problema || "Solicitud de servicio",
      estado: "diagnostico",
      fase_actual: "diagnostico",
      hora_inicio: ahora,
      diagnostico_inicio: ahora,
      diagnostico_minutos: 0,
      reparacion_minutos: 0,
      costo_piezas: 0,
      venta_piezas: 0,
      mano_obra: 0,
      notas: "Trabajo creado automáticamente desde registro público.",
      origen: "registro_publico",
      cliente_id: clienteCreado.id,
      vehiculo_id: vehiculoCreado.id,
      orden_id: ordenCreada.id,
      solicitud_id: solicitudId || null
    };

    let resultado = await supabase
      .from("trabajos_mecanicos")
      .insert([trabajoCompleto])
      .select()
      .single();

    if (!resultado.error) return resultado;

    const mensajeError = `${resultado.error.message || ""} ${resultado.error.details || ""}`.toLowerCase();

    if (
      mensajeError.includes("cliente_telefono") ||
      mensajeError.includes("telefono_cliente") ||
      mensajeError.includes("problema") ||
      mensajeError.includes("anio") ||
      mensajeError.includes("marca") ||
      mensajeError.includes("modelo") ||
      mensajeError.includes("color") ||
      mensajeError.includes("placa") ||
      mensajeError.includes("vin") ||
      mensajeError.includes("millaje")
    ) {
      const trabajoBasico = { ...trabajoCompleto };
      delete trabajoBasico.cliente_telefono;
      delete trabajoBasico.telefono_cliente;
      delete trabajoBasico.problema;
      delete trabajoBasico.anio;
      delete trabajoBasico.marca;
      delete trabajoBasico.modelo;
      delete trabajoBasico.color;
      delete trabajoBasico.placa;
      delete trabajoBasico.vin;
      delete trabajoBasico.millaje;

      resultado = await supabase
        .from("trabajos_mecanicos")
        .insert([trabajoBasico])
        .select()
        .single();
    }

    return resultado;
  };

  const crearSistemaCompleto = async (payload, solicitudId) => {
    let clienteCreado = null;
    let vehiculoCreado = null;
    let ordenCreada = null;

    const limpiarCreacionParcial = async () => {
      if (ordenCreada?.id) await supabase.from("ordenes_trabajo").delete().eq("id", ordenCreada.id);
      if (vehiculoCreado?.id) await supabase.from("vehiculos").delete().eq("id", vehiculoCreado.id);
      if (clienteCreado?.id) await supabase.from("clientes").delete().eq("id", clienteCreado.id);
    };

    const { data: clienteData, error: errorCliente } = await supabase
      .from("clientes")
      .insert([
        {
          nombre: payload.nombre_cliente,
          telefono: payload.telefono || null,
          email: payload.email || null,
          direccion: payload.direccion || null,
          estado: "activo",
          notas: `Creado automáticamente desde registro público. Solicitud #${solicitudId || "sin ID"}`
        }
      ])
      .select()
      .single();

    if (errorCliente) {
      console.log("Error creando cliente:", errorCliente);
      return { ok: false, error: errorCliente };
    }

    clienteCreado = clienteData;

    const { data: vehiculoData, error: errorVehiculo } = await supabase
      .from("vehiculos")
      .insert([
        {
          cliente_id: clienteCreado.id,
          anio: payload.anio || null,
          marca: payload.marca || null,
          modelo: payload.modelo || null,
          color: payload.color || null,
          placa: payload.placa || null,
          vin: payload.vin || null,
          millaje: payload.millaje || null,
          notas: payload.problema || construirVehiculoTexto(payload)
        }
      ])
      .select()
      .single();

    if (errorVehiculo) {
      console.log("Error creando vehículo:", errorVehiculo);
      await limpiarCreacionParcial();
      return { ok: false, error: errorVehiculo };
    }

    vehiculoCreado = vehiculoData;

    const { data: ordenData, error: errorOrden } = await supabase
      .from("ordenes_trabajo")
      .insert([
        {
          cliente_id: clienteCreado.id,
          vehiculo_id: vehiculoCreado.id,
          diagnostico: payload.problema || "Solicitud de servicio",
          mecanico: null,
          estado: "Diagnosticando",
          prioridad: "normal",
          notas: "Orden creada automáticamente desde registro público."
        }
      ])
      .select()
      .single();

    if (errorOrden) {
      console.log("Error creando orden:", errorOrden);
      await limpiarCreacionParcial();
      return { ok: false, error: errorOrden };
    }

    ordenCreada = ordenData;

    const { data: trabajoData, error: errorTrabajo } = await insertarTrabajoMecanico({
      clienteCreado,
      vehiculoCreado,
      ordenCreada,
      payload,
      solicitudId
    });

    if (errorTrabajo) {
      console.log("Error creando trabajo mecánico:", errorTrabajo);
      await limpiarCreacionParcial();
      return { ok: false, error: errorTrabajo };
    }

    if (solicitudId) {
      await supabase
        .from("solicitudes_clientes")
        .update({
          estado: "convertido",
          cliente_id: clienteCreado.id,
          vehiculo_id: vehiculoCreado.id,
          trabajo_id: trabajoData?.id || null
        })
        .eq("id", solicitudId);
    }

    return {
      ok: true,
      cliente: clienteCreado,
      vehiculo: vehiculoCreado,
      orden: ordenCreada,
      trabajo: trabajoData
    };
  };

  const guardarSolicitud = async () => {
    if (!limpiar(form.nombre_cliente)) {
      alert("Por favor escribe el nombre del cliente.");
      return;
    }

    if (!limpiar(form.telefono)) {
      alert("Por favor escribe el teléfono del cliente.");
      return;
    }

    if (!limpiar(form.problema)) {
      alert("Por favor describe el problema del vehículo.");
      return;
    }

    setGuardando(true);

    const direccionCompleta = [
      limpiar(form.direccion),
      limpiar(form.ciudad),
      limpiar(form.estado_ubicacion),
      limpiar(form.zip_code)
    ]
      .filter(Boolean)
      .join(", ");

    const payload = {
      nombre_cliente: limpiar(form.nombre_cliente),
      telefono: limpiar(form.telefono),
      email: limpiar(form.email) || null,

      direccion: direccionCompleta || null,
      ciudad: limpiar(form.ciudad) || null,
      estado_ubicacion: limpiar(form.estado_ubicacion) || null,
      zip_code: limpiar(form.zip_code) || null,

      anio: extraerAnioVehiculo(form.anio),
      marca: limpiar(form.marca) || null,
      modelo: limpiar(form.modelo) || null,
      color: limpiar(form.color) || null,
      placa: limpiar(form.placa).toUpperCase() || null,
      vin: limpiar(form.vin).toUpperCase() || null,
      millaje: limpiar(form.millaje) || null,
      problema: limpiar(form.problema)
    };

    console.log("Enviando a Supabase:", payload);

    const { data, error } = await supabase
      .from("solicitudes_clientes")
      .insert([payload])
      .select()
      .single();

    if (error) {
      setGuardando(false);
      console.log("Error Supabase:", error);
      alert(JSON.stringify(error, null, 2));
      return;
    }

    console.log("Solicitud guardada:", data);

    const resultadoSistema = await crearSistemaCompleto(payload, data?.id);

    setGuardando(false);

    if (!resultadoSistema.ok) {
      alert(
        "La solicitud se guardó, pero no se pudo crear el cliente/trabajo completo.\n\n" +
        JSON.stringify(resultadoSistema.error, null, 2)
      );
      return;
    }

    await enviarPushClienteNuevo(payload);

    alert(
      "Solicitud enviada correctamente.\n\n" +
      "El cliente, vehículo, orden y trabajo fueron creados automáticamente."
    );

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
