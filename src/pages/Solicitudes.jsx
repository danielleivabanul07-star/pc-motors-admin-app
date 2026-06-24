import { useEffect, useState } from "react";
import { supabase } from "../services/supabase";

export default function Solicitudes() {
  const [solicitudes, setSolicitudes] = useState([]);
  const [mecanicos, setMecanicos] = useState([]);
  const [mecanicoSeleccionado, setMecanicoSeleccionado] = useState({});
  const [prioridadSeleccionada, setPrioridadSeleccionada] = useState({});
  const [cargando, setCargando] = useState(true);
  const [procesandoId, setProcesandoId] = useState(null);

  useEffect(() => {
    cargarDatos();
  }, []);

  const cargarDatos = async () => {
    setCargando(true);
    await cargarSolicitudes();
    await cargarMecanicos();
    setCargando(false);
  };

  const cargarSolicitudes = async () => {
    const { data, error } = await supabase
      .from("solicitudes_clientes")
      .select("*")
      .eq("estado", "pendiente")
      .order("creado_en", { ascending: false });

    if (error) {
      console.log("Error cargando solicitudes:", error);
      alert("Error al cargar solicitudes");
      return;
    }

    setSolicitudes(data || []);
  };

  const cargarMecanicos = async () => {
    const { data, error } = await supabase
      .from("mecanicos")
      .select("*")
      .eq("activo", true)
      .order("nombre", { ascending: true });

    if (error) {
      console.log("Error cargando mecánicos:", error);
      alert("Error cargando mecánicos");
      return;
    }

    setMecanicos(data || []);
  };

  const aceptarYCrearCliente = async (solicitud) => {
    const mecanicoId = mecanicoSeleccionado[solicitud.id];
    const prioridad = prioridadSeleccionada[solicitud.id] || "normal";

    if (!mecanicoId) {
      alert("Selecciona un mecánico para iniciar el diagnóstico.");
      return;
    }

    const mecanico = mecanicos.find(
      (item) => String(item.id) === String(mecanicoId)
    );

    if (!mecanico) {
      alert("No se encontró el mecánico seleccionado.");
      return;
    }

    const confirmar = confirm(
      `¿Aceptar esta solicitud, asignar a ${mecanico.nombre}, prioridad ${prioridad.toUpperCase()} e iniciar el diagnóstico automáticamente?`
    );

    if (!confirmar) return;

    setProcesandoId(solicitud.id);

    const { data: clienteCreado, error: errorCliente } = await supabase
      .from("clientes")
      .insert([
        {
          nombre: solicitud.nombre_cliente,
          telefono: solicitud.telefono,
          email: solicitud.email || null,
          direccion: solicitud.direccion || null,
          notas: `Creado desde solicitud #${solicitud.id}`,
          estado: "activo",
          archivado: false
        }
      ])
      .select()
      .single();

    if (errorCliente) {
      console.log("Error creando cliente:", errorCliente);
      alert(JSON.stringify(errorCliente, null, 2));
      setProcesandoId(null);
      return;
    }

    const { data: vehiculoCreado, error: errorVehiculo } = await supabase
      .from("vehiculos")
      .insert([
        {
          cliente_id: clienteCreado.id,
          anio: solicitud.anio || null,
          marca: solicitud.marca || null,
          modelo: solicitud.modelo || null,
          color: solicitud.color || null,
          placa: solicitud.placa || null,
          vin: solicitud.vin || null,
          millaje: solicitud.millaje || null,
          notas: solicitud.problema || null
        }
      ])
      .select()
      .single();

    if (errorVehiculo) {
      console.log("Error creando vehículo:", errorVehiculo);
      alert(JSON.stringify(errorVehiculo, null, 2));
      setProcesandoId(null);
      return;
    }

    const { data: ordenCreada, error: errorOrden } = await supabase
      .from("ordenes_trabajo")
      .insert([
        {
          cliente_id: clienteCreado.id,
          vehiculo_id: vehiculoCreado.id,
          diagnostico: solicitud.problema || "Diagnóstico inicial",
          mecanico: mecanico.nombre,
          estado: "Diagnosticando",
          prioridad,
          notas: `Orden creada automáticamente desde solicitud #${solicitud.id}`
        }
      ])
      .select()
      .single();

    if (errorOrden) {
      console.log("Error creando orden inicial:", errorOrden);
      alert(JSON.stringify(errorOrden, null, 2));
      setProcesandoId(null);
      return;
    }

    await supabase.from("cliente_mecanicos").insert([
      {
        cliente_id: clienteCreado.id,
        mecanico_id: mecanico.id,
        mecanico_nombre: mecanico.nombre,
        rol: "Diagnóstico inicial",
        horas_asignadas: 0,
        porcentaje_produccion: 0,
        notas: `Asignado automáticamente desde solicitud #${solicitud.id}`
      }
    ]);

    const inicioTrabajo = new Date().toISOString();

    const { error: errorTiempo } = await supabase
      .from("tiempos_mecanicos")
      .insert([
        {
          orden_id: ordenCreada.id,
          cliente_id: clienteCreado.id,
          vehiculo_id: vehiculoCreado.id,
          mecanico: mecanico.nombre,
          descripcion:
            solicitud.problema ||
            "Diagnóstico inicial iniciado automáticamente",
          hora_inicio: inicioTrabajo,
          hora_fin: null,
          minutos_trabajados: null
        }
      ]);

    if (errorTiempo) {
      console.log("Error iniciando tiempo:", errorTiempo);
      alert(JSON.stringify(errorTiempo, null, 2));
      setProcesandoId(null);
      return;
    }

    const vehiculoTexto = [
      solicitud.anio,
      solicitud.marca,
      solicitud.modelo
    ]
      .filter(Boolean)
      .join(" ");

    const trabajoMecanicoCompleto = {
      mecanico_id: mecanico.id,
      mecanico_nombre: mecanico.nombre,
      cliente_nombre: solicitud.nombre_cliente || null,
      cliente_telefono: solicitud.telefono || null,
      telefono_cliente: solicitud.telefono || null,
      vehiculo: vehiculoTexto || null,
      anio: solicitud.anio || null,
      marca: solicitud.marca || null,
      modelo: solicitud.modelo || null,
      color: solicitud.color || null,
      placa: solicitud.placa || null,
      vin: solicitud.vin || null,
      millaje: solicitud.millaje || null,
      problema: solicitud.problema || "Diagnóstico inicial",
      trabajo: solicitud.problema || "Diagnóstico inicial",
      descripcion_trabajo: solicitud.problema || "Diagnóstico inicial",
      estado: "diagnostico",
      fase_actual: "diagnostico",
      hora_inicio: inicioTrabajo,
      diagnostico_inicio: inicioTrabajo,
      diagnostico_minutos: 0,
      reparacion_minutos: 0,
      costo_piezas: 0,
      venta_piezas: 0,
      mano_obra: 0,
      notas: `Creado automáticamente desde solicitud #${solicitud.id} / orden #${ordenCreada.id}`,
      origen: "solicitud",
      cliente_id: clienteCreado.id,
      vehiculo_id: vehiculoCreado.id,
      orden_id: ordenCreada.id,
      solicitud_id: solicitud.id
    };

    let trabajoCreado = null;

    let { data: trabajoData, error: errorTrabajoMecanico } = await supabase
      .from("trabajos_mecanicos")
      .insert([trabajoMecanicoCompleto])
      .select()
      .single();

    if (errorTrabajoMecanico) {
      const mensajeError = `${errorTrabajoMecanico.message || ""} ${errorTrabajoMecanico.details || ""}`.toLowerCase();

      if (
        mensajeError.includes("cliente_telefono") ||
        mensajeError.includes("telefono_cliente") ||
        mensajeError.includes("problema") ||
        mensajeError.includes("descripcion_trabajo") ||
        mensajeError.includes("anio") ||
        mensajeError.includes("marca") ||
        mensajeError.includes("modelo") ||
        mensajeError.includes("color") ||
        mensajeError.includes("placa") ||
        mensajeError.includes("vin") ||
        mensajeError.includes("millaje")
      ) {
        const trabajoBasico = { ...trabajoMecanicoCompleto };
        delete trabajoBasico.cliente_telefono;
        delete trabajoBasico.telefono_cliente;
        delete trabajoBasico.problema;
        delete trabajoBasico.descripcion_trabajo;
        delete trabajoBasico.anio;
        delete trabajoBasico.marca;
        delete trabajoBasico.modelo;
        delete trabajoBasico.color;
        delete trabajoBasico.placa;
        delete trabajoBasico.vin;
        delete trabajoBasico.millaje;

        const segundoIntento = await supabase
          .from("trabajos_mecanicos")
          .insert([trabajoBasico])
          .select()
          .single();

        trabajoData = segundoIntento.data;
        errorTrabajoMecanico = segundoIntento.error;
      }
    }

    if (errorTrabajoMecanico) {
      console.log("Error creando trabajo mecánico:", errorTrabajoMecanico);
      alert(JSON.stringify(errorTrabajoMecanico, null, 2));
      setProcesandoId(null);
      return;
    }

    trabajoCreado = trabajoData;

    const { error: errorActualizar } = await supabase
      .from("solicitudes_clientes")
      .update({
        estado: "aceptada",
        aceptada_en: new Date().toISOString(),
        cliente_id: clienteCreado.id,
        vehiculo_id: vehiculoCreado.id,
        orden_id: ordenCreada.id,
        trabajo_id: trabajoCreado?.id || null
      })
      .eq("id", solicitud.id);

    if (errorActualizar) {
      console.log("Error actualizando solicitud:", errorActualizar);
      alert(JSON.stringify(errorActualizar, null, 2));
      setProcesandoId(null);
      return;
    }

    setSolicitudes((prev) => prev.filter((item) => item.id !== solicitud.id));
    setProcesandoId(null);

    alert(
      `Solicitud aceptada correctamente.\n\nCliente creado.\nOrden #${ordenCreada.id} creada.\nTiempo iniciado para ${mecanico.nombre}.
Trabajo mecánico creado para actualizar Dashboard, Mecánicos y Reportes.`
    );
  };

  const rechazarSolicitud = async (solicitud) => {
    const confirmar = confirm(
      `¿Rechazar la solicitud de ${solicitud.nombre_cliente}?`
    );

    if (!confirmar) return;

    setProcesandoId(solicitud.id);

    const { error } = await supabase
      .from("solicitudes_clientes")
      .update({
        estado: "rechazada",
        rechazada_en: new Date().toISOString()
      })
      .eq("id", solicitud.id);

    setProcesandoId(null);

    if (error) {
      console.log("Error rechazando solicitud:", error);
      alert(JSON.stringify(error, null, 2));
      return;
    }

    setSolicitudes((prev) => prev.filter((item) => item.id !== solicitud.id));
    alert("Solicitud rechazada correctamente");
  };

  return (
    <div>
      <div style={headerStyle}>
        <div>
          <h1 style={titleStyle}>📥 Solicitudes Pendientes</h1>
          <p style={{ color: "#d1d5db" }}>
            Acepta la solicitud, asigna mecánico y comienza el diagnóstico
            automáticamente.
          </p>
        </div>

        <button onClick={cargarDatos} style={buttonStyle}>
          Refrescar
        </button>
      </div>

      {cargando ? (
        <p>Cargando solicitudes...</p>
      ) : solicitudes.length === 0 ? (
        <div style={emptyStyle}>No hay solicitudes pendientes.</div>
      ) : (
        <div style={gridStyle}>
          {solicitudes.map((solicitud) => (
            <div key={solicitud.id} style={cardStyle}>
              <h2 style={{ color: "#f59e0b", marginTop: 0 }}>
                {solicitud.nombre_cliente}
              </h2>

              <p>
                <strong>📞 Teléfono:</strong>{" "}
                {solicitud.telefono || "No registrado"}
              </p>

              <p>
                <strong>✉️ Email:</strong>{" "}
                {solicitud.email || "No registrado"}
              </p>

              <p>
                <strong>📍 Dirección:</strong>{" "}
                {solicitud.direccion || "No registrada"}
              </p>

              <hr style={lineStyle} />

              <p>
                <strong>🚗 Vehículo:</strong>{" "}
                {solicitud.anio || ""} {solicitud.marca || ""}{" "}
                {solicitud.modelo || ""}
              </p>

              <p>
                <strong>🎨 Color:</strong>{" "}
                {solicitud.color || "No registrado"}
              </p>

              <p>
                <strong>🔢 Placa:</strong>{" "}
                {solicitud.placa || "No registrada"}
              </p>

              <p>
                <strong>🧾 VIN:</strong>{" "}
                {solicitud.vin || "No registrado"}
              </p>

              <p>
                <strong>🛣 Millaje:</strong>{" "}
                {solicitud.millaje || "No registrado"}
              </p>

              <p>
                <strong>⚠️ Problema reportado:</strong>
                <br />
                {solicitud.problema || "No registrado"}
              </p>

              <label style={labelStyle}>🚦 Prioridad de la orden</label>

              <select
                value={prioridadSeleccionada[solicitud.id] || "normal"}
                onChange={(e) =>
                  setPrioridadSeleccionada({
                    ...prioridadSeleccionada,
                    [solicitud.id]: e.target.value
                  })
                }
                style={selectStyle}
              >
                <option value="urgente">🔴 Urgente</option>
                <option value="normal">🟡 Normal</option>
                <option value="programado">🟢 Programado</option>
              </select>

              <label style={labelStyle}>👨‍🔧 Mecánico para diagnóstico</label>

              <select
                value={mecanicoSeleccionado[solicitud.id] || ""}
                onChange={(e) =>
                  setMecanicoSeleccionado({
                    ...mecanicoSeleccionado,
                    [solicitud.id]: e.target.value
                  })
                }
                style={selectStyle}
              >
                <option value="">Seleccionar mecánico</option>
                {mecanicos.map((mecanico) => (
                  <option key={mecanico.id} value={mecanico.id}>
                    {mecanico.nombre} - {mecanico.tipo_pago}
                  </option>
                ))}
              </select>

              <p>
                <strong>📌 Estado:</strong>{" "}
                <span style={statusStyle}>
                  {solicitud.estado || "pendiente"}
                </span>
              </p>

              <button
                style={acceptButtonStyle}
                disabled={procesandoId === solicitud.id}
                onClick={() => aceptarYCrearCliente(solicitud)}
              >
                {procesandoId === solicitud.id
                  ? "Procesando..."
                  : "✅ Aceptar, Crear Cliente e Iniciar Diagnóstico"}
              </button>

              <button
                style={rejectButtonStyle}
                disabled={procesandoId === solicitud.id}
                onClick={() => rechazarSolicitud(solicitud)}
              >
                ❌ Rechazar Solicitud
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const headerStyle = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  marginBottom: "25px",
  gap: "20px"
};

const titleStyle = {
  color: "#f59e0b",
  marginBottom: "5px"
};

const buttonStyle = {
  padding: "12px 18px",
  background: "#f59e0b",
  color: "#111827",
  border: "none",
  borderRadius: "8px",
  fontWeight: "bold",
  cursor: "pointer"
};

const gridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
  gap: "20px"
};

const cardStyle = {
  background: "#1f2937",
  padding: "20px",
  borderRadius: "14px",
  border: "1px solid #374151",
  boxShadow: "0 10px 25px rgba(0,0,0,0.25)"
};

const lineStyle = {
  border: "none",
  borderTop: "1px solid #374151",
  margin: "15px 0"
};

const labelStyle = {
  display: "block",
  color: "#f59e0b",
  fontWeight: "bold",
  marginTop: "15px",
  marginBottom: "8px"
};

const selectStyle = {
  width: "100%",
  padding: "12px",
  marginBottom: "15px",
  borderRadius: "8px",
  border: "1px solid #374151",
  background: "#111827",
  color: "white",
  boxSizing: "border-box"
};

const statusStyle = {
  background: "#f59e0b",
  color: "#111827",
  padding: "4px 8px",
  borderRadius: "6px",
  fontWeight: "bold"
};

const acceptButtonStyle = {
  width: "100%",
  padding: "12px",
  marginTop: "15px",
  background: "#16a34a",
  color: "white",
  border: "none",
  borderRadius: "8px",
  cursor: "pointer",
  fontWeight: "bold"
};

const rejectButtonStyle = {
  width: "100%",
  padding: "12px",
  marginTop: "10px",
  background: "#dc2626",
  color: "white",
  border: "none",
  borderRadius: "8px",
  cursor: "pointer",
  fontWeight: "bold"
};

const emptyStyle = {
  background: "#1f2937",
  padding: "25px",
  borderRadius: "12px",
  border: "1px solid #374151",
  color: "#d1d5db"
};