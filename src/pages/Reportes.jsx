import { useEffect, useState } from "react";
import { supabase } from "../services/supabase";
import jsPDF from "jspdf";

function Reportes() {
  const [reportes, setReportes] = useState([]);
  const [busqueda, setBusqueda] = useState("");
  const [tipoActivo, setTipoActivo] = useState("semanal");
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    cargarReportes();
  }, []);

  const dinero = (valor) => `$${Number(valor || 0).toFixed(2)}`;

  const cargarReportes = async () => {
    setCargando(true);

    const { data, error } = await supabase
      .from("reportes_financieros")
      .select("*")
      .order("creado_en", { ascending: false });

    if (error) {
      console.log(error);
      alert("Error cargando reportes");
      setCargando(false);
      return;
    }

    setReportes(data || []);
    setCargando(false);
  };

  const descargarPDF = (reporte) => {
    const doc = new jsPDF();

    const titulo =
      reporte.tipo === "semanal" ? "Reporte Semanal" : "Reporte Mensual";

    doc.setFont("helvetica", "bold");
    doc.setFontSize(22);
    doc.text("PC MOTORS", 105, 20, { align: "center" });

    doc.setFontSize(16);
    doc.text(titulo, 105, 32, { align: "center" });

    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    doc.text(`Desde: ${reporte.fecha_inicio || "-"}`, 20, 50);
    doc.text(`Hasta: ${reporte.fecha_fin || "-"}`, 20, 58);
    doc.text(`Clientes atendidos: ${reporte.total_clientes || 0}`, 20, 66);

    doc.line(20, 75, 190, 75);

    let y = 90;

    const fila = (label, valor) => {
      doc.setFont("helvetica", "bold");
      doc.text(label, 20, y);
      doc.setFont("helvetica", "normal");
      doc.text(valor, 150, y);
      y += 10;
    };

    fila("Inversion piezas:", dinero(reporte.inversion_piezas));
    fila("Venta piezas:", dinero(reporte.venta_piezas));
    fila("Ganancia piezas:", dinero(reporte.ganancia_piezas));
    fila("Mano de obra:", dinero(reporte.mano_obra));
    fila("Impuestos:", dinero(reporte.impuestos));
    fila("Descuentos:", dinero(reporte.descuentos));

    doc.line(20, y, 190, y);
    y += 12;

    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("Total cobrado:", 20, y);
    doc.text(dinero(reporte.total_cobrado), 150, y);

    y += 12;
    doc.text("Ganancia aproximada:", 20, y);
    doc.text(dinero(reporte.ganancia_aprox), 150, y);

    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text("Generado desde PC Motors Admin Panel", 105, 280, {
      align: "center"
    });

    const nombreArchivo =
      reporte.tipo === "semanal"
        ? `Reporte_Semanal_${reporte.fecha_inicio || "PC_Motors"}.pdf`
        : `Reporte_Mensual_${reporte.fecha_inicio || "PC_Motors"}.pdf`;

    doc.save(nombreArchivo);
  };

  const imprimirReporte = (reporte) => {
    descargarPDF(reporte);
  };

  const eliminarReporte = async (reporte) => {
    const confirmar = confirm(
      `¿Eliminar este reporte ${reporte.tipo}? Esta acción no se puede deshacer.`
    );

    if (!confirmar) return;

    const { error } = await supabase
      .from("reportes_financieros")
      .delete()
      .eq("id", reporte.id);

    if (error) {
      console.log(error);
      alert(JSON.stringify(error, null, 2));
      return;
    }

    alert("Reporte eliminado correctamente");
    cargarReportes();
  };

  const reportesSemanales = reportes.filter((r) => r.tipo === "semanal");
  const reportesMensuales = reportes.filter((r) => r.tipo === "mensual");

  const reportesPorTipo =
    tipoActivo === "semanal" ? reportesSemanales : reportesMensuales;

  const reportesFiltrados = reportesPorTipo.filter((reporte) => {
    const texto = busqueda.toLowerCase();

    return (
      (reporte.tipo || "").toLowerCase().includes(texto) ||
      (reporte.fecha_inicio || "").toLowerCase().includes(texto) ||
      (reporte.fecha_fin || "").toLowerCase().includes(texto) ||
      String(reporte.total_cobrado || "").includes(texto) ||
      String(reporte.ganancia_aprox || "").includes(texto)
    );
  });

  return (
    <div>
      <h1 style={titleStyle}>📈 Reportes Guardados</h1>

      <div style={tabsBox}>
        <button
          onClick={() => setTipoActivo("semanal")}
          style={{
            ...tabButton,
            background: tipoActivo === "semanal" ? "#f59e0b" : "#1f2937",
            color: tipoActivo === "semanal" ? "#111827" : "white"
          }}
        >
          📅 Semanales ({reportesSemanales.length})
        </button>

        <button
          onClick={() => setTipoActivo("mensual")}
          style={{
            ...tabButton,
            background: tipoActivo === "mensual" ? "#f59e0b" : "#1f2937",
            color: tipoActivo === "mensual" ? "#111827" : "white"
          }}
        >
          🗓 Mensuales ({reportesMensuales.length})
        </button>
      </div>

      <input
        placeholder="Buscar por fecha, total o ganancia..."
        value={busqueda}
        onChange={(e) => setBusqueda(e.target.value)}
        style={searchStyle}
      />

      {cargando ? (
        <p>Cargando reportes...</p>
      ) : reportesFiltrados.length === 0 ? (
        <div style={emptyStyle}>No hay reportes guardados.</div>
      ) : (
        <div style={gridStyle}>
          {reportesFiltrados.map((reporte) => (
            <div key={reporte.id} style={cardStyle}>
              <h2 style={{ color: "#f59e0b", marginTop: 0 }}>
                {reporte.tipo === "semanal"
                  ? "📅 Reporte Semanal"
                  : "🗓 Reporte Mensual"}
              </h2>

              <p><strong>Desde:</strong> {reporte.fecha_inicio || "-"}</p>
              <p><strong>Hasta:</strong> {reporte.fecha_fin || "-"}</p>
              <p><strong>Clientes:</strong> {reporte.total_clientes || 0}</p>

              <hr style={lineStyle} />

              <p><strong>🧾 Inversión piezas:</strong> {dinero(reporte.inversion_piezas)}</p>
              <p><strong>💵 Venta piezas:</strong> {dinero(reporte.venta_piezas)}</p>
              <p><strong>📈 Ganancia piezas:</strong> {dinero(reporte.ganancia_piezas)}</p>
              <p><strong>🔧 Mano de obra:</strong> {dinero(reporte.mano_obra)}</p>
              <p><strong>💲 Total cobrado:</strong> {dinero(reporte.total_cobrado)}</p>
              <p><strong>✅ Ganancia aprox:</strong> {dinero(reporte.ganancia_aprox)}</p>

              <button onClick={() => descargarPDF(reporte)} style={pdfButton}>
                📄 Descargar PDF
              </button>

              <button onClick={() => imprimirReporte(reporte)} style={printButton}>
                🖨 Imprimir
              </button>

              <button onClick={() => eliminarReporte(reporte)} style={deleteButton}>
                🗑 Eliminar Reporte
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const titleStyle = { color: "#f59e0b", marginBottom: "20px" };

const tabsBox = {
  display: "flex",
  gap: "12px",
  flexWrap: "wrap",
  marginBottom: "20px"
};

const tabButton = {
  padding: "12px 18px",
  border: "1px solid #f59e0b",
  borderRadius: "10px",
  cursor: "pointer",
  fontWeight: "bold"
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
  background: "rgba(31, 41, 55, 0.95)",
  padding: "20px",
  borderRadius: "14px",
  border: "1px solid #374151",
  color: "white"
};

const lineStyle = {
  border: "none",
  borderTop: "1px solid #374151",
  margin: "15px 0"
};

const pdfButton = {
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

const printButton = {
  width: "100%",
  padding: "12px",
  marginTop: "10px",
  background: "#2563eb",
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
  borderRadius: "12px",
  border: "1px solid #374151"
};

export default Reportes;