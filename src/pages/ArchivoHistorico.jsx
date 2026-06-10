import { useEffect, useState } from "react";
import { supabase } from "../services/supabase";

function ArchivoHistorico() {
  const [clientes, setClientes] = useState([]);
  const [busqueda, setBusqueda] = useState("");
  const [cargando, setCargando] = useState(true);
  const [eliminandoId, setEliminandoId] = useState(null);

  useEffect(() => {
    cargarArchivo();
  }, []);

  const cargarArchivo = async () => {
    setCargando(true);

    const { data, error } = await supabase
      .from("clientes")
      .select("*")
      .eq("archivado", true)
      .order("archivado_en", { ascending: false });

    if (error) {
      console.log(error);
      alert("Error cargando archivo histórico");
      setCargando(false);
      return;
    }

    setClientes(data || []);
    setCargando(false);
  };

  const restaurarCliente = async (cliente) => {
    const confirmar = confirm(`¿Restaurar el historial de ${cliente.nombre}?`);

    if (!confirmar) return;

    const { error } = await supabase
      .from("clientes")
      .update({
        archivado: false,
        archivado_en: null
      })
      .eq("id", cliente.id);

    if (error) {
      console.log(error);
      alert(JSON.stringify(error, null, 2));
      return;
    }

    alert("Historial restaurado correctamente");
    cargarArchivo();
  };

  const eliminarDefinitivamente = async (cliente) => {
    const confirmar = confirm(
      `¿Seguro que deseas ELIMINAR DEFINITIVAMENTE a ${cliente.nombre}?\n\nSe eliminarán:\n- Cliente\n- Vehículos\n- Órdenes de trabajo\n- Tiempos de mecánicos\n- Estimados\n- Mecánicos asignados al cliente\n\nEsta acción NO se puede deshacer.`
    );

    if (!confirmar) return;

    const confirmarTexto = prompt(
      `Para confirmar escribe exactamente:\n\nELIMINAR`
    );

    if (confirmarTexto !== "ELIMINAR") {
      alert("Eliminación cancelada.");
      return;
    }

    setEliminandoId(cliente.id);

    const clienteId = cliente.id;

    const tablas = [
      "tiempos_mecanicos",
      "ordenes_trabajo",
      "estimados",
      "cliente_mecanicos",
      "vehiculos"
    ];

    for (const tabla of tablas) {
      const { error } = await supabase
        .from(tabla)
        .delete()
        .eq("cliente_id", clienteId);

      if (error) {
        console.log(`Error eliminando ${tabla}:`, error);
        alert(`Error eliminando datos de ${tabla}:\n${JSON.stringify(error, null, 2)}`);
        setEliminandoId(null);
        return;
      }
    }

    const { error: errorCliente } = await supabase
      .from("clientes")
      .delete()
      .eq("id", clienteId);

    setEliminandoId(null);

    if (errorCliente) {
      console.log(errorCliente);
      alert(JSON.stringify(errorCliente, null, 2));
      return;
    }

    alert("Cliente eliminado definitivamente.");
    cargarArchivo();
  };

  const clientesFiltrados = clientes.filter((cliente) => {
    const texto = busqueda.toLowerCase();

    return (
      (cliente.nombre || "").toLowerCase().includes(texto) ||
      (cliente.numero_factura || "").toLowerCase().includes(texto) ||
      (cliente.telefono || "").toLowerCase().includes(texto) ||
      (cliente.mecanico_principal || "").toLowerCase().includes(texto)
    );
  });

  return (
    <div>
      <h1 style={tituloStyle}>🗄 Archivo Histórico</h1>

      <input
        placeholder="Buscar por cliente, factura, teléfono o mecánico..."
        value={busqueda}
        onChange={(e) => setBusqueda(e.target.value)}
        style={searchStyle}
      />

      {cargando ? (
        <p>Cargando archivo...</p>
      ) : clientesFiltrados.length === 0 ? (
        <div style={emptyStyle}>No hay registros archivados.</div>
      ) : (
        <div style={gridStyle}>
          {clientesFiltrados.map((cliente) => (
            <div key={cliente.id} style={cardStyle}>
              <h2 style={{ color: "#f59e0b" }}>{cliente.nombre}</h2>

              <p>
                <strong>📄 Factura:</strong>{" "}
                {cliente.numero_factura || "No registrada"}
              </p>

              <p>
                <strong>📞 Teléfono:</strong>{" "}
                {cliente.telefono || "No registrado"}
              </p>

              <p>
                <strong>👨‍🔧 Mecánico:</strong>{" "}
                {cliente.mecanico_principal || "No registrado"}
              </p>

              <p>
                <strong>🛠 Trabajo:</strong>{" "}
                {cliente.trabajo_realizado || "No registrado"}
              </p>

              <p>
                <strong>💵 Compra piezas:</strong> $
                {Number(cliente.costo_piezas_compra || 0).toFixed(2)}
              </p>

              <p>
                <strong>💰 Venta piezas:</strong> $
                {Number(cliente.precio_piezas_cliente || 0).toFixed(2)}
              </p>

              <p>
                <strong>📈 Ganancia piezas:</strong> $
                {Number(cliente.ganancia_piezas || 0).toFixed(2)}
              </p>

              <p>
                <strong>🔧 Mano de obra:</strong> $
                {Number(cliente.costo_mano_obra || 0).toFixed(2)}
              </p>

              <p>
                <strong>💲 Total:</strong> $
                {Number(cliente.total_final || 0).toFixed(2)}
              </p>

              <button
                onClick={() => restaurarCliente(cliente)}
                style={restoreButton}
              >
                ♻ Restaurar al Historial
              </button>

              <button
                onClick={() => eliminarDefinitivamente(cliente)}
                disabled={eliminandoId === cliente.id}
                style={{
                  ...deleteButton,
                  opacity: eliminandoId === cliente.id ? 0.6 : 1,
                  cursor: eliminandoId === cliente.id ? "not-allowed" : "pointer"
                }}
              >
                {eliminandoId === cliente.id
                  ? "Eliminando..."
                  : "🗑 Eliminar Definitivamente"}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const tituloStyle = {
  color: "#f59e0b",
  marginBottom: "20px"
};

const searchStyle = {
  width: "100%",
  padding: "12px",
  marginBottom: "25px",
  borderRadius: "10px",
  border: "1px solid #374151",
  background: "#1f2937",
  color: "white"
};

const gridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit,minmax(320px,1fr))",
  gap: "20px"
};

const cardStyle = {
  background: "#1f2937",
  padding: "20px",
  borderRadius: "14px",
  border: "1px solid #374151"
};

const restoreButton = {
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

const deleteButton = {
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
  padding: "20px",
  borderRadius: "12px"
};

export default ArchivoHistorico;