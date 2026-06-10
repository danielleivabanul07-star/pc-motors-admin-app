import { useEffect, useMemo, useState } from "react";
import { supabase } from "../services/supabase";

function ReportesMecanicos() {
  const [reportes, setReportes] = useState([]);
  const [trabajos, setTrabajos] = useState([]);
  const [busqueda, setBusqueda] = useState("");
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    cargarReportes();
  }, []);

  useEffect(() => {
    const canal = supabase
      .channel("reportes-mecanicos-tiempo-real")
      .on("postgres_changes", { event: "*", schema: "public", table: "reportes_mecanicos" }, cargarReportes)
      .on("postgres_changes", { event: "*", schema: "public", table: "trabajos_mecanicos" }, cargarReportes)
      .on("postgres_changes", { event: "*", schema: "public", table: "facturas_trabajos" }, cargarReportes)
      .subscribe();

    return () => {
      supabase.removeChannel(canal);
    };
  }, []);

  const dinero = (valor) => `$${Number(valor || 0).toFixed(2)}`;

  const redondearDinero = (valor) => Math.round(Number(valor || 0) * 100) / 100;

  const calcularGananciaPiezasTrabajo = (trabajo) => {
    const costoPiezas = Number(trabajo.costo_piezas || 0);
    const ventaPiezas = Number(trabajo.venta_piezas || 0);
    const gananciaGuardada = Number(trabajo.ganancia_piezas || 0);
    if (gananciaGuardada !== 0) return gananciaGuardada;
    return redondearDinero((ventaPiezas - costoPiezas) + (ventaPiezas * 0.06));
  };

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

  const fechaTrabajo = (trabajo) => {
    return convertirFechaSupabase(trabajo.hora_fin || trabajo.hora_inicio || trabajo.creado_en);
  };

  const convertirMinutos = (minutos) => {
    const total = Number(minutos || 0);
    const horas = Math.floor(total / 60);
    const resto = total % 60;
    if (horas === 0) return `${resto} min`;
    if (resto === 0) return `${horas} h`;
    return `${horas} h ${resto} min`;
  };

  const cargarReportes = async () => {
    setCargando(true);

    const { data: reportesData, error: errorReportes } = await supabase
      .from("reportes_mecanicos")
      .select("*")
      .order("creado_en", { ascending: false });

    if (errorReportes) {
      console.log(errorReportes);
      alert("Error cargando reportes de mecánicos");
      setCargando(false);
      return;
    }

    const { data: trabajosData, error: errorTrabajos } = await supabase
      .from("trabajos_mecanicos")
      .select("*")
      .order("id", { ascending: false });

    if (errorTrabajos) {
      console.log(errorTrabajos);
      alert("Reportes cargados, pero hubo error cargando trabajos mecánicos");
      setReportes(reportesData || []);
      setTrabajos([]);
      setCargando(false);
      return;
    }

    setReportes(reportesData || []);
    setTrabajos(trabajosData || []);
    setCargando(false);
  };

  const resumenActual = useMemo(() => {
    const semana = inicioSemana();
    const mes = inicioMes();
    const resumen = {};

    trabajos.forEach((trabajo) => {
      const nombre = trabajo.mecanico_nombre || "Sin mecánico";
      const fecha = fechaTrabajo(trabajo);
      const minutos = Number(trabajo.minutos_trabajados || 0);

      if (!resumen[nombre]) {
        resumen[nombre] = {
          mecanico_nombre: nombre,
          activos: 0,
          trabajosSemana: 0,
          trabajosMes: 0,
          minutosSemana: 0,
          minutosMes: 0,
          produccionSemana: 0,
          produccionMes: 0,
          manoObraSemana: 0,
          manoObraMes: 0,
          gananciaPiezasSemana: 0,
          gananciaPiezasMes: 0
        };
      }

      if (trabajo.estado === "activo") resumen[nombre].activos += 1;

      if (fecha && fecha >= semana) {
        resumen[nombre].trabajosSemana += 1;
        resumen[nombre].minutosSemana += minutos;
        resumen[nombre].produccionSemana += Number(trabajo.total_generado || 0);
        resumen[nombre].manoObraSemana += Number(trabajo.mano_obra || 0);
        resumen[nombre].gananciaPiezasSemana += calcularGananciaPiezasTrabajo(trabajo);
      }

      if (fecha && fecha >= mes) {
        resumen[nombre].trabajosMes += 1;
        resumen[nombre].minutosMes += minutos;
        resumen[nombre].produccionMes += Number(trabajo.total_generado || 0);
        resumen[nombre].manoObraMes += Number(trabajo.mano_obra || 0);
        resumen[nombre].gananciaPiezasMes += calcularGananciaPiezasTrabajo(trabajo);
      }
    });

    return Object.values(resumen).sort((a, b) => b.produccionMes - a.produccionMes);
  }, [trabajos]);

  const guardarReporteDesdeResumen = async (item, tipo) => {
    const esSemanal = tipo === "semanal";
    const confirmar = confirm(`¿Guardar reporte ${tipo} de ${item.mecanico_nombre}?`);
    if (!confirmar) return;

    const hoy = new Date();
    const inicio = esSemanal ? inicioSemana() : inicioMes();

    const reporte = {
      tipo,
      mecanico_nombre: item.mecanico_nombre,
      fecha_inicio: inicio.toISOString().slice(0, 10),
      fecha_fin: hoy.toISOString().slice(0, 10),
      tipo_pago: "calculado_desde_control_trabajos",
      total_trabajos: esSemanal ? item.trabajosSemana : item.trabajosMes,
      total_minutos: esSemanal ? item.minutosSemana : item.minutosMes,
      total_horas: Number(((esSemanal ? item.minutosSemana : item.minutosMes) / 60).toFixed(2)),
      produccion_total: esSemanal ? item.produccionSemana : item.produccionMes,
      mano_obra_generada: esSemanal ? item.manoObraSemana : item.manoObraMes,
      pago_calculado: 0
    };

    const { error } = await supabase
      .from("reportes_mecanicos")
      .upsert([reporte], {
        onConflict: "tipo,mecanico_nombre,fecha_inicio,fecha_fin"
      });

    if (error) {
      console.log(error);
      alert(JSON.stringify(error, null, 2));
      return;
    }

    alert("Reporte guardado/actualizado correctamente.");
    cargarReportes();
  };

  const eliminarReporte = async (reporte) => {
    const confirmar = confirm(`¿Eliminar el reporte de ${reporte.mecanico_nombre}?`);
    if (!confirmar) return;

    const { error } = await supabase.from("reportes_mecanicos").delete().eq("id", reporte.id);

    if (error) {
      console.log(error);
      alert(JSON.stringify(error, null, 2));
      return;
    }

    alert("Reporte eliminado correctamente");
    cargarReportes();
  };

  const eliminarReportesMecanico = async (nombreMecanico) => {
    const confirmar = confirm(
      `¿Eliminar TODOS los reportes guardados de ${nombreMecanico}?\n\nEsto no borra trabajos, facturas, clientes ni mecánicos.`
    );

    if (!confirmar) return;

    const { error } = await supabase
      .from("reportes_mecanicos")
      .delete()
      .eq("mecanico_nombre", nombreMecanico);

    if (error) {
      console.log(error);
      alert(JSON.stringify(error, null, 2));
      return;
    }

    alert("Reportes del mecánico eliminados correctamente.");
    cargarReportes();
  };

  const eliminarTodosReportes = async () => {
    const confirmar = confirm(
      "¿Eliminar TODOS los reportes de mecánicos guardados?\n\nEsto no borra trabajos, facturas, clientes ni mecánicos."
    );

    if (!confirmar) return;

    const confirmarTexto = prompt('Para confirmar escribe exactamente: ELIMINAR');
    if (confirmarTexto !== "ELIMINAR") {
      alert("Eliminación cancelada.");
      return;
    }

    const { error } = await supabase
      .from("reportes_mecanicos")
      .delete()
      .neq("id", 0);

    if (error) {
      console.log(error);
      alert(JSON.stringify(error, null, 2));
      return;
    }

    alert("Todos los reportes fueron eliminados correctamente.");
    cargarReportes();
  };

  const reportesFiltrados = reportes.filter((reporte) => {
    const texto = busqueda.toLowerCase();
    return (
      (reporte.tipo || "").toLowerCase().includes(texto) ||
      (reporte.mecanico_nombre || "").toLowerCase().includes(texto) ||
      (reporte.fecha_inicio || "").toLowerCase().includes(texto) ||
      (reporte.fecha_fin || "").toLowerCase().includes(texto)
    );
  });

  return (
    <div>
      <h1 style={titleStyle}>📋 Reportes de Mecánicos</h1>

      <div style={actionsBox}>
        <button onClick={cargarReportes} style={refreshButton}>🔄 Refrescar</button>
        <button onClick={eliminarTodosReportes} style={deleteButtonTop}>⚠️ Eliminar Todos los Reportes</button>
      </div>

      <h2 style={sectionTitle}>📊 Producción actual desde Control Trabajos</h2>

      {cargando ? (
        <p>Cargando...</p>
      ) : resumenActual.length === 0 ? (
        <div style={emptyStyle}>No hay trabajos mecánicos registrados.</div>
      ) : (
        <div style={gridStyle}>
          {resumenActual.map((item) => (
            <div key={item.mecanico_nombre} style={cardStyle}>
              <h2 style={{ color: "#f59e0b", marginTop: 0 }}>{item.mecanico_nombre}</h2>
              <p><strong>🟢 Trabajos activos:</strong> {item.activos}</p>
              <hr style={lineStyle} />
              <p><strong>Semana trabajos:</strong> {item.trabajosSemana}</p>
              <p><strong>Semana tiempo:</strong> {convertirMinutos(item.minutosSemana)}</p>
              <p><strong>Semana producción:</strong> {dinero(item.produccionSemana)}</p>
              <p><strong>Semana mano de obra:</strong> {dinero(item.manoObraSemana)}</p>
              <p><strong>Semana ganancia piezas:</strong> {dinero(item.gananciaPiezasSemana)}</p>
              <button onClick={() => guardarReporteDesdeResumen(item, "semanal")} style={saveButton}>💾 Guardar Reporte Semanal</button>
              <hr style={lineStyle} />
              <p><strong>Mes trabajos:</strong> {item.trabajosMes}</p>
              <p><strong>Mes tiempo:</strong> {convertirMinutos(item.minutosMes)}</p>
              <p><strong>Mes producción:</strong> {dinero(item.produccionMes)}</p>
              <p><strong>Mes mano de obra:</strong> {dinero(item.manoObraMes)}</p>
              <p><strong>Mes ganancia piezas:</strong> {dinero(item.gananciaPiezasMes)}</p>
              <button onClick={() => guardarReporteDesdeResumen(item, "mensual")} style={saveButton}>💾 Guardar Reporte Mensual</button>
              <button onClick={() => eliminarReportesMecanico(item.mecanico_nombre)} style={deleteButton}>🗑 Eliminar Reportes de este Mecánico</button>
            </div>
          ))}
        </div>
      )}

      <h2 style={sectionTitle}>🗂 Reportes guardados</h2>

      <input
        placeholder="Buscar por mecánico, tipo o fecha..."
        value={busqueda}
        onChange={(e) => setBusqueda(e.target.value)}
        style={searchStyle}
      />

      {cargando ? (
        <p>Cargando reportes...</p>
      ) : reportesFiltrados.length === 0 ? (
        <div style={emptyStyle}>No hay reportes de mecánicos guardados.</div>
      ) : (
        <div style={gridStyle}>
          {reportesFiltrados.map((reporte) => (
            <div key={reporte.id} style={cardStyle}>
              <h2 style={{ color: "#f59e0b", marginTop: 0 }}>
                {reporte.tipo === "semanal" ? "📅 Reporte Semanal" : "🗓 Reporte Mensual"}
              </h2>
              <p><strong>👨‍🔧 Mecánico:</strong> {reporte.mecanico_nombre || "No registrado"}</p>
              <p><strong>Desde:</strong> {reporte.fecha_inicio || "-"}</p>
              <p><strong>Hasta:</strong> {reporte.fecha_fin || "-"}</p>
              <p><strong>Tipo de pago:</strong> {reporte.tipo_pago || "No registrado"}</p>
              <hr style={lineStyle} />
              <p><strong>Trabajos:</strong> {reporte.total_trabajos || 0}</p>
              <p><strong>Minutos:</strong> {reporte.total_minutos || 0}</p>
              <p><strong>Horas:</strong> {Number(reporte.total_horas || 0).toFixed(2)}</p>
              <p><strong>Producción total:</strong> {dinero(reporte.produccion_total)}</p>
              <p><strong>Mano de obra generada:</strong> {dinero(reporte.mano_obra_generada)}</p>
              <p><strong>Pago calculado:</strong> {dinero(reporte.pago_calculado)}</p>
              <button onClick={() => eliminarReporte(reporte)} style={deleteButton}>🗑 Eliminar Reporte</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const titleStyle = { color: "#f59e0b", marginBottom: "20px" };
const actionsBox = { display: "flex", gap: "12px", flexWrap: "wrap", marginBottom: "20px" };
const deleteButtonTop = { padding: "12px 18px", background: "#991b1b", color: "white", border: "none", borderRadius: "8px", cursor: "pointer", fontWeight: "bold" };
const sectionTitle = { color: "#f59e0b", marginTop: "30px", marginBottom: "15px" };
const refreshButton = { padding: "12px 18px", marginBottom: "20px", background: "#2563eb", color: "white", border: "none", borderRadius: "8px", cursor: "pointer", fontWeight: "bold" };
const searchStyle = { width: "100%", padding: "12px", marginBottom: "25px", borderRadius: "10px", border: "1px solid #374151", background: "#1f2937", color: "white" };
const gridStyle = { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(320px,1fr))", gap: "20px" };
const cardStyle = { background: "rgba(31, 41, 55, 0.95)", padding: "20px", borderRadius: "14px", border: "1px solid #374151", color: "white" };
const lineStyle = { border: "none", borderTop: "1px solid #374151", margin: "15px 0" };
const saveButton = { width: "100%", padding: "12px", marginTop: "10px", background: "#16a34a", color: "white", border: "none", borderRadius: "8px", cursor: "pointer", fontWeight: "bold" };
const deleteButton = { width: "100%", padding: "12px", marginTop: "15px", background: "#dc2626", color: "white", border: "none", borderRadius: "8px", cursor: "pointer", fontWeight: "bold" };
const emptyStyle = { background: "#1f2937", padding: "20px", borderRadius: "12px", border: "1px solid #374151" };

export default ReportesMecanicos;
