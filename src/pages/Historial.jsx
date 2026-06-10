import { useEffect, useMemo, useState } from "react";
import { supabase } from "../services/supabase";

function Historial() {
  const [trabajos, setTrabajos] = useState([]);
  const [clientesMap, setClientesMap] = useState({});
  const [facturasMap, setFacturasMap] = useState({});
  const [busqueda, setBusqueda] = useState("");
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    cargarHistorial();
  }, []);

  const dinero = (valor) => `$${Number(valor || 0).toFixed(2)}`;

  const convertirFechaSupabase = (valor) => {
    if (!valor) return null;
    const texto = String(valor);
    if (texto.endsWith("Z") || texto.includes("+")) return new Date(texto);
    return new Date(texto + "Z");
  };

  const formatearFecha = (fecha) => {
    const f = convertirFechaSupabase(fecha);
    if (!f || Number.isNaN(f.getTime())) return "-";

    return f.toLocaleString("en-US", {
      timeZone: "America/New_York",
      month: "numeric",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      second: "2-digit",
      hour12: true
    });
  };

  const redondearDinero = (valor) => Math.round(Number(valor || 0) * 100) / 100;

  const calcularTotales = (trabajo) => {
    const costoPiezas = Number(trabajo.costo_piezas || 0);
    const ventaPiezas = Number(trabajo.venta_piezas || 0);
    const manoObra = Number(trabajo.mano_obra || 0);

    const taxPiezas6 = redondearDinero(ventaPiezas * 0.06);
    const subtotalBase = redondearDinero(ventaPiezas + taxPiezas6 + manoObra);
    const cargoGeneral4 = redondearDinero(subtotalBase * 0.04);
    const totalGenerado = redondearDinero(subtotalBase + cargoGeneral4);
    const gananciaPiezas = redondearDinero((ventaPiezas - costoPiezas) + taxPiezas6);
    const gananciaAprox = redondearDinero(totalGenerado - costoPiezas);

    return {
      costoPiezas,
      ventaPiezas,
      manoObra,
      taxPiezas6,
      cargoGeneral4,
      totalGenerado: Number(trabajo.total_generado || 0) || totalGenerado,
      gananciaPiezas: Number(trabajo.ganancia_piezas || 0) || gananciaPiezas,
      gananciaAprox
    };
  };

  const parsearArray = (valor) => {
    if (Array.isArray(valor)) return valor;
    if (!valor) return [];

    try {
      const parsed = JSON.parse(valor);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  };

  const normalizarPieza = (pieza, index = 0) => ({
    id: pieza.id || `pieza-${index}`,
    nombre: String(pieza.nombre || pieza.name || `Pieza ${index + 1}`),
    cantidad: Number(pieza.cantidad || pieza.qty || 1),
    costo: Number(pieza.costo || pieza.costo_interno || 0),
    venta: Number(
      pieza.venta ??
      pieza.precio_venta ??
      pieza.precio_cliente ??
      pieza.precio ??
      0
    )
  });

  const normalizarServicio = (servicio, index = 0) => ({
    id: servicio.id || `servicio-${index}`,
    nombre: String(servicio.nombre || servicio.servicio || `Servicio ${index + 1}`),
    precio: Number(servicio.precio ?? servicio.mano_obra ?? servicio.valor ?? 0)
  });

  const cargarHistorial = async () => {
    setCargando(true);

    const { data: clientesData, error: errorClientes } = await supabase
      .from("clientes")
      .select("*");

    if (errorClientes) {
      console.log(errorClientes);
      alert("Error cargando clientes del historial.");
      setCargando(false);
      return;
    }

    const mapaClientes = {};
    (clientesData || []).forEach((cliente) => {
      mapaClientes[cliente.id] = cliente;
    });

    const { data: trabajosData, error: errorTrabajos } = await supabase
      .from("trabajos_mecanicos")
      .select("*")
      .or("estado.eq.finalizado,hora_fin.not.is.null")
      .order("hora_fin", { ascending: false });

    if (errorTrabajos) {
      console.log(errorTrabajos);
      alert("Error cargando trabajos finalizados.");
      setCargando(false);
      return;
    }

    const trabajosFinalizados = (trabajosData || []).filter((trabajo) => {
      const cliente = trabajo.cliente_id ? mapaClientes[trabajo.cliente_id] : null;
      return !cliente?.archivado;
    });

    const idsTrabajos = trabajosFinalizados.map((trabajo) => trabajo.id);

    let mapaFacturas = {};
    if (idsTrabajos.length > 0) {
      const { data: facturasData, error: errorFacturas } = await supabase
        .from("fotos_trabajos_mecanicos")
        .select("*")
        .in("trabajo_id", idsTrabajos)
        .order("id", { ascending: false });

      if (errorFacturas) {
        console.log(errorFacturas);
        alert("Los trabajos cargaron, pero hubo un error cargando fotos/facturas de compras.");
      } else {
        (facturasData || []).forEach((factura) => {
          if (!mapaFacturas[factura.trabajo_id]) mapaFacturas[factura.trabajo_id] = [];
          mapaFacturas[factura.trabajo_id].push(factura);
        });
      }
    }

    setClientesMap(mapaClientes);
    setFacturasMap(mapaFacturas);
    setTrabajos(trabajosFinalizados);
    setCargando(false);
  };

  const archivarHistorial = async (trabajo) => {
    const cliente = trabajo.cliente_id ? clientesMap[trabajo.cliente_id] : null;

    if (!cliente?.id) {
      alert("Este trabajo no tiene cliente_id conectado. No se puede archivar desde clientes.");
      return;
    }

    const confirmar = confirm(
      `¿Archivar el historial de ${cliente.nombre || trabajo.cliente_nombre}? Ya no aparecerá aquí, pero seguirá guardado en Supabase.`
    );

    if (!confirmar) return;

    const { error } = await supabase
      .from("clientes")
      .update({
        archivado: true,
        archivado_en: new Date().toISOString()
      })
      .eq("id", cliente.id);

    if (error) {
      console.log(error);
      alert(JSON.stringify(error, null, 2));
      return;
    }

    alert("Historial archivado correctamente.");
    await cargarHistorial();
  };

  const trabajosFiltrados = useMemo(() => {
    const texto = busqueda.toLowerCase().trim();

    if (!texto) return trabajos;

    return trabajos.filter((trabajo) => {
      const cliente = trabajo.cliente_id ? clientesMap[trabajo.cliente_id] : null;
      const piezas = parsearArray(trabajo.estimado_piezas).map(normalizarPieza);
      const servicios = parsearArray(trabajo.estimado_servicios).map(normalizarServicio);

      const contenido = [
        trabajo.numero_factura,
        trabajo.cliente_nombre,
        cliente?.nombre,
        cliente?.telefono,
        trabajo.vehiculo,
        trabajo.mecanico_nombre,
        trabajo.trabajo,
        trabajo.resultado_diagnostico,
        trabajo.orden_id,
        trabajo.id,
        ...piezas.map((pieza) => pieza.nombre),
        ...servicios.map((servicio) => servicio.nombre)
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return contenido.includes(texto);
    });
  }, [busqueda, trabajos, clientesMap]);

  return (
    <div>
      <h1 style={tituloStyle}>📁 Historial Completo de Trabajos</h1>

      <p style={subtituloStyle}>
        Aquí quedan registrados los trabajos finalizados con cliente, vehículo, mecánico, estimado, factura, firma, piezas, servicios y cobros.
      </p>

      <input
        placeholder="Buscar por cliente, factura, teléfono, vehículo, pieza, servicio o mecánico..."
        value={busqueda}
        onChange={(e) => setBusqueda(e.target.value)}
        style={searchStyle}
      />

      {cargando ? (
        <p>Cargando historial...</p>
      ) : trabajosFiltrados.length === 0 ? (
        <div style={emptyStyle}>No se encontraron registros.</div>
      ) : (
        <div style={gridStyle}>
          {trabajosFiltrados.map((trabajo) => {
            const cliente = trabajo.cliente_id ? clientesMap[trabajo.cliente_id] : null;
            const piezas = parsearArray(trabajo.estimado_piezas).map(normalizarPieza);
            const servicios = parsearArray(trabajo.estimado_servicios).map(normalizarServicio);
            const facturas = facturasMap[trabajo.id] || [];
            const totales = calcularTotales(trabajo);

            return (
              <div key={trabajo.id} style={cardStyle}>
                <div style={headerRow}>
                  <div>
                    <h2 style={clienteTitle}>
                      {trabajo.cliente_nombre || cliente?.nombre || "Cliente no registrado"}
                    </h2>
                    <p style={mutedText}>Trabajo #{trabajo.id} {trabajo.orden_id ? `• Orden #${trabajo.orden_id}` : ""}</p>
                  </div>

                  <span style={statusBadge}>Finalizado</span>
                </div>

                <div style={sectionBox}>
                  <h3 style={sectionMiniTitle}>👤 Cliente y vehículo</h3>
                  <p><strong>Teléfono:</strong> {cliente?.telefono || trabajo.cliente_telefono || "No registrado"}</p>
                  <p><strong>Vehículo:</strong> {trabajo.vehiculo || "No registrado"}</p>
                  <p><strong>Origen:</strong> {trabajo.origen || "No registrado"}</p>
                </div>

                <div style={sectionBox}>
                  <h3 style={sectionMiniTitle}>👨‍🔧 Trabajo</h3>
                  <p><strong>Mecánico:</strong> {trabajo.mecanico_nombre || "No registrado"}</p>
                  <p><strong>Trabajo solicitado:</strong> {trabajo.trabajo || "No registrado"}</p>
                  <p><strong>Resultado diagnóstico:</strong> {trabajo.resultado_diagnostico || "No registrado"}</p>
                  <p><strong>Diagnóstico:</strong> {Number(trabajo.diagnostico_minutos || 0)} min</p>
                  <p><strong>Reparación:</strong> {Number(trabajo.reparacion_minutos || 0)} min</p>
                  <p><strong>Tiempo total:</strong> {Number(trabajo.minutos_trabajados || 0)} min</p>
                </div>

                <div style={sectionBox}>
                  <h3 style={sectionMiniTitle}>📋 Estimado / aprobación</h3>
                  <p><strong>Estado estimado:</strong> {trabajo.estimado_estado || "No registrado"}</p>
                  <p><strong>Creado:</strong> {formatearFecha(trabajo.estimado_creado_en)}</p>
                  <p><strong>Aprobado en taller:</strong> {formatearFecha(trabajo.estimado_aprobado_en)}</p>
                  <p><strong>Aprobado por cliente:</strong> {trabajo.estimado_aprobado_cliente ? "Sí" : "No"}</p>
                  <p><strong>Firmado por:</strong> {trabajo.estimado_firmado_nombre || "No registrado"}</p>
                  <p><strong>Firma fecha:</strong> {formatearFecha(trabajo.estimado_firmado_en)}</p>

                  <div style={linksRow}>
                    {trabajo.estimado_pdf_url && (
                      <a href={trabajo.estimado_pdf_url} target="_blank" rel="noreferrer" style={linkButton}>
                        📄 Ver estimado PDF
                      </a>
                    )}

                    {trabajo.estimado_firma_url && (
                      <a href={trabajo.estimado_firma_url} target="_blank" rel="noreferrer" style={linkButton}>
                        ✍️ Ver firma
                      </a>
                    )}
                  </div>

                  {trabajo.estimado_firma_url && (
                    <img src={trabajo.estimado_firma_url} alt="Firma del cliente" style={firmaPreview} />
                  )}
                </div>

                <div style={sectionBox}>
                  <h3 style={sectionMiniTitle}>🔧 Servicios / mano de obra</h3>

                  {servicios.length === 0 ? (
                    <p>No hay servicios desglosados. Mano de obra total: {dinero(trabajo.mano_obra)}</p>
                  ) : (
                    <div style={detailList}>
                      {servicios.map((servicio, index) => (
                        <div key={servicio.id || index} style={detailRow}>
                          <span>{servicio.nombre}</span>
                          <strong>{dinero(servicio.precio)}</strong>
                        </div>
                      ))}
                    </div>
                  )}

                  <div style={totalLine}>
                    <span>Total mano de obra</span>
                    <strong>{dinero(totales.manoObra)}</strong>
                  </div>
                </div>

                <div style={sectionBox}>
                  <h3 style={sectionMiniTitle}>📦 Piezas</h3>

                  {piezas.length === 0 ? (
                    <p>No hay piezas desglosadas.</p>
                  ) : (
                    <div style={detailList}>
                      {piezas.map((pieza, index) => {
                        const subtotal = Number(pieza.venta || 0) * Number(pieza.cantidad || 1);
                        const totalCliente = redondearDinero(subtotal * 1.06);

                        return (
                          <div key={pieza.id || index} style={detailRow}>
                            <span>{pieza.cantidad} x {pieza.nombre}</span>
                            <strong>{dinero(totalCliente)}</strong>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  <div style={totalLine}>
                    <span>Venta piezas</span>
                    <strong>{dinero(totales.ventaPiezas)}</strong>
                  </div>
                  <div style={totalLine}>
                    <span>Tax piezas 6%</span>
                    <strong>{dinero(totales.taxPiezas6)}</strong>
                  </div>
                </div>

                <div style={sectionBox}>
                  <h3 style={sectionMiniTitle}>💵 Factura y cobros</h3>
                  <p><strong>Factura:</strong> {trabajo.numero_factura || "No registrada"}</p>
                  <p><strong>Factura creada:</strong> {formatearFecha(trabajo.factura_creada_en)}</p>
                  <p><strong>Finalizado:</strong> {formatearFecha(trabajo.hora_fin)}</p>

                  <div style={moneyGrid}>
                    <MoneyItem label="Compra piezas" value={totales.costoPiezas} />
                    <MoneyItem label="Venta piezas" value={totales.ventaPiezas} />
                    <MoneyItem label="Tax piezas 6%" value={totales.taxPiezas6} />
                    <MoneyItem label="Mano de obra" value={totales.manoObra} />
                    <MoneyItem label="Cargo general 4%" value={totales.cargoGeneral4} />
                    <MoneyItem label="Ganancia piezas" value={totales.gananciaPiezas} />
                    <MoneyItem label="Total cobrado" value={totales.totalGenerado} strong />
                    <MoneyItem label="Ganancia aprox." value={totales.gananciaAprox} strong />
                  </div>

                  <div style={linksRow}>
                    {trabajo.factura_pdf_url && (
                      <a href={trabajo.factura_pdf_url} target="_blank" rel="noreferrer" style={linkButton}>
                        🧾 Ver factura PDF
                      </a>
                    )}
                  </div>
                </div>

                <div style={sectionBox}>
                  <h3 style={sectionMiniTitle}>🧾 Facturas / compras subidas</h3>

                  {facturas.length === 0 ? (
                    <p>No hay archivos subidos.</p>
                  ) : (
                    <div style={linksRow}>
                      {facturas.map((factura, index) => (
                        <a
                          key={factura.id || index}
                          href={factura.url}
                          target="_blank"
                          rel="noreferrer"
                          style={linkButton}
                        >
                          📎 Archivo {index + 1}
                        </a>
                      ))}
                    </div>
                  )}
                </div>

                <button
                  onClick={() => archivarHistorial(trabajo)}
                  style={archiveButton}
                >
                  📦 Archivar Historial
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function MoneyItem({ label, value, strong = false }) {
  return (
    <div style={moneyItem}>
      <span>{label}</span>
      <strong style={{ color: strong ? "#22c55e" : "#f59e0b" }}>
        ${Number(value || 0).toFixed(2)}
      </strong>
    </div>
  );
}

const tituloStyle = {
  color: "#f59e0b",
  marginBottom: "8px"
};

const subtituloStyle = {
  color: "#d1d5db",
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
  gridTemplateColumns: "repeat(auto-fit,minmax(420px,1fr))",
  gap: "20px"
};

const cardStyle = {
  background: "rgba(31, 41, 55, 0.96)",
  padding: "20px",
  borderRadius: "14px",
  border: "1px solid #374151",
  boxShadow: "0 10px 25px rgba(0,0,0,0.25)"
};

const headerRow = {
  display: "flex",
  justifyContent: "space-between",
  gap: "12px",
  alignItems: "flex-start"
};

const clienteTitle = {
  color: "#f59e0b",
  margin: 0
};

const mutedText = {
  color: "#9ca3af",
  marginTop: "6px"
};

const statusBadge = {
  background: "#16a34a",
  color: "white",
  padding: "6px 10px",
  borderRadius: "999px",
  fontSize: "12px",
  fontWeight: "bold"
};

const sectionBox = {
  marginTop: "16px",
  padding: "14px",
  borderRadius: "12px",
  border: "1px solid #374151",
  background: "rgba(17, 24, 39, 0.75)"
};

const sectionMiniTitle = {
  color: "#f59e0b",
  marginTop: 0,
  marginBottom: "10px"
};

const detailList = {
  display: "grid",
  gap: "8px"
};

const detailRow = {
  display: "flex",
  justifyContent: "space-between",
  gap: "12px",
  borderBottom: "1px solid #374151",
  paddingBottom: "6px"
};

const totalLine = {
  display: "flex",
  justifyContent: "space-between",
  gap: "12px",
  marginTop: "10px",
  paddingTop: "10px",
  borderTop: "1px solid #f59e0b",
  color: "#f59e0b"
};

const moneyGrid = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))",
  gap: "10px",
  marginTop: "12px"
};

const moneyItem = {
  background: "#111827",
  border: "1px solid #374151",
  borderRadius: "10px",
  padding: "10px",
  display: "flex",
  justifyContent: "space-between",
  gap: "8px"
};

const linksRow = {
  display: "flex",
  flexWrap: "wrap",
  gap: "10px",
  marginTop: "10px"
};

const linkButton = {
  display: "inline-block",
  padding: "9px 12px",
  borderRadius: "8px",
  background: "#2563eb",
  color: "white",
  textDecoration: "none",
  fontWeight: "bold"
};

const firmaPreview = {
  marginTop: "12px",
  maxWidth: "260px",
  width: "100%",
  background: "white",
  borderRadius: "10px",
  padding: "8px"
};

const archiveButton = {
  width: "100%",
  padding: "12px",
  marginTop: "15px",
  background: "#6b7280",
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

export default Historial;
