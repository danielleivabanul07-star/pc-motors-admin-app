import { useEffect, useMemo, useState } from "react";
import { supabase } from "../services/supabase";

function Historial() {
  const [trabajos, setTrabajos] = useState([]);
  const [clientesMap, setClientesMap] = useState({});
  const [facturasMap, setFacturasMap] = useState({});
  const [busqueda, setBusqueda] = useState("");
  const [cargando, setCargando] = useState(true);
  const [trabajoAjustandoPago, setTrabajoAjustandoPago] = useState(null);
  const [pagosDraft, setPagosDraft] = useState([]);
  const [notaPagoDraft, setNotaPagoDraft] = useState("");

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

  const totalPagadoTrabajo = (trabajo) => {
    const totalDetalle = totalPagosDetalle(trabajo?.pagos_detalle);
    if (totalDetalle > 0) return totalDetalle;
    if (Number(trabajo?.total_pagado || 0) > 0) return redondearDinero(trabajo.total_pagado);
    if (trabajo?.pago_recibido) return calcularTotales(trabajo).totalGenerado;
    return 0;
  };

  const saldoPendienteTrabajo = (trabajo) => {
    const total = calcularTotales(trabajo).totalGenerado;
    const pagado = totalPagadoTrabajo(trabajo);
    const saldoBD = Number(trabajo?.saldo_pendiente || 0);

    if (saldoBD > 0 && pagado < total) return redondearDinero(saldoBD);

    return redondearDinero(Math.max(0, total - pagado));
  };

  const pagosPorMetodoTrabajo = (trabajo) => {
    const resumen = {};

    limpiarPagosDetalle(trabajo?.pagos_detalle).forEach((pago) => {
      const metodo = normalizarMetodoPago(pago.metodo);
      if (!metodo) return;
      resumen[metodo] = redondearDinero(Number(resumen[metodo] || 0) + Number(pago.monto || 0));
    });

    return resumen;
  };

  const textoPagosDetalle = (trabajo) => {
    const pagos = limpiarPagosDetalle(trabajo?.pagos_detalle);

    if (pagos.length > 0) {
      return pagos.map((pago) => `${pago.metodo}: ${dinero(pago.monto)}`).join(" • ");
    }

    if (String(trabajo?.metodo_pago || "").includes("+")) {
      return "Pago combinado sin desglose";
    }

    return normalizarMetodoPago(trabajo?.metodo_pago) || "No registrado";
  };

  const abrirAjustePagos = (trabajo) => {
    const pagos = limpiarPagosDetalle(trabajo.pagos_detalle);

    if (pagos.length > 0) {
      setPagosDraft(pagos);
    } else if (trabajo.pago_recibido && trabajo.metodo_pago) {
      setPagosDraft([
        {
          id: `${Date.now()}-pago-historial`,
          metodo: normalizarMetodoPago(trabajo.metodo_pago) || "Cash",
          monto: calcularTotales(trabajo).totalGenerado,
          nota: "Pago registrado"
        }
      ]);
    } else {
      setPagosDraft([]);
    }

    setNotaPagoDraft("");
    setTrabajoAjustandoPago(trabajo);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const cancelarAjustePagos = () => {
    setTrabajoAjustandoPago(null);
    setPagosDraft([]);
    setNotaPagoDraft("");
  };

  const agregarPagoDraft = () => {
    setPagosDraft((prev) => [
      ...prev,
      {
        id: `${Date.now()}-pago-${prev.length}`,
        metodo: "",
        monto: "",
        nota: ""
      }
    ]);
  };

  const actualizarPagoDraft = (index, campo, valor) => {
    setPagosDraft((prev) => {
      const copia = [...prev];
      copia[index] = {
        ...(copia[index] || {}),
        [campo]: valor
      };
      return copia;
    });
  };

  const eliminarPagoDraft = (index) => {
    setPagosDraft((prev) => prev.filter((_pago, i) => i !== index));
  };

  const guardarAjustePagos = async () => {
    if (!trabajoAjustandoPago?.id) return;

    const totalTrabajo = calcularTotales(trabajoAjustandoPago).totalGenerado;
    const pagosLimpios = limpiarPagosDetalle(pagosDraft).map((pago, index) => ({
      ...pago,
      id: pago.id || `${Date.now()}-pago-${index}`,
      nota: pago.nota || notaPagoDraft || "Ajustado desde Historial"
    }));

    const totalPagado = totalPagosDetalle(pagosLimpios);
    const saldoPendiente = redondearDinero(Math.max(0, totalTrabajo - totalPagado));
    const pagoRecibido = totalTrabajo > 0 && saldoPendiente <= 0.009;
    const metodoResumen = pagosLimpios.length > 0
      ? [...new Set(pagosLimpios.map((pago) => pago.metodo))].join(" + ")
      : "Pendiente";

    const confirmar = confirm(
      `¿Guardar ajuste de pagos?\n\nCliente: ${trabajoAjustandoPago.cliente_nombre || "No registrado"}\nTotal factura: ${dinero(totalTrabajo)}\nTotal pagado: ${dinero(totalPagado)}\nPendiente: ${dinero(saldoPendiente)}`
    );

    if (!confirmar) return;

    const { error } = await supabase
      .from("trabajos_mecanicos")
      .update({
        metodo_pago: metodoResumen,
        pagos_detalle: pagosLimpios,
        total_pagado: totalPagado,
        saldo_pendiente: saldoPendiente,
        pago_recibido: pagoRecibido,
        fecha_pago: pagoRecibido ? (trabajoAjustandoPago.fecha_pago || new Date().toISOString()) : null
      })
      .eq("id", trabajoAjustandoPago.id);

    if (error) {
      console.log(error);
      alert(JSON.stringify(error, null, 2));
      return;
    }

    alert("Pagos ajustados correctamente.");
    cancelarAjustePagos();
    await cargarHistorial();
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
        trabajo.metodo_pago,
        textoPagosDetalle(trabajo),
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

      {trabajoAjustandoPago && (
        <div style={paymentEditorBox}>
          <h2 style={{ color: "#f59e0b", marginTop: 0 }}>💳 Ajustar pagos del historial</h2>
          <p style={paymentEditorNotice}>
            Solo se actualizan los pagos, total pagado, saldo pendiente, estado del pago y fecha de pago. No se toca factura, piezas, servicios, mecánicos ni comisiones.
          </p>

          <div style={paymentEditorSummary}>
            <strong>{trabajoAjustandoPago.cliente_nombre || "Cliente no registrado"}</strong>
            <span>Factura: {trabajoAjustandoPago.numero_factura || "No registrada"}</span>
            <span>Total factura: {dinero(calcularTotales(trabajoAjustandoPago).totalGenerado)}</span>
            <span>Total pagado: {dinero(totalPagosDetalle(pagosDraft))}</span>
            <span>Pendiente: {dinero(Math.max(0, calcularTotales(trabajoAjustandoPago).totalGenerado - totalPagosDetalle(pagosDraft)))}</span>
          </div>

          {pagosDraft.length === 0 ? (
            <p style={{ color: "#9ca3af" }}>No hay pagos agregados.</p>
          ) : (
            <div style={paymentRowsBox}>
              {pagosDraft.map((pago, index) => (
                <div key={pago.id || index} style={paymentRowStyle}>
                  <select
                    value={pago.metodo || ""}
                    onChange={(e) => actualizarPagoDraft(index, "metodo", e.target.value)}
                    style={inputSmall}
                  >
                    <option value="">Método</option>
                    {metodosPago.map((metodo) => (
                      <option key={metodo} value={metodo}>{metodo}</option>
                    ))}
                  </select>

                  <input
                    type="number"
                    placeholder="Monto"
                    value={pago.monto ?? ""}
                    onChange={(e) => actualizarPagoDraft(index, "monto", e.target.value)}
                    style={inputSmall}
                  />

                  <input
                    placeholder="Nota opcional"
                    value={pago.nota || ""}
                    onChange={(e) => actualizarPagoDraft(index, "nota", e.target.value)}
                    style={inputSmall}
                  />

                  <button onClick={() => eliminarPagoDraft(index)} style={deletePaymentButton}>🗑</button>
                </div>
              ))}
            </div>
          )}

          <input
            placeholder="Nota general opcional del ajuste"
            value={notaPagoDraft}
            onChange={(e) => setNotaPagoDraft(e.target.value)}
            style={searchStyle}
          />

          <div style={linksRow}>
            <button onClick={agregarPagoDraft} style={addPaymentButton}>➕ Agregar pago</button>
            <button onClick={guardarAjustePagos} style={savePaymentButton}>💾 Guardar ajuste</button>
            <button onClick={cancelarAjustePagos} style={cancelPaymentButton}>Cancelar</button>
          </div>
        </div>
      )}


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
                    <p style={mutedText}>{trabajo.vehiculo || "Vehículo no registrado"}</p>
                  </div>

                  <span style={statusBadge}>Finalizado</span>
                </div>

                <div style={compactMoneyBox}>
                  <div><strong>Factura</strong><span>{trabajo.numero_factura || "No registrada"}</span></div>
                  <div><strong>Total</strong><span>{dinero(totales.totalGenerado)}</span></div>
                  <div><strong>Pagado</strong><span>{dinero(totalPagadoTrabajo(trabajo))}</span></div>
                  <div><strong>Pendiente</strong><span>{dinero(saldoPendienteTrabajo(trabajo))}</span></div>
                </div>

                <div style={paymentCompactBox}>
                  <strong>💳 Pagos:</strong> {textoPagosDetalle(trabajo)}
                </div>

                <div style={linksRow}>
                  <button onClick={() => abrirAjustePagos(trabajo)} style={adjustPaymentButton}>💳 Ajustar pagos</button>
                  {trabajo.factura_pdf_url && (
                    <a href={trabajo.factura_pdf_url} target="_blank" rel="noreferrer" style={linkButton}>
                      🧾 Ver factura PDF
                    </a>
                  )}
                  {trabajo.estimado_pdf_url && (
                    <a href={trabajo.estimado_pdf_url} target="_blank" rel="noreferrer" style={linkButton}>
                      📄 Ver estimado PDF
                    </a>
                  )}
                </div>

                <details style={detailsPanel}>
                  <summary style={detailsSummary}>👁 Ver detalles completos</summary>

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
                  <p><strong>💳 Método de pago:</strong> {textoPagosDetalle(trabajo)}</p>
                  <p><strong>✅ Pago recibido:</strong> {trabajo.pago_recibido ? "Sí" : "No"}</p>
                  <p><strong>🕒 Fecha de pago:</strong> {formatearFecha(trabajo.fecha_pago)}</p>

                  {limpiarPagosDetalle(trabajo.pagos_detalle).length > 0 && (
                    <div style={detailList}>
                      {limpiarPagosDetalle(trabajo.pagos_detalle).map((pago, index) => (
                        <div key={pago.id || index} style={detailRow}>
                          <span>{pago.metodo} {pago.nota ? `— ${pago.nota}` : ""}</span>
                          <strong>{dinero(pago.monto)}</strong>
                        </div>
                      ))}
                    </div>
                  )}

                  <div style={moneyGrid}>
                    <MoneyItem label="Compra piezas" value={totales.costoPiezas} />
                    <MoneyItem label="Venta piezas" value={totales.ventaPiezas} />
                    <MoneyItem label="Tax piezas 6%" value={totales.taxPiezas6} />
                    <MoneyItem label="Mano de obra" value={totales.manoObra} />
                    <MoneyItem label="Cargo general 4%" value={totales.cargoGeneral4} />
                    <MoneyItem label="Ganancia piezas" value={totales.gananciaPiezas} />
                    <MoneyItem label="Total factura" value={totales.totalGenerado} strong />
                    <MoneyItem label="Total pagado" value={totalPagadoTrabajo(trabajo)} strong />
                    <MoneyItem label="Saldo pendiente" value={saldoPendienteTrabajo(trabajo)} strong />
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

                </details>

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


const paymentEditorBox = {
  background: "rgba(15, 23, 42, 0.96)",
  border: "1px solid #f59e0b",
  borderRadius: "14px",
  padding: "18px",
  marginBottom: "22px"
};

const paymentEditorNotice = {
  color: "#fde68a",
  background: "#111827",
  border: "1px solid #374151",
  borderRadius: "10px",
  padding: "10px"
};

const paymentEditorSummary = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
  gap: "10px",
  background: "#111827",
  border: "1px solid #374151",
  borderRadius: "10px",
  padding: "12px",
  marginBottom: "12px"
};

const paymentRowsBox = {
  display: "grid",
  gap: "8px",
  marginBottom: "12px"
};

const paymentRowStyle = {
  display: "grid",
  gridTemplateColumns: "minmax(140px, 1fr) minmax(110px, 150px) minmax(160px, 1fr) auto",
  gap: "8px",
  alignItems: "center"
};

const inputSmall = {
  padding: "10px",
  borderRadius: "8px",
  border: "1px solid #374151",
  background: "#111827",
  color: "white",
  width: "100%"
};

const deletePaymentButton = {
  padding: "10px",
  borderRadius: "8px",
  border: "none",
  background: "#dc2626",
  color: "white",
  cursor: "pointer"
};

const addPaymentButton = {
  padding: "10px 12px",
  borderRadius: "8px",
  border: "none",
  background: "#2563eb",
  color: "white",
  cursor: "pointer",
  fontWeight: "bold"
};

const savePaymentButton = {
  padding: "10px 12px",
  borderRadius: "8px",
  border: "none",
  background: "#16a34a",
  color: "white",
  cursor: "pointer",
  fontWeight: "bold"
};

const cancelPaymentButton = {
  padding: "10px 12px",
  borderRadius: "8px",
  border: "none",
  background: "#6b7280",
  color: "white",
  cursor: "pointer",
  fontWeight: "bold"
};

const compactMoneyBox = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
  gap: "10px",
  marginTop: "14px",
  marginBottom: "10px"
};

const paymentCompactBox = {
  background: "#111827",
  border: "1px solid #374151",
  borderRadius: "10px",
  padding: "10px",
  marginBottom: "10px",
  color: "#e5e7eb"
};

const adjustPaymentButton = {
  padding: "9px 12px",
  borderRadius: "8px",
  background: "#0891b2",
  color: "white",
  border: "none",
  fontWeight: "bold",
  cursor: "pointer"
};

const detailsPanel = {
  marginTop: "12px",
  borderTop: "1px solid #374151",
  paddingTop: "10px"
};

const detailsSummary = {
  cursor: "pointer",
  color: "#f59e0b",
  fontWeight: "bold",
  marginBottom: "10px"
};


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
  gridTemplateColumns: "repeat(auto-fit,minmax(340px,1fr))",
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
