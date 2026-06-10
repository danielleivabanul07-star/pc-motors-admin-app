import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../services/supabase";

export default function FirmaEstimadoCliente({ token }) {
  const canvasRef = useRef(null);
  const dibujandoRef = useRef(false);
  const [trabajo, setTrabajo] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [nombreFirma, setNombreFirma] = useState("");
  const [hayFirma, setHayFirma] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    cargarEstimado();
  }, [token]);

  useEffect(() => {
    prepararCanvas();
    window.addEventListener("resize", prepararCanvas);
    return () => window.removeEventListener("resize", prepararCanvas);
  }, [trabajo]);

  const dinero = (valor) => `$${Number(valor || 0).toFixed(2)}`;
  const redondearDinero = (valor) => Math.round(Number(valor || 0) * 100) / 100;

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

  const calcularTotales = (trabajoActual) => {
    const piezas = parsearArray(trabajoActual?.estimado_piezas).map(normalizarPieza);
    const servicios = parsearArray(trabajoActual?.estimado_servicios).map(normalizarServicio);

    const ventaPiezas = redondearDinero(
      piezas.reduce((total, pieza) => total + Number(pieza.venta || 0) * Number(pieza.cantidad || 1), 0)
    );

    const manoObraBase = servicios.length > 0
      ? redondearDinero(servicios.reduce((total, servicio) => total + Number(servicio.precio || 0), 0))
      : Number(trabajoActual?.estimado_mano_obra || trabajoActual?.mano_obra || 0);

    const descuento = Number(trabajoActual?.estimado_descuento || 0);
    const cargoPiezas6 = redondearDinero(ventaPiezas * 0.06);
    const subtotal = redondearDinero(ventaPiezas + cargoPiezas6 + manoObraBase);
    const cargoGeneral4 = redondearDinero(subtotal * 0.04);
    const totalGenerado = redondearDinero(Math.max(0, subtotal + cargoGeneral4 - descuento));

    return {
      piezas,
      servicios,
      ventaPiezas,
      manoObraBase,
      descuento,
      cargoPiezas6,
      cargoGeneral4,
      piezasCliente: redondearDinero(ventaPiezas + cargoPiezas6),
      manoObraCliente: redondearDinero(manoObraBase + cargoGeneral4 - descuento),
      totalGenerado
    };
  };

  const totales = useMemo(() => calcularTotales(trabajo), [trabajo]);

  const cargarEstimado = async () => {
    if (!token) {
      setError("Link inválido. Falta el token del estimado.");
      setCargando(false);
      return;
    }

    setCargando(true);
    setError("");

    const { data, error: errorConsulta } = await supabase
      .from("trabajos_mecanicos")
      .select("*")
      .eq("estimado_token", token)
      .maybeSingle();

    if (errorConsulta) {
      console.log(errorConsulta);
      setError("No se pudo cargar el estimado. Verifique el link.");
      setCargando(false);
      return;
    }

    if (!data) {
      setError("Este link de estimado no existe o ya no está disponible.");
      setCargando(false);
      return;
    }

    setTrabajo(data);
    setNombreFirma(data.estimado_firmado_nombre || data.cliente_nombre || "");
    setCargando(false);
  };

  const prepararCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const contenedor = canvas.parentElement;
    const ancho = Math.min(contenedor?.clientWidth || 340, 720);
    const alto = 190;
    const ratio = window.devicePixelRatio || 1;

    canvas.width = ancho * ratio;
    canvas.height = alto * ratio;
    canvas.style.width = `${ancho}px`;
    canvas.style.height = `${alto}px`;

    const ctx = canvas.getContext("2d");
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, ancho, alto);
    ctx.strokeStyle = "#111827";
    ctx.lineWidth = 3;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    setHayFirma(false);
  };

  const posicionCanvas = (evento) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    return {
      x: evento.clientX - rect.left,
      y: evento.clientY - rect.top
    };
  };

  const comenzarFirma = (evento) => {
    evento.preventDefault();
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    const pos = posicionCanvas(evento);
    dibujandoRef.current = true;
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
  };

  const dibujarFirma = (evento) => {
    if (!dibujandoRef.current) return;
    evento.preventDefault();
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    const pos = posicionCanvas(evento);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
    setHayFirma(true);
  };

  const terminarFirma = (evento) => {
    if (evento) evento.preventDefault();
    dibujandoRef.current = false;
  };

  const limpiarFirma = () => {
    prepararCanvas();
  };

  const dataURLABlob = async (dataUrl) => {
    const respuesta = await fetch(dataUrl);
    return await respuesta.blob();
  };

  const aprobarYFirmar = async () => {
    if (!trabajo) return;

    const nombre = String(nombreFirma || "").trim();
    if (!nombre) {
      alert("Escribe tu nombre antes de firmar.");
      return;
    }

    if (!hayFirma) {
      alert("Firma dentro del recuadro antes de aprobar el estimado.");
      return;
    }

    const confirmar = confirm(`¿Aprobar y firmar este estimado por ${dinero(totales.totalGenerado)}?`);
    if (!confirmar) return;

    setGuardando(true);

    const canvas = canvasRef.current;
    const dataUrl = canvas.toDataURL("image/png");
    const firmaBlob = await dataURLABlob(dataUrl);
    const rutaFirma = `trabajo-${trabajo.id}/firma-${Date.now()}.png`;

    const { error: errorUpload } = await supabase.storage
      .from("firmas-estimados")
      .upload(rutaFirma, firmaBlob, {
        contentType: "image/png",
        upsert: true
      });

    if (errorUpload) {
      console.log(errorUpload);
      alert("No se pudo subir la firma. Revisa permisos del bucket firmas-estimados.");
      setGuardando(false);
      return;
    }

    const { data: firmaData } = supabase.storage
      .from("firmas-estimados")
      .getPublicUrl(rutaFirma);

    const firmaUrl = firmaData?.publicUrl || null;

    const { error: errorUpdate } = await supabase
      .from("trabajos_mecanicos")
      .update({
        estimado_firma_url: firmaUrl,
        estimado_firmado_en: new Date().toISOString(),
        estimado_firmado_nombre: nombre,
        estimado_aprobado_cliente: true,
        estimado_estado: "estimado_aprobado",
        estimado_aprobado_en: new Date().toISOString(),
        estado: "esperando_piezas",
        fase_actual: "esperando_piezas",
        costo_piezas: 0,
        venta_piezas: totales.ventaPiezas,
        mano_obra: totales.manoObraBase
      })
      .eq("id", trabajo.id)
      .eq("estimado_token", token);

    if (errorUpdate) {
      console.log(errorUpdate);
      alert("La firma se subió, pero no se pudo aprobar el estimado en la base de datos.");
      setGuardando(false);
      return;
    }

    setGuardando(false);
    alert("Estimado aprobado y firmado correctamente. Gracias.");
    await cargarEstimado();
  };

  if (cargando) {
    return <div style={pageStyle}><div style={cardStyle}>Cargando estimado...</div></div>;
  }

  if (error) {
    return <div style={pageStyle}><div style={cardStyle}><h2>PC MOTORS</h2><p>{error}</p></div></div>;
  }

  const yaFirmado = Boolean(trabajo?.estimado_aprobado_cliente);

  return (
    <div style={pageStyle}>
      <div style={cardStyle}>
        <h1 style={titleStyle}>PC MOTORS</h1>
        <h2 style={subtitleStyle}>Aprobación de Estimado</h2>

        {yaFirmado && (
          <div style={approvedBox}>
            ✅ Este estimado ya fue aprobado y firmado por {trabajo.estimado_firmado_nombre || "el cliente"}.
          </div>
        )}

        <div style={infoGrid}>
          <p><strong>Cliente:</strong><br />{trabajo.cliente_nombre || "No registrado"}</p>
          <p><strong>Vehículo:</strong><br />{trabajo.vehiculo || "No registrado"}</p>
          <p><strong>Diagnóstico:</strong><br />{trabajo.resultado_diagnostico || trabajo.trabajo || "Pendiente"}</p>
          <p><strong>Fecha:</strong><br />{new Date().toLocaleString("en-US", { timeZone: "America/New_York" })}</p>
        </div>

        {trabajo.estimado_pdf_url && (
          <p>
            <a href={trabajo.estimado_pdf_url} target="_blank" rel="noreferrer" style={linkButton}>
              📄 Abrir PDF del estimado
            </a>
          </p>
        )}

        <hr style={lineStyle} />

        {totales.servicios.length > 0 && (
          <section>
            <h3 style={sectionTitle}>Servicios</h3>
            {totales.servicios.map((servicio, index) => (
              <div key={servicio.id || index} style={rowStyle}>
                <span>{servicio.nombre}</span>
                <strong>{dinero(servicio.precio)}</strong>
              </div>
            ))}
          </section>
        )}

        {totales.piezas.length > 0 && (
          <section>
            <h3 style={sectionTitle}>Piezas</h3>
            {totales.piezas.map((pieza, index) => {
              const totalLinea = redondearDinero(Number(pieza.venta || 0) * Number(pieza.cantidad || 1) * 1.06);
              return (
                <div key={pieza.id || index} style={rowStyle}>
                  <span>{pieza.cantidad} x {pieza.nombre}</span>
                  <strong>{dinero(totalLinea)}</strong>
                </div>
              );
            })}
          </section>
        )}

        <div style={totalBox}>
          <div style={rowStyle}><span>Piezas con 6%</span><strong>{dinero(totales.piezasCliente)}</strong></div>
          <div style={rowStyle}><span>Mano de obra con 4%</span><strong>{dinero(totales.manoObraCliente)}</strong></div>
          {totales.descuento > 0 && <div style={rowStyle}><span>Descuento</span><strong>-{dinero(totales.descuento)}</strong></div>}
          <div style={totalRow}><span>Total estimado</span><strong>{dinero(totales.totalGenerado)}</strong></div>
        </div>

        {!yaFirmado && (
          <div style={signatureSection}>
            <label style={labelStyle}>Nombre de quien aprueba</label>
            <input
              value={nombreFirma}
              onChange={(e) => setNombreFirma(e.target.value)}
              placeholder="Nombre completo"
              style={inputStyle}
            />

            <p style={smallText}>Firma dentro del recuadro usando el dedo.</p>
            <div style={canvasWrap}>
              <canvas
                ref={canvasRef}
                style={canvasStyle}
                onPointerDown={comenzarFirma}
                onPointerMove={dibujarFirma}
                onPointerUp={terminarFirma}
                onPointerCancel={terminarFirma}
                onPointerLeave={terminarFirma}
              />
            </div>

            <button onClick={limpiarFirma} style={secondaryButton} disabled={guardando}>Limpiar firma</button>
            <button onClick={aprobarYFirmar} style={approveButton} disabled={guardando}>
              {guardando ? "Guardando..." : "✅ Aprobar y Firmar Estimado"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

const pageStyle = {
  minHeight: "100vh",
  background: "#020617",
  color: "white",
  padding: "20px",
  fontFamily: "Arial, sans-serif"
};

const cardStyle = {
  maxWidth: "820px",
  margin: "0 auto",
  background: "#111827",
  border: "1px solid #f59e0b",
  borderRadius: "18px",
  padding: "22px",
  boxShadow: "0 12px 35px rgba(0,0,0,0.45)"
};

const titleStyle = { textAlign: "center", color: "#f59e0b", marginBottom: "5px" };
const subtitleStyle = { textAlign: "center", marginTop: 0 };
const infoGrid = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "12px" };
const lineStyle = { border: "none", borderTop: "1px solid #374151", margin: "20px 0" };
const sectionTitle = { color: "#f59e0b", marginBottom: "8px" };
const rowStyle = { display: "flex", justifyContent: "space-between", gap: "14px", padding: "8px 0", borderBottom: "1px solid #1f2937" };
const totalBox = { marginTop: "18px", background: "#020617", border: "1px solid #374151", borderRadius: "12px", padding: "14px" };
const totalRow = { display: "flex", justifyContent: "space-between", gap: "14px", paddingTop: "12px", marginTop: "8px", borderTop: "2px solid #f59e0b", fontSize: "20px", color: "#f59e0b" };
const signatureSection = { marginTop: "22px" };
const labelStyle = { display: "block", color: "#f59e0b", fontWeight: "bold", marginBottom: "8px" };
const inputStyle = { width: "100%", padding: "14px", borderRadius: "10px", border: "1px solid #374151", background: "#020617", color: "white", fontSize: "16px", marginBottom: "14px" };
const smallText = { color: "#d1d5db" };
const canvasWrap = { background: "white", borderRadius: "10px", padding: "8px", overflow: "hidden", touchAction: "none" };
const canvasStyle = { display: "block", borderRadius: "8px", touchAction: "none" };
const approveButton = { width: "100%", padding: "15px", border: "none", borderRadius: "10px", background: "#16a34a", color: "white", fontWeight: "bold", fontSize: "17px", marginTop: "12px" };
const secondaryButton = { width: "100%", padding: "12px", border: "none", borderRadius: "10px", background: "#6b7280", color: "white", fontWeight: "bold", marginTop: "12px" };
const linkButton = { display: "inline-block", color: "white", background: "#2563eb", padding: "12px 14px", borderRadius: "10px", textDecoration: "none", fontWeight: "bold" };
const approvedBox = { background: "#052e16", border: "1px solid #22c55e", color: "#dcfce7", borderRadius: "12px", padding: "14px", marginBottom: "16px", fontWeight: "bold" };
