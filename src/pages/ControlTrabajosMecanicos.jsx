import { useEffect, useMemo, useState } from "react";
import { supabase } from "../services/supabase";
import jsPDF from "jspdf";


const paymentSwitchBox = {
  background: "#0f172a",
  border: "1px solid #374151",
  borderRadius: "10px",
  padding: "12px",
  marginBottom: "12px"
};

const paymentSwitchButtons = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
  gap: "10px",
  marginTop: "12px"
};

const paidButton = {
  padding: "12px",
  background: "#1f2937",
  color: "white",
  border: "1px solid #374151",
  borderRadius: "8px",
  cursor: "pointer",
  fontWeight: "bold"
};

const paidButtonActive = {
  ...paidButton,
  background: "#16a34a",
  border: "1px solid #22c55e"
};

const pendingButton = {
  padding: "12px",
  background: "#1f2937",
  color: "white",
  border: "1px solid #374151",
  borderRadius: "8px",
  cursor: "pointer",
  fontWeight: "bold"
};

const pendingButtonActive = {
  ...pendingButton,
  background: "#d97706",
  border: "1px solid #f59e0b",
  color: "#111827"
};


export default function ControlTrabajosMecanicos() {
  const [mecanicos, setMecanicos] = useState([]);
  const [trabajos, setTrabajos] = useState([]);
  const [facturas, setFacturas] = useState({});
  const [cargando, setCargando] = useState(true);
  const [tick, setTick] = useState(Date.now());
  const [trabajoEditando, setTrabajoEditando] = useState(null);
  const [resultadoDiagnosticoDraft, setResultadoDiagnosticoDraft] = useState({});
  const [busqueda, setBusqueda] = useState("");
  const [vistaTrabajos, setVistaTrabajos] = useState("activos");
  const [catalogoManoObra, setCatalogoManoObra] = useState([]);
  const [estimadoEditandoId, setEstimadoEditandoId] = useState(null);
  const [estimadoDraft, setEstimadoDraft] = useState({
    piezas: [],
    servicios: [],
    mano_obra: "",
    descuento: "",
    servicio_id: "",
    servicio_nombre: "",
    servicio_precio: "",
    servicio_mecanico_id: ""
  });

  const formBase = {
    mecanico_id: "",
    cliente_nombre: "",
    cliente_telefono: "",
    vehiculo: "",
    trabajo: "",
    costo_piezas: "",
    venta_piezas: "",
    mano_obra: "",
    metodo_pago: "",
    pago_recibido: false,
    notas: ""
  };

  const editBase = {
    cliente_nombre: "",
    vehiculo: "",
    trabajo: "",
    resultado_diagnostico: "",
    estado: "diagnostico",
    diagnostico_minutos: "",
    reparacion_minutos: "",
    costo_piezas: "",
    venta_piezas: "",
    mano_obra: "",
    metodo_pago: "",
    pago_recibido: false,
    notas: ""
  };

  const [form, setForm] = useState(formBase);
  const [editForm, setEditForm] = useState(editBase);

  useEffect(() => {
    cargarDatos();
  }, []);

  useEffect(() => {
    const intervalo = setInterval(() => setTick(Date.now()), 1000);
    return () => clearInterval(intervalo);
  }, []);

  useEffect(() => {
    const channel = supabase
      .channel("control-trabajos-mecanicos-central")
      .on("postgres_changes", { event: "*", schema: "public", table: "trabajos_mecanicos" }, cargarDatos)
      .on("postgres_changes", { event: "*", schema: "public", table: "fotos_trabajos_mecanicos" }, cargarDatos)
      .on("postgres_changes", { event: "*", schema: "public", table: "facturas_trabajos" }, cargarDatos)
      .on("postgres_changes", { event: "*", schema: "public", table: "mecanicos" }, cargarDatos)
      .on("postgres_changes", { event: "*", schema: "public", table: "ordenes_trabajo" }, cargarDatos)
      .on("postgres_changes", { event: "*", schema: "public", table: "clientes" }, cargarDatos)
      .on("postgres_changes", { event: "*", schema: "public", table: "tiempos_mecanicos" }, cargarDatos)
      .on("postgres_changes", { event: "*", schema: "public", table: "mano_obra_precios" }, cargarDatos)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const estados = [
    { value: "diagnostico", label: "🔎 Diagnóstico" },
    { value: "estimado_pendiente", label: "📋 Estimado pendiente" },
    { value: "estimado_aprobado", label: "✅ Estimado aprobado" },
    { value: "estimado_rechazado", label: "❌ Estimado rechazado" },
    { value: "esperando_piezas", label: "📦 Esperando piezas" },
    { value: "piezas_ordenadas", label: "🚚 Piezas ordenadas" },
    { value: "piezas_recibidas", label: "📦 Piezas recibidas" },
    { value: "trabajando", label: "🔧 Trabajando" },
    { value: "listo_para_entrega", label: "✅ Listo para entrega" },
    { value: "finalizado", label: "🏁 Finalizado" }
  ];

  const metodosPago = [
    { value: "", label: "Seleccionar método de pago" },
    { value: "Cash", label: "💵 Cash" },
    { value: "Zelle", label: "🏦 Zelle" },
    { value: "Debit Card", label: "💳 Debit Card" },
    { value: "Credit Card", label: "💳 Credit Card" },
    { value: "Cash App", label: "💸 Cash App" },
    { value: "Apple Pay", label: "🍎 Apple Pay" },
    { value: "Check", label: "🧾 Check" },
    { value: "Financiamiento", label: "📄 Financiamiento" },
    { value: "Otro", label: "🔁 Otro" },
    { value: "Pendiente", label: "⏳ Pendiente" }
  ];

  const GOOGLE_REVIEW_URL = "https://g.page/r/CZDnoTatR0yOEAI/review";
  const APP_PUBLIC_URL = "https://pc-motors-admin-app.vercel.app";

  const obtenerBasePublicaApp = () => {
    const origenActual = window.location.origin;
    if (origenActual.includes("localhost") || origenActual.includes("127.0.0.1")) {
      return APP_PUBLIC_URL;
    }
    return origenActual;
  };

  const dinero = (valor) => `$${Number(valor || 0).toFixed(2)}`;

  const redondearDinero = (valor) => Math.round(Number(valor || 0) * 100) / 100;

  const calcularPrecioPromedioPieza = (costoRealValor, precioNormalValor) => {
    const costoReal = Number(costoRealValor || 0);
    const precioNormal = Number(precioNormalValor || 0);

    if (costoReal > 0 && precioNormal > 0) {
      return redondearDinero((costoReal + precioNormal) / 2);
    }

    if (costoReal > 0) return redondearDinero(costoReal);
    if (precioNormal > 0) return redondearDinero(precioNormal);

    return 0;
  };

  const calcularTotalesContabilidad = (costoPiezasValor, ventaPiezasValor, manoObraValor) => {
    const costoPiezas = Number(costoPiezasValor || 0);
    const ventaPiezas = Number(ventaPiezasValor || 0);
    const manoObra = Number(manoObraValor || 0);

    const cargoPiezas6 = redondearDinero(ventaPiezas * 0.06);
    const subtotalBase = redondearDinero(ventaPiezas + manoObra + cargoPiezas6);
    const cargoGeneral4 = redondearDinero(subtotalBase * 0.04);
    const totalGenerado = redondearDinero(subtotalBase + cargoGeneral4);
    const gananciaPiezas = redondearDinero((ventaPiezas - costoPiezas) + cargoPiezas6);

    return {
      costoPiezas,
      ventaPiezas,
      manoObra,
      cargoPiezas6,
      cargoGeneral4,
      totalGenerado,
      gananciaPiezas
    };
  };


  const parsearEstimadoPiezas = (valor) => {
    if (Array.isArray(valor)) return valor;
    if (!valor) return [];

    try {
      const parsed = JSON.parse(valor);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  };

  const normalizarPiezaEstimado = (pieza, index = 0) => {
    const costoReal = Number(
      pieza.costo_real ??
      pieza.costo ??
      pieza.costo_interno ??
      0
    );

    const precioNormal = Number(
      pieza.precio_normal ??
      pieza.precio_regular ??
      pieza.precio_comercial ??
      pieza.precio_lista ??
      0
    );

    const precioSugerido = redondearDinero(
      Number(
        pieza.precio_sugerido ??
        pieza.precio_promedio ??
        calcularPrecioPromedioPieza(costoReal, precioNormal)
      )
    );

    const precioCliente = Number(
      pieza.venta ??
      pieza.precio_venta ??
      pieza.precio_cliente ??
      pieza.precio ??
      precioSugerido ??
      0
    );

    return {
      id: pieza.id || `${Date.now()}-${index}`,
      nombre: String(pieza.nombre || pieza.name || `Pieza ${index + 1}`),
      cantidad: Number(pieza.cantidad || pieza.qty || 1),
      costo: costoReal,
      costo_real: costoReal,
      precio_normal: precioNormal,
      precio_sugerido: precioSugerido,
      precio_promedio: precioSugerido,
      venta: precioCliente,
      precio_venta: precioCliente,
      precio_cliente: precioCliente,
      precio_cliente_manual: Boolean(pieza.precio_cliente_manual)
    };
  };

  const parsearEstimadoServicios = (valor) => {
    if (Array.isArray(valor)) return valor;
    if (!valor) return [];

    try {
      const parsed = JSON.parse(valor);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  };

  const normalizarServicioEstimado = (servicio, index = 0) => {
    const mecanicoId = servicio.mecanico_id || servicio.mecanicoId || null;
    const mecanicoEncontrado = mecanicoId
      ? mecanicos.find((m) => String(m.id) === String(mecanicoId))
      : null;

    const mecanicoNombre = String(
      servicio.mecanico_nombre ||
      servicio.mecanico ||
      servicio.nombre_mecanico ||
      mecanicoEncontrado?.nombre ||
      ""
    ).trim();

    return {
      id: servicio.id || `${Date.now()}-servicio-${index}`,
      catalogo_id: servicio.catalogo_id || servicio.servicio_id || null,
      nombre: String(servicio.nombre || servicio.servicio || `Servicio ${index + 1}`).trim(),
      precio: Number(servicio.precio ?? servicio.mano_obra ?? servicio.valor ?? 0),
      mecanico_id: mecanicoId,
      mecanico_nombre: mecanicoNombre,
      minutos: Number(servicio.minutos || servicio.tiempo_minutos || 0)
    };
  };

  const sumarServiciosEstimado = (serviciosValor) => {
    const servicios = parsearEstimadoServicios(serviciosValor).map(normalizarServicioEstimado);
    return redondearDinero(
      servicios.reduce((total, servicio) => total + Number(servicio.precio || 0), 0)
    );
  };

  const serviciosMecanicosDesdeServicios = (serviciosValor) => {
    return parsearEstimadoServicios(serviciosValor)
      .map(normalizarServicioEstimado)
      .filter((servicio) => String(servicio.nombre || "").trim() || Number(servicio.precio || 0) > 0)
      .map((servicio, index) => ({
        id: servicio.id || `${Date.now()}-servicio-mecanico-${index}`,
        tipo: servicio.nombre || `Servicio ${index + 1}`,
        servicio: servicio.nombre || `Servicio ${index + 1}`,
        nombre: servicio.nombre || `Servicio ${index + 1}`,
        mecanico_id: servicio.mecanico_id || null,
        mecanico_nombre: servicio.mecanico_nombre || "",
        precio: Number(servicio.precio || 0),
        minutos: Number(servicio.minutos || 0)
      }));
  };

  const calcularManoObraDesdeServiciosMecanicos = (serviciosValor) => {
    return redondearDinero(
      serviciosMecanicosDesdeServicios(serviciosValor).reduce(
        (total, servicio) => total + Number(servicio.precio || 0),
        0
      )
    );
  };

  const calcularTotalesEstimado = (piezasValor, manoObraValor = 0, descuentoValor = 0, serviciosValor = []) => {
    const piezas = parsearEstimadoPiezas(piezasValor).map(normalizarPiezaEstimado);
    const servicios = parsearEstimadoServicios(serviciosValor).map(normalizarServicioEstimado);
    const costoPiezas = redondearDinero(
      piezas.reduce((total, pieza) => total + Number(pieza.costo || 0) * Number(pieza.cantidad || 1), 0)
    );
    const ventaPiezas = redondearDinero(
      piezas.reduce((total, pieza) => total + Number(pieza.venta || 0) * Number(pieza.cantidad || 1), 0)
    );
    const manoObraServicios = redondearDinero(
      servicios.reduce((total, servicio) => total + Number(servicio.precio || 0), 0)
    );
    const manoObra = servicios.length > 0 ? manoObraServicios : Number(manoObraValor || 0);
    const descuento = Number(descuentoValor || 0);
    const totales = calcularTotalesContabilidad(costoPiezas, ventaPiezas, manoObra);
    const totalConDescuento = redondearDinero(Math.max(0, totales.totalGenerado - descuento));

    return {
      piezas,
      servicios,
      costoPiezas,
      ventaPiezas,
      manoObra,
      descuento,
      cargoPiezas6: totales.cargoPiezas6,
      cargoGeneral4: totales.cargoGeneral4,
      totalGenerado: totalConDescuento,
      piezasCliente: redondearDinero(ventaPiezas + totales.cargoPiezas6),
      manoObraCliente: redondearDinero(manoObra + totales.cargoGeneral4 - descuento)
    };
  };


  const calcularLineasClienteEstimado = (piezasValor, manoObraValor = 0, descuentoValor = 0, serviciosValor = []) => {
    const totales = calcularTotalesEstimado(piezasValor, manoObraValor, descuentoValor, serviciosValor);
    const piezas = parsearEstimadoPiezas(piezasValor).map(normalizarPiezaEstimado);
    const servicios = parsearEstimadoServicios(serviciosValor).map(normalizarServicioEstimado);

    const lineasBase = [
      ...servicios.map((servicio, index) => ({
        id: servicio.id || `servicio-${index}`,
        tipo: "servicio",
        nombre: servicio.nombre || `Servicio ${index + 1}`,
        base: Number(servicio.precio || 0)
      })),
      ...piezas.map((pieza, index) => {
        const cantidad = Number(pieza.cantidad || 1);
        return {
          id: pieza.id || `pieza-${index}`,
          tipo: "pieza",
          nombre: `${cantidad} x ${pieza.nombre || `Pieza ${index + 1}`}`,
          base: Number(pieza.venta || 0) * cantidad
        };
      })
    ].filter((linea) => Number(linea.base || 0) > 0);

    const totalBase = lineasBase.reduce((total, linea) => total + Number(linea.base || 0), 0);
    const totalCliente = Number(totales.totalGenerado || 0);

    let acumulado = 0;
    const lineasCliente = lineasBase.map((linea, index) => {
      const esUltima = index === lineasBase.length - 1;
      const total = esUltima
        ? redondearDinero(totalCliente - acumulado)
        : redondearDinero(totalCliente * (Number(linea.base || 0) / totalBase));

      acumulado = redondearDinero(acumulado + total);

      return {
        ...linea,
        total
      };
    });

    const lineasServicios = lineasCliente.filter((linea) => linea.tipo === "servicio");
    const lineasPiezas = lineasCliente.filter((linea) => linea.tipo === "pieza");

    return {
      ...totales,
      lineasPiezas,
      lineasServicios
    };
  };

  const textoEstadoEstimado = (estado) => {
    if (estado === "estimado_pendiente") return "📋 Estimado pendiente";
    if (estado === "estimado_aprobado") return "✅ Estimado aprobado";
    if (estado === "estimado_rechazado") return "❌ Estimado rechazado";
    if (estado === "piezas_ordenadas") return "🚚 Piezas ordenadas";
    if (estado === "piezas_recibidas") return "📦 Piezas recibidas";
    return "Sin estimado";
  };

  const precioSugeridoServicio = (servicio) => {
    return Number(
      servicio?.precio_sugerido ??
      servicio?.precio ??
      servicio?.precio_min ??
      0
    );
  };

  const precioMinServicio = (servicio) => Number(servicio?.precio_min ?? servicio?.precio ?? 0);
  const precioMaxServicio = (servicio) => Number(servicio?.precio_max ?? servicio?.precio ?? servicio?.precio_sugerido ?? 0);

  const textoServicioCatalogo = (servicio) => {
    if (!servicio) return "";
    const min = precioMinServicio(servicio);
    const max = precioMaxServicio(servicio);
    const rango = max > min ? `${dinero(min)} - ${dinero(max)}` : dinero(min || max);
    return `${servicio.categoria || "General"} — ${servicio.servicio} (${rango})`;
  };

  const convertirFechaSupabase = (valor) => {
    if (!valor) return null;
    const texto = String(valor);
    if (texto.endsWith("Z") || texto.includes("+")) return new Date(texto);
    return new Date(texto + "Z");
  };

  const formatearFecha = (fecha) => {
    if (!fecha) return "-";
    const fechaConvertida = convertirFechaSupabase(fecha);
    if (!fechaConvertida || Number.isNaN(fechaConvertida.getTime())) return "Fecha inválida";

    return fechaConvertida.toLocaleString("en-US", {
      timeZone: "America/New_York",
      month: "2-digit",
      day: "2-digit",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      second: "2-digit",
      hour12: true
    });
  };

  const calcularMinutos = (inicioValor, finValor) => {
    if (!inicioValor || !finValor) return 0;
    const inicio = convertirFechaSupabase(inicioValor);
    const fin = convertirFechaSupabase(finValor);
    if (!inicio || !fin || Number.isNaN(inicio.getTime()) || Number.isNaN(fin.getTime())) return 0;
    const diferencia = fin.getTime() - inicio.getTime();
    if (diferencia <= 0) return 0;
    return Math.max(1, Math.round(diferencia / 1000 / 60));
  };

  const convertirMinutos = (minutos) => {
    const total = Number(minutos || 0);
    const horas = Math.floor(total / 60);
    const resto = total % 60;
    if (horas === 0) return `${resto} min`;
    if (resto === 0) return `${horas} h`;
    return `${horas} h ${resto} min`;
  };

  const estadosTrabajoCerrado = ["finalizado", "Finalizado", "Terminado", "Entregado", "Cancelado"];

  const esTrabajoActivo = (trabajo) => !estadosTrabajoCerrado.includes(trabajo?.estado || "");

  const tiempoEnVivo = (trabajo) => {
    if (!trabajo.hora_inicio) return "Sin iniciar";
    if (!esTrabajoActivo(trabajo)) return convertirMinutos(Number(trabajo.minutos_trabajados || 0));

    const inicio = convertirFechaSupabase(trabajo.hora_inicio);
    if (!inicio || Number.isNaN(inicio.getTime())) return "Fecha inválida";

    const segundosTotales = Math.max(0, Math.floor((tick - inicio.getTime()) / 1000));
    const horas = Math.floor(segundosTotales / 3600);
    const minutos = Math.floor((segundosTotales % 3600) / 60);
    const segundos = segundosTotales % 60;

    return `${String(horas).padStart(2, "0")}:${String(minutos).padStart(2, "0")}:${String(segundos).padStart(2, "0")}`;
  };

  const minutosFaseEnVivo = (inicioValor, finValor, estaCorriendo = false) => {
    if (!inicioValor) return 0;

    const inicio = convertirFechaSupabase(inicioValor);
    if (!inicio || Number.isNaN(inicio.getTime())) return 0;

    const fin = finValor
      ? convertirFechaSupabase(finValor)
      : estaCorriendo
        ? new Date(tick)
        : null;

    if (!fin || Number.isNaN(fin.getTime())) return 0;

    const diferencia = fin.getTime() - inicio.getTime();
    if (diferencia <= 0) return 0;

    return Math.max(1, Math.round(diferencia / 1000 / 60));
  };

  const diagnosticoPausado = (trabajo) => {
    return Boolean(trabajo?.diagnostico_pausado) && esTrabajoActivo(trabajo);
  };

  const reparacionPausada = (trabajo) => {
    return Boolean(trabajo?.reparacion_pausado) && esTrabajoActivo(trabajo);
  };

  const diagnosticoCorriendo = (trabajo) => {
    return Boolean(trabajo.diagnostico_inicio) && !trabajo.diagnostico_fin && !trabajo.diagnostico_pausado && esTrabajoActivo(trabajo);
  };

  const reparacionCorriendo = (trabajo) => {
    return Boolean(trabajo.reparacion_inicio) && !trabajo.reparacion_fin && !trabajo.reparacion_pausado && esTrabajoActivo(trabajo);
  };

  const minutosDiagnosticoActual = (trabajo) => {
    const acumulado = Number(trabajo.diagnostico_minutos || 0);

    if (diagnosticoCorriendo(trabajo)) {
      return acumulado + minutosFaseEnVivo(trabajo.diagnostico_inicio, null, true);
    }

    return acumulado;
  };

  const minutosReparacionActual = (trabajo) => {
    const acumulado = Number(trabajo.reparacion_minutos || 0);

    if (reparacionCorriendo(trabajo)) {
      return acumulado + minutosFaseEnVivo(trabajo.reparacion_inicio, null, true);
    }

    return acumulado;
  };

  const minutosTotalFases = (trabajo) => {
    return minutosDiagnosticoActual(trabajo) + minutosReparacionActual(trabajo);
  };

  const iniciarDiagnostico = async (trabajo) => {
    if (trabajo.diagnostico_inicio && !trabajo.diagnostico_fin) {
      alert("El diagnóstico ya está corriendo.");
      return;
    }

    const ahora = new Date().toISOString();

    const { error } = await supabase
      .from("trabajos_mecanicos")
      .update({
        estado: "diagnostico",
        fase_actual: "diagnostico",
        diagnostico_inicio: ahora,
        diagnostico_fin: null,
        diagnostico_minutos: Number(trabajo.diagnostico_minutos || 0),
        diagnostico_pausado: false,
        diagnostico_pausado_en: null,
        hora_inicio: trabajo.hora_inicio || ahora
      })
      .eq("id", trabajo.id);

    if (error) {
      console.log(error);
      alert(JSON.stringify(error, null, 2));
      return;
    }

    await cargarDatos();
  };

  const finalizarDiagnostico = async (trabajo) => {
    if (!trabajo.diagnostico_inicio) {
      alert("Primero inicia el diagnóstico.");
      return;
    }

    if (trabajo.diagnostico_fin) {
      alert("El diagnóstico ya fue finalizado.");
      return;
    }

    const resultado = String(
      resultadoDiagnosticoDraft[trabajo.id] ?? trabajo.resultado_diagnostico ?? ""
    ).trim();

    if (!resultado) {
      alert("Antes de finalizar el diagnóstico debes escribir el resultado encontrado por el mecánico.");
      return;
    }

    const confirmar = confirm(
      `¿Finalizar diagnóstico y guardar este resultado?\n\n${resultado}`
    );

    if (!confirmar) return;

    const ahora = new Date().toISOString();
    const minutos = Number(trabajo.diagnostico_minutos || 0) + calcularMinutos(trabajo.diagnostico_inicio, ahora);

    const { error } = await supabase
      .from("trabajos_mecanicos")
      .update({
        diagnostico_fin: ahora,
        diagnostico_inicio: null,
        diagnostico_minutos: minutos,
        diagnostico_pausado: false,
        diagnostico_pausado_en: null,
        resultado_diagnostico: resultado,
        estado: "estimado_pendiente",
        fase_actual: "estimado_pendiente",
        estimado_estado: trabajo.estimado_estado || "sin_estimado"
      })
      .eq("id", trabajo.id);

    if (error) {
      console.log(error);
      alert(JSON.stringify(error, null, 2));
      return;
    }

    setResultadoDiagnosticoDraft((prev) => {
      const copia = { ...prev };
      delete copia[trabajo.id];
      return copia;
    });

    alert(`Diagnóstico finalizado. Tiempo: ${convertirMinutos(minutos)}`);
    await cargarDatos();
  };

  const iniciarReparacion = async (trabajo) => {
    if (trabajo.reparacion_inicio && !trabajo.reparacion_fin) {
      alert("La reparación ya está corriendo.");
      return;
    }

    const estadoEstimado = trabajo.estimado_estado || "sin_estimado";
    const requiereEstimado = parsearEstimadoPiezas(trabajo.estimado_piezas).length > 0 || Number(trabajo.estimado_mano_obra || 0) > 0;

    if (requiereEstimado && !["estimado_aprobado", "piezas_ordenadas", "piezas_recibidas"].includes(estadoEstimado)) {
      alert("Antes de iniciar la reparación, el estimado debe estar aprobado por el cliente.");
      return;
    }

    if (requiereEstimado && estadoEstimado !== "piezas_recibidas") {
      const confirmarPiezas = confirm("El estimado está aprobado, pero las piezas no aparecen como recibidas. ¿Quieres iniciar la reparación de todas formas?");
      if (!confirmarPiezas) return;
    }

    if (!trabajo.diagnostico_fin) {
      const confirmar = confirm(
        "Este trabajo todavía no tiene diagnóstico finalizado. ¿Quieres iniciar la reparación de todas formas?"
      );
      if (!confirmar) return;
    }

    const ahora = new Date().toISOString();

    const { error } = await supabase
      .from("trabajos_mecanicos")
      .update({
        reparacion_inicio: ahora,
        reparacion_fin: null,
        reparacion_minutos: Number(trabajo.reparacion_minutos || 0),
        reparacion_pausado: false,
        reparacion_pausado_en: null,
        estado: "trabajando",
        fase_actual: "reparacion"
      })
      .eq("id", trabajo.id);

    if (error) {
      console.log(error);
      alert(JSON.stringify(error, null, 2));
      return;
    }

    await cargarDatos();
  };

  const finalizarReparacion = async (trabajo) => {
    if (!trabajo.reparacion_inicio) {
      alert("Primero inicia la reparación.");
      return;
    }

    if (trabajo.reparacion_fin) {
      alert("La reparación ya fue finalizada.");
      return;
    }

    const ahora = new Date().toISOString();
    const minutos = Number(trabajo.reparacion_minutos || 0) + calcularMinutos(trabajo.reparacion_inicio, ahora);
    const totalMinutos = Number(trabajo.diagnostico_minutos || 0) + minutos;

    const { error } = await supabase
      .from("trabajos_mecanicos")
      .update({
        reparacion_fin: ahora,
        reparacion_inicio: null,
        reparacion_minutos: minutos,
        reparacion_pausado: false,
        reparacion_pausado_en: null,
        minutos_trabajados: totalMinutos,
        estado: "listo_para_entrega",
        fase_actual: "listo_para_entrega"
      })
      .eq("id", trabajo.id);

    if (error) {
      console.log(error);
      alert(JSON.stringify(error, null, 2));
      return;
    }

    alert(`Reparación finalizada. Tiempo: ${convertirMinutos(minutos)}`);
    await cargarDatos();
  };

  const pausarDiagnostico = async (trabajo) => {
    if (!diagnosticoCorriendo(trabajo)) {
      alert("El diagnóstico no está corriendo.");
      return;
    }

    const confirmar = confirm("¿Pausar el tiempo de diagnóstico?");
    if (!confirmar) return;

    const ahora = new Date().toISOString();
    const minutos = Number(trabajo.diagnostico_minutos || 0) + calcularMinutos(trabajo.diagnostico_inicio, ahora);

    const { error } = await supabase
      .from("trabajos_mecanicos")
      .update({
        diagnostico_minutos: minutos,
        diagnostico_inicio: null,
        diagnostico_pausado: true,
        diagnostico_pausado_en: ahora,
        fase_actual: "diagnostico_pausado"
      })
      .eq("id", trabajo.id);

    if (error) {
      console.log(error);
      alert(JSON.stringify(error, null, 2));
      return;
    }

    alert(`Diagnóstico pausado. Tiempo acumulado: ${convertirMinutos(minutos)}`);
    await cargarDatos();
  };

  const retomarDiagnostico = async (trabajo) => {
    if (!diagnosticoPausado(trabajo)) {
      alert("El diagnóstico no está pausado.");
      return;
    }

    const ahora = new Date().toISOString();

    const { error } = await supabase
      .from("trabajos_mecanicos")
      .update({
        estado: "diagnostico",
        fase_actual: "diagnostico",
        diagnostico_inicio: ahora,
        diagnostico_fin: null,
        diagnostico_pausado: false,
        diagnostico_pausado_en: null,
        hora_inicio: trabajo.hora_inicio || ahora
      })
      .eq("id", trabajo.id);

    if (error) {
      console.log(error);
      alert(JSON.stringify(error, null, 2));
      return;
    }

    await cargarDatos();
  };

  const pausarReparacion = async (trabajo) => {
    if (!reparacionCorriendo(trabajo)) {
      alert("La reparación no está corriendo.");
      return;
    }

    const confirmar = confirm("¿Pausar el tiempo de reparación?");
    if (!confirmar) return;

    const ahora = new Date().toISOString();
    const minutos = Number(trabajo.reparacion_minutos || 0) + calcularMinutos(trabajo.reparacion_inicio, ahora);

    const { error } = await supabase
      .from("trabajos_mecanicos")
      .update({
        reparacion_minutos: minutos,
        reparacion_inicio: null,
        reparacion_pausado: true,
        reparacion_pausado_en: ahora,
        fase_actual: "reparacion_pausada"
      })
      .eq("id", trabajo.id);

    if (error) {
      console.log(error);
      alert(JSON.stringify(error, null, 2));
      return;
    }

    alert(`Reparación pausada. Tiempo acumulado: ${convertirMinutos(minutos)}`);
    await cargarDatos();
  };

  const retomarReparacion = async (trabajo) => {
    if (!reparacionPausada(trabajo)) {
      alert("La reparación no está pausada.");
      return;
    }

    const ahora = new Date().toISOString();

    const { error } = await supabase
      .from("trabajos_mecanicos")
      .update({
        estado: "trabajando",
        fase_actual: "reparacion",
        reparacion_inicio: ahora,
        reparacion_fin: null,
        reparacion_pausado: false,
        reparacion_pausado_en: null
      })
      .eq("id", trabajo.id);

    if (error) {
      console.log(error);
      alert(JSON.stringify(error, null, 2));
      return;
    }

    await cargarDatos();
  };

  const editarTiempoManual = async (trabajo, fase) => {
    const etiqueta = fase === "diagnostico" ? "diagnóstico" : "reparación";
    const valorActual = fase === "diagnostico"
      ? minutosDiagnosticoActual(trabajo)
      : minutosReparacionActual(trabajo);

    const entrada = prompt(
      `Minutos reales de ${etiqueta}:\n\nEjemplo: 20 para veinte minutos.\nPuedes poner 0 si no se realizó ${etiqueta}.`,
      String(valorActual)
    );

    if (entrada === null) return;

    const minutos = Number(entrada);

    if (!Number.isFinite(minutos) || minutos < 0) {
      alert("Escribe una cantidad válida de minutos. Ejemplo: 20");
      return;
    }

    const updateData = {
      minutos_trabajados:
        fase === "diagnostico"
          ? minutos + minutosReparacionActual(trabajo)
          : minutosDiagnosticoActual(trabajo) + minutos
    };

    if (fase === "diagnostico") {
      updateData.diagnostico_minutos = Math.round(minutos);
      updateData.diagnostico_inicio = null;
      updateData.diagnostico_pausado = false;
      updateData.diagnostico_pausado_en = null;
      if (minutos === 0) updateData.diagnostico_fin = null;
    } else {
      updateData.reparacion_minutos = Math.round(minutos);
      updateData.reparacion_inicio = null;
      updateData.reparacion_pausado = false;
      updateData.reparacion_pausado_en = null;
      if (minutos === 0) updateData.reparacion_fin = null;
    }

    const { error } = await supabase
      .from("trabajos_mecanicos")
      .update(updateData)
      .eq("id", trabajo.id);

    if (error) {
      console.log(error);
      alert(JSON.stringify(error, null, 2));
      return;
    }

    alert(`Tiempo de ${etiqueta} actualizado a ${convertirMinutos(Math.round(minutos))}.`);
    await cargarDatos();
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

 const esTrabajoFinalizadoParaDinero = (trabajo) => {
  return trabajo?.estado === "finalizado";
};

  const fechaBaseTrabajo = (trabajo) => convertirFechaSupabase(
    trabajo.factura_creada_en || trabajo.hora_fin
  );

  const resumen = useMemo(() => {
    const semana = inicioSemana();
    const mes = inicioMes();
    const trabajosActivos = trabajos.filter(esTrabajoActivo);
    const trabajosFinalizados = trabajos.filter(esTrabajoFinalizadoParaDinero);

    const trabajosSemana = trabajosFinalizados.filter((trabajo) => {
      const fecha = fechaBaseTrabajo(trabajo);
      return fecha && fecha >= semana;
    });

    const trabajosMes = trabajosFinalizados.filter((trabajo) => {
      const fecha = fechaBaseTrabajo(trabajo);
      return fecha && fecha >= mes;
    });

    const sumar = (lista, campo) => lista.reduce((total, trabajo) => total + Number(trabajo[campo] || 0), 0);
    const sumarGananciaPiezas = (lista) => lista.reduce(
      (total, trabajo) => total + calcularTotalesContabilidad(
        trabajo.costo_piezas,
        trabajo.venta_piezas,
        trabajo.mano_obra
      ).gananciaPiezas,
      0
    );

    return {
      trabajosActivos: trabajosActivos.length,
      totalGeneradoSemana: sumar(trabajosSemana, "total_generado"),
      gananciaPiezasSemana: sumarGananciaPiezas(trabajosSemana),
      manoObraSemana: sumar(trabajosSemana, "mano_obra"),
      totalGeneradoMes: sumar(trabajosMes, "total_generado"),
      gananciaPiezasMes: sumarGananciaPiezas(trabajosMes),
      manoObraMes: sumar(trabajosMes, "mano_obra")
    };
  }, [trabajos]);

  const cargarDatos = async () => {
    setCargando(true);

    const { data: mecanicosData, error: errorMecanicos } = await supabase
      .from("mecanicos")
      .select("*")
      .eq("activo", true)
      .order("nombre", { ascending: true });

    if (errorMecanicos) {
      console.log(errorMecanicos);
      alert("Error cargando mecánicos");
      setCargando(false);
      return;
    }

    const { data: trabajosData, error: errorTrabajos } = await supabase
      .from("trabajos_mecanicos")
      .select("*")
      .order("id", { ascending: false });

    if (errorTrabajos) {
      console.log(errorTrabajos);
      alert("Error cargando trabajos mecánicos");
      setCargando(false);
      return;
    }

    const { data: manoObraData, error: errorManoObra } = await supabase
      .from("mano_obra_precios")
      .select("*")
      .eq("activo", true)
      .order("categoria", { ascending: true })
      .order("servicio", { ascending: true });

    if (errorManoObra) {
      console.log("No se pudo cargar catálogo de mano de obra:", errorManoObra);
      setCatalogoManoObra([]);
    } else {
      setCatalogoManoObra(manoObraData || []);
    }

    const listaTrabajos = trabajosData || [];
    setMecanicos(mecanicosData || []);
    setTrabajos(listaTrabajos);
    await cargarFacturas(listaTrabajos);
    setCargando(false);
  };

  const cargarFacturas = async (listaTrabajos = trabajos) => {
    const ids = listaTrabajos.map((trabajo) => trabajo.id);
    if (ids.length === 0) {
      setFacturas({});
      return;
    }

    const { data, error } = await supabase
      .from("fotos_trabajos_mecanicos")
      .select("*")
      .in("trabajo_id", ids)
      .order("id", { ascending: false });

    if (error) {
      console.log(error);
      alert("Los trabajos cargaron, pero hubo un error cargando facturas/compras.");
      setFacturas({});
      return;
    }

    const agrupadas = {};
    (data || []).forEach((factura) => {
      if (!agrupadas[factura.trabajo_id]) agrupadas[factura.trabajo_id] = [];
      agrupadas[factura.trabajo_id].push(factura);
    });

    setFacturas(agrupadas);
  };

  const crearTrabajo = async () => {
    const mecanico = mecanicos.find((m) => String(m.id) === String(form.mecanico_id));

    if (!mecanico) {
      alert("Selecciona un mecánico.");
      return;
    }

    if (!form.cliente_nombre.trim()) {
      alert("Para que el sistema se actualice completo, escribe el nombre del cliente.");
      return;
    }

    if (!form.vehiculo.trim()) {
      alert("Para que aparezca en Clientes Activos y Dashboard, escribe el vehículo.");
      return;
    }

    if (!form.trabajo.trim()) {
      alert("Escribe el trabajo o diagnóstico inicial.");
      return;
    }

    const ahora = new Date().toISOString();
    const clienteNombre = form.cliente_nombre.trim();
    const clienteTelefono = String(form.cliente_telefono || "").trim();
    const vehiculoTexto = form.vehiculo.trim();
    const trabajoTexto = form.trabajo.trim();
    const totalesTrabajo = calcularTotalesContabilidad(
      form.costo_piezas,
      form.venta_piezas,
      form.mano_obra
    );

    let clienteCreado = null;
    let vehiculoCreado = null;
    let ordenCreada = null;

    const limpiarCreacionParcial = async () => {
      if (ordenCreada?.id) {
        await supabase.from("ordenes_trabajo").delete().eq("id", ordenCreada.id);
      }

      if (vehiculoCreado?.id) {
        await supabase.from("vehiculos").delete().eq("id", vehiculoCreado.id);
      }

      if (clienteCreado?.id) {
        await supabase.from("clientes").delete().eq("id", clienteCreado.id);
      }
    };

    const { data: clienteData, error: errorCliente } = await supabase
      .from("clientes")
      .insert([
        {
          nombre: clienteNombre,
          telefono: clienteTelefono || null,
          estado: "activo",
          notas: form.notas.trim() || "Cliente creado manualmente desde Control Trabajos."
        }
      ])
      .select()
      .single();

    if (errorCliente) {
      console.log(errorCliente);
      alert("No se pudo crear el cliente.\n\n" + JSON.stringify(errorCliente, null, 2));
      return;
    }

    clienteCreado = clienteData;

    const partesVehiculo = vehiculoTexto.split(" ").filter(Boolean);
    const posibleAnio = partesVehiculo.find((p) => /^\d{4}$/.test(p)) || null;

    const { data: vehiculoData, error: errorVehiculo } = await supabase
      .from("vehiculos")
      .insert([
        {
          cliente_id: clienteCreado.id,
          anio: posibleAnio,
          marca: null,
          modelo: vehiculoTexto,
          notas: vehiculoTexto
        }
      ])
      .select()
      .single();

    if (errorVehiculo) {
      console.log(errorVehiculo);
      await limpiarCreacionParcial();
      alert("No se pudo crear el vehículo. Se limpió el cliente creado para evitar duplicados.\n\n" + JSON.stringify(errorVehiculo, null, 2));
      await cargarDatos();
      return;
    }

    vehiculoCreado = vehiculoData;

    const { data: ordenData, error: errorOrden } = await supabase
      .from("ordenes_trabajo")
      .insert([
        {
          cliente_id: clienteCreado.id,
          vehiculo_id: vehiculoCreado.id,
          diagnostico: trabajoTexto,
          mecanico: mecanico.nombre,
          estado: "Diagnosticando",
          prioridad: "normal",
          notas: form.notas.trim() || "Orden creada manualmente desde Control Trabajos."
        }
      ])
      .select()
      .single();

    if (errorOrden) {
      console.log(errorOrden);
      await limpiarCreacionParcial();
      alert("No se pudo crear la orden. Se limpió el cliente y vehículo creados para evitar duplicados.\n\n" + JSON.stringify(errorOrden, null, 2));
      await cargarDatos();
      return;
    }

    ordenCreada = ordenData;

    const { error } = await supabase.from("trabajos_mecanicos").insert([
      {
        mecanico_id: mecanico.id,
        mecanico_nombre: mecanico.nombre,
        cliente_nombre: clienteNombre,
        vehiculo: vehiculoTexto,
        trabajo: trabajoTexto,
        estado: "diagnostico",
        fase_actual: "diagnostico",
        hora_inicio: ahora,
        diagnostico_inicio: ahora,
        diagnostico_minutos: 0,
        reparacion_minutos: 0,
        costo_piezas: totalesTrabajo.costoPiezas,
        venta_piezas: totalesTrabajo.ventaPiezas,
        mano_obra: totalesTrabajo.manoObra,
        notas: form.notas.trim() || null,
        origen: "manual",
        cliente_id: clienteCreado.id,
        vehiculo_id: vehiculoCreado.id,
        orden_id: ordenCreada.id,
        solicitud_id: null
      }
    ]);

    if (error) {
      console.log(error);
      await limpiarCreacionParcial();
      alert("No se pudo crear el trabajo mecánico. Se limpió el cliente, vehículo y orden creados para evitar duplicados.\n\n" + JSON.stringify(error, null, 2));
      await cargarDatos();
      return;
    }

    setForm(formBase);
    alert(`Trabajo creado y conectado al sistema completo.\n\nCliente #${clienteCreado.id}\nVehículo #${vehiculoCreado.id}\nOrden #${ordenCreada.id}`);
    await cargarDatos();
  };

  const abrirEdicionContabilidad = (trabajo) => {
    setTrabajoEditando(trabajo);
    setEditForm({
      cliente_nombre: trabajo.cliente_nombre || "",
      vehiculo: trabajo.vehiculo || "",
      trabajo: trabajo.trabajo || "",
      resultado_diagnostico: trabajo.resultado_diagnostico || "",
      estado: trabajo.estado || "diagnostico",
      diagnostico_minutos: String(minutosDiagnosticoActual(trabajo) || 0),
      reparacion_minutos: String(minutosReparacionActual(trabajo) || 0),
      costo_piezas: String(trabajo.costo_piezas || ""),
      venta_piezas: String(trabajo.venta_piezas || ""),
      mano_obra: String(trabajo.mano_obra || ""),
      metodo_pago: trabajo.metodo_pago || "",
      pago_recibido: Boolean(trabajo.pago_recibido),
      notas: trabajo.notas || ""
    });

    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const cancelarEdicion = () => {
    setTrabajoEditando(null);
    setEditForm(editBase);
  };

  const guardarContabilidad = async () => {
    if (!trabajoEditando) return;

    const costoPiezas = Number(editForm.costo_piezas || 0);
    const ventaPiezas = Number(editForm.venta_piezas || 0);
    const manoObra = Number(editForm.mano_obra || 0);
    const diagnosticoMinutos = Number(editForm.diagnostico_minutos || 0);
    const reparacionMinutos = Number(editForm.reparacion_minutos || 0);

    if (
      Number.isNaN(costoPiezas) ||
      Number.isNaN(ventaPiezas) ||
      Number.isNaN(manoObra) ||
      Number.isNaN(diagnosticoMinutos) ||
      Number.isNaN(reparacionMinutos) ||
      diagnosticoMinutos < 0 ||
      reparacionMinutos < 0
    ) {
      alert("Uno de los valores de contabilidad o tiempo no es válido.");
      return;
    }

    const totalesTrabajo = calcularTotalesContabilidad(costoPiezas, ventaPiezas, manoObra);

    const updateData = {
      cliente_nombre: editForm.cliente_nombre.trim() || null,
      vehiculo: editForm.vehiculo.trim() || null,
      trabajo: editForm.trabajo.trim() || "Trabajo sin descripción",
      resultado_diagnostico: editForm.resultado_diagnostico.trim() || null,
      estado: editForm.estado || "diagnostico",
      diagnostico_minutos: Math.round(diagnosticoMinutos),
      reparacion_minutos: Math.round(reparacionMinutos),
      minutos_trabajados: Math.round(diagnosticoMinutos) + Math.round(reparacionMinutos),
      costo_piezas: totalesTrabajo.costoPiezas,
      venta_piezas: totalesTrabajo.ventaPiezas,
      mano_obra: totalesTrabajo.manoObra,
      metodo_pago: editForm.metodo_pago || null,
      pago_recibido: Boolean(editForm.pago_recibido),
      fecha_pago: Boolean(editForm.pago_recibido)
        ? (trabajoEditando.fecha_pago || new Date().toISOString())
        : null,
      notas: editForm.notas.trim() || null
    };

    if (editForm.estado === "finalizado" && !trabajoEditando.hora_fin) {
      updateData.hora_fin = new Date().toISOString();
      updateData.minutos_trabajados = Math.round(diagnosticoMinutos) + Math.round(reparacionMinutos);
    }

    if (editForm.estado !== "finalizado" && trabajoEditando.hora_fin) {
      updateData.hora_fin = null;
      updateData.minutos_trabajados = Math.round(diagnosticoMinutos) + Math.round(reparacionMinutos);
    }

    const { error } = await supabase
      .from("trabajos_mecanicos")
      .update(updateData)
      .eq("id", trabajoEditando.id);

    if (error) {
      console.log(error);
      alert(JSON.stringify(error, null, 2));
      return;
    }

    if (editForm.estado === "finalizado") {
      await finalizarRelacionesDelTrabajo({
        ...trabajoEditando,
        ...updateData,
        estado: "finalizado"
      });
    }

    alert("Trabajo y contabilidad actualizados correctamente.");
    cancelarEdicion();
    await cargarDatos();
  };

  const finalizarTrabajo = async (trabajo) => {
    if (!trabajo) return;

    if (!esTrabajoActivo(trabajo)) {
      alert("Este trabajo ya fue finalizado. No se puede finalizar dos veces.");
      await cargarDatos();
      return;
    }

    const metodoActual = trabajo.metodo_pago || "";
    const metodoTexto = prompt(
      "Método de pago usado por el cliente:\n\nOpciones: Cash, Zelle, Debit Card, Credit Card, Cash App, Apple Pay, Check, Financiamiento, Otro o Pendiente.",
      metodoActual || "Cash"
    );

    if (metodoTexto === null) return;

    const metodoPago = String(metodoTexto || "").trim();

    if (!metodoPago) {
      alert("Selecciona o escribe el método de pago antes de finalizar el trabajo.");
      return;
    }

    const pagoRecibido = metodoPago === "Pendiente"
      ? false
      : confirm(
          `¿El pago fue recibido realmente?\n\nCliente: ${trabajo.cliente_nombre || "No registrado"}\nMétodo: ${metodoPago}\n\nAceptar = Sí, pago recibido.\nCancelar = No, queda pendiente.`
        );

    const confirmar = confirm(
      `¿Finalizar completamente el trabajo de ${trabajo.mecanico_nombre}?\n\nMétodo de pago: ${metodoPago}\nPago recibido: ${pagoRecibido ? "Sí" : "No"}`
    );
    if (!confirmar) return;

    const fin = new Date().toISOString();
    const numeroFactura = generarNumeroFactura(trabajo);
    const totalesTrabajo = calcularTotalesContabilidad(
      trabajo.costo_piezas,
      trabajo.venta_piezas,
      trabajo.mano_obra
    );

    let diagnosticoMinutos = Number(trabajo.diagnostico_minutos || 0);
    let reparacionMinutos = Number(trabajo.reparacion_minutos || 0);
    const updateData = {
      estado: "finalizado",
      fase_actual: "finalizado",
      hora_fin: trabajo.hora_fin || fin,
      numero_factura: trabajo.numero_factura || numeroFactura,
      factura_creada_en: trabajo.factura_creada_en || fin,
      costo_piezas: totalesTrabajo.costoPiezas,
      venta_piezas: totalesTrabajo.ventaPiezas,
      mano_obra: totalesTrabajo.manoObra,
      metodo_pago: metodoPago,
      pago_recibido: pagoRecibido,
      fecha_pago: pagoRecibido ? (trabajo.fecha_pago || fin) : null,
    };

    if (trabajo.diagnostico_inicio && !trabajo.diagnostico_fin && !trabajo.diagnostico_pausado) {
      diagnosticoMinutos = Number(trabajo.diagnostico_minutos || 0) + calcularMinutos(trabajo.diagnostico_inicio, fin);
      updateData.diagnostico_fin = fin;
      updateData.diagnostico_inicio = null;
      updateData.diagnostico_minutos = diagnosticoMinutos;
      updateData.diagnostico_pausado = false;
      updateData.diagnostico_pausado_en = null;
    }

    if (trabajo.reparacion_inicio && !trabajo.reparacion_fin && !trabajo.reparacion_pausado) {
      reparacionMinutos = Number(trabajo.reparacion_minutos || 0) + calcularMinutos(trabajo.reparacion_inicio, fin);
      updateData.reparacion_fin = fin;
      updateData.reparacion_inicio = null;
      updateData.reparacion_minutos = reparacionMinutos;
      updateData.reparacion_pausado = false;
      updateData.reparacion_pausado_en = null;
    }

    const totalFases = diagnosticoMinutos + reparacionMinutos;
    const totalGeneral = totalFases > 0
      ? totalFases
      : calcularMinutos(trabajo.hora_inicio, fin);

    updateData.minutos_trabajados = totalGeneral;

    const { error } = await supabase
      .from("trabajos_mecanicos")
      .update(updateData)
      .eq("id", trabajo.id)
      .neq("estado", "finalizado");

    if (error) {
      console.log(error);
      alert(JSON.stringify(error, null, 2));
      return;
    }

    const relacionesActualizadas = await finalizarRelacionesDelTrabajo({
      ...trabajo,
      ...updateData
    });

    if (!relacionesActualizadas) return;

    alert(`Trabajo finalizado correctamente. Tiempo total: ${convertirMinutos(totalGeneral)}\nFactura: ${numeroFactura}`);
    await cargarDatos();
  };

  const subirFactura = async (trabajo, archivo) => {
    if (!archivo) return;
    const nombreArchivo = `trabajo-${trabajo.id}/${Date.now()}-${archivo.name}`;

    const { error: errorUpload } = await supabase.storage
      .from("facturas-mecanicos")
      .upload(nombreArchivo, archivo);

    if (errorUpload) {
      console.log(errorUpload);
      alert(JSON.stringify(errorUpload, null, 2));
      return;
    }

    const { data } = supabase.storage.from("facturas-mecanicos").getPublicUrl(nombreArchivo);

    const { error } = await supabase.from("fotos_trabajos_mecanicos").insert([
      { trabajo_id: trabajo.id, url: data.publicUrl, tipo: "factura" }
    ]);

    if (error) {
      console.log(error);
      alert(JSON.stringify(error, null, 2));
      return;
    }

    alert("Factura/compra subida correctamente.");
    await cargarDatos();
  };

  const extraerRutaStorage = (url) => {
    if (!url) return null;
    const marcador = "/facturas-mecanicos/";
    const partes = String(url).split(marcador);
    if (partes.length < 2) return null;
    return decodeURIComponent(partes[1]);
  };

  const eliminarFacturaSubida = async (factura) => {
    const confirmar = confirm("¿Eliminar esta factura/compra subida? Esto no elimina el trabajo.");
    if (!confirmar) return;

    const ruta = extraerRutaStorage(factura.url);
    if (ruta) {
      await supabase.storage.from("facturas-mecanicos").remove([ruta]);
    }

    const { error } = await supabase
      .from("fotos_trabajos_mecanicos")
      .delete()
      .eq("id", factura.id);

    if (error) {
      console.log(error);
      alert(JSON.stringify(error, null, 2));
      return;
    }

    alert("Factura/compra eliminada correctamente.");
    await cargarDatos();
  };

  const generarNumeroFactura = (trabajo) => {
    const year = new Date().getFullYear();
    const numeroBase = trabajo.orden_id || trabajo.id || Date.now();
    return trabajo.numero_factura || `PC-${year}-${String(numeroBase).padStart(6, "0")}`;
  };

  const cargarLogoFactura = async () => {
    const posiblesLogos = [
      "/logo-pc-motors.png",
      "/pc-motors-logo.png",
      "/logo.jpg",
      "/logo.jpeg",
      "/logo.png",
      "/Logo oficial(1).png"
    ];

    for (const ruta of posiblesLogos) {
      try {
        const respuesta = await fetch(ruta);
        if (!respuesta.ok) continue;

        const blob = await respuesta.blob();
        const tipo = String(blob.type || "").toLowerCase();

        if (!tipo.includes("png") && !tipo.includes("jpeg") && !tipo.includes("jpg")) {
          console.warn(`Logo ignorado porque no es PNG/JPG válido: ${ruta}`);
          continue;
        }

        const dataUrl = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result);
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });

        const formato = tipo.includes("png") ? "PNG" : "JPEG";
        return { dataUrl, formato };
      } catch (error) {
        console.warn(`No se pudo cargar logo desde ${ruta}`, error);
      }
    }

    return null;
  };

  const ponerLogoEnTodasLasPaginas = (doc, logoInfo) => {
    if (!logoInfo?.dataUrl) return;

    const totalPaginas = doc.getNumberOfPages();

    for (let pagina = 1; pagina <= totalPaginas; pagina += 1) {
      try {
        doc.setPage(pagina);
        doc.addImage(logoInfo.dataUrl, logoInfo.formato || "PNG", 165, 10, 28, 28);
      } catch (error) {
        console.warn("No se pudo agregar el logo a la factura. La factura se generará sin logo.", error);
        return;
      }
    }
  };


  const subirFacturaClientePDF = async (trabajo, numeroFactura, doc, totalFacturaActual = 0) => {
    const nombreSeguro = String(numeroFactura || `factura-${Date.now()}`)
      .replace(/[^a-zA-Z0-9-_]/g, "-");

    const totalSeguro = String(Number(totalFacturaActual || 0).toFixed(2)).replace(".", "-");
    const versionUnica = Date.now();

    // IMPORTANTE:
    // Se usa una ruta única cada vez que se crea/actualiza la factura.
    // Así evitamos que el SMS siga enviando un PDF viejo guardado en el mismo link.
    const rutaPDF = `trabajo-${trabajo.id}/${nombreSeguro}-${totalSeguro}-${versionUnica}.pdf`;
    const pdfBlob = doc.output("blob");

    const { error: errorUpload } = await supabase.storage
      .from("facturas-clientes")
      .upload(rutaPDF, pdfBlob, {
        contentType: "application/pdf",
        upsert: false,
        cacheControl: "0"
      });

    if (errorUpload) {
      console.log(errorUpload);
      return {
        url: null,
        path: rutaPDF,
        error: errorUpload
      };
    }

    const { data } = supabase.storage
      .from("facturas-clientes")
      .getPublicUrl(rutaPDF);

    return {
      url: data?.publicUrl || null,
      path: rutaPDF,
      error: null
    };
  };

  const guardarLinkFacturaEnTrabajo = async (trabajoId, facturaUrl, facturaPath) => {
    if (!trabajoId || !facturaUrl) return { error: null };

    const { error } = await supabase
      .from("trabajos_mecanicos")
      .update({
        factura_pdf_url: facturaUrl,
        factura_pdf_path: facturaPath,
        factura_sms_estado: "pendiente"
      })
      .eq("id", trabajoId);

    return { error };
  };

  const limpiarLinkFacturaEnTrabajo = async (trabajoId) => {
    if (!trabajoId) return { error: null };

    const { error } = await supabase
      .from("trabajos_mecanicos")
      .update({
        factura_pdf_url: null,
        factura_pdf_path: null,
        factura_sms_estado: "error_upload_pdf"
      })
      .eq("id", trabajoId);

    return { error };
  };

  const guardarFacturaTrabajoSeguro = async (payloadFactura) => {
    const intentarGuardar = async (payload) => {
      return await supabase
        .from("facturas_trabajos")
        .upsert([payload], { onConflict: "trabajo_id" });
    };

    const primerIntento = await intentarGuardar(payloadFactura);

    if (!primerIntento.error) {
      return { error: null };
    }

    const mensaje = `${primerIntento.error.message || ""} ${primerIntento.error.details || ""}`.toLowerCase();
    const esColumnaGenerada =
      primerIntento.error.code === "428C9" ||
      mensaje.includes("generated column") ||
      mensaje.includes("non-default value");

    if (!esColumnaGenerada) {
      return { error: primerIntento.error };
    }

    const payloadSinColumnasGeneradas = { ...payloadFactura };
    delete payloadSinColumnasGeneradas.total;
    delete payloadSinColumnasGeneradas.ganancia_piezas;
    delete payloadSinColumnasGeneradas.total_generado;

    const segundoIntento = await intentarGuardar(payloadSinColumnasGeneradas);
    return { error: segundoIntento.error || null };
  };

  const crearFacturaPDF = async (trabajo) => {
    if (!trabajo) return;

    // Siempre buscamos el trabajo más reciente en Supabase antes de generar la factura.
    // Esto evita crear/enviar un PDF con valores viejos que ya no coinciden con la pantalla.
    const { data: trabajoActualizado, error: errorTrabajoActualizado } = await supabase
      .from("trabajos_mecanicos")
      .select("*")
      .eq("id", trabajo.id)
      .single();

    if (errorTrabajoActualizado) {
      console.log(errorTrabajoActualizado);
      alert("No se pudo leer la información actualizada del trabajo antes de crear la factura.");
      return;
    }

    trabajo = trabajoActualizado || trabajo;

    const numeroFactura = generarNumeroFactura(trabajo);
    const totalesFactura = calcularTotalesContabilidad(
      trabajo.costo_piezas,
      trabajo.venta_piezas,
      trabajo.mano_obra
    );
    const totalFactura = Number(totalesFactura.totalGenerado || 0);

    const confirmar = confirm(
      `¿Crear/actualizar factura ${numeroFactura} para ${trabajo.cliente_nombre || "cliente no registrado"}?\n\nTotal actual que tendrá la factura: ${dinero(totalFactura)}`
    );
    if (!confirmar) return;

    const payloadFactura = {
      trabajo_id: trabajo.id,
      numero_factura: numeroFactura,
      cliente_nombre: trabajo.cliente_nombre || null,
      vehiculo: trabajo.vehiculo || null,
      trabajo_realizado: trabajo.trabajo || null,
      costo_piezas: Number(totalesFactura.costoPiezas || 0),
      venta_piezas: Number(totalesFactura.ventaPiezas || 0),
      mano_obra: Number(totalesFactura.manoObra || 0),
      total: totalFactura,
      mecanico_nombre: trabajo.mecanico_nombre || null
    };

    const { error: errorFactura } = await guardarFacturaTrabajoSeguro(payloadFactura);

    if (errorFactura) {
      console.log(errorFactura);
      const continuarPDF = confirm(
        "No se pudo guardar/actualizar la factura en Supabase, pero sí puedo descargar el PDF.\n\n" +
        "¿Quieres descargar la factura PDF de todas formas?\n\n" +
        JSON.stringify(errorFactura, null, 2)
      );

      if (!continuarPDF) return;
    }

    const { error: errorTrabajo } = await supabase
      .from("trabajos_mecanicos")
      .update({
        numero_factura: numeroFactura,
        factura_creada_en: new Date().toISOString(),
        costo_piezas: totalesFactura.costoPiezas,
        venta_piezas: totalesFactura.ventaPiezas,
        mano_obra: totalesFactura.manoObra
      })
      .eq("id", trabajo.id);

    if (errorTrabajo) {
      console.log(errorTrabajo);
      alert(JSON.stringify(errorTrabajo, null, 2));
      return;
    }

    const logoInfo = await cargarLogoFactura();
    const doc = new jsPDF();
    let y = 18;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(22);
    doc.text("PC MOTORS", 105, y, { align: "center" });

    y += 10;
    doc.setFontSize(15);
    doc.text("Factura de Servicio", 105, y, { align: "center" });

    y += 16;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);

    const escribir = (label, valor) => {
      doc.setFont("helvetica", "bold");
      doc.text(label, 20, y);
      doc.setFont("helvetica", "normal");
      doc.text(String(valor || "-"), 70, y);
      y += 8;
    };

    escribir("Factura:", numeroFactura);
    escribir("Fecha:", new Date().toLocaleString("en-US", { timeZone: "America/New_York" }));
    escribir("Origen:", mostrarOrigenTexto(trabajo));
    escribir("Orden:", trabajo.orden_id ? `#${trabajo.orden_id}` : "-");
    escribir("Cliente:", trabajo.cliente_nombre || "No registrado");
    escribir("Vehículo:", trabajo.vehiculo || "No registrado");
    escribir("Mecánico:", trabajo.mecanico_nombre || "No registrado");
    escribir("Diagnóstico:", convertirMinutos(minutosDiagnosticoActual(trabajo)));
    escribir("Reparación:", convertirMinutos(minutosReparacionActual(trabajo)));
    escribir("Tiempo total:", convertirMinutos(minutosTotalFases(trabajo) || trabajo.minutos_trabajados || 0));

    y += 4;
    doc.line(20, y, 190, y);
    y += 10;

    doc.setFont("helvetica", "bold");
    doc.text("Trabajo realizado / Diagnóstico:", 20, y);
    y += 8;

    doc.setFont("helvetica", "normal");
    const descripcion = doc.splitTextToSize(trabajo.trabajo || "Sin descripción", 170);
    doc.text(descripcion, 20, y);
    y += descripcion.length * 7 + 8;

    doc.setFont("helvetica", "bold");
    doc.text("Resultado del diagnóstico:", 20, y);
    y += 8;
    doc.setFont("helvetica", "normal");
    const resultadoDiagnostico = doc.splitTextToSize(trabajo.resultado_diagnostico || "Pendiente", 170);
    doc.text(resultadoDiagnostico, 20, y);
    y += resultadoDiagnostico.length * 7 + 8;

    const filaDinero = (label, valor) => {
      doc.setFont("helvetica", "bold");
      doc.text(label, 20, y);
      doc.setFont("helvetica", "normal");
      doc.text(dinero(valor), 155, y);
      y += 9;
    };

    const lineasClienteFactura = calcularLineasClienteEstimado(
      trabajo.estimado_piezas,
      trabajo.mano_obra,
      trabajo.estimado_descuento,
      trabajo.estimado_servicios
    );

    const tieneDetalleEstimado =
      lineasClienteFactura.lineasPiezas.length > 0 ||
      lineasClienteFactura.lineasServicios.length > 0;

    if (tieneDetalleEstimado) {
      if (lineasClienteFactura.lineasServicios.length > 0) {
        doc.setFont("helvetica", "bold");
        doc.text("Servicios:", 20, y);
        y += 8;
        lineasClienteFactura.lineasServicios.forEach((servicio) => {
          doc.setFont("helvetica", "normal");
          doc.text(String(servicio.nombre || "Servicio"), 20, y);
          doc.text(dinero(servicio.total), 155, y);
          y += 8;
          if (y > 260) {
            doc.addPage();
            y = 20;
          }
        });
        y += 4;
      }

      if (lineasClienteFactura.lineasPiezas.length > 0) {
        doc.setFont("helvetica", "bold");
        doc.text("Piezas:", 20, y);
        y += 8;
        lineasClienteFactura.lineasPiezas.forEach((pieza) => {
          doc.setFont("helvetica", "normal");
          doc.text(String(pieza.nombre || "Pieza"), 20, y);
          doc.text(dinero(pieza.total), 155, y);
          y += 8;
          if (y > 260) {
            doc.addPage();
            y = 20;
          }
        });
        y += 4;
      }
    } else {
      filaDinero("Piezas:", redondearDinero(totalesFactura.ventaPiezas + totalesFactura.cargoPiezas6));
      filaDinero("Mano de obra:", redondearDinero(totalesFactura.manoObra + totalesFactura.cargoGeneral4));
    }

    y += 3;
    doc.line(20, y, 190, y);
    y += 12;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(15);
    doc.text("TOTAL:", 20, y);
    doc.text(dinero(totalFactura), 155, y);

    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text("Gracias por confiar en PC Motors.", 105, 280, { align: "center" });

    ponerLogoEnTodasLasPaginas(doc, logoInfo);

    const resultadoUploadPDF = await subirFacturaClientePDF(trabajo, numeroFactura, doc, totalFactura);

    let mensajeFinal = `Factura ${numeroFactura} creada/actualizada y descargada correctamente.`;

    if (resultadoUploadPDF.error) {
      console.log(resultadoUploadPDF.error);

      // Si falló la subida, borramos el link guardado para evitar enviar por SMS una factura vieja.
      const { error: errorLimpiarLink } = await limpiarLinkFacturaEnTrabajo(trabajo.id);
      if (errorLimpiarLink) {
        console.log(errorLimpiarLink);
      }

      mensajeFinal +=
        `\n\nOJO: La factura se descargó, pero NO se pudo subir al bucket facturas-clientes.` +
        `\n\nPor seguridad, el link viejo de factura fue removido para que no se envíe una factura incorrecta por SMS.` +
        `\n\nRevisa Storage / Policies del bucket facturas-clientes.`;
    } else if (resultadoUploadPDF.url) {
      const { error: errorGuardarUrl } = await guardarLinkFacturaEnTrabajo(
        trabajo.id,
        resultadoUploadPDF.url,
        resultadoUploadPDF.path
      );

      if (errorGuardarUrl) {
        console.log(errorGuardarUrl);
        mensajeFinal += `\n\nOJO: La factura se subió al bucket, pero no se pudo guardar factura_pdf_url en trabajos_mecanicos. Asegúrate de haber agregado las columnas factura_pdf_url y factura_pdf_path.`;
      } else {
        mensajeFinal += `\n\nLink guardado para enviar por SMS.`;
      }
    }

    doc.save(`${numeroFactura}.pdf`);
    alert(mensajeFinal);
    await cargarDatos();
  };



  const guardarEstimadoTrabajo = async (trabajo, piezas, servicios, manoObra, descuento = 0, estadoEstimado = "estimado_pendiente") => {
    const piezasLimpias = piezas.map(normalizarPiezaEstimado);
    const serviciosLimpios = servicios.map(normalizarServicioEstimado);
    const serviciosMecanicos = serviciosMecanicosDesdeServicios(serviciosLimpios);
    const manoObraFinal = serviciosLimpios.length > 0 ? calcularManoObraDesdeServiciosMecanicos(serviciosLimpios) : Number(manoObra || 0);
    const totalesEstimado = calcularTotalesEstimado(piezasLimpias, manoObraFinal, descuento, serviciosLimpios);

    const payloadEstimado = {
      estimado_estado: estadoEstimado,
      estimado_piezas: piezasLimpias,
      estimado_servicios: serviciosLimpios,
      servicios_mecanicos: serviciosMecanicos,
      estimado_mano_obra: totalesEstimado.manoObra,
      estimado_descuento: totalesEstimado.descuento,
      estimado_creado_en: new Date().toISOString(),
      estado: "estimado_pendiente",
      fase_actual: "estimado_pendiente",
      costo_piezas: totalesEstimado.costoPiezas,
      venta_piezas: totalesEstimado.ventaPiezas,
      mano_obra: totalesEstimado.manoObra
    };

    let { error } = await supabase
      .from("trabajos_mecanicos")
      .update(payloadEstimado)
      .eq("id", trabajo.id);

    if (error) {
      const mensaje = `${error.message || ""} ${error.details || ""}`.toLowerCase();

      if (mensaje.includes("servicios_mecanicos")) {
        console.log(error);
        const payloadSinServiciosMecanicos = { ...payloadEstimado };
        delete payloadSinServiciosMecanicos.servicios_mecanicos;

        const segundoIntento = await supabase
          .from("trabajos_mecanicos")
          .update(payloadSinServiciosMecanicos)
          .eq("id", trabajo.id);

        error = segundoIntento.error;

        if (!error) {
          alert(
            "Estimado guardado, pero falta crear la columna servicios_mecanicos en Supabase.\n\n" +
            "Hasta que agregues esa columna, el sistema no podrá dividir correctamente la comisión por servicio/mecánico."
          );
          return true;
        }
      }

      console.log(error);
      alert(JSON.stringify(error, null, 2));
      return false;
    }

    return true;
  };

  const crearEditarEstimado = (trabajo) => {
    if (!trabajo) return;

    const piezasActuales = parsearEstimadoPiezas(trabajo.estimado_piezas).map(normalizarPiezaEstimado);
    const serviciosActuales = parsearEstimadoServicios(trabajo.estimado_servicios).map(normalizarServicioEstimado);

    setEstimadoEditandoId(trabajo.id);
    setEstimadoDraft({
      piezas: piezasActuales.length > 0
        ? piezasActuales
        : [
            {
              id: `${Date.now()}-0`,
              nombre: "",
              cantidad: 1,
              costo: 0,
              costo_real: 0,
              precio_normal: 0,
              precio_sugerido: 0,
              venta: 0,
              precio_cliente_manual: false
            }
          ],
      servicios: serviciosActuales,
      mano_obra: String(serviciosActuales.length > 0 ? sumarServiciosEstimado(serviciosActuales) : (trabajo.estimado_mano_obra || trabajo.mano_obra || "")),
      descuento: String(trabajo.estimado_descuento || ""),
      servicio_id: "",
      servicio_nombre: "",
      servicio_precio: "",
      servicio_mecanico_id: trabajo.mecanico_id ? String(trabajo.mecanico_id) : ""
    });
  };

  const cancelarEditorEstimado = () => {
    setEstimadoEditandoId(null);
    setEstimadoDraft({
      piezas: [],
      servicios: [],
      mano_obra: "",
      descuento: "",
      servicio_id: "",
      servicio_nombre: "",
      servicio_precio: "",
      servicio_mecanico_id: ""
    });
  };

  const actualizarPiezaDraft = (index, campo, valor) => {
    setEstimadoDraft((prev) => {
      const piezas = [...(prev.piezas || [])];
      const piezaActual = piezas[index] || {};

      if (campo === "nombre") {
        piezas[index] = {
          ...piezaActual,
          nombre: valor
        };
      } else if (
        campo === "venta" ||
        campo === "precio_venta" ||
        campo === "precio_cliente"
      ) {
        const precioCliente = Number(valor || 0);
        piezas[index] = {
          ...piezaActual,
          cantidad: 1,
          costo: Number(piezaActual.costo || piezaActual.costo_real || 0),
          costo_real: Number(piezaActual.costo_real || piezaActual.costo || 0),
          precio_normal: Number(piezaActual.precio_normal || 0),
          venta: precioCliente,
          precio_venta: precioCliente,
          precio_cliente: precioCliente,
          precio_cliente_manual: true
        };
      } else if (campo === "costo" || campo === "costo_real" || campo === "precio_normal") {
        const nuevoValor = Number(valor || 0);
        const costoReal = campo === "precio_normal"
          ? Number(piezaActual.costo_real ?? piezaActual.costo ?? 0)
          : nuevoValor;
        const precioNormal = campo === "precio_normal"
          ? nuevoValor
          : Number(piezaActual.precio_normal || 0);
        const precioSugerido = calcularPrecioPromedioPieza(costoReal, precioNormal);
        const precioClienteActual = Number(
          piezaActual.venta ??
          piezaActual.precio_venta ??
          piezaActual.precio_cliente ??
          0
        );
        const debeActualizarPrecioCliente =
          !piezaActual.precio_cliente_manual || precioClienteActual <= 0;

        const piezaActualizada = {
          ...piezaActual,
          cantidad: 1,
          costo: costoReal,
          costo_real: costoReal,
          precio_normal: precioNormal,
          precio_sugerido: precioSugerido,
          precio_promedio: precioSugerido
        };

        if (debeActualizarPrecioCliente) {
          piezaActualizada.venta = precioSugerido;
          piezaActualizada.precio_venta = precioSugerido;
          piezaActualizada.precio_cliente = precioSugerido;
        }

        piezas[index] = piezaActualizada;
      } else {
        piezas[index] = {
          ...piezaActual,
          [campo]: Number(valor || 0)
        };
      }

      return { ...prev, piezas };
    });
  };

  const agregarPiezaDraft = () => {
    setEstimadoDraft((prev) => ({
      ...prev,
      piezas: [
        ...(prev.piezas || []),
        {
          id: `${Date.now()}-${(prev.piezas || []).length}`,
          nombre: "",
          cantidad: 1,
          costo: 0,
          costo_real: 0,
          precio_normal: 0,
          precio_sugerido: 0,
          venta: 0,
          precio_cliente_manual: false
        }
      ]
    }));
  };

  const eliminarPiezaDraft = (index) => {
    setEstimadoDraft((prev) => {
      const piezas = [...(prev.piezas || [])];
      piezas.splice(index, 1);
      return { ...prev, piezas };
    });
  };

  const aplicarServicioManoObra = (servicioId) => {
    const servicio = catalogoManoObra.find((item) => String(item.id) === String(servicioId));

    if (!servicio) {
      setEstimadoDraft((prev) => ({
        ...prev,
        servicio_id: "",
        servicio_nombre: "",
        servicio_precio: ""
      }));
      return;
    }

    setEstimadoDraft((prev) => ({
      ...prev,
      servicio_id: String(servicio.id),
      servicio_nombre: servicio.servicio || "",
      servicio_precio: String(precioSugeridoServicio(servicio) || "")
    }));
  };

  const agregarServicioDraft = () => {
    const nombre = String(estimadoDraft.servicio_nombre || "").trim();
    const precio = Number(estimadoDraft.servicio_precio || 0);
    const mecanicoServicio = mecanicos.find(
      (m) => String(m.id) === String(estimadoDraft.servicio_mecanico_id)
    );

    if (!nombre) {
      alert("Escribe el nombre del servicio o selecciona uno del catálogo antes de agregarlo.");
      return;
    }

    if (!Number.isFinite(precio) || precio < 0) {
      alert("El precio del servicio no es válido.");
      return;
    }

    if (!mecanicoServicio) {
      alert("Selecciona qué mecánico realizará este servicio.");
      return;
    }

    setEstimadoDraft((prev) => {
      const servicios = [
        ...(prev.servicios || []),
        {
          id: `${Date.now()}-servicio-${(prev.servicios || []).length}`,
          catalogo_id: prev.servicio_id || null,
          nombre,
          precio,
          mecanico_id: mecanicoServicio.id,
          mecanico_nombre: mecanicoServicio.nombre,
          minutos: 0
        }
      ];

      return {
        ...prev,
        servicios,
        mano_obra: String(sumarServiciosEstimado(servicios)),
        servicio_id: "",
        servicio_nombre: "",
        servicio_precio: ""
      };
    });
  };

  const actualizarServicioDraft = (index, campo, valor) => {
    setEstimadoDraft((prev) => {
      const servicios = [...(prev.servicios || [])];
      const servicioActual = servicios[index] || {};

      if (campo === "mecanico_id") {
        const mecanicoSeleccionado = mecanicos.find((m) => String(m.id) === String(valor));
        servicios[index] = {
          ...servicioActual,
          mecanico_id: valor || null,
          mecanico_nombre: mecanicoSeleccionado?.nombre || ""
        };
      } else {
        servicios[index] = {
          ...servicioActual,
          [campo]: campo === "nombre" ? valor : Number(valor || 0)
        };
      }

      return { ...prev, servicios, mano_obra: String(sumarServiciosEstimado(servicios)) };
    });
  };

  const eliminarServicioDraft = (index) => {
    setEstimadoDraft((prev) => {
      const servicios = [...(prev.servicios || [])];
      servicios.splice(index, 1);
      return { ...prev, servicios, mano_obra: String(sumarServiciosEstimado(servicios)) };
    });
  };

  const guardarEstimadoDesdeEditor = async (trabajo) => {
    if (!trabajo) return;

    const piezas = (estimadoDraft.piezas || [])
      .map((pieza, index) => {
        const costoReal = Number(pieza.costo_real ?? pieza.costo ?? 0);
        const precioNormal = Number(pieza.precio_normal ?? 0);
        const precioSugerido = calcularPrecioPromedioPieza(costoReal, precioNormal);
        const precioCliente = Number(
          pieza.venta ??
          pieza.precio_venta ??
          pieza.precio_cliente ??
          pieza.precio ??
          precioSugerido ??
          0
        );

        return {
          id: pieza.id || `${Date.now()}-${index}`,
          nombre: String(pieza.nombre || `Pieza ${index + 1}`).trim(),
          cantidad: 1,
          costo: costoReal,
          costo_real: costoReal,
          precio_normal: precioNormal,
          precio_sugerido: precioSugerido,
          precio_promedio: precioSugerido,
          venta: precioCliente,
          precio_venta: precioCliente,
          precio_cliente: precioCliente,
          precio_cliente_manual: Boolean(pieza.precio_cliente_manual)
        };
      })
      .filter((pieza) => {
        return (
          String(pieza.nombre || "").trim() ||
          Number(pieza.costo || 0) > 0 ||
          Number(pieza.precio_normal || 0) > 0 ||
          Number(pieza.venta || 0) > 0
        );
      });

    const servicios = (estimadoDraft.servicios || [])
      .map(normalizarServicioEstimado)
      .filter((servicio) => String(servicio.nombre || "").trim() || Number(servicio.precio || 0) > 0);

    const manoObra = servicios.length > 0 ? sumarServiciosEstimado(servicios) : Number(estimadoDraft.mano_obra || 0);
    const descuento = Number(estimadoDraft.descuento || 0);

    if (!Number.isFinite(manoObra) || manoObra < 0 || !Number.isFinite(descuento) || descuento < 0) {
      alert("La mano de obra o el descuento no son válidos.");
      return;
    }

    const servicioInvalido = servicios.find((servicio) => {
      return !String(servicio.nombre || "").trim() || !Number.isFinite(Number(servicio.precio)) || Number(servicio.precio) < 0;
    });

    if (servicioInvalido) {
      alert("Revisa los servicios: cada servicio debe tener nombre y precio válido.");
      return;
    }

    const servicioSinMecanico = servicios.find((servicio) => {
      return !String(servicio.mecanico_nombre || "").trim();
    });

    if (servicioSinMecanico) {
      alert("Revisa los servicios: cada servicio debe tener un mecánico asignado para poder calcular la comisión exacta.");
      return;
    }

    const piezaInvalida = piezas.find((pieza) => {
      return (
        !String(pieza.nombre || "").trim() ||
        !Number.isFinite(Number(pieza.venta)) ||
        Number(pieza.venta) < 0
      );
    });

    if (piezaInvalida) {
      alert("Revisa las piezas: cada pieza debe tener nombre y precio de la pieza para el cliente.");
      return;
    }

    if (piezas.length === 0 && servicios.length === 0 && manoObra <= 0) {
      alert("Agrega al menos una pieza o una mano de obra.");
      return;
    }

    const totales = calcularTotalesEstimado(piezas, manoObra, descuento, servicios);
    const confirmar = confirm(
      `Guardar estimado para ${trabajo.cliente_nombre || "cliente"}?\n\n` +
      `Piezas al cliente: ${dinero(totales.piezasCliente)}\n` +
      `Mano de obra final: ${dinero(totales.manoObraCliente)}\n` +
      `Total estimado: ${dinero(totales.totalGenerado)}`
    );

    if (!confirmar) return;

    const ok = await guardarEstimadoTrabajo(trabajo, piezas, servicios, manoObra, descuento, "estimado_pendiente");
    if (!ok) return;

    cancelarEditorEstimado();
    alert("Estimado guardado correctamente.");
    await cargarDatos();
  };

  const crearPDFEstimado = async (trabajo, descargar = true) => {
    if (!trabajo) return null;

    let trabajoPDF = trabajo;

    const { data: trabajoActualizado, error: errorTrabajoActualizado } = await supabase
      .from("trabajos_mecanicos")
      .select("*")
      .eq("id", trabajo.id)
      .maybeSingle();

    if (errorTrabajoActualizado) {
      console.log("No se pudo recargar el estimado actualizado:", errorTrabajoActualizado);
    } else if (trabajoActualizado) {
      trabajoPDF = trabajoActualizado;
    }

    const piezas = parsearEstimadoPiezas(trabajoPDF.estimado_piezas).map(normalizarPiezaEstimado);
    const servicios = parsearEstimadoServicios(trabajoPDF.estimado_servicios).map(normalizarServicioEstimado);
    const manoObraPDF = servicios.length > 0 ? sumarServiciosEstimado(servicios) : Number(trabajoPDF.estimado_mano_obra || trabajoPDF.mano_obra || 0);
    const descuentoPDF = Number(trabajoPDF.estimado_descuento || 0);

    if (piezas.length === 0 && servicios.length === 0 && manoObraPDF <= 0) {
      alert("Primero crea un estimado con piezas o mano de obra.");
      return null;
    }

    const numeroEstimado = `EST-${generarNumeroFactura(trabajoPDF)}`;
    const totales = calcularTotalesEstimado(piezas, manoObraPDF, descuentoPDF, servicios);

    const logoInfo = await cargarLogoFactura();
    const doc = new jsPDF();
    let y = 18;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(22);
    doc.text("PC MOTORS", 105, y, { align: "center" });

    y += 10;
    doc.setFontSize(15);
    doc.text("Estimado de Servicio", 105, y, { align: "center" });

    y += 16;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);

    const escribir = (label, valor) => {
      doc.setFont("helvetica", "bold");
      doc.text(label, 20, y);
      doc.setFont("helvetica", "normal");
      doc.text(String(valor || "-"), 70, y);
      y += 8;
    };

    escribir("Estimado:", numeroEstimado);
    escribir("Fecha:", new Date().toLocaleString("en-US", { timeZone: "America/New_York" }));
    escribir("Cliente:", trabajoPDF.cliente_nombre || "No registrado");
    escribir("Vehículo:", trabajoPDF.vehiculo || "No registrado");
    escribir("Diagnóstico:", trabajoPDF.resultado_diagnostico || trabajoPDF.trabajo || "Pendiente");

    y += 4;
    doc.line(20, y, 190, y);
    y += 10;

    doc.setFont("helvetica", "bold");
    doc.text("Detalle del estimado:", 20, y);
    y += 8;

    doc.setFont("helvetica", "bold");
    if (servicios.length > 0) {
      doc.text("Servicios:", 20, y);
      y += 8;
      doc.setFont("helvetica", "normal");
      servicios.forEach((servicio) => {
        doc.text(String(servicio.nombre || "Servicio").substring(0, 70), 20, y);
        doc.text(dinero(servicio.precio), 155, y);
        y += 8;
        if (y > 260) {
          doc.addPage();
          y = 20;
        }
      });
      y += 4;
    }

    if (piezas.length > 0) {
      doc.setFont("helvetica", "bold");
      doc.text("Piezas:", 20, y);
      y += 8;
    }

    doc.setFont("helvetica", "normal");
    piezas.forEach((pieza) => {
      const precioPiezaCliente = Number(
        pieza.venta ??
        pieza.precio_venta ??
        pieza.precio_cliente ??
        pieza.precio ??
        0
      );
      const totalLineaConCargo = redondearDinero(precioPiezaCliente * Number(pieza.cantidad || 1) * 1.06);
      const textoPieza = `${pieza.cantidad} x ${pieza.nombre}`;
      doc.text(textoPieza.substring(0, 70), 20, y);
      doc.text(dinero(totalLineaConCargo), 155, y);
      y += 8;
      if (y > 260) {
        doc.addPage();
        y = 20;
      }
    });

    const filaDinero = (label, valor) => {
      doc.setFont("helvetica", "bold");
      doc.text(label, 20, y);
      doc.setFont("helvetica", "normal");
      doc.text(dinero(valor), 155, y);
      y += 9;
    };

    y += 4;
    filaDinero("Piezas:", lineasClientePDF.piezasCliente);
    filaDinero("Mano de obra:", lineasClientePDF.manoObraCliente);
    if (lineasClientePDF.descuento > 0) filaDinero("Descuento:", -lineasClientePDF.descuento);

    y += 3;
    doc.line(20, y, 190, y);
    y += 12;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(15);
    doc.text("TOTAL ESTIMADO:", 20, y);
    doc.text(dinero(lineasClientePDF.totalGenerado), 155, y);

    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text("Este estimado puede cambiar si se encuentran trabajos adicionales.", 105, 280, { align: "center" });

    ponerLogoEnTodasLasPaginas(doc, logoInfo);

    const nombreSeguro = String(numeroEstimado).replace(/[^a-zA-Z0-9-_]/g, "-");
    const rutaPDF = `estimados/trabajo-${trabajoPDF.id}/${nombreSeguro}-${Date.now()}.pdf`;
    const pdfBlob = doc.output("blob");

    const { error: errorUpload } = await supabase.storage
      .from("facturas-clientes")
      .upload(rutaPDF, pdfBlob, { contentType: "application/pdf", upsert: true });

    if (errorUpload) {
      console.log(errorUpload);
      alert("El estimado se generó, pero no se pudo subir al bucket facturas-clientes.");
      if (descargar) doc.save(`${numeroEstimado}.pdf`);
      return null;
    }

    const { data } = supabase.storage.from("facturas-clientes").getPublicUrl(rutaPDF);
    const publicUrl = data?.publicUrl || null;

    const { error } = await supabase
      .from("trabajos_mecanicos")
      .update({
        estimado_pdf_url: publicUrl,
        estimado_pdf_path: rutaPDF,
        estimado_creado_en: new Date().toISOString(),
        estimado_estado: trabajoPDF.estimado_estado && trabajoPDF.estimado_estado !== "sin_estimado" ? trabajoPDF.estimado_estado : "estimado_pendiente"
      })
      .eq("id", trabajoPDF.id);

    if (error) {
      console.log(error);
      alert(JSON.stringify(error, null, 2));
      return null;
    }

    if (descargar) doc.save(`${numeroEstimado}.pdf`);
    await cargarDatos();
    return publicUrl;
  };

  const aprobarEstimado = async (trabajo) => {
    const piezas = parsearEstimadoPiezas(trabajo.estimado_piezas).map(normalizarPiezaEstimado);
    const servicios = parsearEstimadoServicios(trabajo.estimado_servicios).map(normalizarServicioEstimado);
    const manoObraAprobada = servicios.length > 0 ? sumarServiciosEstimado(servicios) : Number(trabajo.estimado_mano_obra || 0);
    const totales = calcularTotalesEstimado(piezas, manoObraAprobada, trabajo.estimado_descuento || 0, servicios);

    const confirmar = confirm(`¿Aprobar estimado de ${dinero(totales.totalGenerado)} y pasar a esperando piezas?`);
    if (!confirmar) return;

    const { error } = await supabase
      .from("trabajos_mecanicos")
      .update({
        estimado_estado: "estimado_aprobado",
        estimado_aprobado_en: new Date().toISOString(),
        estado: "esperando_piezas",
        fase_actual: "esperando_piezas",
        costo_piezas: totales.costoPiezas,
        venta_piezas: totales.ventaPiezas,
        mano_obra: totales.manoObra
      })
      .eq("id", trabajo.id);

    if (error) {
      console.log(error);
      alert(JSON.stringify(error, null, 2));
      return;
    }

    alert("Estimado aprobado. Ahora puedes marcar piezas ordenadas o recibidas.");
    await cargarDatos();
  };

  const rechazarEstimado = async (trabajo) => {
    const confirmar = confirm("¿Marcar este estimado como rechazado?");
    if (!confirmar) return;

    const { error } = await supabase
      .from("trabajos_mecanicos")
      .update({
        estimado_estado: "estimado_rechazado",
        estimado_rechazado_en: new Date().toISOString(),
        estado: "estimado_rechazado",
        fase_actual: "estimado_rechazado"
      })
      .eq("id", trabajo.id);

    if (error) {
      console.log(error);
      alert(JSON.stringify(error, null, 2));
      return;
    }

    alert("Estimado marcado como rechazado.");
    await cargarDatos();
  };

  const marcarPiezasOrdenadas = async (trabajo) => {
    const { error } = await supabase
      .from("trabajos_mecanicos")
      .update({
        estimado_estado: "piezas_ordenadas",
        estado: "piezas_ordenadas",
        fase_actual: "piezas_ordenadas",
        piezas_ordenadas_en: new Date().toISOString()
      })
      .eq("id", trabajo.id);

    if (error) {
      console.log(error);
      alert(JSON.stringify(error, null, 2));
      return;
    }

    await cargarDatos();
  };

  const marcarPiezasRecibidas = async (trabajo) => {
    const { error } = await supabase
      .from("trabajos_mecanicos")
      .update({
        estimado_estado: "piezas_recibidas",
        estado: "piezas_recibidas",
        fase_actual: "piezas_recibidas",
        piezas_recibidas_en: new Date().toISOString()
      })
      .eq("id", trabajo.id);

    if (error) {
      console.log(error);
      alert(JSON.stringify(error, null, 2));
      return;
    }

    await cargarDatos();
  };

  const generarTokenEstimado = () => {
    if (window.crypto?.randomUUID) return window.crypto.randomUUID();
    return `${Date.now()}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
  };

  const obtenerOCrearTokenEstimado = async (trabajo) => {
    if (!trabajo?.id) return null;
    if (trabajo.estimado_token) return trabajo.estimado_token;

    const token = generarTokenEstimado();

    const { error } = await supabase
      .from("trabajos_mecanicos")
      .update({ estimado_token: token })
      .eq("id", trabajo.id);

    if (error) {
      console.log(error);
      alert("No se pudo crear el token de firma del estimado. Revisa que la columna estimado_token exista en trabajos_mecanicos.");
      return null;
    }

    return token;
  };

  const obtenerLinkFirmaEstimado = async (trabajo) => {
    if (!trabajo) return null;

    const token = await obtenerOCrearTokenEstimado(trabajo);
    if (!token) return null;

    return `${obtenerBasePublicaApp()}/firma-estimado/${token}`;
  };

  const copiarLinkFirmaEstimado = async (trabajo) => {
    const linkFirma = await obtenerLinkFirmaEstimado(trabajo);

    if (!linkFirma) {
      alert("No se pudo crear el link de firma del estimado.");
      return;
    }

    try {
      await navigator.clipboard.writeText(linkFirma);
      alert(`Link de firma copiado:\n\n${linkFirma}`);
    } catch {
      prompt("Copia este link de firma:", linkFirma);
    }

    await cargarDatos();
  };

  const enviarEstimadoSMS = async (trabajo) => {
    if (!trabajo) return;

    const estimadoUrlNuevo = await crearPDFEstimado(trabajo, false);

    if (!estimadoUrlNuevo) {
      alert("No se pudo generar el PDF actualizado del estimado para enviarlo por SMS.");
      return;
    }

    const trabajoParaFirma = {
      ...trabajo,
      estimado_pdf_url: estimadoUrlNuevo
    };

    const linkFirma = await obtenerLinkFirmaEstimado(trabajoParaFirma);

    if (!linkFirma) {
      alert("No se pudo crear el link para que el cliente firme el estimado.");
      return;
    }

    let telefono = await obtenerTelefonoClienteTrabajo(trabajo);
    if (!telefono) {
      telefono = prompt("Este cliente no tiene teléfono guardado. Escribe el número para preparar el SMS:") || "";
    }

    const telefonoSMS = normalizarTelefonoParaSMS(telefono);
    if (!telefonoSMS) {
      alert("No hay teléfono válido para preparar el mensaje.");
      return;
    }

    const linkFirmaConCache = `${linkFirma}${linkFirma.includes("?") ? "&" : "?"}v=${Date.now()}`;

    const mensaje = `Hola ${trabajo.cliente_nombre || "cliente"}, gracias por confiar en PC Motors.\n\nRevise su estimado aquí y fírmelo desde su teléfono para aprobar el trabajo:\n${linkFirmaConCache}\n\nPC Motors Auto Repair`;
    const separador = navigator.userAgent.includes("iPhone") || navigator.userAgent.includes("iPad") ? "&" : "?";
    window.location.href = `sms:${telefonoSMS}${separador}body=${encodeURIComponent(mensaje)}`;

    await cargarDatos();
  };

  const normalizarTelefonoParaSMS = (telefono) => {
    const limpio = String(telefono || "").replace(/[^0-9+]/g, "");
    if (!limpio) return "";
    if (limpio.startsWith("+")) return limpio;
    if (limpio.length === 10) return `+1${limpio}`;
    if (limpio.length === 11 && limpio.startsWith("1")) return `+${limpio}`;
    return limpio;
  };

  const obtenerTelefonoClienteTrabajo = async (trabajo) => {
    if (trabajo?.telefono) return trabajo.telefono;
    if (trabajo?.cliente_telefono) return trabajo.cliente_telefono;

    if (trabajo?.cliente_id) {
      const { data, error } = await supabase
        .from("clientes")
        .select("telefono")
        .eq("id", trabajo.cliente_id)
        .maybeSingle();

      if (error) {
        console.log(error);
      }

      if (data?.telefono) return data.telefono;
    }

    return "";
  };

  const abrirSMSCliente = async (trabajo, tipoMensaje = "factura_resena") => {
    if (!trabajo) return;

    // Leemos el trabajo actualizado justo antes de preparar el SMS.
    // Así nunca usamos un link viejo que quedó en memoria en la pantalla.
    const { data: trabajoActualizado, error: errorTrabajoActualizado } = await supabase
      .from("trabajos_mecanicos")
      .select("*")
      .eq("id", trabajo.id)
      .single();

    if (errorTrabajoActualizado) {
      console.log(errorTrabajoActualizado);
      alert("No se pudo verificar la factura actual antes de preparar el SMS.");
      return;
    }

    trabajo = trabajoActualizado || trabajo;

    let telefono = await obtenerTelefonoClienteTrabajo(trabajo);

    if (!telefono) {
      telefono = prompt("Este cliente no tiene teléfono guardado. Escribe el número para preparar el SMS:") || "";
    }

    const telefonoSMS = normalizarTelefonoParaSMS(telefono);

    if (!telefonoSMS) {
      alert("No hay teléfono válido para preparar el mensaje.");
      return;
    }

    const facturaUrl = trabajo.factura_pdf_url || "";

    if ((tipoMensaje === "factura" || tipoMensaje === "factura_resena") && !facturaUrl) {
      alert(
        "Primero debes crear/actualizar la factura PDF correctamente.\n\n" +
        "No hay link de factura guardado o la última subida al bucket falló.\n\n" +
        "Esto evita enviar por SMS una factura vieja o incorrecta."
      );
      return;
    }

    const nombreCliente = trabajo.cliente_nombre || "cliente";
    let mensaje = "";

    if (tipoMensaje === "factura") {
      mensaje = `Hola ${nombreCliente}, gracias por confiar en PC Motors.\n\nSu factura está lista:\n${facturaUrl}\n\nPC Motors Auto Repair`;
    } else if (tipoMensaje === "resena") {
      mensaje = `Hola ${nombreCliente}, gracias por confiar en PC Motors.\n\nSi quedó satisfecho con nuestro servicio, le agradeceríamos mucho una reseña en Google:\n${GOOGLE_REVIEW_URL}\n\nPC Motors Auto Repair`;
    } else {
      mensaje = `Hola ${nombreCliente}, gracias por confiar en PC Motors.\n\nSu factura está lista:\n${facturaUrl}\n\nSi quedó satisfecho con nuestro servicio, le agradeceríamos mucho una reseña en Google:\n${GOOGLE_REVIEW_URL}\n\nPC Motors Auto Repair`;
    }

    await supabase
      .from("trabajos_mecanicos")
      .update({
        factura_sms_estado: tipoMensaje === "resena" ? "resena_preparada" : "sms_preparado",
        factura_enviada_sms_en: new Date().toISOString()
      })
      .eq("id", trabajo.id);

    const separador = navigator.userAgent.includes("iPhone") || navigator.userAgent.includes("iPad") ? "&" : "?";
    window.location.href = `sms:${telefonoSMS}${separador}body=${encodeURIComponent(mensaje)}`;
  };

  const eliminarTrabajoCompleto = async (trabajo) => {
    const confirmar = confirm(
      `¿ELIMINAR COMPLETAMENTE este trabajo?\n\nCliente: ${trabajo.cliente_nombre || "No registrado"}\nVehículo: ${trabajo.vehiculo || "No registrado"}\nMecánico: ${trabajo.mecanico_nombre || "No registrado"}\n\nEsto eliminará el trabajo, la factura generada y los registros de facturas/compras relacionados. Esta acción no se puede deshacer.`
    );
    if (!confirmar) return;

    const confirmarFinal = prompt('Para confirmar escribe exactamente: ELIMINAR');
    if (confirmarFinal !== "ELIMINAR") {
      alert("Eliminación cancelada.");
      return;
    }

    const { error: errorFacturasTrabajo } = await supabase
      .from("facturas_trabajos")
      .delete()
      .eq("trabajo_id", trabajo.id);

    if (errorFacturasTrabajo) {
      console.log(errorFacturasTrabajo);
      alert(JSON.stringify(errorFacturasTrabajo, null, 2));
      return;
    }

    const facturasTrabajo = facturas[trabajo.id] || [];
    const rutas = facturasTrabajo.map((factura) => extraerRutaStorage(factura.url)).filter(Boolean);
    if (rutas.length > 0) {
      await supabase.storage.from("facturas-mecanicos").remove(rutas);
    }

    const { error: errorFotos } = await supabase
      .from("fotos_trabajos_mecanicos")
      .delete()
      .eq("trabajo_id", trabajo.id);

    if (errorFotos) {
      console.log(errorFotos);
      alert(JSON.stringify(errorFotos, null, 2));
      return;
    }

    const relacionesCerradas = await cerrarOrdenYClienteRelacionado(trabajo);
    if (!relacionesCerradas) return;

    const { error: errorTrabajo } = await supabase
      .from("trabajos_mecanicos")
      .delete()
      .eq("id", trabajo.id);

    if (errorTrabajo) {
      console.log(errorTrabajo);
      alert(JSON.stringify(errorTrabajo, null, 2));
      return;
    }

    if (trabajoEditando?.id === trabajo.id) cancelarEdicion();
    alert("Trabajo eliminado correctamente.");
    await cargarDatos();
  };

  const cerrarOrdenYClienteRelacionado = async (trabajo) => {
    if (trabajo.orden_id) {
      const { error: errorTiempos } = await supabase
        .from("tiempos_mecanicos")
        .delete()
        .eq("orden_id", trabajo.orden_id);

      if (errorTiempos) {
        console.log(errorTiempos);
        alert(JSON.stringify(errorTiempos, null, 2));
        return false;
      }

      const { error: errorOrden } = await supabase
        .from("ordenes_trabajo")
        .update({
          estado: "Cancelado",
          notas: "Trabajo mecánico eliminado desde Control Trabajos."
        })
        .eq("id", trabajo.orden_id);

      if (errorOrden) {
        console.log(errorOrden);
        alert(JSON.stringify(errorOrden, null, 2));
        return false;
      }
    }

    if (trabajo.cliente_id) {
      const { data: otrosTrabajos, error: errorOtrosTrabajos } = await supabase
        .from("trabajos_mecanicos")
        .select("id, estado")
        .eq("cliente_id", trabajo.cliente_id)
        .neq("id", trabajo.id)
        .neq("estado", "finalizado");

      if (errorOtrosTrabajos) {
        console.log(errorOtrosTrabajos);
        alert(JSON.stringify(errorOtrosTrabajos, null, 2));
        return false;
      }

      const { data: ordenesAbiertas, error: errorOrdenesAbiertas } = await supabase
        .from("ordenes_trabajo")
        .select("id, estado")
        .eq("cliente_id", trabajo.cliente_id)
        .not("estado", "in", '("Terminado","Entregado","Cancelado")');

      if (errorOrdenesAbiertas) {
        console.log(errorOrdenesAbiertas);
        alert(JSON.stringify(errorOrdenesAbiertas, null, 2));
        return false;
      }

      if ((otrosTrabajos || []).length === 0 && (ordenesAbiertas || []).length === 0) {
        const { error: errorCliente } = await supabase
          .from("clientes")
          .update({
            estado: "finalizado",
            finalizado_en: new Date().toISOString(),
            notas: "Cliente removido de activos al eliminar su trabajo desde Control Trabajos."
          })
          .eq("id", trabajo.cliente_id)
          .eq("estado", "activo");

        if (errorCliente) {
          console.log(errorCliente);
          alert(JSON.stringify(errorCliente, null, 2));
          return false;
        }
      }
    }

    return true;
  };

  const finalizarRelacionesDelTrabajo = async (trabajo) => {
    if (!trabajo) return false;

    if (trabajo.orden_id) {
      const { error: errorOrden } = await supabase
        .from("ordenes_trabajo")
        .update({
          estado: "Entregado",
          notas: "Orden cerrada automáticamente al finalizar el trabajo mecánico."
        })
        .eq("id", trabajo.orden_id)
        .not("estado", "in", '("Entregado","Terminado","Cancelado")');

      if (errorOrden) {
        console.log(errorOrden);
        alert(JSON.stringify(errorOrden, null, 2));
        return false;
      }
    }

    if (!trabajo.cliente_id) return true;

    const { data: otrosTrabajosActivos, error: errorOtros } = await supabase
      .from("trabajos_mecanicos")
      .select("id, estado")
      .eq("cliente_id", trabajo.cliente_id)
      .neq("id", trabajo.id)
      .not("estado", "in", '("finalizado","Finalizado","Terminado","Entregado","Cancelado")');

    if (errorOtros) {
      console.log(errorOtros);
      alert(JSON.stringify(errorOtros, null, 2));
      return false;
    }

    if ((otrosTrabajosActivos || []).length > 0) return true;

    const { data: trabajosCliente, error: errorTrabajosCliente } = await supabase
      .from("trabajos_mecanicos")
      .select("*")
      .eq("cliente_id", trabajo.cliente_id);

    if (errorTrabajosCliente) {
      console.log(errorTrabajosCliente);
      alert(JSON.stringify(errorTrabajosCliente, null, 2));
      return false;
    }

    const lista = trabajosCliente || [];
    const numeroFactura = trabajo.numero_factura || generarNumeroFactura(trabajo);
    const trabajoRealizado = lista.map((item) => item.trabajo).filter(Boolean).join(" / ") || trabajo.trabajo || "Trabajo registrado en PC Motors";
    const costoPiezas = lista.reduce((total, item) => total + Number(item.costo_piezas || 0), 0);
    const ventaPiezas = lista.reduce((total, item) => total + Number(item.venta_piezas || 0), 0);
    const gananciaPiezas = lista.reduce((total, item) => total + calcularTotalesContabilidad(item.costo_piezas, item.venta_piezas, item.mano_obra).gananciaPiezas, 0);
    const manoObra = lista.reduce((total, item) => total + Number(item.mano_obra || 0), 0);
    const totalFinal = lista.reduce((total, item) => total + Number(item.total_generado || 0), 0);
    const mecanicos = [...new Set(lista.map((item) => item.mecanico_nombre).filter(Boolean))].join(", ") || trabajo.mecanico_nombre || "No asignado";

    const { error: errorCliente } = await supabase
      .from("clientes")
      .update({
        estado: "finalizado",
        finalizado_en: new Date().toISOString(),
        mecanico_principal: mecanicos,
        numero_factura: numeroFactura,
        trabajo_realizado: trabajoRealizado,
        costo_piezas_compra: costoPiezas,
        precio_piezas_cliente: ventaPiezas,
        ganancia_piezas: gananciaPiezas,
        costo_mano_obra: manoObra,
        impuestos: 0,
        descuento: 0,
        total_final: totalFinal
      })
      .eq("id", trabajo.cliente_id)
      .neq("estado", "finalizado");

    if (errorCliente) {
      console.log(errorCliente);
      alert(JSON.stringify(errorCliente, null, 2));
      return false;
    }

    return true;
  };

  const mostrarOrigenTexto = (trabajo) => {
    if (trabajo.origen === "solicitud" || trabajo.solicitud_id) return "Solicitud Cliente";
    if (trabajo.orden_id) return "Orden de Trabajo";
    return "Trabajo Manual";
  };

  const mostrarEstado = (estado) => {
    const encontrado = estados.find((item) => item.value === estado);
    if (encontrado) return encontrado.label;
    if (estado === "activo") return "🔎 Diagnóstico";
    return estado || "Sin estado";
  };

  const origenStyle = (trabajo) => {
    if (trabajo.origen === "solicitud" || trabajo.solicitud_id) return originSolicitudBadge;
    return originManualBadge;
  };

  const trabajosActivosLista = trabajos.filter(esTrabajoActivo);
  const trabajosHistorialLista = trabajos.filter((trabajo) => !esTrabajoActivo(trabajo));
  const trabajosBaseVista = vistaTrabajos === "historial" ? trabajosHistorialLista : trabajosActivosLista;

  const trabajosFiltrados = trabajosBaseVista.filter((trabajo) => {
    const texto = busqueda.trim().toLowerCase();
    if (!texto) return true;

    return (
      String(trabajo.id || "").includes(texto) ||
      String(trabajo.orden_id || "").includes(texto) ||
      String(trabajo.solicitud_id || "").includes(texto) ||
      (trabajo.cliente_nombre || "").toLowerCase().includes(texto) ||
      (trabajo.vehiculo || "").toLowerCase().includes(texto) ||
      (trabajo.mecanico_nombre || "").toLowerCase().includes(texto) ||
      (trabajo.numero_factura || "").toLowerCase().includes(texto) ||
      (trabajo.trabajo || "").toLowerCase().includes(texto) ||
      (trabajo.resultado_diagnostico || "").toLowerCase().includes(texto) ||
      (trabajo.estado || "").toLowerCase().includes(texto) ||
      mostrarOrigenTexto(trabajo).toLowerCase().includes(texto)
    );
  });

  return (
    <div>
      <h1 style={titleStyle}>🔧 Control Central de Trabajos</h1>

      <div style={summaryGrid}>
        <div style={summaryCard}><strong>🟢 Trabajos activos</strong><span style={summaryNumber}>{resumen.trabajosActivos}</span></div>
        <div style={summaryCard}><strong>💰 Total generado semana</strong><span style={summaryNumber}>{dinero(resumen.totalGeneradoSemana)}</span></div>
        <div style={summaryCard}><strong>📈 Ganancia piezas semana</strong><span style={summaryNumber}>{dinero(resumen.gananciaPiezasSemana)}</span></div>
        <div style={summaryCard}><strong>🔧 Mano de obra semana</strong><span style={summaryNumber}>{dinero(resumen.manoObraSemana)}</span></div>
        <div style={summaryCard}><strong>🗓 Total generado mes</strong><span style={summaryNumber}>{dinero(resumen.totalGeneradoMes)}</span></div>
        <div style={summaryCard}><strong>📈 Ganancia piezas mes</strong><span style={summaryNumber}>{dinero(resumen.gananciaPiezasMes)}</span></div>
      </div>

      <div style={formBox}>
        <h2 style={{ color: "#f59e0b", marginTop: 0 }}>➕ Nuevo Trabajo Manual</h2>

        <select value={form.mecanico_id} onChange={(e) => setForm({ ...form, mecanico_id: e.target.value })} style={inputStyle}>
          <option value="">Seleccionar mecánico</option>
          {mecanicos.map((m) => <option key={m.id} value={m.id}>{m.nombre} - {m.tipo_pago}</option>)}
        </select>

        <input placeholder="Nombre del cliente" value={form.cliente_nombre} onChange={(e) => setForm({ ...form, cliente_nombre: e.target.value })} style={inputStyle} />
        <input placeholder="Teléfono del cliente para SMS. Ejemplo: 5025551234" value={form.cliente_telefono} onChange={(e) => setForm({ ...form, cliente_telefono: e.target.value })} style={inputStyle} />
        <input placeholder="Vehículo. Ejemplo: Toyota Corolla 2020" value={form.vehiculo} onChange={(e) => setForm({ ...form, vehiculo: e.target.value })} style={inputStyle} />
        <textarea placeholder="Trabajo o diagnóstico inicial" value={form.trabajo} onChange={(e) => setForm({ ...form, trabajo: e.target.value })} style={{ ...inputStyle, minHeight: "90px" }} />
        <input type="number" placeholder="Costo de piezas (se puede agregar después)" value={form.costo_piezas} onChange={(e) => setForm({ ...form, costo_piezas: e.target.value })} style={inputStyle} />
        <input type="number" placeholder="Venta de piezas al cliente" value={form.venta_piezas} onChange={(e) => setForm({ ...form, venta_piezas: e.target.value })} style={inputStyle} />
        <input type="number" placeholder="Mano de obra cobrada" value={form.mano_obra} onChange={(e) => setForm({ ...form, mano_obra: e.target.value })} style={inputStyle} />
        <textarea placeholder="Notas" value={form.notas} onChange={(e) => setForm({ ...form, notas: e.target.value })} style={{ ...inputStyle, minHeight: "80px" }} />

        <button onClick={crearTrabajo} style={saveButton}>Crear Trabajo e Iniciar Tiempo</button>
      </div>

      {trabajoEditando && (
        <div style={editBox}>
          <h2 style={{ color: "#f59e0b", marginTop: 0 }}>✏️ Editar trabajo / contabilidad</h2>
          <p><strong>Origen:</strong> {mostrarOrigenTexto(trabajoEditando)}</p>
          <p><strong>Mecánico:</strong> {trabajoEditando.mecanico_nombre}</p>

          <input placeholder="Cliente" value={editForm.cliente_nombre} onChange={(e) => setEditForm({ ...editForm, cliente_nombre: e.target.value })} style={inputStyle} />
          <input placeholder="Vehículo" value={editForm.vehiculo} onChange={(e) => setEditForm({ ...editForm, vehiculo: e.target.value })} style={inputStyle} />
          <textarea placeholder="Trabajo / diagnóstico" value={editForm.trabajo} onChange={(e) => setEditForm({ ...editForm, trabajo: e.target.value })} style={{ ...inputStyle, minHeight: "90px" }} />

          <textarea
            placeholder="Resultado del diagnóstico. Ejemplo: Módulo dañado, fusible quemado, sensor defectuoso..."
            value={editForm.resultado_diagnostico}
            onChange={(e) => setEditForm({ ...editForm, resultado_diagnostico: e.target.value })}
            style={{ ...inputStyle, minHeight: "90px", border: "1px solid #f59e0b" }}
          />

          <select value={editForm.estado} onChange={(e) => setEditForm({ ...editForm, estado: e.target.value })} style={inputStyle}>
            {estados.map((estado) => <option key={estado.value} value={estado.value}>{estado.label}</option>)}
          </select>

          <input type="number" placeholder="Minutos reales de diagnóstico. Ejemplo: 20 o 0 si no hubo diagnóstico" value={editForm.diagnostico_minutos} onChange={(e) => setEditForm({ ...editForm, diagnostico_minutos: e.target.value })} style={inputStyle} />
          <input type="number" placeholder="Minutos reales de reparación. Ejemplo: 90" value={editForm.reparacion_minutos} onChange={(e) => setEditForm({ ...editForm, reparacion_minutos: e.target.value })} style={inputStyle} />

          <input type="number" placeholder="Costo de piezas" value={editForm.costo_piezas} onChange={(e) => setEditForm({ ...editForm, costo_piezas: e.target.value })} style={inputStyle} />
          <input type="number" placeholder="Venta de piezas al cliente" value={editForm.venta_piezas} onChange={(e) => setEditForm({ ...editForm, venta_piezas: e.target.value })} style={inputStyle} />
          <input type="number" placeholder="Mano de obra cobrada" value={editForm.mano_obra} onChange={(e) => setEditForm({ ...editForm, mano_obra: e.target.value })} style={inputStyle} />
          <label style={fieldLabel}>Método de pago</label>
          <select
            value={editForm.metodo_pago || ""}
            onChange={(e) =>
              setEditForm({
                ...editForm,
                metodo_pago: e.target.value,
                pago_recibido: e.target.value === "Pendiente" ? false : editForm.pago_recibido
              })
            }
            style={inputStyle}
          >
            {metodosPago.map((metodo) => (
              <option key={metodo.value || "sin-metodo"} value={metodo.value}>
                {metodo.label}
              </option>
            ))}
          </select>

          <div style={paymentSwitchBox}>
            <div>
              <strong>💵 Estado del pago</strong>
              <p style={{ margin: "5px 0 0 0", color: "#d1d5db", fontSize: "13px" }}>
                El método de pago no marca el cobro automáticamente. Usa este interruptor para confirmar si el dinero ya fue recibido.
              </p>
            </div>

            <div style={paymentSwitchButtons}>
              <button
                type="button"
                onClick={() => setEditForm({ ...editForm, pago_recibido: true })}
                style={Boolean(editForm.pago_recibido) ? paidButtonActive : paidButton}
              >
                ✅ Pago recibido
              </button>

              <button
                type="button"
                onClick={() => setEditForm({ ...editForm, pago_recibido: false })}
                style={!Boolean(editForm.pago_recibido) ? pendingButtonActive : pendingButton}
              >
                ⏳ Pago pendiente
              </button>
            </div>
          </div>

          <textarea placeholder="Notas" value={editForm.notas} onChange={(e) => setEditForm({ ...editForm, notas: e.target.value })} style={{ ...inputStyle, minHeight: "80px" }} />

          <button onClick={guardarContabilidad} style={saveButton}>Guardar Cambios</button>
          <button onClick={cancelarEdicion} style={cancelButton}>Cancelar</button>
        </div>
      )}

      <h2 style={sectionTitle}>{vistaTrabajos === "historial" ? "🏁 Historial de Trabajos" : "📋 Trabajos Activos"}</h2>

      <div style={viewToggleBox}>
        <button
          onClick={() => setVistaTrabajos("activos")}
          style={vistaTrabajos === "activos" ? viewButtonActive : viewButton}
        >
          🟢 Activos ({trabajosActivosLista.length})
        </button>
        <button
          onClick={() => setVistaTrabajos("historial")}
          style={vistaTrabajos === "historial" ? viewButtonActive : viewButton}
        >
          🏁 Historial ({trabajosHistorialLista.length})
        </button>
      </div>

      <input
        type="text"
        placeholder={vistaTrabajos === "historial" ? "Buscar en historial por cliente, vehículo, mecánico, orden, factura o diagnóstico..." : "Buscar por cliente, vehículo, mecánico, orden, factura, diagnóstico, resultado o estado..."}
        value={busqueda}
        onChange={(e) => setBusqueda(e.target.value)}
        style={searchInputStyle}
      />

      {cargando ? (
        <p>Cargando...</p>
      ) : trabajosBaseVista.length === 0 ? (
        <div style={emptyStyle}>{vistaTrabajos === "historial" ? "No hay trabajos finalizados en historial." : "No hay trabajos activos registrados."}</div>
      ) : trabajosFiltrados.length === 0 ? (
        <div style={emptyStyle}>No hay resultados para esa búsqueda.</div>
      ) : (
        <div style={gridStyle}>
          {trabajosFiltrados.map((trabajo) => (
            <div key={trabajo.id} style={cardStyle}>
              <h2 style={{ color: "#f59e0b", marginTop: 0 }}>{trabajo.mecanico_nombre}</h2>

              <p><strong>Origen:</strong> <span style={origenStyle(trabajo)}>{mostrarOrigenTexto(trabajo)}</span></p>
              {trabajo.solicitud_id && <p><strong>📥 Solicitud:</strong> #{trabajo.solicitud_id}</p>}
              {trabajo.orden_id && <p><strong>📋 Orden:</strong> #{trabajo.orden_id}</p>}
              {trabajo.cliente_id && <p><strong>👤 Cliente ID:</strong> #{trabajo.cliente_id}</p>}
              {trabajo.vehiculo_id && <p><strong>🚗 Vehículo ID:</strong> #{trabajo.vehiculo_id}</p>}

              <p><strong>Cliente:</strong> {trabajo.cliente_nombre || "No registrado"}</p>
              <p><strong>Vehículo:</strong> {trabajo.vehiculo || "No registrado"}</p>
              <p><strong>Diagnóstico / Trabajo:</strong><br />{trabajo.trabajo}</p>

              <p><strong>📋 Resultado diagnóstico:</strong><br />{trabajo.resultado_diagnostico || "Pendiente"}</p>

              <p><strong>Estado:</strong> <span style={esTrabajoActivo(trabajo) ? activeBadge : finishedBadge}>{mostrarEstado(trabajo.estado)}</span></p>
              <p><strong>Inicio:</strong> {formatearFecha(trabajo.hora_inicio)}</p>
              {trabajo.hora_fin && <p><strong>Final:</strong> {formatearFecha(trabajo.hora_fin)}</p>}
              <div style={phaseBox}>
                <p><strong>🔎 Diagnóstico:</strong> <span style={statusBadge}>{convertirMinutos(minutosDiagnosticoActual(trabajo))}</span></p>
                {diagnosticoCorriendo(trabajo) && <p><strong>⏱ Diagnóstico corriendo:</strong> <span style={statusBadge}>{tiempoEnVivo({ ...trabajo, hora_inicio: trabajo.diagnostico_inicio })}</span></p>}
                {diagnosticoPausado(trabajo) && <p><strong>⏸ Diagnóstico pausado:</strong> <span style={pausedBadge}>Pausado</span></p>}
                <button onClick={() => editarTiempoManual(trabajo, "diagnostico")} style={timeEditButton}>✏️ Editar minutos diagnóstico</button>

                <p><strong>🔧 Reparación:</strong> <span style={statusBadge}>{convertirMinutos(minutosReparacionActual(trabajo))}</span></p>
                {reparacionCorriendo(trabajo) && <p><strong>⏱ Reparación corriendo:</strong> <span style={statusBadge}>{tiempoEnVivo({ ...trabajo, hora_inicio: trabajo.reparacion_inicio })}</span></p>}
                {reparacionPausada(trabajo) && <p><strong>⏸ Reparación pausada:</strong> <span style={pausedBadge}>Pausada</span></p>}
                <button onClick={() => editarTiempoManual(trabajo, "reparacion")} style={timeEditButton}>✏️ Editar minutos reparación</button>

                <p><strong>⏱ Tiempo total:</strong> <span style={statusBadge}>{convertirMinutos(minutosTotalFases(trabajo) || trabajo.minutos_trabajados || 0)}</span></p>

                {!trabajo.diagnostico_inicio && esTrabajoActivo(trabajo) && (
                  <button onClick={() => iniciarDiagnostico(trabajo)} style={phaseButton}>▶️ Iniciar Diagnóstico</button>
                )}

                {diagnosticoCorriendo(trabajo) && (
                  <div style={diagnosisResultBox}>
                    <label style={diagnosisLabel}>📋 Resultado del diagnóstico antes de finalizar</label>
                    <textarea
                      placeholder="Ejemplo: fusible quemado, módulo BCM defectuoso, cableado dañado, se recomienda reemplazar..."
                      value={resultadoDiagnosticoDraft[trabajo.id] ?? trabajo.resultado_diagnostico ?? ""}
                      onChange={(e) =>
                        setResultadoDiagnosticoDraft({
                          ...resultadoDiagnosticoDraft,
                          [trabajo.id]: e.target.value
                        })
                      }
                      style={diagnosisTextarea}
                    />
                    <button onClick={() => pausarDiagnostico(trabajo)} style={pauseButton}>⏸ Pausar Diagnóstico</button>
                    <button onClick={() => finalizarDiagnostico(trabajo)} style={phaseButton}>⏹ Finalizar Diagnóstico y Guardar Resultado</button>
                  </div>
                )}

                {diagnosticoPausado(trabajo) && (
                  <button onClick={() => retomarDiagnostico(trabajo)} style={resumeButton}>▶️ Retomar Diagnóstico</button>
                )}

                {trabajo.diagnostico_fin && !trabajo.reparacion_inicio && !reparacionPausada(trabajo) && esTrabajoActivo(trabajo) && (
                  <button onClick={() => iniciarReparacion(trabajo)} style={repairButton}>🔧 Iniciar Reparación</button>
                )}

                {reparacionPausada(trabajo) && (
                  <button onClick={() => retomarReparacion(trabajo)} style={resumeButton}>▶️ Retomar Reparación</button>
                )}

                {reparacionCorriendo(trabajo) && (
                  <>
                    <button onClick={() => pausarReparacion(trabajo)} style={pauseButton}>⏸ Pausar Reparación</button>
                    <button onClick={() => finalizarReparacion(trabajo)} style={repairButton}>✅ Finalizar Reparación</button>
                  </>
                )}
              </div>

              <div style={estimateBox}>
                <h3 style={{ color: "#f59e0b", marginTop: 0 }}>📋 Estimado del cliente</h3>
                <p><strong>Estado estimado:</strong> <span style={statusBadge}>{textoEstadoEstimado(trabajo.estimado_estado)}</span></p>
                {parsearEstimadoPiezas(trabajo.estimado_piezas).length > 0 ? (
                  <div>
                    {parsearEstimadoPiezas(trabajo.estimado_piezas).map((pieza, index) => {
                      const p = normalizarPiezaEstimado(pieza, index);
                      return (
                        <p key={p.id || index} style={{ margin: "6px 0" }}>
                          🔩 {p.cantidad} x {p.nombre} — venta: {dinero(Number(p.venta || 0) * Number(p.cantidad || 1))}
                        </p>
                      );
                    })}
                  </div>
                ) : (
                  <p>No hay piezas agregadas al estimado.</p>
                )}
                {parsearEstimadoServicios(trabajo.estimado_servicios).length > 0 ? (
                  <div>
                    <p style={{ color: "#f59e0b", fontWeight: "bold", marginBottom: "6px" }}>Servicios:</p>
                    {parsearEstimadoServicios(trabajo.estimado_servicios).map((servicio, index) => {
                      const s = normalizarServicioEstimado(servicio, index);
                      return (
                        <p key={s.id || index} style={{ margin: "6px 0" }}>
                          🧾 {s.nombre} — {dinero(calcularLineasClienteEstimado([], s.precio, 0, [s]).lineasServicios[0]?.total || s.precio)}
                          {s.mecanico_nombre ? ` — Mecánico: ${s.mecanico_nombre}` : ""}
                        </p>
                      );
                    })}
                  </div>
                ) : null}
                <p><strong>Mano de obra estimada:</strong> {dinero(parsearEstimadoServicios(trabajo.estimado_servicios).length > 0 ? sumarServiciosEstimado(trabajo.estimado_servicios) : (trabajo.estimado_mano_obra || 0))}</p>
                <p><strong>Total estimado:</strong> <span style={statusBadge}>{dinero(calcularTotalesEstimado(trabajo.estimado_piezas, trabajo.estimado_mano_obra, trabajo.estimado_descuento, trabajo.estimado_servicios).totalGenerado)}</span></p>

                {estimadoEditandoId === trabajo.id && (
                  <div style={estimateEditorBox}>
                    <h4 style={{ color: "#f59e0b", marginTop: 0 }}>✏️ Editor visual del estimado</h4>

                    <label style={fieldLabel}>Agregar servicio de mano de obra</label>
                    <select
                      value={estimadoDraft.servicio_id}
                      onChange={(e) => aplicarServicioManoObra(e.target.value)}
                      style={inputStyle}
                    >
                      <option value="">Seleccionar del catálogo o escribir manual abajo</option>
                      {catalogoManoObra.map((servicio) => (
                        <option key={servicio.id} value={servicio.id}>
                          {textoServicioCatalogo(servicio)}
                        </option>
                      ))}
                    </select>

                    <p style={internalHint}>
                      Puedes seleccionar un servicio del catálogo o escribir uno manual si no existe todavía. En el PDF del cliente solo sale el servicio y el precio final.
                    </p>

                    <input
                      type="text"
                      placeholder="Nombre del servicio manual o seleccionado"
                      value={estimadoDraft.servicio_nombre}
                      onChange={(e) =>
                        setEstimadoDraft({
                          ...estimadoDraft,
                          servicio_id: "",
                          servicio_nombre: e.target.value
                        })
                      }
                      style={inputStyle}
                    />

                    <select
                      value={estimadoDraft.servicio_mecanico_id || ""}
                      onChange={(e) => setEstimadoDraft({ ...estimadoDraft, servicio_mecanico_id: e.target.value })}
                      style={inputStyle}
                    >
                      <option value="">Seleccionar mecánico para este servicio</option>
                      {mecanicos.map((mecanico) => (
                        <option key={mecanico.id} value={mecanico.id}>
                          {mecanico.nombre}
                        </option>
                      ))}
                    </select>

                    <input
                      type="number"
                      placeholder="Precio final del servicio"
                      value={estimadoDraft.servicio_precio}
                      onChange={(e) => setEstimadoDraft({ ...estimadoDraft, servicio_precio: e.target.value })}
                      style={inputStyle}
                    />

                    <button onClick={agregarServicioDraft} style={partsButton}>➕ Agregar servicio</button>

                    <label style={fieldLabel}>Servicios del estimado</label>
                    {(estimadoDraft.servicios || []).length > 0 ? (
                      (estimadoDraft.servicios || []).map((servicio, index) => (
                        <div key={servicio.id || index} style={serviceEditorRow}>
                          <input
                            placeholder="Nombre del servicio"
                            value={servicio.nombre}
                            onChange={(e) => actualizarServicioDraft(index, "nombre", e.target.value)}
                            style={pieceInput}
                          />
                          <select
                            value={servicio.mecanico_id || ""}
                            onChange={(e) => actualizarServicioDraft(index, "mecanico_id", e.target.value)}
                            style={pieceInput}
                          >
                            <option value="">Mecánico</option>
                            {mecanicos.map((mecanico) => (
                              <option key={mecanico.id} value={mecanico.id}>
                                {mecanico.nombre}
                              </option>
                            ))}
                          </select>
                          <input
                            type="number"
                            placeholder="Precio del servicio"
                            value={servicio.precio ?? ""}
                            onChange={(e) => actualizarServicioDraft(index, "precio", e.target.value)}
                            style={piecePriceInput}
                          />
                          <input
                            type="number"
                            placeholder="Minutos opcional"
                            value={servicio.minutos ?? ""}
                            onChange={(e) => actualizarServicioDraft(index, "minutos", e.target.value)}
                            style={piecePriceInput}
                          />
                          <button onClick={() => eliminarServicioDraft(index)} style={miniDeleteButton}>🗑</button>
                        </div>
                      ))
                    ) : (
                      <p style={{ color: "#d1d5db" }}>No hay servicios agregados.</p>
                    )}

                    {(estimadoDraft.servicios || []).length === 0 && (
                      <>
                        <label style={fieldLabel}>Mano de obra final para cobrar al cliente</label>
                        <input
                          type="number"
                          value={estimadoDraft.mano_obra}
                          onChange={(e) => setEstimadoDraft({ ...estimadoDraft, mano_obra: e.target.value })}
                          style={inputStyle}
                        />
                      </>
                    )}

                    <label style={fieldLabel}>Piezas del estimado</label>
                    {(estimadoDraft.piezas || []).map((pieza, index) => {
                      const costoReal = Number(pieza.costo_real ?? pieza.costo ?? 0);
                      const precioNormal = Number(pieza.precio_normal ?? 0);
                      const precioSugerido = calcularPrecioPromedioPieza(costoReal, precioNormal);
                      const precioCliente = Number(
                        pieza.venta ??
                        pieza.precio_venta ??
                        pieza.precio_cliente ??
                        precioSugerido ??
                        0
                      );
                      const taxPieza = redondearDinero(precioCliente * 0.06);

                      return (
                        <div key={pieza.id || index} style={pieceEditorRow}>
                          <input
                            placeholder="Nombre de pieza"
                            value={pieza.nombre}
                            onChange={(e) => actualizarPiezaDraft(index, "nombre", e.target.value)}
                            style={pieceInput}
                          />

                          <input
                            type="number"
                            placeholder="Costo real PC Motors"
                            value={pieza.costo_real ?? pieza.costo ?? ""}
                            onChange={(e) => actualizarPiezaDraft(index, "costo_real", e.target.value)}
                            style={piecePriceInput}
                          />

                          <input
                            type="number"
                            placeholder="Precio normal pieza"
                            value={pieza.precio_normal ?? ""}
                            onChange={(e) => actualizarPiezaDraft(index, "precio_normal", e.target.value)}
                            style={piecePriceInput}
                          />

                          <div style={suggestedPriceBox}>
                            <strong>Promedio:</strong> {dinero(precioSugerido)}
                            <br />
                            <span>Cargo incluido: {dinero(taxPieza)}</span>
                          </div>

                          <input
                            type="number"
                            placeholder="Precio cliente editable"
                            value={pieza.venta ?? pieza.precio_venta ?? pieza.precio_cliente ?? ""}
                            onChange={(e) => actualizarPiezaDraft(index, "venta", e.target.value)}
                            style={piecePriceInput}
                          />

                          <button onClick={() => eliminarPiezaDraft(index)} style={miniDeleteButton}>🗑</button>
                        </div>
                      );
                    })}

                    <button onClick={agregarPiezaDraft} style={partsButton}>➕ Agregar pieza</button>

                    <label style={fieldLabel}>Descuento opcional</label>
                    <input
                      type="number"
                      value={estimadoDraft.descuento}
                      onChange={(e) => setEstimadoDraft({ ...estimadoDraft, descuento: e.target.value })}
                      style={inputStyle}
                    />

                    <div style={estimatePreviewBox}>
                      <p><strong>Piezas:</strong> {dinero(calcularTotalesEstimado(estimadoDraft.piezas, estimadoDraft.mano_obra, estimadoDraft.descuento, estimadoDraft.servicios).piezasCliente)}</p>
                      <p><strong>Mano de obra:</strong> {dinero(calcularTotalesEstimado(estimadoDraft.piezas, estimadoDraft.mano_obra, estimadoDraft.descuento, estimadoDraft.servicios).manoObraCliente)}</p>
                      <p><strong>Total estimado:</strong> <span style={statusBadge}>{dinero(calcularTotalesEstimado(estimadoDraft.piezas, estimadoDraft.mano_obra, estimadoDraft.descuento, estimadoDraft.servicios).totalGenerado)}</span></p>
                    </div>

                    <button onClick={() => guardarEstimadoDesdeEditor(trabajo)} style={saveButton}>💾 Guardar Estimado</button>
                    <button onClick={cancelarEditorEstimado} style={cancelButton}>Cancelar</button>
                  </div>
                )}

                {esTrabajoActivo(trabajo) && (
                  <>
                    <button onClick={() => crearEditarEstimado(trabajo)} style={estimateButton}>📋 Abrir Editor de Estimado</button>
                    <button onClick={() => crearPDFEstimado(trabajo, true)} style={invoiceButton}>📄 Generar PDF Estimado</button>
                    <button onClick={() => enviarEstimadoSMS(trabajo)} style={smsButton}>📱 Enviar Estimado para Firma</button>
                    <button onClick={() => copiarLinkFirmaEstimado(trabajo)} style={invoiceButton}>🔗 Copiar Link de Firma</button>
                    <button onClick={() => aprobarEstimado(trabajo)} style={reviewButton}>✅ Aprobar Estimado</button>
                    <button onClick={() => rechazarEstimado(trabajo)} style={deleteButton}>❌ Rechazar Estimado</button>
                    <button onClick={() => marcarPiezasOrdenadas(trabajo)} style={partsButton}>🚚 Piezas Ordenadas</button>
                    <button onClick={() => marcarPiezasRecibidas(trabajo)} style={partsReceivedButton}>📦 Piezas Recibidas</button>
                  </>
                )}

                {trabajo.estimado_pdf_url && (
                  <p style={{ marginTop: "8px" }}>
                    <strong>PDF estimado:</strong>{" "}
                    <a href={trabajo.estimado_pdf_url} target="_blank" rel="noreferrer" style={invoiceLink}>
                      Abrir estimado del cliente
                    </a>
                  </p>
                )}

                {trabajo.estimado_token && !trabajo.estimado_aprobado_cliente && (
                  <p style={{ marginTop: "8px", color: "#93c5fd" }}>
                    <strong>Link de firma:</strong>{" "}
                    <a
                      href={`${obtenerBasePublicaApp()}/firma-estimado/${trabajo.estimado_token}`}
                      target="_blank"
                      rel="noreferrer"
                      style={invoiceLink}
                    >
                      Abrir página de firma del cliente
                    </a>
                  </p>
                )}

                {trabajo.estimado_aprobado_cliente && (
                  <div style={signedBox}>
                    <strong>🟢 Estimado aprobado y firmado por el cliente</strong>
                    <br />
                    <span>Nombre: {trabajo.estimado_firmado_nombre || "Cliente"}</span>
                    <br />
                    <span>Fecha: {formatearFecha(trabajo.estimado_firmado_en)}</span>
                    {trabajo.estimado_firma_url && (
                      <>
                        <br />
                        <a href={trabajo.estimado_firma_url} target="_blank" rel="noreferrer" style={invoiceLink}>
                          Ver firma
                        </a>
                      </>
                    )}
                  </div>
                )}
              </div>

              <hr style={lineStyle} />

              <p><strong>Costo piezas:</strong> {dinero(trabajo.costo_piezas)}</p>
              <p><strong>Venta piezas:</strong> {dinero(trabajo.venta_piezas)}</p>
              <p><strong>Cargo piezas 6%:</strong> {dinero(calcularTotalesContabilidad(trabajo.costo_piezas, trabajo.venta_piezas, trabajo.mano_obra).cargoPiezas6)}</p>
              <p><strong>Mano de obra:</strong> {dinero(trabajo.mano_obra)}</p>
              <p><strong>Cargo general 4%:</strong> {dinero(calcularTotalesContabilidad(trabajo.costo_piezas, trabajo.venta_piezas, trabajo.mano_obra).cargoGeneral4)}</p>
              <p><strong>Ganancia piezas:</strong> {dinero(calcularTotalesContabilidad(trabajo.costo_piezas, trabajo.venta_piezas, trabajo.mano_obra).gananciaPiezas)}</p>
              <p><strong>Total generado:</strong> <span style={statusBadge}>{dinero(calcularTotalesContabilidad(trabajo.costo_piezas, trabajo.venta_piezas, trabajo.mano_obra).totalGenerado)}</span></p>
              <p><strong>💳 Método de pago:</strong> {trabajo.metodo_pago || "No registrado"}</p>
              <p><strong>✅ Pago recibido:</strong> {trabajo.pago_recibido ? "Sí" : "No"}</p>
              <p><strong>🕒 Fecha de pago:</strong> {formatearFecha(trabajo.fecha_pago)}</p>

              <p><strong>Notas:</strong><br />{trabajo.notas || "Sin notas"}</p>

              <button onClick={() => abrirEdicionContabilidad(trabajo)} style={editButton}>✏️ Editar trabajo / contabilidad</button>

              {esTrabajoActivo(trabajo) && (
                <button onClick={() => finalizarTrabajo(trabajo)} style={finishButton}>⏹ Finalizar Trabajo</button>
              )}

              <button onClick={() => crearFacturaPDF(trabajo)} style={invoiceButton}>🧾 Crear / Actualizar Factura PDF Automática</button>
              <button onClick={() => eliminarTrabajoCompleto(trabajo)} style={deleteButton}>🗑 Eliminar Trabajo</button>

              {trabajo.numero_factura && <p style={{ marginTop: "10px" }}><strong>Factura creada:</strong> {trabajo.numero_factura}</p>}
              {trabajo.factura_pdf_url && (
                <p style={{ marginTop: "8px" }}>
                  <strong>PDF guardado:</strong>{" "}
                  <a href={trabajo.factura_pdf_url} target="_blank" rel="noreferrer" style={invoiceLink}>
                    Abrir factura del cliente
                  </a>
                </p>
              )}

              <button onClick={() => abrirSMSCliente(trabajo, "factura")} style={smsButton}>📱 Enviar Factura por SMS</button>
              <button onClick={() => abrirSMSCliente(trabajo, "resena")} style={reviewButton}>⭐ Pedir Reseña Google</button>
              <button onClick={() => abrirSMSCliente(trabajo, "factura_resena")} style={smsReviewButton}>📱⭐ Factura + Reseña</button>

              <div style={invoiceBox}>
                <strong>📎 Facturas / compras</strong>
                {(facturas[trabajo.id] || []).length === 0 ? (
                  <p>No hay facturas subidas.</p>
                ) : (
                  <div style={{ marginTop: "10px" }}>
                    {(facturas[trabajo.id] || []).map((factura) => (
                      <div key={factura.id} style={invoiceItem}>
                        <a href={factura.url} target="_blank" rel="noreferrer" style={invoiceLink}>📄 Ver factura #{factura.id}</a>
                        <button onClick={() => eliminarFacturaSubida(factura)} style={deleteMiniButton}>Eliminar</button>
                      </div>
                    ))}
                  </div>
                )}

                <input type="file" accept="image/*,.pdf" onChange={(e) => subirFactura(trabajo, e.target.files[0])} style={fileInput} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const titleStyle = { color: "#f59e0b", marginBottom: "20px" };
const sectionTitle = { color: "#f59e0b", marginTop: "30px" };
const viewToggleBox = { display: "flex", gap: "10px", flexWrap: "wrap", marginBottom: "15px" };
const viewButton = { padding: "12px 16px", background: "#374151", color: "white", border: "1px solid #4b5563", borderRadius: "8px", cursor: "pointer", fontWeight: "bold" };
const viewButtonActive = { padding: "12px 16px", background: "#f59e0b", color: "#111827", border: "1px solid #f59e0b", borderRadius: "8px", cursor: "pointer", fontWeight: "bold" };
const summaryGrid = { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: "15px", marginBottom: "25px" };
const summaryCard = { background: "rgba(31, 41, 55, 0.95)", padding: "16px", borderRadius: "12px", border: "1px solid #f59e0b", display: "flex", flexDirection: "column", gap: "8px" };
const summaryNumber = { color: "#f59e0b", fontSize: "26px", fontWeight: "bold" };
const formBox = { background: "#1f2937", padding: "20px", borderRadius: "14px", border: "1px solid #f59e0b" };
const editBox = { background: "#111827", padding: "20px", borderRadius: "14px", border: "1px solid #f59e0b", marginTop: "25px" };
const inputStyle = { width: "100%", padding: "12px", marginBottom: "12px", borderRadius: "8px", border: "1px solid #374151", background: "#111827", color: "white", boxSizing: "border-box" };
const saveButton = { width: "100%", padding: "12px", background: "#16a34a", color: "white", border: "none", borderRadius: "8px", cursor: "pointer", fontWeight: "bold", marginBottom: "10px" };
const cancelButton = { width: "100%", padding: "12px", background: "#6b7280", color: "white", border: "none", borderRadius: "8px", cursor: "pointer", fontWeight: "bold" };
const editButton = { width: "100%", padding: "12px", marginTop: "10px", background: "#2563eb", color: "white", border: "none", borderRadius: "8px", cursor: "pointer", fontWeight: "bold" };
const finishButton = { width: "100%", padding: "12px", marginTop: "10px", background: "#dc2626", color: "white", border: "none", borderRadius: "8px", cursor: "pointer", fontWeight: "bold" };
const gridStyle = { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(320px,1fr))", gap: "20px" };
const cardStyle = { background: "#1f2937", padding: "20px", borderRadius: "14px", border: "1px solid #374151" };
const lineStyle = { border: "none", borderTop: "1px solid #374151", margin: "15px 0" };
const statusBadge = { background: "#f59e0b", color: "#111827", padding: "4px 8px", borderRadius: "6px", fontWeight: "bold" };
const activeBadge = { background: "#16a34a", color: "white", padding: "4px 8px", borderRadius: "6px", fontWeight: "bold" };
const finishedBadge = { background: "#6b7280", color: "white", padding: "4px 8px", borderRadius: "6px", fontWeight: "bold" };
const originSolicitudBadge = { background: "#7c3aed", color: "white", padding: "4px 8px", borderRadius: "6px", fontWeight: "bold" };
const originManualBadge = { background: "#0f766e", color: "white", padding: "4px 8px", borderRadius: "6px", fontWeight: "bold" };
const invoiceButton = { width: "100%", padding: "12px", marginTop: "10px", background: "#f59e0b", color: "#111827", border: "none", borderRadius: "8px", cursor: "pointer", fontWeight: "bold" };
const smsButton = { width: "100%", padding: "12px", marginTop: "10px", background: "#0ea5e9", color: "white", border: "none", borderRadius: "8px", cursor: "pointer", fontWeight: "bold" };
const reviewButton = { width: "100%", padding: "12px", marginTop: "10px", background: "#16a34a", color: "white", border: "none", borderRadius: "8px", cursor: "pointer", fontWeight: "bold" };
const smsReviewButton = { width: "100%", padding: "12px", marginTop: "10px", background: "#7c3aed", color: "white", border: "none", borderRadius: "8px", cursor: "pointer", fontWeight: "bold" };
const deleteButton = { width: "100%", padding: "12px", marginTop: "10px", background: "#991b1b", color: "white", border: "none", borderRadius: "8px", cursor: "pointer", fontWeight: "bold" };
const phaseBox = { background: "#0f172a", padding: "12px", borderRadius: "10px", border: "1px solid #374151", marginTop: "12px", marginBottom: "12px" };
const phaseButton = { width: "100%", padding: "12px", marginTop: "10px", background: "#7c3aed", color: "white", border: "none", borderRadius: "8px", cursor: "pointer", fontWeight: "bold" };
const repairButton = { width: "100%", padding: "12px", marginTop: "10px", background: "#ea580c", color: "white", border: "none", borderRadius: "8px", cursor: "pointer", fontWeight: "bold" };
const pauseButton = { width: "100%", padding: "12px", marginTop: "10px", background: "#ca8a04", color: "#111827", border: "none", borderRadius: "8px", cursor: "pointer", fontWeight: "bold" };
const resumeButton = { width: "100%", padding: "12px", marginTop: "10px", background: "#16a34a", color: "white", border: "none", borderRadius: "8px", cursor: "pointer", fontWeight: "bold" };
const timeEditButton = { width: "100%", padding: "10px", marginTop: "8px", marginBottom: "8px", background: "#334155", color: "white", border: "1px solid #64748b", borderRadius: "8px", cursor: "pointer", fontWeight: "bold" };
const pausedBadge = { background: "#ca8a04", color: "#111827", padding: "4px 8px", borderRadius: "6px", fontWeight: "bold" };
const invoiceBox = { background: "#111827", padding: "12px", borderRadius: "10px", border: "1px solid #374151", marginTop: "15px" };
const invoiceItem = { display: "flex", justifyContent: "space-between", alignItems: "center", gap: "8px", marginBottom: "8px" };
const invoiceLink = { display: "block", color: "#93c5fd", textDecoration: "none" };
const signedBox = {
  background: "rgba(22, 163, 74, 0.16)",
  border: "1px solid #22c55e",
  color: "white",
  padding: "12px",
  borderRadius: "10px",
  marginTop: "12px",
  lineHeight: 1.6
};
const deleteMiniButton = { padding: "6px 10px", background: "#991b1b", color: "white", border: "none", borderRadius: "6px", cursor: "pointer", fontWeight: "bold" };
const searchInputStyle = { width: "100%", padding: "12px", marginBottom: "20px", borderRadius: "8px", border: "1px solid #f59e0b", background: "#111827", color: "white", boxSizing: "border-box", fontWeight: "bold" };
const emptyStyle = { background: "#1f2937", padding: "20px", borderRadius: "12px" };

const diagnosisResultBox = {
  background: "#020617",
  padding: "14px",
  borderRadius: "10px",
  border: "1px solid #7c3aed",
  marginTop: "14px",
  marginBottom: "12px"
};

const diagnosisLabel = {
  display: "block",
  color: "#f59e0b",
  fontWeight: "bold",
  marginBottom: "8px"
};

const diagnosisTextarea = {
  width: "100%",
  minHeight: "100px",
  padding: "12px",
  borderRadius: "8px",
  border: "1px solid #f59e0b",
  background: "#111827",
  color: "white",
  boxSizing: "border-box",
  marginBottom: "10px"
};

const estimateBox = { background: "#020617", padding: "14px", borderRadius: "10px", border: "1px solid #f59e0b", marginTop: "14px", marginBottom: "12px" };
const estimateButton = { width: "100%", padding: "12px", marginTop: "10px", background: "#9333ea", color: "white", border: "none", borderRadius: "8px", cursor: "pointer", fontWeight: "bold" };
const partsButton = { width: "100%", padding: "12px", marginTop: "10px", background: "#d97706", color: "#111827", border: "none", borderRadius: "8px", cursor: "pointer", fontWeight: "bold" };
const partsReceivedButton = { width: "100%", padding: "12px", marginTop: "10px", background: "#059669", color: "white", border: "none", borderRadius: "8px", cursor: "pointer", fontWeight: "bold" };
const estimateEditorBox = {
  background: "#020617",
  border: "1px solid #8b5cf6",
  borderRadius: "12px",
  padding: "15px",
  marginTop: "15px",
  marginBottom: "15px"
};

const fieldLabel = {
  display: "block",
  marginBottom: "6px",
  marginTop: "12px",
  color: "#f59e0b",
  fontWeight: "bold"
};

const internalHint = {
  color: "#d1d5db",
  fontSize: "13px",
  marginTop: "-4px",
  marginBottom: "10px"
};

const pieceEditorRow = {
  display: "grid",
  gridTemplateColumns: "1.4fr 1fr 1fr 1fr 1fr auto",
  gap: "8px",
  marginBottom: "8px",
  alignItems: "center"
};

const serviceEditorRow = {
  display: "grid",
  gridTemplateColumns: "1.4fr 1fr 1fr 1fr auto",
  gap: "8px",
  marginBottom: "8px",
  alignItems: "center"
};

const suggestedPriceBox = {
  background: "#0f172a",
  border: "1px solid #374151",
  borderRadius: "8px",
  padding: "8px",
  color: "#f59e0b",
  fontSize: "13px",
  lineHeight: "1.35"
};

const pieceInput = {
  padding: "10px",
  borderRadius: "8px",
  border: "1px solid #374151",
  background: "#111827",
  color: "white",
  boxSizing: "border-box"
};

const smallPieceInput = {
  ...pieceInput,
  width: "100%"
};

const piecePriceInput = {
  ...pieceInput,
  width: "100%"
};

const miniDeleteButton = {
  padding: "10px",
  borderRadius: "8px",
  border: "none",
  background: "#991b1b",
  color: "white",
  cursor: "pointer",
  fontWeight: "bold"
};

const estimatePreviewBox = {
  background: "#111827",
  border: "1px solid #f59e0b",
  borderRadius: "10px",
  padding: "12px",
  marginTop: "12px",
  marginBottom: "12px"
};

const fileInput = { marginTop: "15px", color: "white" };
