import { useEffect, useState } from "react";
import { supabase } from "../services/supabase";
import jsPDF from "jspdf";

function Clientes() {
  const [clientes, setClientes] = useState([]);
  const [clienteSeleccionado, setClienteSeleccionado] = useState(null);
  const [vehiculos, setVehiculos] = useState([]);
  const [ordenes, setOrdenes] = useState([]);
  const [ordenesPorCliente, setOrdenesPorCliente] = useState({});
  const [tiemposActivosPorCliente, setTiemposActivosPorCliente] = useState({});
  const [tiempos, setTiempos] = useState([]);
  const [trabajosMecanicos, setTrabajosMecanicos] = useState([]);
  const [trabajosPorCliente, setTrabajosPorCliente] = useState({});
  const [mecanicosDB, setMecanicosDB] = useState([]);
  const [mecanicosAsignados, setMecanicosAsignados] = useState([]);
  const [estimados, setEstimados] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [vehiculoSeleccionado, setVehiculoSeleccionado] = useState(null);
  const [vehiculoSeleccionadoEstimado, setVehiculoSeleccionadoEstimado] = useState(null);
  const [ordenSeleccionadaTiempo, setOrdenSeleccionadaTiempo] = useState(null);
  const [procesandoTiempoId, setProcesandoTiempoId] = useState(null);

  const [ordenForm, setOrdenForm] = useState({
    diagnostico: "",
    mecanico: "",
    estado: "Recibido",
    prioridad: "normal",
    notas: ""
  });

  const [tiempoForm, setTiempoForm] = useState({
    mecanico: "",
    descripcion: ""
  });

  const [estimadoForm, setEstimadoForm] = useState({
    descripcion: "",
    piezas: "",
    piezas_detalle: [
      { nombre: "", cantidad: "1", precio: "" }
    ],
    mano_obra: "",
    descuento: "",
    notas: ""
  });

  const [mecanicoAsignadoForm, setMecanicoAsignadoForm] = useState({
    mecanico_id: "",
    mecanico_nombre: "",
    rol: "",
    horas_asignadas: "",
    porcentaje_produccion: "",
    notas: ""
  });

  useEffect(() => {
    cargarClientes();

    const canal = supabase
      .channel("clientes-activos-central")
      .on("postgres_changes", { event: "*", schema: "public", table: "clientes" }, cargarClientes)
      .on("postgres_changes", { event: "*", schema: "public", table: "vehiculos" }, cargarClientes)
      .on("postgres_changes", { event: "*", schema: "public", table: "ordenes_trabajo" }, cargarClientes)
      .on("postgres_changes", { event: "*", schema: "public", table: "trabajos_mecanicos" }, cargarClientes)
      .subscribe();

    return () => {
      supabase.removeChannel(canal);
    };
  }, []);

  const dinero = (valor) => `$${Number(valor || 0).toFixed(2)}`;


  const prioridadPeso = (prioridad) => {
    if (prioridad === "urgente") return 3;
    if (prioridad === "normal") return 2;
    if (prioridad === "programado") return 1;
    return 0;
  };

  const prioridadTexto = (prioridad) => {
    if (prioridad === "urgente") return "🔴 Urgente";
    if (prioridad === "programado") return "🟢 Programado";
    return "🟡 Normal";
  };

  const prioridadStyle = (prioridad) => ({
    background:
      prioridad === "urgente"
        ? "#dc2626"
        : prioridad === "programado"
        ? "#16a34a"
        : "#f59e0b",
    color: prioridad === "normal" ? "#111827" : "white",
    padding: "6px 10px",
    borderRadius: "10px",
    fontWeight: "bold",
    display: "inline-block"
  });


  const estadosOrdenCerrada = ["Terminado", "Entregado", "Cancelado"];

  const esOrdenActiva = (orden) => {
    return !estadosOrdenCerrada.includes(orden.estado || "");
  };

  const ordenesActivasDelCliente = (clienteId) => {
    return (ordenesPorCliente[clienteId] || [])
      .filter(esOrdenActiva)
      .sort((a, b) => prioridadPeso(b.prioridad) - prioridadPeso(a.prioridad) || Number(b.id) - Number(a.id));
  };

  const ordenesActivasVehiculo = (vehiculoId) => {
    return ordenes
      .filter((orden) => orden.vehiculo_id === vehiculoId && esOrdenActiva(orden))
      .sort((a, b) => prioridadPeso(b.prioridad) - prioridadPeso(a.prioridad) || Number(b.id) - Number(a.id));
  };

  const textoOrdenesActivas = (lista) => {
    if (!lista || lista.length === 0) return "Sin órdenes activas";
    return lista.map((orden) => `#${orden.id}`).join(", ");
  };

  const tiempoActivoDelCliente = (clienteId) => {
    const tiemposCliente = tiemposActivosPorCliente[clienteId] || [];
    return tiemposCliente[0] || null;
  };

  const trabajoCentralDelCliente = (clienteId) => {
    const trabajosCliente = trabajosPorCliente[clienteId] || [];

    if (trabajosCliente.length === 0) return null;

    const activos = trabajosCliente.filter(
      (trabajo) => trabajo.estado !== "finalizado"
    );

    return activos[0] || trabajosCliente[0];
  };

  const estadoCentralTexto = (trabajo, orden, tiempoActivo) => {
    if (!trabajo) {
      return tiempoActivo
        ? "🟢 Diagnóstico en curso"
        : orden?.estado || "Activa";
    }

    if (trabajo.fase_actual === "reparacion" || trabajo.estado === "trabajando") {
      return "🔧 Trabajando";
    }

    if (trabajo.estado === "esperando_piezas") {
      return "📦 Esperando piezas";
    }

    if (trabajo.estado === "listo_para_entrega") {
      return "✅ Listo para entrega";
    }

    if (trabajo.estado === "finalizado") {
      return "🏁 Finalizado";
    }

    if (trabajo.estado === "diagnostico" || trabajo.fase_actual === "diagnostico") {
      return "🔎 Diagnóstico en curso";
    }

    return trabajo.estado || orden?.estado || "Activa";
  };

  const fechaPrincipalTrabajo = (trabajo, tiempoActivo) => {
    if (!trabajo) return tiempoActivo?.hora_inicio || null;

    if (trabajo.fase_actual === "reparacion" && trabajo.reparacion_inicio) {
      return trabajo.reparacion_inicio;
    }

    return trabajo.diagnostico_inicio || trabajo.hora_inicio || tiempoActivo?.hora_inicio || null;
  };

  const trabajoDescripcionCliente = (trabajo, orden, tiempoActivo) => {
    return trabajo?.trabajo || orden?.diagnostico || tiempoActivo?.descripcion || "Sin diagnóstico";
  };

  const mecanicoClienteActual = (trabajo, orden, tiempoActivo) => {
    return trabajo?.mecanico_nombre || tiempoActivo?.mecanico || orden?.mecanico || "No asignado";
  };

  const cargarClientes = async () => {
    setCargando(true);

    const estadosCerrados = ["finalizado", "Finalizado", "Terminado", "Entregado", "Cancelado"];

    const { data: clientesActivosData, error: errorClientesActivos } = await supabase
      .from("clientes")
      .select("*")
      .eq("estado", "activo")
      .order("id", { ascending: false });

    if (errorClientesActivos) {
      console.log(errorClientesActivos);
      alert("Error cargando clientes activos");
      setCargando(false);
      return;
    }

    const { data: trabajosActivosData, error: errorTrabajosActivos } = await supabase
      .from("trabajos_mecanicos")
      .select("*")
      .not("estado", "in", '("finalizado","Finalizado","Terminado","Entregado","Cancelado")')
      .order("id", { ascending: false });

    if (errorTrabajosActivos) {
      console.log(errorTrabajosActivos);
      alert("Error cargando trabajos activos");
      setCargando(false);
      return;
    }

    const { data: ordenesActivasData, error: errorOrdenesActivas } = await supabase
      .from("ordenes_trabajo")
      .select("id, cliente_id, vehiculo_id, diagnostico, mecanico, estado, prioridad")
      .not("estado", "in", '("Terminado","Entregado","Cancelado","finalizado","Finalizado")')
      .order("id", { ascending: false });

    if (errorOrdenesActivas) {
      console.log(errorOrdenesActivas);
      alert("Error cargando órdenes activas");
      setCargando(false);
      return;
    }

    const idsDesdeClientes = (clientesActivosData || []).map((cliente) => cliente.id);
    const idsDesdeTrabajos = (trabajosActivosData || [])
      .map((trabajo) => trabajo.cliente_id)
      .filter(Boolean);
    const idsDesdeOrdenes = (ordenesActivasData || [])
      .map((orden) => orden.cliente_id)
      .filter(Boolean);

    const idsClientes = [...new Set([...idsDesdeClientes, ...idsDesdeTrabajos, ...idsDesdeOrdenes])];

    if (idsClientes.length === 0) {
      setClientes([]);
      setOrdenesPorCliente({});
      setTiemposActivosPorCliente({});
      setTrabajosPorCliente({});
      setCargando(false);
      return;
    }

    let clientesData = clientesActivosData || [];
    const idsYaCargados = new Set(clientesData.map((cliente) => cliente.id));
    const idsFaltantes = idsClientes.filter((id) => !idsYaCargados.has(id));

    if (idsFaltantes.length > 0) {
      const { data: clientesFaltantes, error: errorClientesFaltantes } = await supabase
        .from("clientes")
        .select("*")
        .in("id", idsFaltantes);

      if (errorClientesFaltantes) {
        console.log(errorClientesFaltantes);
        alert("Error cargando clientes conectados a trabajos activos");
        setCargando(false);
        return;
      }

      clientesData = [...clientesData, ...(clientesFaltantes || [])];
    }

    const clientesUnicos = [];
    const vistos = new Set();

    clientesData.forEach((cliente) => {
      if (!cliente?.id || vistos.has(cliente.id)) return;
      vistos.add(cliente.id);
      clientesUnicos.push(cliente);
    });

    clientesUnicos.sort((a, b) => Number(b.id) - Number(a.id));
    setClientes(clientesUnicos);

    const { data: ordenesData, error: errorOrdenes } = await supabase
      .from("ordenes_trabajo")
      .select("id, cliente_id, vehiculo_id, diagnostico, mecanico, estado, prioridad")
      .in("cliente_id", idsClientes)
      .order("id", { ascending: false });

    if (errorOrdenes) {
      console.log(errorOrdenes);
      alert("Clientes cargados, pero hubo un error cargando las órdenes.");
      setOrdenesPorCliente({});
      setCargando(false);
      return;
    }

    const agrupadas = {};

    (ordenesData || []).forEach((orden) => {
      if (!agrupadas[orden.cliente_id]) {
        agrupadas[orden.cliente_id] = [];
      }

      agrupadas[orden.cliente_id].push(orden);
    });

    setOrdenesPorCliente(agrupadas);

    const { data: trabajosData, error: errorTrabajos } = await supabase
      .from("trabajos_mecanicos")
      .select("*")
      .in("cliente_id", idsClientes)
      .order("id", { ascending: false });

    if (errorTrabajos) {
      console.log(errorTrabajos);
      setTrabajosPorCliente({});
    } else {
      const trabajosAgrupados = {};

      (trabajosData || []).forEach((trabajo) => {
        if (!trabajo.cliente_id) return;
        if (!trabajosAgrupados[trabajo.cliente_id]) {
          trabajosAgrupados[trabajo.cliente_id] = [];
        }

        trabajosAgrupados[trabajo.cliente_id].push(trabajo);
      });

      setTrabajosPorCliente(trabajosAgrupados);
    }

    const { data: tiemposActivosData, error: errorTiemposActivos } = await supabase
      .from("tiempos_mecanicos")
      .select("id, cliente_id, orden_id, mecanico, hora_inicio, descripcion")
      .in("cliente_id", idsClientes)
      .is("hora_fin", null)
      .order("id", { ascending: false });

    if (errorTiemposActivos) {
      console.log(errorTiemposActivos);
      setTiemposActivosPorCliente({});
    } else {
      const tiemposAgrupados = {};

      (tiemposActivosData || []).forEach((tiempo) => {
        if (!tiemposAgrupados[tiempo.cliente_id]) {
          tiemposAgrupados[tiempo.cliente_id] = [];
        }

        tiemposAgrupados[tiempo.cliente_id].push(tiempo);
      });

      setTiemposActivosPorCliente(tiemposAgrupados);
    }

    setCargando(false);
  };

  const cargarOrdenes = async (clienteId) => {
    const { data, error } = await supabase
      .from("ordenes_trabajo")
      .select("*")
      .eq("cliente_id", clienteId)
      .order("id", { ascending: false });

    if (error) {
      console.log(error);
      alert("Error cargando órdenes");
      return;
    }

    setOrdenes(data || []);
  };

  const cargarTiempos = async (clienteId) => {
    const { data, error } = await supabase
      .from("tiempos_mecanicos")
      .select("*")
      .eq("cliente_id", clienteId)
      .order("id", { ascending: false });

    if (error) {
      console.log(error);
      alert("Error cargando tiempos de mecánicos");
      return;
    }

    setTiempos(data || []);
  };

  const cargarTrabajosMecanicos = async (clienteId) => {
    const { data, error } = await supabase
      .from("trabajos_mecanicos")
      .select("*")
      .eq("cliente_id", clienteId)
      .order("id", { ascending: false });

    if (error) {
      console.log(error);
      alert("Error cargando trabajos mecánicos del cliente");
      return;
    }

    setTrabajosMecanicos(data || []);
  };

  const cargarEstimados = async (clienteId) => {
    const { data, error } = await supabase
      .from("estimados")
      .select("*")
      .eq("cliente_id", clienteId)
      .order("id", { ascending: false });

    if (error) {
      console.log(error);
      alert("Error cargando estimados");
      return;
    }

    setEstimados(data || []);
  };

  const cargarMecanicos = async () => {
    const { data, error } = await supabase
      .from("mecanicos")
      .select("*")
      .eq("activo", true)
      .order("nombre", { ascending: true });

    if (error) {
      console.log(error);
      alert("Error cargando lista de mecánicos");
      return;
    }

    setMecanicosDB(data || []);
  };

  const cargarMecanicosAsignados = async (clienteId) => {
    const { data, error } = await supabase
      .from("cliente_mecanicos")
      .select("*")
      .eq("cliente_id", clienteId)
      .order("id", { ascending: true });

    if (error) {
      console.log(error);
      alert("Error cargando mecánicos asignados al cliente");
      return;
    }

    setMecanicosAsignados(data || []);
  };

  const abrirPerfil = async (cliente) => {
    setClienteSeleccionado(cliente);

    const { data: vehiculosData, error: errorVehiculos } = await supabase
      .from("vehiculos")
      .select("*")
      .eq("cliente_id", cliente.id)
      .order("id", { ascending: false });

    if (errorVehiculos) {
      console.log(errorVehiculos);
      alert("Error cargando vehículos");
      return;
    }

    setVehiculos(vehiculosData || []);
    await cargarOrdenes(cliente.id);
    await cargarTiempos(cliente.id);
    await cargarTrabajosMecanicos(cliente.id);
    await cargarEstimados(cliente.id);
    await cargarMecanicos();
    await cargarMecanicosAsignados(cliente.id);
  };

  const volverLista = () => {
    setClienteSeleccionado(null);
    setVehiculos([]);
    setOrdenes([]);
    setTiempos([]);
    setTrabajosMecanicos([]);
    setEstimados([]);
    setVehiculoSeleccionado(null);
    setVehiculoSeleccionadoEstimado(null);
    setOrdenSeleccionadaTiempo(null);
    setMecanicosAsignados([]);
    setMecanicoAsignadoForm({
      mecanico_id: "",
      mecanico_nombre: "",
      rol: "",
      horas_asignadas: "",
      porcentaje_produccion: "",
      notas: ""
    });
    setEstimadoForm({
      descripcion: "",
      piezas: "",
      piezas_detalle: [
        { nombre: "", cantidad: "1", precio: "" }
      ],
      mano_obra: "",
      descuento: "",
      notas: ""
    });
  };

  const seleccionarMecanicoAsignado = (mecanicoId) => {
    const mecanico = mecanicosDB.find((m) => String(m.id) === String(mecanicoId));

    setMecanicoAsignadoForm({
      ...mecanicoAsignadoForm,
      mecanico_id: mecanico ? mecanico.id : "",
      mecanico_nombre: mecanico ? mecanico.nombre : ""
    });
  };

  const agregarMecanicoAlCliente = async () => {
    if (!clienteSeleccionado) return;

    if (!mecanicoAsignadoForm.mecanico_nombre.trim()) {
      alert("Selecciona o escribe el nombre del mecánico");
      return;
    }

    const horas = Number(mecanicoAsignadoForm.horas_asignadas || 0);
    const porcentaje = Number(mecanicoAsignadoForm.porcentaje_produccion || 0);

    if (Number.isNaN(horas) || Number.isNaN(porcentaje)) {
      alert("Las horas o el porcentaje no son válidos");
      return;
    }

    const { error } = await supabase.from("cliente_mecanicos").insert([
      {
        cliente_id: clienteSeleccionado.id,
        mecanico_id: mecanicoAsignadoForm.mecanico_id || null,
        mecanico_nombre: mecanicoAsignadoForm.mecanico_nombre.trim(),
        rol: mecanicoAsignadoForm.rol.trim() || null,
        horas_asignadas: horas,
        porcentaje_produccion: porcentaje,
        notas: mecanicoAsignadoForm.notas.trim() || null
      }
    ]);

    if (error) {
      console.log(error);
      alert(JSON.stringify(error, null, 2));
      return;
    }

    alert("Mecánico asignado correctamente");

    setMecanicoAsignadoForm({
      mecanico_id: "",
      mecanico_nombre: "",
      rol: "",
      horas_asignadas: "",
      porcentaje_produccion: "",
      notas: ""
    });

    await cargarMecanicosAsignados(clienteSeleccionado.id);
  };

  const eliminarMecanicoAsignado = async (asignacion) => {
    const confirmar = confirm(
      `¿Quitar a ${asignacion.mecanico_nombre} de este cliente?`
    );

    if (!confirmar) return;

    const { error } = await supabase
      .from("cliente_mecanicos")
      .delete()
      .eq("id", asignacion.id);

    if (error) {
      console.log(error);
      alert(JSON.stringify(error, null, 2));
      return;
    }

    await cargarMecanicosAsignados(clienteSeleccionado.id);
  };

  const obtenerMecanicosParaCierre = () => {
    if (mecanicosAsignados.length > 0) {
      return mecanicosAsignados.map((m) => m.mecanico_nombre).filter(Boolean);
    }

    const mecanicosDesdeTrabajos = [
      ...new Set(trabajosMecanicos.map((t) => t.mecanico_nombre).filter(Boolean))
    ];

    if (mecanicosDesdeTrabajos.length > 0) {
      return mecanicosDesdeTrabajos;
    }

    const mecanicosDesdeTiempos = [
      ...new Set(tiempos.map((t) => t.mecanico).filter(Boolean))
    ];

    return mecanicosDesdeTiempos;
  };

  const generarNumeroFacturaCliente = (trabajo) => {
    const year = new Date().getFullYear();
    const numeroBase = trabajo?.orden_id || trabajo?.id || Date.now();
    return trabajo?.numero_factura || `PC-${year}-${String(numeroBase).padStart(6, "0")}`;
  };

  const trabajoPrincipalParaCierre = () => {
    const activos = trabajosMecanicos.filter((trabajo) => trabajo.estado !== "finalizado");
    return activos[0] || trabajosMecanicos[0] || null;
  };

  const finalizarCliente = async () => {
    if (!clienteSeleccionado) return;

    const trabajosActivos = (trabajosMecanicos || []).filter(
      (trabajo) => !["finalizado", "Finalizado", "Terminado", "Entregado", "Cancelado"].includes(trabajo.estado || "")
    );

    if (trabajosActivos.length === 0) {
      alert("Este cliente no tiene trabajos activos pendientes por finalizar. Si ya fue finalizado desde otro panel, no se puede finalizar otra vez.");
      volverLista();
      await cargarClientes();
      return;
    }

    const confirmar = confirm(
      `¿Seguro que quieres finalizar este cliente?\n\nSe cerrarán ${trabajosActivos.length} trabajo(s) activo(s) usando la misma fuente central: trabajos_mecanicos. No se crearán facturas duplicadas.`
    );

    if (!confirmar) return;

    const fin = new Date().toISOString();

    for (const trabajo of trabajosActivos) {
      const numeroFactura = generarNumeroFacturaCliente(trabajo);
      const minutosExistentes =
        Number(trabajo.diagnostico_minutos || 0) +
        Number(trabajo.reparacion_minutos || 0);
      const minutosCalculados = trabajo.hora_inicio
        ? calcularMinutosEntreFechas(trabajo.hora_inicio, fin)
        : 0;

      const payloadTrabajo = {
        estado: "finalizado",
        fase_actual: "finalizado",
        hora_fin: trabajo.hora_fin || fin,
        minutos_trabajados: minutosExistentes > 0 ? minutosExistentes : minutosCalculados,
        numero_factura: trabajo.numero_factura || numeroFactura,
        factura_creada_en: trabajo.factura_creada_en || fin
      };

      if (trabajo.diagnostico_inicio && !trabajo.diagnostico_fin) {
        payloadTrabajo.diagnostico_fin = fin;
        payloadTrabajo.diagnostico_minutos = calcularMinutosEntreFechas(trabajo.diagnostico_inicio, fin);
      }

      if (trabajo.reparacion_inicio && !trabajo.reparacion_fin) {
        payloadTrabajo.reparacion_fin = fin;
        payloadTrabajo.reparacion_minutos = calcularMinutosEntreFechas(trabajo.reparacion_inicio, fin);
      }

      const { error: errorTrabajo } = await supabase
        .from("trabajos_mecanicos")
        .update(payloadTrabajo)
        .eq("id", trabajo.id)
        .not("estado", "in", '("finalizado","Finalizado","Terminado","Entregado","Cancelado")');

      if (errorTrabajo) {
        console.log(errorTrabajo);
        alert(JSON.stringify(errorTrabajo, null, 2));
        return;
      }
    }

    const idsOrdenes = [
      ...new Set([
        ...ordenes.map((orden) => orden.id),
        ...trabajosActivos.map((trabajo) => trabajo.orden_id).filter(Boolean)
      ])
    ];

    if (idsOrdenes.length > 0) {
      const { error: errorOrdenes } = await supabase
        .from("ordenes_trabajo")
        .update({ estado: "Entregado" })
        .in("id", idsOrdenes)
        .not("estado", "in", '("Entregado","Terminado","Cancelado")');

      if (errorOrdenes) {
        console.log(errorOrdenes);
        alert("Los trabajos se finalizaron, pero hubo un error actualizando las órdenes.\n\n" + JSON.stringify(errorOrdenes, null, 2));
        return;
      }
    }

    const trabajosActualizados = (trabajosMecanicos || []).map((trabajo) =>
      trabajosActivos.some((activo) => activo.id === trabajo.id)
        ? { ...trabajo, estado: "finalizado" }
        : trabajo
    );

    const numero_factura = generarNumeroFacturaCliente(trabajosActivos[0]);
    const trabajo_realizado = trabajosActualizados.map((trabajo) => trabajo.trabajo).filter(Boolean).join(" / ") || "Trabajo registrado en PC Motors";
    const costo_piezas_compra = trabajosActualizados.reduce((total, trabajo) => total + Number(trabajo.costo_piezas || 0), 0);
    const precio_piezas_cliente = trabajosActualizados.reduce((total, trabajo) => total + Number(trabajo.venta_piezas || 0), 0);
    const ganancia_piezas = trabajosActualizados.reduce((total, trabajo) => total + Number(trabajo.ganancia_piezas || 0), 0);
    const costo_mano_obra = trabajosActualizados.reduce((total, trabajo) => total + Number(trabajo.mano_obra || 0), 0);
    const total_final = trabajosActualizados.reduce((total, trabajo) => total + Number(trabajo.total_generado || 0), 0);
    const mecanicosParaCierre = obtenerMecanicosParaCierre();
    const mecanico_principal = mecanicosParaCierre.length > 0 ? mecanicosParaCierre.join(", ") : "No asignado";

    const { error } = await supabase
      .from("clientes")
      .update({
        estado: "finalizado",
        finalizado_en: fin,
        mecanico_principal,
        numero_factura,
        trabajo_realizado,
        costo_piezas_compra,
        precio_piezas_cliente,
        ganancia_piezas,
        costo_mano_obra,
        impuestos: 0,
        descuento: 0,
        total_final
      })
      .eq("id", clienteSeleccionado.id)
      .neq("estado", "finalizado");

    if (error) {
      console.log(error);
      alert(JSON.stringify(error, null, 2));
      return;
    }

    alert(
      `Cliente finalizado correctamente desde la fuente central.\n\nFactura: ${numero_factura}\nGanancia piezas: $${ganancia_piezas.toFixed(2)}\nTotal final: $${total_final.toFixed(2)}`
    );

    volverLista();
    await cargarClientes();
  };

  const redondearDinero = (valor) => Math.round(Number(valor || 0) * 100) / 100;

  const crearEstimadoFormVacio = () => ({
    descripcion: "",
    piezas: "",
    piezas_detalle: [
      { nombre: "", cantidad: "1", precio: "" }
    ],
    mano_obra: "",
    descuento: "",
    notas: ""
  });

  const normalizarPiezasDetalle = (lista = []) => {
    const piezas = Array.isArray(lista) ? lista : [];

    return piezas
      .map((pieza) => {
        const nombre = String(pieza.nombre || "").trim();
        const cantidad = Number(pieza.cantidad || 0);
        const precio = Number(pieza.precio || 0);
        const total = redondearDinero(cantidad * precio);

        return {
          nombre,
          cantidad: Number.isFinite(cantidad) && cantidad > 0 ? cantidad : 0,
          precio: Number.isFinite(precio) && precio >= 0 ? precio : 0,
          total
        };
      })
      .filter((pieza) => pieza.nombre || pieza.cantidad > 0 || pieza.precio > 0);
  };

  const calcularTotalesEstimado = (formulario = estimadoForm) => {
    const piezasDetalle = normalizarPiezasDetalle(formulario.piezas_detalle || []);
    const piezasTotalDesdeDetalle = piezasDetalle.reduce(
      (total, pieza) => total + Number(pieza.total || 0),
      0
    );
    const piezasBase = redondearDinero(
      piezasTotalDesdeDetalle > 0 ? piezasTotalDesdeDetalle : Number(formulario.piezas || 0)
    );
    const manoObra = redondearDinero(Number(formulario.mano_obra || 0));
    const descuento = redondearDinero(Number(formulario.descuento || 0));
    const cargoPiezas6 = redondearDinero(piezasBase * 0.06);
    const subtotal = redondearDinero(piezasBase + cargoPiezas6 + manoObra);
    const feeServicio4 = redondearDinero(subtotal * 0.04);
    const total = redondearDinero(subtotal + feeServicio4 - descuento);

    return {
      piezasDetalle,
      piezasBase,
      manoObra,
      descuento,
      cargoPiezas6,
      subtotal,
      feeServicio4,
      total
    };
  };

  const crearNotasEstimado = (notasUsuario, piezasDetalle) => {
    const limpio = String(notasUsuario || "").trim();
    const json = JSON.stringify(piezasDetalle || []);
    return `${limpio}\n\n[PIEZAS_DETALLE_JSON]${json}[/PIEZAS_DETALLE_JSON]`.trim();
  };

  const limpiarNotasEstimado = (notas) => {
    return String(notas || "")
      .replace(/\n?\[PIEZAS_DETALLE_JSON\][\s\S]*?\[\/PIEZAS_DETALLE_JSON\]/g, "")
      .trim();
  };

  const obtenerPiezasDesdeEstimado = (estimado) => {
    const notas = String(estimado?.notas || "");
    const match = notas.match(/\[PIEZAS_DETALLE_JSON\]([\s\S]*?)\[\/PIEZAS_DETALLE_JSON\]/);

    if (match?.[1]) {
      try {
        const parsed = JSON.parse(match[1]);
        const normalizadas = normalizarPiezasDetalle(parsed);
        if (normalizadas.length > 0) return normalizadas;
      } catch (error) {
        console.log("No se pudo leer el desglose de piezas del estimado", error);
      }
    }

    const piezas = Number(estimado?.piezas || 0);
    return piezas > 0
      ? [{ nombre: "Piezas y materiales", cantidad: 1, precio: piezas, total: piezas }]
      : [];
  };

  const cargarLogoPDF = async () => {
    const posiblesLogos = [
      "/logo-pc-motors.png",
      "/pc-motors-logo.png",
      "/logo.png",
      "/Logo oficial(1).png"
    ];

    for (const ruta of posiblesLogos) {
      try {
        const respuesta = await fetch(ruta, { cache: "no-store" });
        const contentType = respuesta.headers.get("content-type") || "";

        if (!respuesta.ok || !contentType.startsWith("image/")) {
          continue;
        }

        const blob = await respuesta.blob();
        const dataUrl = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result);
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });

        const formato = contentType.includes("jpeg") || contentType.includes("jpg") ? "JPEG" : "PNG";
        return { dataUrl, formato };
      } catch (error) {
        console.log(`No se pudo cargar logo desde ${ruta}`, error);
      }
    }

    return null;
  };

  const ponerLogoEnTodasLasPaginas = (doc, logoInfo) => {
    if (!logoInfo) return;

    const dataUrl = typeof logoInfo === "string" ? logoInfo : logoInfo.dataUrl;
    const formato = typeof logoInfo === "string" ? "PNG" : logoInfo.formato || "PNG";

    if (!dataUrl) return;

    const totalPaginas = doc.getNumberOfPages();
    for (let pagina = 1; pagina <= totalPaginas; pagina += 1) {
      try {
        doc.setPage(pagina);
        doc.addImage(dataUrl, formato, 165, 10, 28, 28);
      } catch (error) {
        console.log("No se pudo agregar el logo al PDF", error);
      }
    }
  };

  const abrirFormularioEstimado = (vehiculo) => {
    setVehiculoSeleccionadoEstimado(vehiculo);

    const trabajoCentralVehiculo = (trabajosMecanicos || []).find(
      (trabajo) =>
        String(trabajo.vehiculo_id) === String(vehiculo.id) &&
        !["finalizado", "Finalizado", "Terminado", "Entregado", "Cancelado"].includes(trabajo.estado || "")
    ) || (trabajosMecanicos || []).find(
      (trabajo) => String(trabajo.vehiculo_id) === String(vehiculo.id)
    );

    const ventaPiezas = Number(trabajoCentralVehiculo?.venta_piezas || 0);
    const manoObra = Number(trabajoCentralVehiculo?.mano_obra || 0);
    const descripcion = trabajoCentralVehiculo?.trabajo || "";
    const resultadoDiagnostico = trabajoCentralVehiculo?.resultado_diagnostico || "";

    const piezasDetalle = ventaPiezas > 0
      ? [
          {
            nombre: descripcion ? `Piezas / materiales para: ${descripcion}` : "Piezas y materiales",
            cantidad: "1",
            precio: String(ventaPiezas)
          }
        ]
      : [{ nombre: "", cantidad: "1", precio: "" }];

    setEstimadoForm({
      descripcion,
      piezas: ventaPiezas > 0 ? String(ventaPiezas) : "",
      piezas_detalle: piezasDetalle,
      mano_obra: manoObra > 0 ? String(manoObra) : "",
      descuento: "",
      notas: resultadoDiagnostico ? `Resultado diagnóstico: ${resultadoDiagnostico}` : ""
    });
  };

  const cancelarEstimado = () => {
    setVehiculoSeleccionadoEstimado(null);
    setEstimadoForm(crearEstimadoFormVacio());
  };

  const actualizarPiezaEstimado = (indice, campo, valor) => {
    const lista = [...(estimadoForm.piezas_detalle || [])];
    lista[indice] = {
      ...lista[indice],
      [campo]: valor
    };

    const totalesParciales = calcularTotalesEstimado({
      ...estimadoForm,
      piezas_detalle: lista
    });

    setEstimadoForm({
      ...estimadoForm,
      piezas_detalle: lista,
      piezas: String(totalesParciales.piezasBase)
    });
  };

  const agregarPiezaEstimado = () => {
    setEstimadoForm({
      ...estimadoForm,
      piezas_detalle: [
        ...(estimadoForm.piezas_detalle || []),
        { nombre: "", cantidad: "1", precio: "" }
      ]
    });
  };

  const eliminarPiezaEstimado = (indice) => {
    const lista = (estimadoForm.piezas_detalle || []).filter((_, i) => i !== indice);
    const listaFinal = lista.length > 0 ? lista : [{ nombre: "", cantidad: "1", precio: "" }];
    const totalesParciales = calcularTotalesEstimado({
      ...estimadoForm,
      piezas_detalle: listaFinal
    });

    setEstimadoForm({
      ...estimadoForm,
      piezas_detalle: listaFinal,
      piezas: String(totalesParciales.piezasBase)
    });
  };

  const calcularTotalEstimado = () => {
    return calcularTotalesEstimado().total;
  };

  const guardarEstimado = async () => {
    if (!clienteSeleccionado || !vehiculoSeleccionadoEstimado) {
      alert("Falta cliente o vehículo seleccionado para el estimado");
      return;
    }

    if (!estimadoForm.descripcion.trim()) {
      alert("Escribe la descripción del estimado");
      return;
    }

    const totales = calcularTotalesEstimado();

    if (totales.piezasDetalle.length === 0 && totales.manoObra <= 0) {
      alert("Agrega al menos una pieza o una mano de obra para el estimado.");
      return;
    }

    if (
      Number.isNaN(totales.piezasBase) ||
      Number.isNaN(totales.manoObra) ||
      Number.isNaN(totales.descuento)
    ) {
      alert("Uno de los valores del estimado no es válido");
      return;
    }

    const numeroEstimado = generarNumeroEstimado();
    const notasConDetalle = crearNotasEstimado(
      estimadoForm.notas,
      totales.piezasDetalle
    );

    const { error } = await supabase.from("estimados").insert([
      {
        cliente_id: clienteSeleccionado.id,
        vehiculo_id: vehiculoSeleccionadoEstimado.id,
        numero_estimado: numeroEstimado,
        fecha_estimado: new Date().toISOString().slice(0, 10),
        descripcion: estimadoForm.descripcion.trim(),
        piezas: totales.piezasBase,
        mano_obra: totales.manoObra,
        impuestos: totales.cargoPiezas6 + totales.feeServicio4,
        descuento: totales.descuento,
        estado: "pendiente",
        notas: notasConDetalle || null
      }
    ]);

    if (error) {
      console.log(error);
      alert(JSON.stringify(error, null, 2));
      return;
    }

    alert(`Estimado guardado correctamente\n\nNúmero: ${numeroEstimado}\nTotal: ${dinero(totales.total)}`);

    cancelarEstimado();
    await cargarEstimados(clienteSeleccionado.id);
  };

  const estimadosPorVehiculo = (vehiculoId) =>
    estimados.filter((estimado) => estimado.vehiculo_id === vehiculoId);

  const generarNumeroEstimado = () => {
    const year = new Date().getFullYear();
    const siguiente = estimados.length + 1;
    return `PC-${year}-EST-${String(siguiente).padStart(6, "0")}`;
  };

  const obtenerVehiculoPorId = (vehiculoId) => {
    return vehiculos.find((vehiculo) => vehiculo.id === vehiculoId);
  };

  const cambiarEstadoEstimado = async (estimado, nuevoEstado) => {
    const confirmar = confirm(
      `¿Cambiar el estimado ${estimado.numero_estimado || estimado.id} a ${nuevoEstado}?`
    );

    if (!confirmar) return;

    const payload = {
      estado: nuevoEstado
    };

    if (nuevoEstado === "aprobado") {
      payload.aprobado_en = new Date().toISOString();
    }

    const { error } = await supabase
      .from("estimados")
      .update(payload)
      .eq("id", estimado.id);

    if (error) {
      console.log(error);
      alert(JSON.stringify(error, null, 2));
      return;
    }

    alert("Estado del estimado actualizado correctamente");
    await cargarEstimados(clienteSeleccionado.id);
  };

  const eliminarEstimado = async (estimado) => {
    const confirmar = confirm(
      `¿Eliminar definitivamente el estimado ${estimado.numero_estimado || estimado.id}?\n\nEsta acción no se puede deshacer.`
    );

    if (!confirmar) return;

    const { error } = await supabase
      .from("estimados")
      .delete()
      .eq("id", estimado.id);

    if (error) {
      console.log(error);
      alert(JSON.stringify(error, null, 2));
      return;
    }

    alert("Estimado eliminado correctamente");
    await cargarEstimados(clienteSeleccionado.id);
  };

  const convertirEstimadoEnOrden = async (estimado) => {
    const confirmar = confirm(
      `¿Convertir el estimado ${estimado.numero_estimado || estimado.id} en una orden de trabajo?`
    );

    if (!confirmar) return;

    const { error: errorOrden } = await supabase.from("ordenes_trabajo").insert([
      {
        cliente_id: estimado.cliente_id,
        vehiculo_id: estimado.vehiculo_id,
        diagnostico: estimado.descripcion || "Orden creada desde estimado",
        mecanico: null,
        estado: "Recibido",
        prioridad: "normal",
        notas: `Orden creada desde estimado ${estimado.numero_estimado || estimado.id}. Total estimado: ${dinero(estimado.total)}`
      }
    ]);

    if (errorOrden) {
      console.log(errorOrden);
      alert(JSON.stringify(errorOrden, null, 2));
      return;
    }

    const { error: errorEstimado } = await supabase
      .from("estimados")
      .update({
        estado: "aprobado",
        aprobado_en: new Date().toISOString()
      })
      .eq("id", estimado.id);

    if (errorEstimado) {
      console.log(errorEstimado);
      alert(JSON.stringify(errorEstimado, null, 2));
      return;
    }

    alert("Estimado aprobado y convertido en orden correctamente");
    await cargarEstimados(clienteSeleccionado.id);
    await cargarOrdenes(clienteSeleccionado.id);
  };

  const descargarPDFEstimado = async (estimado) => {
    const vehiculo = obtenerVehiculoPorId(estimado.vehiculo_id);
    const logoDataUrl = await cargarLogoPDF();
    const piezasDetalle = obtenerPiezasDesdeEstimado(estimado);
    const totales = calcularTotalesEstimado({
      piezas: estimado.piezas,
      piezas_detalle: piezasDetalle,
      mano_obra: estimado.mano_obra,
      descuento: estimado.descuento,
      notas: estimado.notas || ""
    });

    const doc = new jsPDF();
    let y = 18;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(22);
    doc.text("PC MOTORS", 20, y);

    y += 8;
    doc.setFontSize(13);
    doc.text("Estimado / Factura Proforma", 20, y);

    y += 12;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);

    const escribir = (label, valor) => {
      doc.setFont("helvetica", "bold");
      doc.text(label, 20, y);
      doc.setFont("helvetica", "normal");
      doc.text(String(valor || "-"), 68, y);
      y += 7;
    };

    escribir("Estimado:", estimado.numero_estimado || estimado.id);
    escribir("Fecha:", estimado.fecha_estimado || new Date().toISOString().slice(0, 10));
    escribir("Estado:", estimado.estado || "pendiente");
    escribir("Cliente:", clienteSeleccionado?.nombre || "-");
    escribir("Teléfono:", clienteSeleccionado?.telefono || "-");
    escribir(
      "Vehículo:",
      `${vehiculo?.anio || ""} ${vehiculo?.marca || ""} ${vehiculo?.modelo || ""}`.trim() || "-"
    );
    escribir("Placa / VIN:", `${vehiculo?.placa || "-"} / ${vehiculo?.vin || "-"}`);

    y += 3;
    doc.line(20, y, 190, y);
    y += 9;

    doc.setFont("helvetica", "bold");
    doc.text("Descripción del servicio:", 20, y);
    y += 7;
    doc.setFont("helvetica", "normal");
    const descripcion = doc.splitTextToSize(estimado.descripcion || "Sin descripción", 170);
    doc.text(descripcion, 20, y);
    y += descripcion.length * 6 + 8;

    doc.setFont("helvetica", "bold");
    doc.text("Piezas y materiales", 20, y);
    y += 8;

    doc.setFillColor(245, 158, 11);
    doc.rect(20, y - 5, 170, 8, "F");
    doc.setTextColor(17, 24, 39);
    doc.setFont("helvetica", "bold");
    doc.text("Pieza", 22, y);
    doc.text("Cant.", 105, y);
    doc.text("Precio", 128, y);
    doc.text("Total", 160, y);
    doc.setTextColor(0, 0, 0);
    y += 8;

    doc.setFont("helvetica", "normal");
    if (piezasDetalle.length === 0) {
      doc.text("No hay piezas registradas.", 22, y);
      y += 7;
    } else {
      piezasDetalle.forEach((pieza) => {
        if (y > 255) {
          doc.addPage();
          y = 20;
        }

        const nombre = doc.splitTextToSize(pieza.nombre || "Pieza", 78);
        doc.text(nombre, 22, y);
        doc.text(String(pieza.cantidad || 0), 108, y);
        doc.text(dinero(pieza.precio), 128, y);
        doc.text(dinero(pieza.total), 160, y);
        y += Math.max(7, nombre.length * 6);
      });
    }

    y += 4;
    doc.line(20, y, 190, y);
    y += 9;

    const filaDinero = (label, valor) => {
      doc.setFont("helvetica", "bold");
      doc.text(label, 20, y);
      doc.setFont("helvetica", "normal");
      doc.text(dinero(valor), 160, y);
      y += 8;
    };

    filaDinero("Subtotal piezas:", totales.piezasBase);
    filaDinero("Recargo piezas 6%:", totales.cargoPiezas6);
    filaDinero("Mano de obra:", totales.manoObra);
    filaDinero("Fee de servicio 4%:", totales.feeServicio4);

    if (totales.descuento > 0) {
      filaDinero("Descuento:", -totales.descuento);
    }

    y += 2;
    doc.line(20, y, 190, y);
    y += 11;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(15);
    doc.text("TOTAL ESTIMADO:", 20, y);
    doc.text(dinero(totales.total), 150, y);

    y += 14;
    const notasLimpias = limpiarNotasEstimado(estimado.notas);
    if (notasLimpias) {
      doc.setFontSize(10);
      doc.setFont("helvetica", "bold");
      doc.text("Notas:", 20, y);
      y += 7;
      doc.setFont("helvetica", "normal");
      const notas = doc.splitTextToSize(notasLimpias, 170);
      doc.text(notas, 20, y);
    }

    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.text("Documento generado desde PC Motors Admin Panel", 105, 280, { align: "center" });

    ponerLogoEnTodasLasPaginas(doc, logoDataUrl);

    const nombreArchivo = `${estimado.numero_estimado || "Estimado_PC_Motors"}.pdf`;
    doc.save(nombreArchivo);
  };

  const abrirFormularioOrden = (vehiculo) => {
    setVehiculoSeleccionado(vehiculo);
    setOrdenForm({
      diagnostico: "",
      mecanico: "",
      estado: "Recibido",
      prioridad: "normal",
      notas: ""
    });
  };

  const cancelarOrden = () => {
    setVehiculoSeleccionado(null);
    setOrdenForm({
      diagnostico: "",
      mecanico: "",
      estado: "Recibido",
      prioridad: "normal",
      notas: ""
    });
  };

  const guardarOrdenTrabajo = async () => {
    if (!vehiculoSeleccionado || !clienteSeleccionado) {
      alert("Falta cliente o vehículo seleccionado");
      return;
    }

    if (!ordenForm.diagnostico.trim()) {
      alert("Escribe el diagnóstico o problema principal");
      return;
    }

    const ordenesAbiertas = ordenesActivasVehiculo(vehiculoSeleccionado.id);

    if (ordenesAbiertas.length > 0) {
      const continuar = confirm(
        `Este vehículo ya tiene una orden activa: ${textoOrdenesActivas(ordenesAbiertas)}.\n\n¿Quieres crear otra orden de todos modos?`
      );

      if (!continuar) return;
    }

    const mecanicoAsignado = ordenForm.mecanico.trim();
    const ahora = new Date().toISOString();
    const vehiculoTexto = `${vehiculoSeleccionado.anio || ""} ${vehiculoSeleccionado.marca || ""} ${vehiculoSeleccionado.modelo || ""}`.trim() || vehiculoSeleccionado.notas || "Vehículo no registrado";

    const { data: ordenCreada, error } = await supabase
      .from("ordenes_trabajo")
      .insert([
        {
          cliente_id: clienteSeleccionado.id,
          vehiculo_id: vehiculoSeleccionado.id,
          diagnostico: ordenForm.diagnostico.trim(),
          mecanico: mecanicoAsignado || null,
          estado: mecanicoAsignado ? "Diagnosticando" : ordenForm.estado,
          prioridad: ordenForm.prioridad || "normal",
          notas: ordenForm.notas.trim() || null
        }
      ])
      .select()
      .single();

    if (error) {
      console.log(error);
      alert(JSON.stringify(error, null, 2));
      return;
    }

    const { error: errorTrabajoCentral } = await supabase
      .from("trabajos_mecanicos")
      .insert([
        {
          mecanico_id: null,
          mecanico_nombre: mecanicoAsignado || "No asignado",
          cliente_nombre: clienteSeleccionado.nombre || null,
          vehiculo: vehiculoTexto,
          trabajo: ordenForm.diagnostico.trim(),
          estado: "diagnostico",
          fase_actual: "diagnostico",
          hora_inicio: ahora,
          diagnostico_inicio: ahora,
          diagnostico_minutos: 0,
          reparacion_minutos: 0,
          costo_piezas: 0,
          venta_piezas: 0,
          mano_obra: 0,
          notas: ordenForm.notas.trim() || `Trabajo central creado desde orden #${ordenCreada.id}`,
          origen: "orden_cliente",
          cliente_id: clienteSeleccionado.id,
          vehiculo_id: vehiculoSeleccionado.id,
          orden_id: ordenCreada.id,
          solicitud_id: null
        }
      ]);

    if (errorTrabajoCentral) {
      console.log(errorTrabajoCentral);
      alert(
        `La orden #${ordenCreada.id} fue creada, pero no se pudo crear el trabajo central.\n\n${JSON.stringify(errorTrabajoCentral, null, 2)}`
      );
      return;
    }

    alert(`Orden #${ordenCreada.id} creada y conectada al Control Central de Trabajos.`);

    cancelarOrden();
    await cargarOrdenes(clienteSeleccionado.id);
    await cargarTiempos(clienteSeleccionado.id);
    await cargarTrabajosMecanicos(clienteSeleccionado.id);
    await cargarClientes();
  };

  const abrirFormularioTiempo = (orden) => {
    setOrdenSeleccionadaTiempo(orden);
    setTiempoForm({
      mecanico: orden.mecanico || "",
      descripcion: ""
    });
  };

  const cancelarTiempo = () => {
    setOrdenSeleccionadaTiempo(null);
    setTiempoForm({
      mecanico: "",
      descripcion: ""
    });
  };

  const iniciarTiempoTrabajo = async () => {
    if (!clienteSeleccionado || !ordenSeleccionadaTiempo) {
      alert("Falta cliente u orden seleccionada");
      return;
    }

    if (!tiempoForm.mecanico.trim()) {
      alert("Escribe el nombre del mecánico");
      return;
    }

    const { error } = await supabase.from("tiempos_mecanicos").insert([
      {
        orden_id: ordenSeleccionadaTiempo.id,
        cliente_id: clienteSeleccionado.id,
        vehiculo_id: ordenSeleccionadaTiempo.vehiculo_id,
        mecanico: tiempoForm.mecanico.trim(),
        descripcion: tiempoForm.descripcion.trim() || null,
        hora_inicio: new Date().toISOString(),
        hora_fin: null,
        minutos_trabajados: null
      }
    ]);

    if (error) {
      console.log(error);
      alert(JSON.stringify(error, null, 2));
      return;
    }

    alert("Tiempo iniciado correctamente");
    cancelarTiempo();
    await cargarTiempos(clienteSeleccionado.id);
  };

  const convertirFechaSupabase = (valor) => {
    if (!valor) return null;

    const texto = String(valor);

    if (texto.endsWith("Z") || texto.includes("+")) {
      return new Date(texto);
    }

    return new Date(texto + "Z");
  };

  const calcularMinutosEntreFechas = (inicioValor, finValor) => {
    if (!inicioValor || !finValor) return 0;

    const inicio = convertirFechaSupabase(inicioValor);
    const fin = convertirFechaSupabase(finValor);

    if (!inicio || !fin) return 0;

    if (Number.isNaN(inicio.getTime()) || Number.isNaN(fin.getTime())) {
      return 0;
    }

    const diferenciaMs = fin.getTime() - inicio.getTime();

    if (diferenciaMs <= 0) return 0;

    return Math.max(1, Math.round(diferenciaMs / 1000 / 60));
  };

  const finalizarTiempoTrabajo = async (tiempo) => {
    const confirmar = confirm(`¿Finalizar el tiempo de ${tiempo.mecanico}?`);
    if (!confirmar) return;

    setProcesandoTiempoId(tiempo.id);

    const fin = new Date();
    const minutos = calcularMinutosEntreFechas(tiempo.hora_inicio, fin.toISOString());

    console.log("Recalculando tiempo al finalizar");
    console.log("Inicio:", tiempo.hora_inicio);
    console.log("Final:", fin.toISOString());
    console.log("Minutos:", minutos);

    if (minutos <= 0) {
      setProcesandoTiempoId(null);
      alert("No se pudo calcular el tiempo correctamente.");
      return;
    }

    const { error } = await supabase
      .from("tiempos_mecanicos")
      .update({
        hora_fin: fin.toISOString(),
        minutos_trabajados: minutos
      })
      .eq("id", tiempo.id);

    setProcesandoTiempoId(null);

    if (error) {
      console.log(error);
      alert(JSON.stringify(error, null, 2));
      return;
    }

    alert(`Tiempo finalizado: ${convertirMinutos(minutos)}`);
    await cargarTiempos(clienteSeleccionado.id);
  };

  const recalcularTiemposAntiguos = async () => {
    if (!clienteSeleccionado) return;

    const tiemposParaRecalcular = tiempos.filter(
      (tiempo) => tiempo.hora_inicio && tiempo.hora_fin
    );

    if (tiemposParaRecalcular.length === 0) {
      alert("No hay tiempos antiguos para recalcular.");
      return;
    }

    const confirmar = confirm(
      `Se recalcularán ${tiemposParaRecalcular.length} registros usando hora de inicio y hora final. ¿Continuar?`
    );

    if (!confirmar) return;

    let actualizados = 0;
    let errores = 0;

    for (const tiempo of tiemposParaRecalcular) {
      const minutos = calcularMinutosEntreFechas(
        tiempo.hora_inicio,
        tiempo.hora_fin
      );

      if (minutos <= 0) {
        errores += 1;
        continue;
      }

      const { error } = await supabase
        .from("tiempos_mecanicos")
        .update({
          minutos_trabajados: minutos
        })
        .eq("id", tiempo.id);

      if (error) {
        console.log(error);
        errores += 1;
      } else {
        actualizados += 1;
      }
    }

    await cargarTiempos(clienteSeleccionado.id);

    alert(
      `Recalculo terminado.\n\nActualizados: ${actualizados}\nErrores: ${errores}`
    );
  };

  const tiemposPorOrden = (ordenId) =>
    tiempos.filter((tiempo) => tiempo.orden_id === ordenId);

  const trabajoMecanicoDeOrden = (ordenId) =>
    trabajosMecanicos.find(
      (trabajo) => String(trabajo.orden_id) === String(ordenId)
    );

  const esTrabajoMecanicoActivo = (trabajo) =>
    Boolean(trabajo) &&
    !["finalizado", "Finalizado", "Terminado", "Entregado", "Cancelado"].includes(trabajo.estado || "");

  const minutosTrabajoMecanico = (trabajo) => {
    if (!trabajo) return 0;

    let diagnostico = Number(trabajo.diagnostico_minutos || 0);
    let reparacion = Number(trabajo.reparacion_minutos || 0);
    const ahora = new Date().toISOString();

    if (trabajo.diagnostico_inicio && !trabajo.diagnostico_fin && esTrabajoMecanicoActivo(trabajo)) {
      diagnostico = calcularMinutosEntreFechas(trabajo.diagnostico_inicio, ahora);
    }

    if (trabajo.reparacion_inicio && !trabajo.reparacion_fin && esTrabajoMecanicoActivo(trabajo)) {
      reparacion = calcularMinutosEntreFechas(trabajo.reparacion_inicio, ahora);
    }

    return diagnostico + reparacion;
  };

  const trabajoCentralCorriendoComoTiempo = (trabajo) => {
    if (!esTrabajoMecanicoActivo(trabajo)) return null;

    const reparacionActiva = Boolean(trabajo.reparacion_inicio) && !trabajo.reparacion_fin;
    const diagnosticoActivo = Boolean(trabajo.diagnostico_inicio) && !trabajo.diagnostico_fin;

    if (!reparacionActiva && !diagnosticoActivo) return null;

    const faseTexto = reparacionActiva ? "Reparación" : "Diagnóstico";

    return {
      id: `central-${trabajo.id}`,
      orden_id: trabajo.orden_id,
      mecanico: trabajo.mecanico_nombre || "No asignado",
      hora_inicio: reparacionActiva ? trabajo.reparacion_inicio : trabajo.diagnostico_inicio,
      descripcion: `${faseTexto} en curso desde Control Trabajos: ${trabajo.trabajo || "Sin descripción"}`,
      desdeControlCentral: true
    };
  };

  const tiemposActivosPorOrden = (ordenId) => {
    const tiemposDirectos = tiempos.filter((tiempo) => tiempo.orden_id === ordenId && !tiempo.hora_fin);
    const trabajoCentral = trabajoMecanicoDeOrden(ordenId);
    const tiempoCentral = trabajoCentralCorriendoComoTiempo(trabajoCentral);

    if (!tiempoCentral) return tiemposDirectos;

    const yaExisteMismoMecanico = tiemposDirectos.some(
      (tiempo) => String(tiempo.mecanico || "").toLowerCase() === String(tiempoCentral.mecanico || "").toLowerCase()
    );

    return yaExisteMismoMecanico ? tiemposDirectos : [...tiemposDirectos, tiempoCentral];
  };

  const totalMinutosOrden = (ordenId) => {
    const totalTiempos = tiemposPorOrden(ordenId).reduce(
      (total, tiempo) => total + Number(tiempo.minutos_trabajados || 0),
      0
    );

    const totalCentral = minutosTrabajoMecanico(trabajoMecanicoDeOrden(ordenId));
    return Math.max(totalTiempos, totalCentral);
  };

  const totalMinutosCliente = () =>
    tiempos.reduce(
      (total, tiempo) => total + Number(tiempo.minutos_trabajados || 0),
      0
    );

  const convertirMinutos = (minutos) => {
    const horas = Math.floor(minutos / 60);
    const resto = minutos % 60;

    if (horas === 0) return `${resto} min`;
    if (resto === 0) return `${horas} h`;

    return `${horas} h ${resto} min`;
  };

  const formatearFecha = (fecha) => {
    if (!fecha) return "Activo";

    const fechaConvertida = convertirFechaSupabase(fecha);

    if (!fechaConvertida || Number.isNaN(fechaConvertida.getTime())) {
      return "Fecha inválida";
    }

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
  if (clienteSeleccionado) {
    return (
      <div>
        <button onClick={volverLista} style={backButton}>
          ← Volver a Clientes
        </button>

        <h1 style={{ color: "#f59e0b" }}>👤 Perfil del Cliente</h1>

        <div style={profileBox}>
          <h2 style={{ color: "#f59e0b" }}>{clienteSeleccionado.nombre}</h2>

          <p>
            <strong>📞 Teléfono:</strong>{" "}
            {clienteSeleccionado.telefono || "No registrado"}
          </p>

          <p>
            <strong>✉️ Email:</strong>{" "}
            {clienteSeleccionado.email || "No registrado"}
          </p>

          <p>
            <strong>📍 Dirección:</strong>{" "}
            {clienteSeleccionado.direccion || "No registrada"}
          </p>

          <p>
            <strong>📝 Notas:</strong>{" "}
            {clienteSeleccionado.notas || "Sin notas"}
          </p>

          <p>
            <strong>⏱ Total trabajado en este cliente:</strong>{" "}
            <span style={statusBadge}>
              {convertirMinutos(totalMinutosCliente())}
            </span>
          </p>

          <button onClick={recalcularTiemposAntiguos} style={recalculateButton}>
            🔄 Recalcular tiempos antiguos
          </button>

          <div style={mechanicAssignBox}>
            <h3 style={{ color: "#f59e0b", marginTop: 0 }}>
              👨‍🔧 Mecánicos asignados a este cliente
            </h3>

            <select
              value={mecanicoAsignadoForm.mecanico_id}
              onChange={(e) => seleccionarMecanicoAsignado(e.target.value)}
              style={inputStyle}
            >
              <option value="">Seleccionar mecánico registrado</option>
              {mecanicosDB.map((mecanico) => (
                <option key={mecanico.id} value={mecanico.id}>
                  {mecanico.nombre} - {mecanico.tipo_pago}
                </option>
              ))}
            </select>

            <input
              placeholder="O escribir nombre del mecánico"
              value={mecanicoAsignadoForm.mecanico_nombre}
              onChange={(e) =>
                setMecanicoAsignadoForm({
                  ...mecanicoAsignadoForm,
                  mecanico_nombre: e.target.value,
                  mecanico_id: ""
                })
              }
              style={inputStyle}
            />

            <input
              placeholder="Rol o trabajo. Ejemplo: diagnóstico, frenos, electricidad"
              value={mecanicoAsignadoForm.rol}
              onChange={(e) =>
                setMecanicoAsignadoForm({
                  ...mecanicoAsignadoForm,
                  rol: e.target.value
                })
              }
              style={inputStyle}
            />

            <input
              placeholder="Horas asignadas. Ejemplo: 4.5"
              type="number"
              value={mecanicoAsignadoForm.horas_asignadas}
              onChange={(e) =>
                setMecanicoAsignadoForm({
                  ...mecanicoAsignadoForm,
                  horas_asignadas: e.target.value
                })
              }
              style={inputStyle}
            />

            <input
              placeholder="Porcentaje producción solo si aplica. Ejemplo: 50"
              type="number"
              value={mecanicoAsignadoForm.porcentaje_produccion}
              onChange={(e) =>
                setMecanicoAsignadoForm({
                  ...mecanicoAsignadoForm,
                  porcentaje_produccion: e.target.value
                })
              }
              style={inputStyle}
            />

            <textarea
              placeholder="Notas del mecánico en este cliente"
              value={mecanicoAsignadoForm.notas}
              onChange={(e) =>
                setMecanicoAsignadoForm({
                  ...mecanicoAsignadoForm,
                  notas: e.target.value
                })
              }
              style={{ ...inputStyle, minHeight: "80px" }}
            />

            <button onClick={agregarMecanicoAlCliente} style={saveButton}>
              ➕ Agregar Mecánico al Cliente
            </button>

            {mecanicosAsignados.length === 0 ? (
              <p style={{ color: "#d1d5db", marginTop: "12px" }}>
                No hay mecánicos asignados todavía. Si no agregas ninguno, el
                sistema usará los mecánicos registrados en los tiempos de trabajo.
              </p>
            ) : (
              <div style={{ marginTop: "15px" }}>
                {mecanicosAsignados.map((asignacion) => (
                  <div key={asignacion.id} style={assignedMechanicCard}>
                    <p>
                      <strong>👨‍🔧 Mecánico:</strong>{" "}
                      {asignacion.mecanico_nombre}
                    </p>

                    <p>
                      <strong>Rol:</strong>{" "}
                      {asignacion.rol || "No especificado"}
                    </p>

                    <p>
                      <strong>Horas asignadas:</strong>{" "}
                      {Number(asignacion.horas_asignadas || 0)}
                    </p>

                    <p>
                      <strong>% producción:</strong>{" "}
                      {Number(asignacion.porcentaje_produccion || 0)}%
                    </p>

                    <p>
                      <strong>Notas:</strong>{" "}
                      {asignacion.notas || "Sin notas"}
                    </p>

                    <button
                      onClick={() => eliminarMecanicoAsignado(asignacion)}
                      style={removeButton}
                    >
                      Quitar
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <button onClick={finalizarCliente} style={finishClientButton}>
            ✅ Finalizar Cliente
          </button>
        </div>

        <h2 style={{ color: "#f59e0b", marginTop: "30px" }}>🚗 Vehículos</h2>

        {vehiculos.length === 0 ? (
          <div style={emptyStyle}>
            Este cliente todavía no tiene vehículos registrados.
          </div>
        ) : (
          <div style={gridStyle}>
            {vehiculos.map((vehiculo) => {
              const ordenesActivas = ordenesActivasVehiculo(vehiculo.id);
              const ordenPrincipalVehiculo = ordenesActivas[0];
              const trabajosDelVehiculo = trabajosMecanicos.filter(
                (trabajo) => String(trabajo.vehiculo_id) === String(vehiculo.id)
              );
              const trabajoCentralVehiculo =
                trabajosDelVehiculo.find((trabajo) => trabajo.estado !== "finalizado") ||
                trabajosDelVehiculo[0] ||
                null;
              const diagnosticoVehiculoMinutos = Number(
                trabajoCentralVehiculo?.diagnostico_minutos || 0
              );
              const reparacionVehiculoMinutos = Number(
                trabajoCentralVehiculo?.reparacion_minutos || 0
              );
              const totalVehiculoMinutos =
                diagnosticoVehiculoMinutos + reparacionVehiculoMinutos;

              return (
              <div key={vehiculo.id} style={cardStyle}>
                <h3 style={{ color: "#f59e0b", marginTop: 0 }}>
                  {vehiculo.anio || ""} {vehiculo.marca || ""}{" "}
                  {vehiculo.modelo || ""}
                </h3>

                <p>
                  <strong>Color:</strong> {vehiculo.color || "No registrado"}
                </p>

                <p>
                  <strong>Placa:</strong> {vehiculo.placa || "No registrada"}
                </p>

                <p>
                  <strong>VIN:</strong> {vehiculo.vin || "No registrado"}
                </p>

                <p>
                  <strong>Millaje:</strong>{" "}
                  {vehiculo.millaje || "No registrado"}
                </p>

                <p>
                  <strong>Notas:</strong>
                  <br />
                  {vehiculo.notas || "Sin notas"}
                </p>

                {ordenesActivas.length > 0 ? (
                  <div style={activeOrderSummaryBox}>
                    <strong>✅ Orden activa:</strong> {textoOrdenesActivas(ordenesActivas)}
                    <br />
                    <span style={prioridadStyle(ordenPrincipalVehiculo?.prioridad)}>
                      {prioridadTexto(ordenPrincipalVehiculo?.prioridad)}
                    </span>
                    <br />
                    <span>
                      Mecánico: {mecanicoClienteActual(
                        trabajoCentralVehiculo,
                        ordenPrincipalVehiculo,
                        null
                      )}
                    </span>
                    <br />
                    <span>
                      Estado: {estadoCentralTexto(
                        trabajoCentralVehiculo,
                        ordenPrincipalVehiculo,
                        null
                      )}
                    </span>

                    {trabajoCentralVehiculo && (
                      <div style={vehicleCentralTimeBox}>
                        <p style={{ margin: "6px 0" }}>
                          <strong>⏱ Diagnóstico:</strong>{" "}
                          {convertirMinutos(diagnosticoVehiculoMinutos)}
                        </p>

                        <p style={{ margin: "6px 0" }}>
                          <strong>🔧 Reparación:</strong>{" "}
                          {convertirMinutos(reparacionVehiculoMinutos)}
                        </p>

                        <p style={{ margin: "6px 0" }}>
                          <strong>⏱ Total:</strong>{" "}
                          {convertirMinutos(totalVehiculoMinutos)}
                        </p>

                        <p style={{ margin: "6px 0" }}>
                          <strong>📋 Resultado diagnóstico:</strong>
                          <br />
                          {trabajoCentralVehiculo.resultado_diagnostico || "Pendiente"}
                        </p>
                      </div>
                    )}
                  </div>
                ) : (
                  <button
                    style={workOrderButton}
                    onClick={() => abrirFormularioOrden(vehiculo)}
                  >
                    Crear Orden de Trabajo
                  </button>
                )}

                <button
                  style={estimateButton}
                  onClick={() => abrirFormularioEstimado(vehiculo)}
                >
                  Crear Estimado
                </button>

                <h4 style={{ color: "#f59e0b", marginTop: "18px" }}>
                  Estimados
                </h4>

                {estimadosPorVehiculo(vehiculo.id).length === 0 ? (
                  <p>No hay estimados para este vehículo.</p>
                ) : (
                  estimadosPorVehiculo(vehiculo.id).map((estimado) => (
                    <div key={estimado.id} style={estimateBox}>
                      <p>
                        <strong>🧾 Número:</strong>{" "}
                        {estimado.numero_estimado || `EST-${estimado.id}`}
                      </p>

                      <p>
                        <strong>📅 Fecha:</strong>{" "}
                        {estimado.fecha_estimado || "No registrada"}
                      </p>

                      <p>
                        <strong>Estado:</strong>{" "}
                        <span style={estadoEstimadoStyle(estimado.estado)}>
                          {estimado.estado || "pendiente"}
                        </span>
                      </p>

                      <p>
                        <strong>Descripción:</strong>
                        <br />
                        {estimado.descripcion || "Sin descripción"}
                      </p>

                      <div style={estimateSummaryBox}>
                        <p><strong>🧩 Piezas:</strong> {dinero(estimado.piezas)}</p>
                        <p><strong>🔧 Mano de obra:</strong> {dinero(estimado.mano_obra)}</p>
                        <p><strong>🧾 Fees:</strong> {dinero(estimado.impuestos)}</p>
                        {Number(estimado.descuento || 0) > 0 && (
                          <p><strong>Descuento:</strong> {dinero(estimado.descuento)}</p>
                        )}
                      </div>

                      <p>
                        <strong>Total:</strong>{" "}
                        <span style={statusBadge}>
                          {dinero(estimado.total)}
                        </span>
                      </p>

                      <p>
                        <strong>Notas:</strong>{" "}
                        {limpiarNotasEstimado(estimado.notas) || "Sin notas"}
                      </p>

                      <button
                        onClick={() => descargarPDFEstimado(estimado)}
                        style={pdfButton}
                      >
                        📄 Descargar PDF
                      </button>

                      <button
                        onClick={() => cambiarEstadoEstimado(estimado, "aprobado")}
                        style={approveButton}
                      >
                        ✅ Aprobar Estimado
                      </button>

                      <button
                        onClick={() => convertirEstimadoEnOrden(estimado)}
                        style={workOrderButton}
                      >
                        🔧 Convertir en Orden
                      </button>

                      <button
                        onClick={() => cambiarEstadoEstimado(estimado, "rechazado")}
                        style={rejectButton}
                      >
                        ❌ Marcar Rechazado
                      </button>

                      <button
                        onClick={() => eliminarEstimado(estimado)}
                        style={removeButton}
                      >
                        🗑 Eliminar Estimado
                      </button>
                    </div>
                  ))
                )}
              </div>
              );
            })}
          </div>
        )}

        {vehiculoSeleccionadoEstimado && (
          <div style={formBox}>
            <h2 style={{ color: "#f59e0b" }}>🧾 Nuevo Estimado</h2>

            <p>
              Vehículo:{" "}
              <strong>
                {vehiculoSeleccionadoEstimado.anio || ""}{" "}
                {vehiculoSeleccionadoEstimado.marca || ""}{" "}
                {vehiculoSeleccionadoEstimado.modelo || ""}
              </strong>
            </p>

            <textarea
              placeholder="Descripción del estimado"
              value={estimadoForm.descripcion}
              onChange={(e) =>
                setEstimadoForm({
                  ...estimadoForm,
                  descripcion: e.target.value
                })
              }
              style={{ ...inputStyle, minHeight: "90px" }}
            />

            <div style={partsBox}>
              <h3 style={{ color: "#f59e0b", marginTop: 0 }}>🧩 Piezas desglosadas</h3>

              {(estimadoForm.piezas_detalle || []).map((pieza, indice) => {
                const cantidad = Number(pieza.cantidad || 0);
                const precio = Number(pieza.precio || 0);
                const totalPieza = redondearDinero(cantidad * precio);

                return (
                  <div key={indice} style={partRowBox}>
                    <input
                      placeholder="Nombre de pieza. Ejemplo: Batería, fusible, sensor..."
                      value={pieza.nombre}
                      onChange={(e) => actualizarPiezaEstimado(indice, "nombre", e.target.value)}
                      style={inputStyle}
                    />
                    <div style={partGridStyle}>
                      <input
                        placeholder="Cantidad"
                        type="number"
                        value={pieza.cantidad}
                        onChange={(e) => actualizarPiezaEstimado(indice, "cantidad", e.target.value)}
                        style={inputStyle}
                      />
                      <input
                        placeholder="Precio venta al cliente"
                        type="number"
                        value={pieza.precio}
                        onChange={(e) => actualizarPiezaEstimado(indice, "precio", e.target.value)}
                        style={inputStyle}
                      />
                      <div style={partTotalBox}>
                        Total pieza: {dinero(totalPieza)}
                      </div>
                    </div>
                    <button type="button" onClick={() => eliminarPiezaEstimado(indice)} style={removeButton}>
                      Quitar pieza
                    </button>
                  </div>
                );
              })}

              <button type="button" onClick={agregarPiezaEstimado} style={estimateButton}>
                ➕ Agregar otra pieza
              </button>
            </div>

            <input
              placeholder="Mano de obra"
              type="number"
              value={estimadoForm.mano_obra}
              onChange={(e) =>
                setEstimadoForm({
                  ...estimadoForm,
                  mano_obra: e.target.value
                })
              }
              style={inputStyle}
            />

            <input
              placeholder="Descuento opcional"
              type="number"
              value={estimadoForm.descuento}
              onChange={(e) =>
                setEstimadoForm({
                  ...estimadoForm,
                  descuento: e.target.value
                })
              }
              style={inputStyle}
            />

            <div style={estimateSummaryBox}>
              <p><strong>Piezas:</strong> {dinero(calcularTotalesEstimado().piezasBase)}</p>
              <p><strong>Recargo piezas 6%:</strong> {dinero(calcularTotalesEstimado().cargoPiezas6)}</p>
              <p><strong>Mano de obra:</strong> {dinero(calcularTotalesEstimado().manoObra)}</p>
              <p><strong>Fee de servicio 4%:</strong> {dinero(calcularTotalesEstimado().feeServicio4)}</p>
              {Number(estimadoForm.descuento || 0) > 0 && (
                <p><strong>Descuento:</strong> {dinero(Number(estimadoForm.descuento || 0))}</p>
              )}
            </div>

            <textarea
              placeholder="Notas del estimado"
              value={estimadoForm.notas}
              onChange={(e) =>
                setEstimadoForm({
                  ...estimadoForm,
                  notas: e.target.value
                })
              }
              style={{ ...inputStyle, minHeight: "80px" }}
            />

            <p>
              <strong>Total estimado:</strong>{" "}
              <span style={statusBadge}>
                ${calcularTotalEstimado().toFixed(2)}
              </span>
            </p>

            <button onClick={guardarEstimado} style={saveButton}>
              Guardar Estimado
            </button>

            <button onClick={cancelarEstimado} style={cancelButton}>
              Cancelar
            </button>
          </div>
        )}

        {vehiculoSeleccionado && (
          <div style={formBox}>
            <h2 style={{ color: "#f59e0b" }}>🔧 Nueva Orden de Trabajo</h2>

            <textarea
              placeholder="Diagnóstico o problema principal"
              value={ordenForm.diagnostico}
              onChange={(e) =>
                setOrdenForm({ ...ordenForm, diagnostico: e.target.value })
              }
              style={{ ...inputStyle, minHeight: "90px" }}
            />

            <input
              placeholder="Mecánico asignado"
              value={ordenForm.mecanico}
              onChange={(e) =>
                setOrdenForm({ ...ordenForm, mecanico: e.target.value })
              }
              style={inputStyle}
            />

            <select
              value={ordenForm.estado}
              onChange={(e) =>
                setOrdenForm({ ...ordenForm, estado: e.target.value })
              }
              style={inputStyle}
            >
              <option>Recibido</option>
              <option>Diagnosticando</option>
              <option>Esperando piezas</option>
              <option>En reparación</option>
              <option>Terminado</option>
              <option>Entregado</option>
              <option>Cancelado</option>
            </select>

            <select
              value={ordenForm.prioridad}
              onChange={(e) =>
                setOrdenForm({ ...ordenForm, prioridad: e.target.value })
              }
              style={inputStyle}
            >
              <option value="urgente">🔴 Urgente</option>
              <option value="normal">🟡 Normal</option>
              <option value="programado">🟢 Programado</option>
            </select>

            <textarea
              placeholder="Notas adicionales"
              value={ordenForm.notas}
              onChange={(e) =>
                setOrdenForm({ ...ordenForm, notas: e.target.value })
              }
              style={{ ...inputStyle, minHeight: "90px" }}
            />

            <button onClick={guardarOrdenTrabajo} style={saveButton}>
              Guardar Orden
            </button>

            <button onClick={cancelarOrden} style={cancelButton}>
              Cancelar
            </button>
          </div>
        )}

        {ordenSeleccionadaTiempo && (
          <div style={formBox}>
            <h2 style={{ color: "#f59e0b" }}>▶️ Iniciar Trabajo</h2>

            <p>
              Orden: <strong>#{ordenSeleccionadaTiempo.id}</strong>
            </p>

            <input
              placeholder="Nombre del mecánico"
              value={tiempoForm.mecanico}
              onChange={(e) =>
                setTiempoForm({ ...tiempoForm, mecanico: e.target.value })
              }
              style={inputStyle}
            />

            <textarea
              placeholder="Descripción del trabajo que va a realizar"
              value={tiempoForm.descripcion}
              onChange={(e) =>
                setTiempoForm({ ...tiempoForm, descripcion: e.target.value })
              }
              style={{ ...inputStyle, minHeight: "90px" }}
            />

            <button onClick={iniciarTiempoTrabajo} style={saveButton}>
              ▶️ Iniciar Tiempo
            </button>

            <button onClick={cancelarTiempo} style={cancelButton}>
              Cancelar
            </button>
          </div>
        )}

        <h2 style={{ color: "#f59e0b", marginTop: "30px" }}>
          📋 Órdenes de Trabajo
        </h2>

        {ordenes.length === 0 ? (
          <div style={emptyStyle}>No hay órdenes de trabajo registradas.</div>
        ) : (
          <div style={gridStyle}>
            {ordenes.map((orden) => {
              const tiemposDeOrden = tiemposPorOrden(orden.id);
              const tiemposActivos = tiemposActivosPorOrden(orden.id);
              const totalMinutos = totalMinutosOrden(orden.id);
              const trabajoMecanico = trabajoMecanicoDeOrden(orden.id);
              const diagnosticoMinutos = Number(trabajoMecanico?.diagnostico_minutos || 0);
              const reparacionMinutos = Number(trabajoMecanico?.reparacion_minutos || 0);
              const totalCentralizadoMinutos = minutosTrabajoMecanico(trabajoMecanico);

              return (
                <div key={orden.id} style={cardStyle}>
                  <h3 style={{ color: "#f59e0b", marginTop: 0 }}>
                    Orden #{orden.id}
                  </h3>

                  <p>
                    <strong>Estado:</strong>{" "}
                    <span style={statusBadge}>
                      {estadoCentralTexto(trabajoMecanico, orden, tiemposActivos[0])}
                    </span>
                  </p>

                  <p>
                    <strong>Prioridad:</strong>{" "}
                    <span style={prioridadStyle(orden.prioridad)}>
                      {prioridadTexto(orden.prioridad)}
                    </span>
                  </p>

                  <p>
                    <strong>Mecánico principal:</strong>{" "}
                    {orden.mecanico || "No asignado"}
                  </p>

                  <p>
                    <strong>Diagnóstico:</strong>
                    <br />
                    {orden.diagnostico || "Sin diagnóstico"}
                  </p>

                  <p>
                    <strong>Notas:</strong>
                    <br />
                    {orden.notas || "Sin notas"}
                  </p>

                  <p>
                    <strong>⏱ Tiempo total de la orden:</strong>{" "}
                    {convertirMinutos(totalMinutos)}
                  </p>

                  {trabajoMecanico && (
                    <div style={centralWorkBox}>
                      <h4 style={{ color: "#f59e0b", marginTop: 0 }}>
                        🔧 Control central del trabajo
                      </h4>

                      <p>
                        <strong>Estado central:</strong>{" "}
                        <span style={statusBadge}>
                          {trabajoMecanico.estado || "Sin estado"}
                        </span>
                      </p>

                      <p>
                        <strong>⏱ Diagnóstico:</strong>{" "}
                        {convertirMinutos(diagnosticoMinutos)}
                      </p>

                      <p>
                        <strong>🔧 Reparación:</strong>{" "}
                        {convertirMinutos(reparacionMinutos)}
                      </p>

                      <p>
                        <strong>⏱ Total centralizado:</strong>{" "}
                        <span style={statusBadge}>
                          {convertirMinutos(totalCentralizadoMinutos)}
                        </span>
                      </p>

                      <p>
                        <strong>📋 Resultado diagnóstico:</strong>
                        <br />
                        {trabajoMecanico.resultado_diagnostico || "Pendiente"}
                      </p>

                      <p>
                        <strong>💰 Costo piezas:</strong>{" "}
                        {dinero(trabajoMecanico.costo_piezas)}
                      </p>

                      <p>
                        <strong>💵 Venta piezas:</strong>{" "}
                        {dinero(trabajoMecanico.venta_piezas)}
                      </p>

                      <p>
                        <strong>📈 Ganancia piezas:</strong>{" "}
                        {dinero(trabajoMecanico.ganancia_piezas)}
                      </p>

                      <p>
                        <strong>🔧 Mano de obra:</strong>{" "}
                        {dinero(trabajoMecanico.mano_obra)}
                      </p>

                      <p>
                        <strong>💲 Total generado:</strong>{" "}
                        <span style={statusBadge}>
                          {dinero(trabajoMecanico.total_generado)}
                        </span>
                      </p>

                      {trabajoMecanico.numero_factura && (
                        <p>
                          <strong>🧾 Factura:</strong>{" "}
                          {trabajoMecanico.numero_factura}
                        </p>
                      )}
                    </div>
                  )}

                  {tiemposActivos.length > 0 ? (
                    <div style={activeOrderSummaryBox}>
                      🟢 Trabajo activo en esta orden. Finaliza el tiempo actual antes de iniciar otro.
                    </div>
                  ) : (
                    <button
                      style={timeButton}
                      onClick={() => abrirFormularioTiempo(orden)}
                    >
                      ▶️ Iniciar Trabajo
                    </button>
                  )}

                  <h4 style={{ color: "#f59e0b" }}>Trabajos activos</h4>

                  {tiemposActivos.length === 0 ? (
                    <p>No hay mecánicos trabajando ahora en esta orden.</p>
                  ) : (
                    tiemposActivos.map((tiempo) => (
                      <div key={tiempo.id} style={activeTimeBox}>
                        <p>
                          <strong>Mecánico:</strong> {tiempo.mecanico}
                        </p>

                        <p>
                          <strong>Inicio:</strong>{" "}
                          {formatearFecha(tiempo.hora_inicio)}
                        </p>

                        <p>
                          <strong>Trabajo:</strong>
                          <br />
                          {tiempo.descripcion || "Sin descripción"}
                        </p>

                        <button
                          style={tiempo.desdeControlCentral ? disabledInfoButton : stopButton}
                          disabled={tiempo.desdeControlCentral || procesandoTiempoId === tiempo.id}
                          onClick={() => tiempo.desdeControlCentral ? null : finalizarTiempoTrabajo(tiempo)}
                        >
                          {tiempo.desdeControlCentral
                            ? "⏱ Tiempo activo desde Control Trabajos"
                            : procesandoTiempoId === tiempo.id
                              ? "Finalizando..."
                              : "⏹ Finalizar Trabajo"}
                        </button>
                      </div>
                    ))
                  )}

                  <h4 style={{ color: "#f59e0b" }}>Historial de tiempos</h4>

                  {tiemposDeOrden.length === 0 ? (
                    <p>No hay tiempos registrados para esta orden.</p>
                  ) : (
                    tiemposDeOrden.map((tiempo) => (
                      <div key={tiempo.id} style={timeBox}>
                        <p>
                          <strong>Mecánico:</strong> {tiempo.mecanico}
                        </p>

                        <p>
                          <strong>Inicio:</strong>{" "}
                          {formatearFecha(tiempo.hora_inicio)}
                        </p>

                        <p>
                          <strong>Final:</strong>{" "}
                          {tiempo.hora_fin
                            ? formatearFecha(tiempo.hora_fin)
                            : "Activo"}
                        </p>

                        <p>
                          <strong>Tiempo:</strong>{" "}
                          {tiempo.minutos_trabajados
                            ? convertirMinutos(Number(tiempo.minutos_trabajados))
                            : "En progreso"}
                        </p>

                        <p>
                          <strong>Trabajo:</strong>
                          <br />
                          {tiempo.descripcion || "Sin descripción"}
                        </p>
                      </div>
                    ))
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  return (
    <div>
      <div style={headerStyle}>
        <div>
          <h1 style={{ color: "#f59e0b" }}>👥 Clientes Activos</h1>
          <p>Clientes con trabajos activos en PC Motors.</p>
        </div>

        <button onClick={cargarClientes} style={refreshButton}>
          Refrescar
        </button>
      </div>

      {cargando ? (
        <p>Cargando clientes...</p>
      ) : clientes.length === 0 ? (
        <div style={emptyStyle}>No hay clientes activos.</div>
      ) : (
        <div style={gridStyle}>
          {clientes.map((cliente) => {
            const ordenesActivas = ordenesActivasDelCliente(cliente.id);
            const ordenPrincipal = ordenesActivas[0];
            const tiempoActivo = tiempoActivoDelCliente(cliente.id);
            const trabajoCentral = trabajoCentralDelCliente(cliente.id);
            const ordenVisual = ordenPrincipal || (trabajoCentral
              ? {
                  id: trabajoCentral.orden_id || trabajoCentral.id,
                  prioridad: "normal",
                  estado: trabajoCentral.estado,
                  diagnostico: trabajoCentral.trabajo,
                  mecanico: trabajoCentral.mecanico_nombre
                }
              : null);
            const estadoMostrado = estadoCentralTexto(
              trabajoCentral,
              ordenVisual,
              tiempoActivo
            );
            const inicioMostrado = fechaPrincipalTrabajo(trabajoCentral, tiempoActivo);

            return (
            <div key={cliente.id} style={cardStyle}>
              {ordenVisual ? (
                <div style={orderHeroBox}>
                  <div style={orderHeroTop}>
                    <span style={orderNumberStyle}>📋 Orden #{ordenVisual.id}</span>
                    <span style={prioridadStyle(ordenVisual.prioridad)}>
                      {prioridadTexto(ordenVisual.prioridad)}
                    </span>
                    <span style={estadoTrabajoStyle(trabajoCentral?.estado, trabajoCentral?.fase_actual)}>
                      {estadoMostrado}
                    </span>
                  </div>

                  <h2 style={{ color: "white", margin: "12px 0 8px" }}>
                    {cliente.nombre}
                  </h2>

                  <p style={{ marginBottom: "6px" }}>
                    <strong>👨‍🔧 Mecánico:</strong>{" "}
                    {mecanicoClienteActual(trabajoCentral, ordenVisual, tiempoActivo)}
                  </p>

                  {inicioMostrado && (
                    <p style={{ marginBottom: "6px" }}>
                      <strong>⏱ Iniciado:</strong>{" "}
                      {formatearFecha(inicioMostrado)}
                    </p>
                  )}

                  <p>
                    <strong>⚠️ Trabajo:</strong>{" "}
                    {trabajoDescripcionCliente(trabajoCentral, ordenVisual, tiempoActivo)}
                  </p>
                </div>
              ) : (
                <>
                  <h2 style={{ color: "#f59e0b", marginTop: 0 }}>
                    {cliente.nombre}
                  </h2>

                  <div style={orderBadgeBox}>
                    <strong>📋 Órdenes activas:</strong> Sin órdenes activas
                  </div>
                </>
              )}

              {ordenesActivas.length > 1 && (
                <div style={orderBadgeBox}>
                  <strong>📋 Otras órdenes activas:</strong>{" "}
                  {textoOrdenesActivas(ordenesActivas.slice(1))}
                </div>
              )}

              <p>
                <strong>📞 Teléfono:</strong>{" "}
                {cliente.telefono || "No registrado"}
              </p>

              <p>
                <strong>✉️ Email:</strong>{" "}
                {cliente.email || "No registrado"}
              </p>

              <p>
                <strong>📍 Dirección:</strong>{" "}
                {cliente.direccion || "No registrada"}
              </p>

              <button
                style={profileButton}
                onClick={() => abrirPerfil(cliente)}
              >
                Ver Perfil
              </button>
            </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

const headerStyle = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  marginBottom: "25px"
};

const refreshButton = {
  padding: "12px 18px",
  background: "#f59e0b",
  color: "#111827",
  border: "none",
  borderRadius: "8px",
  cursor: "pointer",
  fontWeight: "bold"
};

const gridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))",
  gap: "20px"
};

const cardStyle = {
  background: "#1f2937",
  padding: "20px",
  borderRadius: "14px",
  border: "1px solid #374151"
};

const profileBox = {
  background: "#1f2937",
  padding: "25px",
  borderRadius: "14px",
  border: "1px solid #374151",
  marginTop: "20px"
};

const profileButton = {
  width: "100%",
  marginTop: "15px",
  padding: "12px",
  background: "#2563eb",
  color: "white",
  border: "none",
  borderRadius: "8px",
  cursor: "pointer",
  fontWeight: "bold"
};

const backButton = {
  padding: "10px 15px",
  background: "#374151",
  color: "white",
  border: "none",
  borderRadius: "8px",
  cursor: "pointer",
  marginBottom: "20px"
};

const workOrderButton = {
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

const estimateButton = {
  width: "100%",
  padding: "12px",
  marginTop: "10px",
  background: "#f59e0b",
  color: "#111827",
  border: "none",
  borderRadius: "8px",
  cursor: "pointer",
  fontWeight: "bold"
};

const formBox = {
  background: "#111827",
  padding: "25px",
  borderRadius: "14px",
  border: "1px solid #f59e0b",
  marginTop: "30px"
};

const inputStyle = {
  width: "100%",
  padding: "12px",
  marginBottom: "12px",
  borderRadius: "8px",
  border: "1px solid #374151",
  background: "#1f2937",
  color: "white",
  boxSizing: "border-box"
};

const saveButton = {
  width: "100%",
  padding: "12px",
  background: "#16a34a",
  color: "white",
  border: "none",
  borderRadius: "8px",
  cursor: "pointer",
  fontWeight: "bold",
  marginBottom: "10px"
};

const cancelButton = {
  width: "100%",
  padding: "12px",
  background: "#6b7280",
  color: "white",
  border: "none",
  borderRadius: "8px",
  cursor: "pointer",
  fontWeight: "bold"
};

const statusBadge = {
  background: "#f59e0b",
  color: "#111827",
  padding: "4px 8px",
  borderRadius: "6px",
  fontWeight: "bold"
};

const timeButton = {
  width: "100%",
  padding: "12px",
  marginTop: "10px",
  background: "#0ea5e9",
  color: "white",
  border: "none",
  borderRadius: "8px",
  cursor: "pointer",
  fontWeight: "bold"
};

const stopButton = {
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

const disabledInfoButton = {
  width: "100%",
  padding: "12px",
  marginTop: "10px",
  background: "#374151",
  color: "white",
  border: "none",
  borderRadius: "8px",
  cursor: "not-allowed",
  fontWeight: "bold"
};

const finishClientButton = {
  width: "100%",
  padding: "12px",
  marginTop: "20px",
  background: "#dc2626",
  color: "white",
  border: "none",
  borderRadius: "8px",
  cursor: "pointer",
  fontWeight: "bold"
};

const centralWorkBox = {
  background: "#111827",
  padding: "14px",
  borderRadius: "12px",
  border: "1px solid #f59e0b",
  marginTop: "12px",
  marginBottom: "12px"
};

const vehicleCentralTimeBox = {
  background: "#111827",
  padding: "10px",
  borderRadius: "10px",
  border: "1px solid #f59e0b",
  marginTop: "10px"
};

const timeBox = {
  background: "#111827",
  padding: "12px",
  borderRadius: "10px",
  border: "1px solid #374151",
  marginTop: "10px"
};

const activeTimeBox = {
  background: "#052e16",
  padding: "12px",
  borderRadius: "10px",
  border: "1px solid #16a34a",
  marginTop: "10px"
};

const mechanicAssignBox = {
  background: "#111827",
  padding: "18px",
  borderRadius: "12px",
  border: "1px solid #374151",
  marginTop: "20px"
};

const assignedMechanicCard = {
  background: "#1f2937",
  padding: "12px",
  borderRadius: "10px",
  border: "1px solid #374151",
  marginTop: "10px"
};

const removeButton = {
  width: "100%",
  padding: "10px",
  marginTop: "10px",
  background: "#dc2626",
  color: "white",
  border: "none",
  borderRadius: "8px",
  cursor: "pointer",
  fontWeight: "bold"
};

const recalculateButton = {
  width: "100%",
  padding: "12px",
  marginTop: "15px",
  background: "#2563eb",
  color: "white",
  border: "none",
  borderRadius: "8px",
  cursor: "pointer",
  fontWeight: "bold"
};

const estimateBox = {
  background: "#111827",
  padding: "12px",
  borderRadius: "10px",
  border: "1px solid #f59e0b",
  marginTop: "10px"
};



const partsBox = {
  background: "#020617",
  padding: "14px",
  borderRadius: "12px",
  border: "1px solid #374151",
  marginBottom: "14px"
};

const partRowBox = {
  background: "#111827",
  padding: "12px",
  borderRadius: "10px",
  border: "1px solid #1f2937",
  marginBottom: "12px"
};

const partGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))",
  gap: "10px",
  alignItems: "center"
};

const partTotalBox = {
  background: "#f59e0b",
  color: "#111827",
  padding: "12px",
  borderRadius: "8px",
  fontWeight: "bold",
  textAlign: "center"
};

const estimateSummaryBox = {
  background: "#020617",
  padding: "12px",
  borderRadius: "10px",
  border: "1px solid #f59e0b",
  marginTop: "10px",
  marginBottom: "12px"
};

const estadoEstimadoStyle = (estado) => ({
  background:
    estado === "aprobado"
      ? "#16a34a"
      : estado === "rechazado"
      ? "#dc2626"
      : "#f59e0b",
  color: estado === "pendiente" || !estado ? "#111827" : "white",
  padding: "4px 8px",
  borderRadius: "6px",
  fontWeight: "bold"
});

const pdfButton = {
  width: "100%",
  padding: "10px",
  marginTop: "10px",
  background: "#2563eb",
  color: "white",
  border: "none",
  borderRadius: "8px",
  cursor: "pointer",
  fontWeight: "bold"
};

const approveButton = {
  width: "100%",
  padding: "10px",
  marginTop: "10px",
  background: "#16a34a",
  color: "white",
  border: "none",
  borderRadius: "8px",
  cursor: "pointer",
  fontWeight: "bold"
};

const rejectButton = {
  width: "100%",
  padding: "10px",
  marginTop: "10px",
  background: "#b91c1c",
  color: "white",
  border: "none",
  borderRadius: "8px",
  cursor: "pointer",
  fontWeight: "bold"
};

const orderHeroBox = {
  background: "linear-gradient(135deg, #92400e, #111827)",
  padding: "16px",
  borderRadius: "14px",
  border: "2px solid #f59e0b",
  marginBottom: "15px",
  color: "white",
  boxShadow: "0 10px 25px rgba(0,0,0,0.35)"
};

const orderHeroTop = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: "10px",
  flexWrap: "wrap"
};

const orderNumberStyle = {
  background: "#f59e0b",
  color: "#111827",
  padding: "8px 12px",
  borderRadius: "10px",
  fontWeight: "bold",
  fontSize: "18px"
};

const diagnosticStatusStyle = {
  background: "#16a34a",
  color: "white",
  padding: "7px 10px",
  borderRadius: "10px",
  fontWeight: "bold",
  fontSize: "14px"
};

const estadoTrabajoStyle = (estado, faseActual) => ({
  background:
    estado === "trabajando" || faseActual === "reparacion"
      ? "#2563eb"
      : estado === "esperando_piezas"
      ? "#f59e0b"
      : estado === "listo_para_entrega"
      ? "#16a34a"
      : estado === "finalizado"
      ? "#6b7280"
      : "#16a34a",
  color: estado === "esperando_piezas" ? "#111827" : "white",
  padding: "7px 10px",
  borderRadius: "10px",
  fontWeight: "bold",
  fontSize: "14px",
  display: "inline-block"
});

const orderBadgeBox = {
  background: "#111827",
  padding: "10px",
  borderRadius: "10px",
  border: "1px solid #f59e0b",
  marginBottom: "12px",
  color: "white"
};

const activeOrderSummaryBox = {
  background: "#052e16",
  padding: "12px",
  borderRadius: "10px",
  border: "1px solid #16a34a",
  marginTop: "12px",
  marginBottom: "10px",
  color: "white"
};

const emptyStyle = {
  background: "#1f2937",
  padding: "25px",
  borderRadius: "12px",
  border: "1px solid #374151"
};

export default Clientes;
