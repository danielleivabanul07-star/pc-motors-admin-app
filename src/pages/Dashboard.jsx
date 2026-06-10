import { useEffect, useState } from "react";
import { supabase } from "../services/supabase";

function Dashboard() {
  const [stats, setStats] = useState({
    clientesActivos: 0,
    clientesAtendidos: 0,
    vehiculosActivos: 0,
    trabajosActivos: 0,
    semana: {},
    mes: {},
    trabajosSemana: [],
    trabajosMes: [],
    trabajosMecanicosSemana: [],
    trabajosMecanicosMes: []
  });

  const [ocultarTrabajosSemana, setOcultarTrabajosSemana] = useState(false);
  const [refrescando, setRefrescando] = useState(false);

  useEffect(() => {
    cargarDashboard(false);
  }, []);

  useEffect(() => {
    const canal = supabase
      .channel("dashboard-tiempo-real")
      .on("postgres_changes", { event: "*", schema: "public", table: "clientes" }, () => cargarDashboard(false))
      .on("postgres_changes", { event: "*", schema: "public", table: "vehiculos" }, () => cargarDashboard(false))
      .on("postgres_changes", { event: "*", schema: "public", table: "trabajos_mecanicos" }, () => cargarDashboard(false))
      .on("postgres_changes", { event: "*", schema: "public", table: "facturas_trabajos" }, () => cargarDashboard(false))
      .on("postgres_changes", { event: "*", schema: "public", table: "reportes_financieros" }, () => cargarDashboard(false))
      .subscribe();

    return () => {
      supabase.removeChannel(canal);
    };
  }, []);

  const dinero = (valor) => `$${Number(valor || 0).toFixed(2)}`;

  const convertirFechaSupabase = (valor) => {
    if (!valor) return null;
    const texto = String(valor);
    if (texto.endsWith("Z") || texto.includes("+")) return new Date(texto);
    return new Date(texto + "Z");
  };

  const inicioSemana = () => {
    const hoy = new Date();
    const dia = hoy.getDay();
    const diferencia = dia === 0 ? 6 : dia - 1;
    const inicio = new Date(hoy);
    inicio.setDate(hoy.getDate() - diferencia);
    inicio.setHours(0, 0, 0, 0);
    return inicio;
  };

  const inicioMes = () => {
    const hoy = new Date();
    return new Date(hoy.getFullYear(), hoy.getMonth(), 1);
  };

  const redondearDinero = (valor) => Math.round(Number(valor || 0) * 100) / 100;

  const totalesVacios = () => ({
    inversionPiezas: 0,
    ventaPiezas: 0,
    taxPiezas6: 0,
    cargoGeneral4: 0,
    gananciaPiezas: 0,
    manoObra: 0,
    impuestos: 0,
    descuentos: 0,
    totalCobrado: 0,
    gananciaAprox: 0,
    porMetodoPago: {}
  });

  const calcularTotalesClientes = (clientes) => {
    return clientes.reduce((total, cliente) => {
      total.inversionPiezas += Number(cliente.costo_piezas_compra || 0);
      total.ventaPiezas += Number(cliente.precio_piezas_cliente || 0);
      total.gananciaPiezas += Number(cliente.ganancia_piezas || 0);
      total.manoObra += Number(cliente.costo_mano_obra || 0);
      total.impuestos += Number(cliente.impuestos || 0);
      total.descuentos += Number(cliente.descuento || 0);
      total.totalCobrado += Number(cliente.total_final || 0);
      total.gananciaAprox += Number(cliente.total_final || 0) - Number(cliente.costo_piezas_compra || 0);
      return total;
    }, totalesVacios());
  };

  const calcularTotalesTrabajosMecanicos = (trabajos) => {
    return trabajos.reduce((total, trabajo) => {
      const inversionPiezas = Number(trabajo.costo_piezas || 0);
      const ventaPiezas = Number(trabajo.venta_piezas || 0);
      const manoObra = Number(trabajo.mano_obra || 0);

      // Estos dos cargos se calculan igual que en Control Trabajos:
      // 6% sobre las piezas vendidas y 4% sobre piezas + mano de obra + cargo piezas.
      const taxPiezas6 = redondearDinero(ventaPiezas * 0.06);
      const subtotalBase = redondearDinero(ventaPiezas + manoObra + taxPiezas6);
      const cargoGeneral4 = redondearDinero(subtotalBase * 0.04);
      const totalGeneradoCalculado = redondearDinero(subtotalBase + cargoGeneral4);
      const totalGenerado = Number(trabajo.total_generado || totalGeneradoCalculado);
      const gananciaPiezas = Number(trabajo.ganancia_piezas || redondearDinero((ventaPiezas - inversionPiezas) + taxPiezas6));

      total.inversionPiezas += inversionPiezas;
      total.ventaPiezas += ventaPiezas;
      total.taxPiezas6 += taxPiezas6;
      total.cargoGeneral4 += cargoGeneral4;
      total.gananciaPiezas += gananciaPiezas;
      total.manoObra += manoObra;
      total.impuestos += taxPiezas6 + cargoGeneral4;
      total.totalCobrado += totalGenerado;
      total.gananciaAprox += totalGenerado - inversionPiezas;

      const metodoPago = trabajo.metodo_pago || "No registrado";
      total.porMetodoPago[metodoPago] = Number(total.porMetodoPago[metodoPago] || 0) + totalGenerado;

      return total;
    }, totalesVacios());
  };

  const sumarTotales = (a, b) => ({
    inversionPiezas: Number(a.inversionPiezas || 0) + Number(b.inversionPiezas || 0),
    ventaPiezas: Number(a.ventaPiezas || 0) + Number(b.ventaPiezas || 0),
    taxPiezas6: Number(a.taxPiezas6 || 0) + Number(b.taxPiezas6 || 0),
    cargoGeneral4: Number(a.cargoGeneral4 || 0) + Number(b.cargoGeneral4 || 0),
    gananciaPiezas: Number(a.gananciaPiezas || 0) + Number(b.gananciaPiezas || 0),
    manoObra: Number(a.manoObra || 0) + Number(b.manoObra || 0),
    impuestos: Number(a.impuestos || 0) + Number(b.impuestos || 0),
    descuentos: Number(a.descuentos || 0) + Number(b.descuentos || 0),
    totalCobrado: Number(a.totalCobrado || 0) + Number(b.totalCobrado || 0),
    gananciaAprox: Number(a.gananciaAprox || 0) + Number(b.gananciaAprox || 0),
    porMetodoPago: {
      ...(a.porMetodoPago || {}),
      ...Object.fromEntries(
        Object.entries(b.porMetodoPago || {}).map(([metodo, valor]) => [
          metodo,
          Number(a.porMetodoPago?.[metodo] || 0) + Number(valor || 0)
        ])
      )
    }
  });

  const fechaTrabajoMecanico = (trabajo) => {
    return convertirFechaSupabase(trabajo.factura_creada_en || trabajo.hora_fin || trabajo.creado_en || trabajo.hora_inicio);
  };

  const obtenerRangoFechasReales = (clientes, trabajosMecanicos = []) => {
    const fechas = [];

    clientes.forEach((cliente) => {
      if (cliente.finalizado_en) fechas.push(convertirFechaSupabase(cliente.finalizado_en));
    });

    trabajosMecanicos.forEach((trabajo) => {
      const fecha = fechaTrabajoMecanico(trabajo);
      if (fecha) fechas.push(fecha);
    });

    const validas = fechas.filter((fecha) => fecha && !Number.isNaN(fecha.getTime())).sort((a, b) => a - b);

    if (validas.length === 0) {
      return { fechaInicio: "", fechaFin: "" };
    }

    return {
      fechaInicio: validas[0].toISOString().slice(0, 10),
      fechaFin: validas[validas.length - 1].toISOString().slice(0, 10)
    };
  };

  async function cargarDashboard(mostrarAlerta = true) {
    setRefrescando(true);

    const { count: clientesActivos, error: errorActivos } = await supabase
      .from("clientes")
      .select("*", { count: "exact", head: true })
      .eq("estado", "activo");

    if (errorActivos) {
      console.log(errorActivos);
      alert("Error cargando clientes activos");
      setRefrescando(false);
      return;
    }

    const { count: clientesAtendidos, error: errorAtendidos } = await supabase
      .from("clientes")
      .select("*", { count: "exact", head: true })
      .eq("estado", "finalizado");

    if (errorAtendidos) {
      console.log(errorAtendidos);
      alert("Error cargando clientes atendidos");
      setRefrescando(false);
      return;
    }

    const { data: activos, error: errorIdsActivos } = await supabase
      .from("clientes")
      .select("id")
      .eq("estado", "activo");

    if (errorIdsActivos) {
      console.log(errorIdsActivos);
      alert("Error cargando IDs de clientes activos");
      setRefrescando(false);
      return;
    }

    const idsActivos = activos?.map((c) => c.id) || [];
    let vehiculosActivos = 0;

    if (idsActivos.length > 0) {
      const { count, error: errorVehiculos } = await supabase
        .from("vehiculos")
        .select("*", { count: "exact", head: true })
        .in("cliente_id", idsActivos);

      if (errorVehiculos) {
        console.log(errorVehiculos);
        alert("Error cargando vehículos activos");
        setRefrescando(false);
        return;
      }

      vehiculosActivos = count || 0;
    }

    const { data: finalizados, error: errorFinalizados } = await supabase
      .from("clientes")
      .select("*")
      .eq("estado", "finalizado");

    if (errorFinalizados) {
      console.log(errorFinalizados);
      alert("Error cargando clientes finalizados");
      setRefrescando(false);
      return;
    }

    const { data: trabajosMecanicosRaw, error: errorTrabajosMecanicos } = await supabase
      .from("trabajos_mecanicos")
      .select("*");

    const trabajosMecanicos = trabajosMecanicosRaw || [];

    // Trabajos abiertos: se usan solo para contar clientes/vehículos/trabajos en proceso.
    const trabajosMecanicosActivos = trabajosMecanicos.filter(
      (trabajo) => trabajo.estado !== "finalizado" && !trabajo.hora_fin
    );

    // Trabajos finalizados: son los únicos que cuentan dinero en el Dashboard.
    // Así no se muestran ingresos, ganancias ni mano de obra de trabajos aún abiertos.
    const trabajosMecanicosFinalizados = trabajosMecanicos.filter(
      (trabajo) => trabajo.estado === "finalizado" || Boolean(trabajo.hora_fin)
    );

    if (errorTrabajosMecanicos) {
      console.log(errorTrabajosMecanicos);
      alert("Error cargando trabajos mecánicos");
      setRefrescando(false);
      return;
    }

    const inicioSemanaActual = inicioSemana();
    const inicioMesActual = inicioMes();

    const trabajosSemana = [];
    const trabajosMes = [];

    const trabajosMecanicosSemana =
      trabajosMecanicosFinalizados.filter((trabajo) => {
        const fecha = fechaTrabajoMecanico(trabajo);
        return fecha && fecha >= inicioSemanaActual;
      }) || [];

    const trabajosMecanicosMes =
      trabajosMecanicosFinalizados.filter((trabajo) => {
        const fecha = fechaTrabajoMecanico(trabajo);
        return fecha && fecha >= inicioMesActual;
      }) || [];

    const semana = calcularTotalesTrabajosMecanicos(trabajosMecanicosSemana);
    const mes = calcularTotalesTrabajosMecanicos(trabajosMecanicosMes);

    const clientesActivosDesdeTrabajos = new Set(
      trabajosMecanicosActivos
        .map((trabajo) => trabajo.cliente_id || `trabajo-${trabajo.id}`)
        .filter(Boolean)
    ).size;

    const vehiculosActivosDesdeTrabajos = new Set(
      trabajosMecanicosActivos
        .map((trabajo) => trabajo.vehiculo_id || `trabajo-${trabajo.id}`)
        .filter(Boolean)
    ).size;

    const clientesEnProceso = Math.max(clientesActivos || 0, clientesActivosDesdeTrabajos);
    const vehiculosEnProceso = Math.max(vehiculosActivos || 0, vehiculosActivosDesdeTrabajos);

    setStats({
      clientesActivos: clientesEnProceso,
      clientesAtendidos: clientesAtendidos || 0,
      vehiculosActivos: vehiculosEnProceso,
      trabajosActivos: trabajosMecanicosActivos.length,
      semana,
      mes,
      trabajosSemana,
      trabajosMes,
      trabajosMecanicosSemana,
      trabajosMecanicosMes
    });

    setOcultarTrabajosSemana(false);
    setRefrescando(false);

    if (mostrarAlerta) alert("Dashboard actualizado correctamente.");
  }

  const guardarReporte = async (tipo) => {
    const esSemanal = tipo === "semanal";
    const trabajos = esSemanal ? stats.trabajosSemana : stats.trabajosMes;
    const trabajosMecanicos = esSemanal ? stats.trabajosMecanicosSemana : stats.trabajosMecanicosMes;
    const totales = esSemanal ? stats.semana : stats.mes;
    const totalRegistros = trabajosMecanicos.length;

    if (totalRegistros === 0) {
      alert(esSemanal ? "No hay trabajos esta semana para guardar reporte." : "No hay trabajos este mes para guardar reporte.");
      return;
    }

    const { fechaInicio, fechaFin } = obtenerRangoFechasReales([], trabajosMecanicos);

    const reporte = {
      tipo,
      fecha_inicio: fechaInicio,
      fecha_fin: fechaFin,
      total_clientes: totalRegistros,
      inversion_piezas: Number(totales.inversionPiezas || 0),
      venta_piezas: Number(totales.ventaPiezas || 0),
      ganancia_piezas: Number(totales.gananciaPiezas || 0),
      mano_obra: Number(totales.manoObra || 0),
      impuestos: Number(totales.impuestos || 0),
      descuentos: Number(totales.descuentos || 0),
      total_cobrado: Number(totales.totalCobrado || 0),
      ganancia_aprox: Number(totales.gananciaAprox || 0)
    };

    const { error } = await supabase.from("reportes_financieros").insert([reporte]);

    if (error) {
      console.log(error);
      alert(JSON.stringify(error, null, 2));
      return;
    }

    alert(tipo === "semanal" ? "Reporte semanal guardado correctamente" : "Reporte mensual guardado correctamente");
  };

  const limpiarVistaDashboard = () => {
    const totalVisible = stats.trabajosSemana.length + stats.trabajosMecanicosSemana.length;

    if (totalVisible === 0) {
      alert("No hay trabajos visibles para limpiar.");
      return;
    }

    const confirmar = confirm("Esto solo ocultará la lista visible de trabajos de esta semana. No borra clientes, historial ni reportes. ¿Continuar?");
    if (!confirmar) return;

    setOcultarTrabajosSemana(true);
    alert("Vista del Dashboard limpiada correctamente.");
  };

  return (
    <div style={pageBox}>
      <h1 style={titleStyle}>📊 Dashboard Financiero</h1>
      <p style={subtitleStyle}>Resumen de clientes activos, trabajos atendidos, trabajos mecánicos, ganancias y cobros.</p>

      <div style={actionsBox}>
        <button onClick={() => guardarReporte("semanal")} style={saveButton}>💾 Guardar Reporte Semanal</button>
        <button onClick={() => guardarReporte("mensual")} style={saveButton}>💾 Guardar Reporte Mensual</button>
        <button onClick={limpiarVistaDashboard} style={cleanButton}>🧹 Limpiar Vista Dashboard</button>
        <button
          onClick={() => cargarDashboard(true)}
          style={{ ...refreshButton, opacity: refrescando ? 0.7 : 1, cursor: refrescando ? "not-allowed" : "pointer" }}
          disabled={refrescando}
        >
          {refrescando ? "Refrescando..." : "🔄 Refrescar"}
        </button>
      </div>

      <div style={gridStyle}>
        <Card title="👥 Clientes en proceso" value={stats.clientesActivos} />
        <Card title="🚗 Vehículos en proceso" value={stats.vehiculosActivos} />
        <Card title="📁 Clientes atendidos" value={stats.clientesAtendidos} />
        <Card title="🛠 Trabajos activos" value={stats.trabajosActivos} />
        <Card title="💰 Cobrado esta semana" value={dinero(stats.semana.totalCobrado)} />
      </div>

      <h2 style={sectionTitle}>📅 Resumen de esta semana</h2>
      <div style={gridStyle}>
        <Card title="🧾 Inversión piezas" value={dinero(stats.semana.inversionPiezas)} />
        <Card title="💵 Venta piezas" value={dinero(stats.semana.ventaPiezas)} />
        <Card title="🧾 Tax piezas 6%" value={dinero(stats.semana.taxPiezas6)} />
        <Card title="💳 Cargo general 4%" value={dinero(stats.semana.cargoGeneral4)} />
        <Card title="📈 Ganancia piezas" value={dinero(stats.semana.gananciaPiezas)} />
        <Card title="🔧 Mano de obra" value={dinero(stats.semana.manoObra)} />
        <Card title="💲 Total cobrado" value={dinero(stats.semana.totalCobrado)} />
        <Card title="✅ Ganancia aprox." value={dinero(stats.semana.gananciaAprox)} />
      </div>

      <h2 style={sectionTitle}>💳 Cobros por método esta semana</h2>
      <div style={gridStyle}>
        {Object.entries(stats.semana.porMetodoPago || {}).length === 0 ? (
          <Card title="Sin cobros registrados" value="$0.00" />
        ) : (
          Object.entries(stats.semana.porMetodoPago || {}).map(([metodo, total]) => (
            <Card key={metodo} title={`💳 ${metodo}`} value={dinero(total)} />
          ))
        )}
      </div>

      <h2 style={sectionTitle}>🗓 Resumen de este mes</h2>
      <div style={gridStyle}>
        <Card title="🧾 Inversión piezas" value={dinero(stats.mes.inversionPiezas)} />
        <Card title="💵 Venta piezas" value={dinero(stats.mes.ventaPiezas)} />
        <Card title="🧾 Tax piezas 6%" value={dinero(stats.mes.taxPiezas6)} />
        <Card title="💳 Cargo general 4%" value={dinero(stats.mes.cargoGeneral4)} />
        <Card title="📈 Ganancia piezas" value={dinero(stats.mes.gananciaPiezas)} />
        <Card title="🔧 Mano de obra" value={dinero(stats.mes.manoObra)} />
        <Card title="💲 Total cobrado" value={dinero(stats.mes.totalCobrado)} />
        <Card title="✅ Ganancia aprox." value={dinero(stats.mes.gananciaAprox)} />
      </div>

      <h2 style={sectionTitle}>💳 Cobros por método este mes</h2>
      <div style={gridStyle}>
        {Object.entries(stats.mes.porMetodoPago || {}).length === 0 ? (
          <Card title="Sin cobros registrados" value="$0.00" />
        ) : (
          Object.entries(stats.mes.porMetodoPago || {}).map(([metodo, total]) => (
            <Card key={metodo} title={`💳 ${metodo}`} value={dinero(total)} />
          ))
        )}
      </div>

      <h2 style={sectionTitle}>🔎 Trabajos de esta semana</h2>
      {ocultarTrabajosSemana ? (
        <div style={emptyStyle}>La vista fue limpiada. Usa “Refrescar” para volver a mostrar los datos.</div>
      ) : stats.trabajosSemana.length + stats.trabajosMecanicosSemana.length === 0 ? (
        <div style={emptyStyle}>No hay trabajos esta semana.</div>
      ) : (
        <div style={tableBox}>
          {stats.trabajosMecanicosSemana.map((trabajo) => (
            <div key={`mecanico-${trabajo.id}`} style={rowStyle}>
              <strong>{trabajo.numero_factura || "Trabajo mecánico"}</strong>
              <span>{trabajo.cliente_nombre || "Cliente manual"}</span>
              <span>{trabajo.mecanico_nombre || "Sin mecánico"}</span>
              <span>{trabajo.metodo_pago || "No registrado"}</span>
              <span>{dinero(trabajo.costo_piezas)} inversión</span>
              <span>{dinero(Number(trabajo.venta_piezas || 0) * 0.06)} tax piezas 6%</span>
              <span>{dinero((Number(trabajo.venta_piezas || 0) + Number(trabajo.mano_obra || 0) + Number(trabajo.venta_piezas || 0) * 0.06) * 0.04)} cargo 4%</span>
              <span>{dinero(trabajo.ganancia_piezas)} ganancia piezas</span>
              <span>{dinero(trabajo.total_generado)} total</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Card({ title, value }) {
  return (
    <div style={cardStyle}>
      <h2 style={cardTitleStyle}>{title}</h2>
      <p style={numberStyle}>{value}</p>
    </div>
  );
}

const pageBox = { color: "white" };
const titleStyle = { color: "#f59e0b", fontSize: "42px", marginBottom: "8px" };
const subtitleStyle = { color: "#d1d5db", fontSize: "16px" };
const actionsBox = { display: "flex", gap: "12px", flexWrap: "wrap", marginTop: "25px", marginBottom: "25px" };
const saveButton = { padding: "12px 16px", background: "#16a34a", color: "white", border: "none", borderRadius: "8px", cursor: "pointer", fontWeight: "bold" };
const cleanButton = { padding: "12px 16px", background: "#6b7280", color: "white", border: "none", borderRadius: "8px", cursor: "pointer", fontWeight: "bold" };
const refreshButton = { padding: "12px 16px", background: "#2563eb", color: "white", border: "none", borderRadius: "8px", cursor: "pointer", fontWeight: "bold" };
const sectionTitle = { color: "#f59e0b", marginTop: "35px", marginBottom: "10px" };
const gridStyle = { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: "20px", marginTop: "20px" };
const cardStyle = { background: "rgba(31, 41, 55, 0.95)", padding: "20px", borderRadius: "12px", border: "1px solid #f59e0b", boxShadow: "0 10px 25px rgba(0,0,0,0.25)" };
const cardTitleStyle = { color: "white", fontSize: "20px", margin: 0, marginBottom: "10px" };
const numberStyle = { fontSize: "30px", fontWeight: "bold", color: "#f59e0b", margin: 0 };
const tableBox = { background: "rgba(31, 41, 55, 0.95)", borderRadius: "12px", border: "1px solid #374151", overflow: "hidden" };
const rowStyle = { display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr 1fr 1fr 1fr 1fr 1fr", gap: "10px", padding: "14px", borderBottom: "1px solid #374151", alignItems: "center", color: "white" };
const emptyStyle = { background: "rgba(31, 41, 55, 0.95)", padding: "20px", borderRadius: "12px", border: "1px solid #374151", color: "white" };

export default Dashboard;
