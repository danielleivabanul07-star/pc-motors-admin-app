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
    trabajosMecanicosMes: [],
    trabajosPendientesSemana: [],
    trabajosPendientesMes: []
  });

  const [ocultarTrabajosSemana, setOcultarTrabajosSemana] = useState(false);
  const [resetSemanalDesde, setResetSemanalDesde] = useState(() =>
    localStorage.getItem("pc_motors_dashboard_reset_semanal_desde") || ""
  );
  const [refrescando, setRefrescando] = useState(false);
  const [busquedaTrabajo, setBusquedaTrabajo] = useState("");
  const [seccionesAbiertas, setSeccionesAbiertas] = useState({
    resumen: true,
    metodos: true,
    pendientes: false,
    semana: false,
    mes: false,
    trabajos: false
  });

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

  const alternarSeccion = (nombre) => {
    setSeccionesAbiertas((prev) => ({
      ...prev,
      [nombre]: !prev[nombre]
    }));
  };

  const dinero = (valor) => `$${Number(valor || 0).toFixed(2)}`;

  const porcentaje = (valor, total) => {
    const totalNumero = Number(total || 0);
    if (!totalNumero) return "0.00%";
    return `${((Number(valor || 0) / totalNumero) * 100).toFixed(2)}%`;
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

  const obtenerResetSemanalDesde = () => {
    const valor = localStorage.getItem("pc_motors_dashboard_reset_semanal_desde");
    const fecha = convertirFechaSupabase(valor);
    if (!fecha || Number.isNaN(fecha.getTime())) return null;
    return fecha;
  };

  const obtenerInicioSemanaDashboard = () => {
    const inicioSemanaActual = inicioSemana();
    const resetDesde = obtenerResetSemanalDesde();

    // Si el reset fue dentro de esta semana, el Dashboard semanal empieza desde ese momento.
    // Si el reset es viejo, se ignora automáticamente al comenzar una semana nueva.
    if (resetDesde && resetDesde >= inicioSemanaActual) return resetDesde;
    return inicioSemanaActual;
  };

  const redondearDinero = (valor) => Math.round(Number(valor || 0) * 100) / 100;

  const normalizarMetodoPago = (metodoValor) => {
    const texto = String(metodoValor || "").trim();
    const clave = texto.toLowerCase();

    if (!clave || clave === "pendiente" || clave === "no registrado") return "";
    if (clave === "cash" || clave === "efectivo") return "Cash";
    if (clave === "zelle") return "Zelle";
    if (clave === "debit card" || clave === "debit" || clave === "tarjeta debito" || clave === "tarjeta de debito") return "Debit Card";
    if (clave === "credit card" || clave === "credit" || clave === "tarjeta credito" || clave === "tarjeta de credito") return "Credit Card";
    if (clave === "cash app" || clave === "cashapp") return "Cash App";
    if (clave === "apple pay" || clave === "applepay") return "Apple Pay";
    if (clave === "check" || clave === "cheque") return "Check";
    if (clave === "financiamiento" || clave === "financing" || clave === "finance") return "Financiamiento";
    if (clave === "otro" || clave === "other") return "Otro";

    return texto;
  };

  const metodoPagoEsCombinado = (metodoValor) => {
    const texto = String(metodoValor || "").trim();
    return texto.includes("+") || texto.includes(",") || texto.toLowerCase().includes(" y ");
  };

  const parsearPagosDetalle = (valor) => {
    if (Array.isArray(valor)) return valor;
    if (!valor) return [];

    try {
      const parsed = JSON.parse(valor);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  };

  const limpiarPagosDetalle = (pagosValor) => {
    return parsearPagosDetalle(pagosValor)
      .map((pago, index) => ({
        id: pago.id || `${Date.now()}-pago-${index}`,
        metodo: normalizarMetodoPago(pago.metodo || pago.metodo_pago),
        monto: redondearDinero(Number(pago.monto || pago.amount || 0)),
        nota: String(pago.nota || "").trim()
      }))
      .filter((pago) => pago.metodo && pago.monto > 0);
  };

  const totalPagosDetalle = (pagosValor) => {
    return redondearDinero(
      limpiarPagosDetalle(pagosValor).reduce((total, pago) => total + Number(pago.monto || 0), 0)
    );
  };

  const pagosDetalleTrabajo = (trabajo) => {
    const pagos = limpiarPagosDetalle(trabajo?.pagos_detalle);
    if (pagos.length > 0) return pagos;

    const metodoOriginal = String(trabajo?.metodo_pago || "").trim();
    const metodo = normalizarMetodoPago(metodoOriginal);
    const total = calcularTotalTrabajoMecanico(trabajo || {});

    // Si el método viejo viene combinado como "Cash + Zelle", no lo convertimos en una categoría falsa.
    // Debe ajustarse con pagos_detalle para repartir los montos reales por método.
    if (metodoPagoEsCombinado(metodoOriginal)) return [];

    if (metodo && trabajo?.pago_recibido === true && total > 0) {
      return [
        {
          id: `fallback-${trabajo.id || Date.now()}`,
          metodo,
          monto: total,
          nota: "Pago registrado"
        }
      ];
    }

    return [];
  };

  const totalPagadoTrabajo = (trabajo) => {
    const totalDetalle = totalPagosDetalle(trabajo?.pagos_detalle);
    if (totalDetalle > 0) return totalDetalle;
    if (Number(trabajo?.total_pagado || 0) > 0) return redondearDinero(trabajo.total_pagado);
    if (trabajo?.pago_recibido === true) return calcularTotalTrabajoMecanico(trabajo);
    return 0;
  };

  const saldoPendienteTrabajo = (trabajo) => {
    const total = calcularTotalTrabajoMecanico(trabajo);
    const pagado = totalPagadoTrabajo(trabajo);
    const saldoBD = Number(trabajo?.saldo_pendiente || 0);
    if (saldoBD > 0) return redondearDinero(saldoBD);
    return redondearDinero(Math.max(0, total - pagado));
  };

  const pagosPorMetodoTrabajo = (trabajo) => {
    const resumen = {};
    pagosDetalleTrabajo(trabajo).forEach((pago) => {
      const metodo = normalizarMetodoPago(pago.metodo);
      if (!metodo) return;
      resumen[metodo] = redondearDinero(Number(resumen[metodo] || 0) + Number(pago.monto || 0));
    });
    return resumen;
  };

  const textoPagosDetalle = (trabajo) => {
    const pagos = pagosDetalleTrabajo(trabajo);
    if (pagos.length === 0) {
      if (trabajo?.pago_recibido && metodoPagoEsCombinado(trabajo?.metodo_pago)) return "Sin desglose: ajustar pagos";
      return trabajo?.pago_recibido ? (normalizarMetodoPago(trabajo?.metodo_pago) || "No registrado") : "Pendiente";
    }
    return pagos.map((pago) => `${pago.metodo} ${dinero(pago.monto)}`).join(" + ");
  };

  const montoMetodoTrabajo = (trabajo, metodo) => {
    return pagosPorMetodoTrabajo(trabajo)[metodo] || 0;
  };

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
    pagosPendientes: 0,
    cobrosPorMetodo: {}
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

  const calcularTotalTrabajoMecanico = (trabajo) => {
    const inversionPiezas = Number(trabajo.costo_piezas || 0);
    const ventaPiezas = Number(trabajo.venta_piezas || 0);
    const manoObra = Number(trabajo.mano_obra || 0);

    const taxPiezas6 = redondearDinero(ventaPiezas * 0.06);
    const subtotalBase = redondearDinero(ventaPiezas + manoObra + taxPiezas6);
    const cargoGeneral4 = redondearDinero(subtotalBase * 0.04);
    const totalGeneradoCalculado = redondearDinero(subtotalBase + cargoGeneral4);

    return Number(trabajo.total_generado || totalGeneradoCalculado);
  };

  const esTrabajoFinalizado = (trabajo) => trabajo?.estado === "finalizado";

  const esTrabajoCobrado = (trabajo) => {
    return esTrabajoFinalizado(trabajo) && totalPagadoTrabajo(trabajo) > 0;
  };

  const esTrabajoPendientePago = (trabajo) => {
    return esTrabajoFinalizado(trabajo) && saldoPendienteTrabajo(trabajo) > 0;
  };

  const calcularPagosPendientes = (trabajos) => {
    return redondearDinero(
      trabajos.reduce((total, trabajo) => total + saldoPendienteTrabajo(trabajo), 0)
    );
  };

  const calcularTotalesTrabajosMecanicos = (trabajos) => {
    return trabajos.reduce((total, trabajo) => {
      const inversionPiezas = Number(trabajo.costo_piezas || 0);
      const ventaPiezas = Number(trabajo.venta_piezas || 0);
      const manoObra = Number(trabajo.mano_obra || 0);

      const taxPiezas6 = redondearDinero(ventaPiezas * 0.06);
      const subtotalBase = redondearDinero(ventaPiezas + manoObra + taxPiezas6);
      const cargoGeneral4 = redondearDinero(subtotalBase * 0.04);
      const totalGenerado = calcularTotalTrabajoMecanico(trabajo);
      const totalPagado = totalPagadoTrabajo(trabajo);
      const proporcionPagada = totalGenerado > 0 ? Math.min(1, totalPagado / totalGenerado) : 0;
      const gananciaPiezas = Number(trabajo.ganancia_piezas || redondearDinero((ventaPiezas - inversionPiezas) + taxPiezas6));

      // Para que el Dashboard refleje dinero real cobrado, los totales financieros se prorratean
      // cuando un trabajo tiene pagos parciales. Los cobros por método siempre salen de pagos_detalle.
      total.inversionPiezas += redondearDinero(inversionPiezas * proporcionPagada);
      total.ventaPiezas += redondearDinero(ventaPiezas * proporcionPagada);
      total.taxPiezas6 += redondearDinero(taxPiezas6 * proporcionPagada);
      total.cargoGeneral4 += redondearDinero(cargoGeneral4 * proporcionPagada);
      total.gananciaPiezas += redondearDinero(gananciaPiezas * proporcionPagada);
      total.manoObra += redondearDinero(manoObra * proporcionPagada);
      total.impuestos += redondearDinero((taxPiezas6 + cargoGeneral4) * proporcionPagada);
      total.totalCobrado += redondearDinero(totalPagado);
      total.gananciaAprox += redondearDinero((totalGenerado - inversionPiezas) * proporcionPagada);

      Object.entries(pagosPorMetodoTrabajo(trabajo)).forEach(([metodo, monto]) => {
        total.cobrosPorMetodo[metodo] = redondearDinero(Number(total.cobrosPorMetodo[metodo] || 0) + Number(monto || 0));
      });

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
    pagosPendientes: Number(a.pagosPendientes || 0) + Number(b.pagosPendientes || 0),
    cobrosPorMetodo: {
      ...(a.cobrosPorMetodo || {}),
      ...Object.fromEntries(
        Object.entries(b.cobrosPorMetodo || {}).map(([metodo, valor]) => [
          metodo,
          Number(a.cobrosPorMetodo?.[metodo] || 0) + Number(valor || 0)
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

    // Trabajos finalizados se separan en dos grupos:
    // 1) cobrados: sí entran al total cobrado, ganancias, taxes y desglose por método.
    // 2) pendientes: NO entran al total cobrado, pero se muestran aparte como pagos pendientes.
    const trabajosMecanicosFinalizados = trabajosMecanicos.filter(esTrabajoFinalizado);
    const trabajosMecanicosCobrados = trabajosMecanicos.filter(esTrabajoCobrado);
    const trabajosMecanicosPendientesPago = trabajosMecanicos.filter(esTrabajoPendientePago);

    if (errorTrabajosMecanicos) {
      console.log(errorTrabajosMecanicos);
      alert("Error cargando trabajos mecánicos");
      setRefrescando(false);
      return;
    }

    const inicioSemanaActual = obtenerInicioSemanaDashboard();
    const inicioMesActual = inicioMes();

    const trabajosSemana = [];
    const trabajosMes = [];

    const trabajosMecanicosSemana =
      trabajosMecanicosCobrados.filter((trabajo) => {
        const fecha = fechaTrabajoMecanico(trabajo);
        return fecha && fecha >= inicioSemanaActual;
      }) || [];

    const trabajosMecanicosMes =
      trabajosMecanicosCobrados.filter((trabajo) => {
        const fecha = fechaTrabajoMecanico(trabajo);
        return fecha && fecha >= inicioMesActual;
      }) || [];

    const trabajosPendientesSemana =
      trabajosMecanicosPendientesPago.filter((trabajo) => {
        const fecha = fechaTrabajoMecanico(trabajo);
        return fecha && fecha >= inicioSemanaActual;
      }) || [];

    const trabajosPendientesMes =
      trabajosMecanicosPendientesPago.filter((trabajo) => {
        const fecha = fechaTrabajoMecanico(trabajo);
        return fecha && fecha >= inicioMesActual;
      }) || [];

    const semana = calcularTotalesTrabajosMecanicos(trabajosMecanicosSemana);
    semana.pagosPendientes = calcularPagosPendientes(trabajosPendientesSemana);

    const mes = calcularTotalesTrabajosMecanicos(trabajosMecanicosMes);
    mes.pagosPendientes = calcularPagosPendientes(trabajosPendientesMes);

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
      trabajosMecanicosMes,
      trabajosPendientesSemana,
      trabajosPendientesMes
    });

    setOcultarTrabajosSemana(false);
    setRefrescando(false);

    if (mostrarAlerta) alert("Dashboard actualizado correctamente.");
  }

  const metodosPago = [
    "Cash",
    "Zelle",
    "Debit Card",
    "Credit Card",
    "Cash App",
    "Apple Pay",
    "Check",
    "Financiamiento",
    "Otro"
  ];

  const marcarTrabajoComoCobrado = async (trabajo) => {
    if (!trabajo?.id) return;

    let metodoPago = String(trabajo.metodo_pago || "").trim();

    if (!metodoPago || metodoPago === "Pendiente" || metodoPago === "No registrado") {
      metodoPago =
        prompt(
          `Método de pago recibido para ${trabajo.cliente_nombre || "cliente"}:\n\nOpciones: ${metodosPago.join(", ")}`,
          "Cash"
        ) || "";
      metodoPago = metodoPago.trim();
    }

    if (!metodoPago || metodoPago === "Pendiente" || metodoPago === "No registrado") {
      alert("Para marcar como cobrado debes indicar un método de pago válido.");
      return;
    }

    const totalTrabajo = calcularTotalTrabajoMecanico(trabajo);

    const confirmar = confirm(
      `¿Marcar este trabajo como COBRADO?\n\nCliente: ${trabajo.cliente_nombre || "No registrado"}\nFactura: ${trabajo.numero_factura || "Sin factura"}\nMétodo: ${metodoPago}\nTotal: ${dinero(totalTrabajo)}`
    );

    if (!confirmar) return;

    setRefrescando(true);

    const { error } = await supabase
      .from("trabajos_mecanicos")
      .update({
        pago_recibido: true,
        metodo_pago: normalizarMetodoPago(metodoPago),
        pagos_detalle: [
          {
            id: `${Date.now()}-dashboard-pago`,
            metodo: normalizarMetodoPago(metodoPago),
            monto: totalTrabajo,
            nota: "Marcado como cobrado desde Dashboard"
          }
        ],
        total_pagado: totalTrabajo,
        saldo_pendiente: 0,
        fecha_pago: new Date().toISOString()
      })
      .eq("id", trabajo.id);

    if (error) {
      console.log(error);
      alert(JSON.stringify(error, null, 2));
      setRefrescando(false);
      return;
    }

    alert("Pago marcado como cobrado correctamente.");
    await cargarDashboard(false);
  };

  const marcarTrabajoComoPendiente = async (trabajo) => {
    if (!trabajo?.id) return;

    const confirmar = confirm(
      `¿Marcar este trabajo como PENDIENTE de pago?\n\nCliente: ${trabajo.cliente_nombre || "No registrado"}\nFactura: ${trabajo.numero_factura || "Sin factura"}`
    );

    if (!confirmar) return;

    setRefrescando(true);

    const totalTrabajo = calcularTotalTrabajoMecanico(trabajo);

    const { error } = await supabase
      .from("trabajos_mecanicos")
      .update({
        pago_recibido: false,
        total_pagado: totalPagadoTrabajo(trabajo),
        saldo_pendiente: saldoPendienteTrabajo({ ...trabajo, saldo_pendiente: totalTrabajo - totalPagadoTrabajo(trabajo) }),
        fecha_pago: null
      })
      .eq("id", trabajo.id);

    if (error) {
      console.log(error);
      alert(JSON.stringify(error, null, 2));
      setRefrescando(false);
      return;
    }

    alert("Pago marcado como pendiente correctamente.");
    await cargarDashboard(false);
  };

  const ajustarPagosDashboard = async (trabajo) => {
    if (!trabajo?.id) return;

    const totalTrabajo = calcularTotalTrabajoMecanico(trabajo);
    const pagosActuales = pagosPorMetodoTrabajo(trabajo);

    const nuevosPagos = [];
    let cancelado = false;

    for (const metodo of metodosPago) {
      const valorActual = Number(pagosActuales[metodo] || 0);
      const entrada = prompt(
        `Ajustar pago para ${trabajo.cliente_nombre || "cliente"}\n\nMétodo: ${metodo}\nTotal factura: ${dinero(totalTrabajo)}\n\nEscribe el monto recibido por ${metodo}.\nDeja 0 si no aplica.`,
        valorActual ? String(valorActual) : "0"
      );

      if (entrada === null) {
        cancelado = true;
        break;
      }

      const monto = Number(String(entrada).replace(",", "."));

      if (!Number.isFinite(monto) || monto < 0) {
        alert(`Monto no válido para ${metodo}.`);
        return;
      }

      if (monto > 0) {
        nuevosPagos.push({
          id: `${Date.now()}-${metodo.replace(/\s+/g, "-").toLowerCase()}`,
          metodo,
          monto: redondearDinero(monto),
          nota: "Ajustado desde Dashboard"
        });
      }
    }

    if (cancelado) return;

    const totalPagado = redondearDinero(
      nuevosPagos.reduce((total, pago) => total + Number(pago.monto || 0), 0)
    );

    if (totalPagado > totalTrabajo + 0.009) {
      const continuar = confirm(
        `El total pagado (${dinero(totalPagado)}) es mayor que el total de la factura (${dinero(totalTrabajo)}).\n\n¿Guardar de todas formas?`
      );
      if (!continuar) return;
    }

    const saldoPendiente = redondearDinero(Math.max(0, totalTrabajo - totalPagado));
    const pagoRecibido = totalTrabajo > 0 && saldoPendiente <= 0.009;

    const metodoResumen = nuevosPagos.length === 0
      ? "Pendiente"
      : [...new Set(nuevosPagos.map((pago) => pago.metodo))].join(" + ");

    const confirmar = confirm(
      `¿Guardar ajuste de pagos?\n\nCliente: ${trabajo.cliente_nombre || "No registrado"}\nTotal factura: ${dinero(totalTrabajo)}\nTotal pagado: ${dinero(totalPagado)}\nPendiente: ${dinero(saldoPendiente)}`
    );

    if (!confirmar) return;

    setRefrescando(true);

    const { error } = await supabase
      .from("trabajos_mecanicos")
      .update({
        metodo_pago: metodoResumen,
        pagos_detalle: nuevosPagos,
        total_pagado: totalPagado,
        saldo_pendiente: saldoPendiente,
        pago_recibido: pagoRecibido,
        fecha_pago: pagoRecibido ? (trabajo.fecha_pago || new Date().toISOString()) : null
      })
      .eq("id", trabajo.id);

    if (error) {
      console.log(error);
      alert(JSON.stringify(error, null, 2));
      setRefrescando(false);
      return;
    }

    alert("Pagos ajustados correctamente.");
    await cargarDashboard(false);
  };

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

  const resetearDashboardSemanal = async () => {
    const confirmar = confirm(
      "¿Resetear los datos SEMANALES del Dashboard a 0?\n\nEsto NO borra clientes, vehículos, trabajos, facturas ni reportes. Solo hace que el Dashboard semanal empiece a contar desde este momento."
    );

    if (!confirmar) return;

    const ahora = new Date().toISOString();
    localStorage.setItem("pc_motors_dashboard_reset_semanal_desde", ahora);
    setResetSemanalDesde(ahora);
    setOcultarTrabajosSemana(false);

    await cargarDashboard(false);
    alert("Dashboard semanal reiniciado a 0 correctamente.");
  };

  const quitarResetSemanalDashboard = async () => {
    const confirmar = confirm(
      "¿Quitar el reset semanal y volver a mostrar todos los datos reales de esta semana?"
    );

    if (!confirmar) return;

    localStorage.removeItem("pc_motors_dashboard_reset_semanal_desde");
    setResetSemanalDesde("");
    setOcultarTrabajosSemana(false);

    await cargarDashboard(false);
    alert("Reset semanal eliminado. El Dashboard volvió a mostrar la semana completa.");
  };

  const trabajosFinalizadosVisibles = (stats.trabajosMecanicosSemana || []).filter((trabajo) => {
    const texto = `${trabajo.numero_factura || ""} ${trabajo.cliente_nombre || ""} ${trabajo.mecanico_nombre || ""} ${trabajo.vehiculo || ""}`.toLowerCase();
    return texto.includes(busquedaTrabajo.toLowerCase());
  });

  const trabajosPendientesSemanaVisibles = (stats.trabajosPendientesSemana || []).filter((trabajo) => {
    const texto = `${trabajo.numero_factura || ""} ${trabajo.cliente_nombre || ""} ${trabajo.mecanico_nombre || ""} ${trabajo.vehiculo || ""}`.toLowerCase();
    return texto.includes(busquedaTrabajo.toLowerCase());
  });

  const trabajosPendientesMesVisibles = (stats.trabajosPendientesMes || []).filter((trabajo) => {
    const texto = `${trabajo.numero_factura || ""} ${trabajo.cliente_nombre || ""} ${trabajo.mecanico_nombre || ""} ${trabajo.vehiculo || ""}`.toLowerCase();
    return texto.includes(busquedaTrabajo.toLowerCase());
  });

  return (
    <div style={pageBox}>
      <h1 style={titleStyle}>📊 Dashboard Financiero</h1>
      <p style={subtitleStyle}>
        Resumen limpio de cobros reales, pagos pendientes y métodos de pago.
        {resetSemanalDesde && (
          <span style={resetNoticeStyle}> Semana reiniciada desde: {new Date(resetSemanalDesde).toLocaleString()}</span>
        )}
      </p>

      <div style={actionsBox}>
        <button onClick={() => guardarReporte("semanal")} style={saveButton}>💾 Guardar Reporte Semanal</button>
        <button onClick={() => guardarReporte("mensual")} style={saveButton}>💾 Guardar Reporte Mensual</button>
        <button onClick={resetearDashboardSemanal} style={cleanButton}>♻️ Reset Semana</button>
        {resetSemanalDesde && (
          <button onClick={quitarResetSemanalDashboard} style={undoButton}>↩️ Quitar Reset</button>
        )}
        <button
          onClick={() => cargarDashboard(true)}
          style={{ ...refreshButton, opacity: refrescando ? 0.7 : 1, cursor: refrescando ? "not-allowed" : "pointer" }}
          disabled={refrescando}
        >
          {refrescando ? "Refrescando..." : "🔄 Refrescar"}
        </button>
      </div>

      <Panel
        titulo="📌 Resumen General"
        abierto={seccionesAbiertas.resumen}
        onToggle={() => alternarSeccion("resumen")}
      >
        <div style={gridStyle}>
          <Card title="👥 Clientes en proceso" value={stats.clientesActivos} />
          <Card title="🚗 Vehículos en proceso" value={stats.vehiculosActivos} />
          <Card title="📁 Clientes atendidos" value={stats.clientesAtendidos} />
          <Card title="🛠 Trabajos activos" value={stats.trabajosActivos} />
          <Card title="💰 Cobrado esta semana" value={dinero(stats.semana.totalCobrado)} />
          <Card title="⏳ Pendiente semana" value={dinero(stats.semana.pagosPendientes)} />
          <Card title="💰 Cobrado este mes" value={dinero(stats.mes.totalCobrado)} />
          <Card title="⏳ Pendiente mes" value={dinero(stats.mes.pagosPendientes)} />
        </div>
      </Panel>

      <Panel
        titulo="💳 Cobros por Método"
        abierto={seccionesAbiertas.metodos}
        onToggle={() => alternarSeccion("metodos")}
      >
        <h3 style={miniTitle}>Esta semana</h3>
        <div style={gridStyle}>
          {Object.entries(stats.semana.cobrosPorMetodo || {}).length === 0 ? (
            <Card title="Sin cobros registrados" value="$0.00" />
          ) : (
            Object.entries(stats.semana.cobrosPorMetodo || {}).sort(([a], [b]) => a.localeCompare(b)).map(([metodo, total]) => (
              <Card
                key={`semana-${metodo}`}
                title={`💳 ${metodo}`}
                value={dinero(total)}
                subtitle={`${porcentaje(total, stats.semana.totalCobrado)} del total cobrado`}
              />
            ))
          )}
        </div>

        <h3 style={miniTitle}>Este mes</h3>
        <div style={gridStyle}>
          {Object.entries(stats.mes.cobrosPorMetodo || {}).length === 0 ? (
            <Card title="Sin cobros registrados" value="$0.00" />
          ) : (
            Object.entries(stats.mes.cobrosPorMetodo || {}).sort(([a], [b]) => a.localeCompare(b)).map(([metodo, total]) => (
              <Card
                key={`mes-${metodo}`}
                title={`💳 ${metodo}`}
                value={dinero(total)}
                subtitle={`${porcentaje(total, stats.mes.totalCobrado)} del total cobrado`}
              />
            ))
          )}
        </div>
      </Panel>

      <Panel
        titulo="⏳ Pagos Pendientes"
        abierto={seccionesAbiertas.pendientes}
        onToggle={() => alternarSeccion("pendientes")}
      >
        <div style={gridStyle}>
          <Card title="Pendiente esta semana" value={dinero(stats.semana.pagosPendientes)} />
          <Card title="Pendiente este mes" value={dinero(stats.mes.pagosPendientes)} />
        </div>

        <h3 style={miniTitle}>Pendientes esta semana</h3>
        {trabajosPendientesSemanaVisibles.length === 0 ? (
          <div style={emptyStyle}>No hay pagos pendientes esta semana.</div>
        ) : (
          <div style={compactListBox}>
            {trabajosPendientesSemanaVisibles.map((trabajo) => (
              <TrabajoCompacto
                key={`pendiente-semana-${trabajo.id}`}
                trabajo={trabajo}
                dinero={dinero}
                textoPagosDetalle={textoPagosDetalle}
                totalPagadoTrabajo={totalPagadoTrabajo}
                saldoPendienteTrabajo={saldoPendienteTrabajo}
                montoMetodoTrabajo={montoMetodoTrabajo}
                onAjustar={() => ajustarPagosDashboard(trabajo)}
                onCobrado={() => marcarTrabajoComoCobrado(trabajo)}
                onPendiente={() => marcarTrabajoComoPendiente(trabajo)}
                pendiente
              />
            ))}
          </div>
        )}

        <h3 style={miniTitle}>Pendientes este mes</h3>
        {trabajosPendientesMesVisibles.length === 0 ? (
          <div style={emptyStyle}>No hay pagos pendientes este mes.</div>
        ) : (
          <div style={compactListBox}>
            {trabajosPendientesMesVisibles.map((trabajo) => (
              <TrabajoCompacto
                key={`pendiente-mes-${trabajo.id}`}
                trabajo={trabajo}
                dinero={dinero}
                textoPagosDetalle={textoPagosDetalle}
                totalPagadoTrabajo={totalPagadoTrabajo}
                saldoPendienteTrabajo={saldoPendienteTrabajo}
                montoMetodoTrabajo={montoMetodoTrabajo}
                onAjustar={() => ajustarPagosDashboard(trabajo)}
                onCobrado={() => marcarTrabajoComoCobrado(trabajo)}
                onPendiente={() => marcarTrabajoComoPendiente(trabajo)}
                pendiente
              />
            ))}
          </div>
        )}
      </Panel>

      <Panel
        titulo="📅 Resumen Semanal Detallado"
        abierto={seccionesAbiertas.semana}
        onToggle={() => alternarSeccion("semana")}
      >
        <div style={gridStyle}>
          <Card title="🧾 Inversión piezas" value={dinero(stats.semana.inversionPiezas)} />
          <Card title="💵 Venta piezas" value={dinero(stats.semana.ventaPiezas)} />
          <Card title="🧾 Tax piezas exacto 6.00%" value={dinero(stats.semana.taxPiezas6)} subtitle="Uso interno" />
          <Card title="💳 Cargo general exacto 4.00%" value={dinero(stats.semana.cargoGeneral4)} subtitle="Uso interno" />
          <Card title="📈 Ganancia piezas" value={dinero(stats.semana.gananciaPiezas)} />
          <Card title="🔧 Mano de obra" value={dinero(stats.semana.manoObra)} />
          <Card title="💲 Total cobrado" value={dinero(stats.semana.totalCobrado)} />
          <Card title="✅ Ganancia aprox." value={dinero(stats.semana.gananciaAprox)} />
        </div>
      </Panel>

      <Panel
        titulo="🗓 Resumen Mensual Detallado"
        abierto={seccionesAbiertas.mes}
        onToggle={() => alternarSeccion("mes")}
      >
        <div style={gridStyle}>
          <Card title="🧾 Inversión piezas" value={dinero(stats.mes.inversionPiezas)} />
          <Card title="💵 Venta piezas" value={dinero(stats.mes.ventaPiezas)} />
          <Card title="🧾 Tax piezas exacto 6.00%" value={dinero(stats.mes.taxPiezas6)} subtitle="Uso interno" />
          <Card title="💳 Cargo general exacto 4.00%" value={dinero(stats.mes.cargoGeneral4)} subtitle="Uso interno" />
          <Card title="📈 Ganancia piezas" value={dinero(stats.mes.gananciaPiezas)} />
          <Card title="🔧 Mano de obra" value={dinero(stats.mes.manoObra)} />
          <Card title="💲 Total cobrado" value={dinero(stats.mes.totalCobrado)} />
          <Card title="✅ Ganancia aprox." value={dinero(stats.mes.gananciaAprox)} />
        </div>
      </Panel>

      <Panel
        titulo="🚗 Trabajos Finalizados / Ajustar Pagos"
        abierto={seccionesAbiertas.trabajos}
        onToggle={() => alternarSeccion("trabajos")}
      >
        <input
          placeholder="Buscar por cliente, factura, mecánico o vehículo..."
          value={busquedaTrabajo}
          onChange={(e) => setBusquedaTrabajo(e.target.value)}
          style={searchInput}
        />

        {ocultarTrabajosSemana ? (
          <div style={emptyStyle}>La vista fue limpiada. Usa “Refrescar” para volver a mostrar los datos.</div>
        ) : trabajosFinalizadosVisibles.length === 0 ? (
          <div style={emptyStyle}>No hay trabajos finalizados visibles esta semana.</div>
        ) : (
          <div style={compactListBox}>
            {trabajosFinalizadosVisibles.map((trabajo) => (
              <TrabajoCompacto
                key={`mecanico-${trabajo.id}`}
                trabajo={trabajo}
                dinero={dinero}
                textoPagosDetalle={textoPagosDetalle}
                totalPagadoTrabajo={totalPagadoTrabajo}
                saldoPendienteTrabajo={saldoPendienteTrabajo}
                montoMetodoTrabajo={montoMetodoTrabajo}
                onAjustar={() => ajustarPagosDashboard(trabajo)}
                onCobrado={() => marcarTrabajoComoCobrado(trabajo)}
                onPendiente={() => marcarTrabajoComoPendiente(trabajo)}
              />
            ))}
          </div>
        )}
      </Panel>
    </div>
  );
}



function Panel({ titulo, abierto, onToggle, children }) {
  return (
    <section style={panelStyle}>
      <button onClick={onToggle} style={panelHeaderStyle}>
        <span>{titulo}</span>
        <span>{abierto ? "▲ Ocultar" : "▼ Ver"}</span>
      </button>
      {abierto && <div style={panelBodyStyle}>{children}</div>}
    </section>
  );
}

function TrabajoCompacto({
  trabajo,
  dinero,
  textoPagosDetalle,
  totalPagadoTrabajo,
  saldoPendienteTrabajo,
  montoMetodoTrabajo,
  onAjustar,
  onCobrado,
  onPendiente,
  pendiente = false
}) {
  return (
    <div style={compactJobCard}>
      <div>
        <strong style={{ color: "#f59e0b" }}>{trabajo.numero_factura || "Trabajo finalizado"}</strong>
        <p style={compactText}>{trabajo.cliente_nombre || "Cliente no registrado"}</p>
        <p style={compactText}>{trabajo.mecanico_nombre || "Sin mecánico"}</p>
      </div>

      <div>
        <p style={compactText}><strong>Pagos:</strong> {textoPagosDetalle(trabajo)}</p>
        <p style={compactText}>
          Pagado: <strong>{dinero(totalPagadoTrabajo(trabajo))}</strong> /
          Pendiente: <strong>{dinero(saldoPendienteTrabajo(trabajo))}</strong>
        </p>
      </div>

      <div style={paymentMiniGrid}>
        <span>Cash {dinero(montoMetodoTrabajo(trabajo, "Cash"))}</span>
        <span>Zelle {dinero(montoMetodoTrabajo(trabajo, "Zelle"))}</span>
        <span>Financ. {dinero(montoMetodoTrabajo(trabajo, "Financiamiento"))}</span>
        <span>Card {dinero(montoMetodoTrabajo(trabajo, "Debit Card") + montoMetodoTrabajo(trabajo, "Credit Card"))}</span>
      </div>

      <div style={compactActions}>
        <button onClick={onAjustar} style={adjustButton}>✏️ Ajustar pagos</button>
        {pendiente ? (
          <button onClick={onCobrado} style={markPaidButton}>✅ Cobrado</button>
        ) : (
          <button onClick={onPendiente} style={markPendingButton}>⏳ Pendiente</button>
        )}
      </div>
    </div>
  );
}


function Card({ title, value, subtitle }) {
  return (
    <div style={cardStyle}>
      <h2 style={cardTitleStyle}>{title}</h2>
      <p style={numberStyle}>{value}</p>
      {subtitle && <p style={cardSubtitleStyle}>{subtitle}</p>}
    </div>
  );
}

const pageBox = { color: "white" };
const titleStyle = { color: "#f59e0b", fontSize: "42px", marginBottom: "8px" };
const subtitleStyle = { color: "#d1d5db", fontSize: "16px" };
const actionsBox = { display: "flex", gap: "12px", flexWrap: "wrap", marginTop: "25px", marginBottom: "25px" };
const saveButton = { padding: "12px 16px", background: "#16a34a", color: "white", border: "none", borderRadius: "8px", cursor: "pointer", fontWeight: "bold" };
const cleanButton = { padding: "12px 16px", background: "#dc2626", color: "white", border: "none", borderRadius: "8px", cursor: "pointer", fontWeight: "bold" };
const undoButton = { padding: "12px 16px", background: "#6b7280", color: "white", border: "none", borderRadius: "8px", cursor: "pointer", fontWeight: "bold" };
const refreshButton = { padding: "12px 16px", background: "#2563eb", color: "white", border: "none", borderRadius: "8px", cursor: "pointer", fontWeight: "bold" };
const resetNoticeStyle = { display: "inline-block", marginLeft: "10px", color: "#fca5a5", fontWeight: "bold" };
const sectionTitle = { color: "#f59e0b", marginTop: "35px", marginBottom: "10px" };
const gridStyle = { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: "16px", marginTop: "14px" };
const cardStyle = { background: "rgba(31, 41, 55, 0.95)", padding: "20px", borderRadius: "12px", border: "1px solid #f59e0b", boxShadow: "0 10px 25px rgba(0,0,0,0.25)" };
const cardTitleStyle = { color: "white", fontSize: "20px", margin: 0, marginBottom: "10px" };
const numberStyle = { fontSize: "30px", fontWeight: "bold", color: "#f59e0b", margin: 0 };
const cardSubtitleStyle = { color: "#d1d5db", fontSize: "13px", margin: "8px 0 0 0", lineHeight: "1.35" };
const tableBox = { background: "rgba(31, 41, 55, 0.95)", borderRadius: "12px", border: "1px solid #374151", overflowX: "auto", overflowY: "hidden" };
const rowStyle = { display: "grid", gridTemplateColumns: "130px 140px 130px 260px 110px 110px 110px 130px 120px 180px 140px", gap: "10px", padding: "14px", borderBottom: "1px solid #374151", alignItems: "center", color: "white", minWidth: "1650px" };
const pendingRowStyle = { display: "grid", gridTemplateColumns: "140px 150px 140px 260px 120px 130px 150px", gap: "10px", padding: "14px", borderBottom: "1px solid #374151", alignItems: "center", color: "white", minWidth: "1090px" };
const markPaidButton = { padding: "10px 12px", background: "#16a34a", color: "white", border: "none", borderRadius: "8px", cursor: "pointer", fontWeight: "bold" };
const markPendingButton = { padding: "10px 12px", background: "#d97706", color: "#111827", border: "none", borderRadius: "8px", cursor: "pointer", fontWeight: "bold" };
const pendingBadge = { background: "#7f1d1d", color: "white", padding: "6px 10px", borderRadius: "999px", fontWeight: "bold", textAlign: "center" };
const paidBadge = { background: "#166534", color: "white", padding: "6px 10px", borderRadius: "999px", fontWeight: "bold", textAlign: "center" };
const emptyStyle = { background: "rgba(31, 41, 55, 0.95)", padding: "20px", borderRadius: "12px", border: "1px solid #374151", color: "white" };


const panelStyle = {
  background: "rgba(15, 23, 42, 0.92)",
  border: "1px solid #374151",
  borderRadius: "14px",
  marginTop: "18px",
  overflow: "hidden"
};

const panelHeaderStyle = {
  width: "100%",
  background: "rgba(31, 41, 55, 0.98)",
  color: "#f59e0b",
  border: "none",
  padding: "16px 18px",
  fontSize: "20px",
  fontWeight: "bold",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  cursor: "pointer",
  textAlign: "left"
};

const panelBodyStyle = {
  padding: "18px"
};

const miniTitle = {
  color: "#f59e0b",
  marginTop: "18px",
  marginBottom: "8px"
};

const searchInput = {
  width: "100%",
  padding: "13px",
  borderRadius: "10px",
  border: "1px solid #374151",
  background: "#111827",
  color: "white",
  marginBottom: "14px",
  fontSize: "15px"
};

const compactListBox = {
  display: "grid",
  gap: "12px"
};

const compactJobCard = {
  display: "grid",
  gridTemplateColumns: "1fr 1.4fr 1.2fr auto",
  gap: "14px",
  background: "rgba(31, 41, 55, 0.95)",
  border: "1px solid #374151",
  borderRadius: "12px",
  padding: "14px",
  alignItems: "center"
};

const compactText = {
  margin: "4px 0",
  color: "#d1d5db"
};

const paymentMiniGrid = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: "6px",
  color: "white",
  fontSize: "13px"
};

const compactActions = {
  display: "grid",
  gap: "8px"
};

const adjustButton = {
  padding: "10px 12px",
  background: "#2563eb",
  color: "white",
  border: "none",
  borderRadius: "8px",
  cursor: "pointer",
  fontWeight: "bold"
};


export default Dashboard;
