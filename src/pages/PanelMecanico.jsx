import { useEffect, useState } from "react";
import { supabase } from "../services/supabase";

const USUARIO_TALLER = "mecanicos";
const PASSWORD_TALLER = "0000";

const construirBusqueda = (vehiculo, pieza) => {
  return [
    pieza,
    vehiculo?.anio,
    vehiculo?.marca,
    vehiculo?.modelo,
    vehiculo?.motor,
    vehiculo?.trim
  ]
    .map((valor) => String(valor || "").trim())
    .filter(Boolean)
    .join(" ");
};

const tiendas = [
  {
    nombre: "AutoZone Pro",
    crearUrl: (vehiculo, pieza) =>
      `https://www.autozonepro.com/search?text=${encodeURIComponent(construirBusqueda(vehiculo, pieza))}`
  },
  {
    nombre: "O'Reilly Pro",
    crearUrl: (vehiculo, pieza) =>
      `https://www.oreillypro.com/search?q=${encodeURIComponent(construirBusqueda(vehiculo, pieza))}`
  },
  {
    nombre: "Advance Professional",
    crearUrl: (vehiculo, pieza) =>
      `https://shop.advanceautoparts.com/web/SearchResults?searchTerm=${encodeURIComponent(construirBusqueda(vehiculo, pieza))}`
  }
];

const estadosTrabajo = [
  { value: "diagnostico", label: "🔎 Diagnóstico" },
  { value: "estimado_pendiente", label: "📋 Estimado pendiente" },
  { value: "esperando_piezas", label: "📦 Esperando piezas" },
  { value: "piezas_ordenadas", label: "🚚 Piezas ordenadas" },
  { value: "piezas_recibidas", label: "📦 Piezas recibidas" },
  { value: "trabajando", label: "🔧 Trabajando" },
  { value: "listo_para_entrega", label: "✅ Listo para entrega" }
];

function PanelMecanico() {
  const [autorizado, setAutorizado] = useState(false);
  const [usuario, setUsuario] = useState("");
  const [password, setPassword] = useState("");
  const [buscandoVin, setBuscandoVin] = useState(false);
  const [escaneandoVin, setEscaneandoVin] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [piezaBuscar, setPiezaBuscar] = useState("");
  const [piezaBuscarTrabajo, setPiezaBuscarTrabajo] = useState("");
  const [mecanicos, setMecanicos] = useState([]);
  const [cargandoMecanicos, setCargandoMecanicos] = useState(false);
  const [trabajosActivos, setTrabajosActivos] = useState([]);
  const [cargandoTrabajos, setCargandoTrabajos] = useState(false);
  const [trabajoSeleccionado, setTrabajoSeleccionado] = useState(null);
  const [guardandoTrabajo, setGuardandoTrabajo] = useState(false);

  const [form, setForm] = useState({
    mecanico_nombre: "",
    mecanico_id: "",
    cliente_nombre: "",
    telefono_cliente: "",
    anio: "",
    marca: "",
    modelo: "",
    motor: "",
    trim: "",
    tipo_vehiculo: "",
    color: "",
    placa: "",
    vin: "",
    millaje: "",
    problema: "",
    notas_mecanico: ""
  });

  const [editForm, setEditForm] = useState({
    id: null,
    cliente_nombre: "",
    telefono_cliente: "",
    vehiculo: "",
    anio: "",
    marca: "",
    modelo: "",
    motor: "",
    trim: "",
    color: "",
    placa: "",
    vin: "",
    millaje: "",
    problema: "",
    resultado_diagnostico: "",
    notas_mecanico: "",
    estado: "diagnostico",
    costo_piezas: "",
    venta_piezas: "",
    mano_obra: "",
    estimado_mano_obra: "",
    estimado_piezas: []
  });

  const [piezaDraft, setPiezaDraft] = useState({
    nombre: "",
    cantidad: "1",
    nota: ""
  });

  useEffect(() => {
    cargarMecanicos();
  }, []);

  useEffect(() => {
    if (autorizado && form.mecanico_id) {
      cargarTrabajosMecanico(form.mecanico_id, form.mecanico_nombre);
    }
  }, [autorizado, form.mecanico_id, form.mecanico_nombre]);

  useEffect(() => {
    if (!autorizado || (!form.mecanico_id && !form.mecanico_nombre)) return;

    const channel = supabase
      .channel(`panel-mecanico-trabajos-${form.mecanico_id || form.mecanico_nombre}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "trabajos_mecanicos" },
        () => cargarTrabajosMecanico(form.mecanico_id, form.mecanico_nombre)
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [autorizado, form.mecanico_id, form.mecanico_nombre]);

  const cargarMecanicos = async () => {
    setCargandoMecanicos(true);

    const { data, error } = await supabase
      .from("mecanicos")
      .select("*")
      .eq("activo", true)
      .order("nombre", { ascending: true });

    if (error) {
      console.log(error);
      alert("Error cargando mecánicos registrados.");
      setMecanicos([]);
      setCargandoMecanicos(false);
      return;
    }

    setMecanicos(data || []);
    setCargandoMecanicos(false);
  };

  const cargarTrabajosMecanico = async (mecanicoId = form.mecanico_id, mecanicoNombre = form.mecanico_nombre) => {
    if (!mecanicoId && !mecanicoNombre) {
      setTrabajosActivos([]);
      return;
    }

    setCargandoTrabajos(true);

    const { data, error } = await supabase
      .from("trabajos_mecanicos")
      .select("*")
      .order("id", { ascending: false });

    if (error) {
      console.log(error);
      alert("Error cargando trabajos activos del mecánico.");
      setTrabajosActivos([]);
      setCargandoTrabajos(false);
      return;
    }

    const lista = (data || []).filter((trabajo) => {
      const mismoId = mecanicoId && String(trabajo.mecanico_id || "") === String(mecanicoId);
      const mismoNombre = mecanicoNombre && String(trabajo.mecanico_nombre || trabajo.creado_por || "").toLowerCase() === String(mecanicoNombre).toLowerCase();
      const activo = !["finalizado", "Finalizado", "Terminado", "Entregado", "Cancelado"].includes(trabajo.estado || "");
      return activo && (mismoId || mismoNombre);
    });

    setTrabajosActivos(lista);
    setCargandoTrabajos(false);
  };

  const actualizarCampo = (campo, valor) => {
    setForm((prev) => ({ ...prev, [campo]: valor }));
  };

  const seleccionarMecanico = (mecanicoId) => {
    const mecanico = mecanicos.find((item) => String(item.id) === String(mecanicoId));

    setForm((prev) => ({
      ...prev,
      mecanico_id: mecanico ? String(mecanico.id) : "",
      mecanico_nombre: mecanico?.nombre || ""
    }));

    setTrabajoSeleccionado(null);
  };

  const limpiarTexto = (valor) => String(valor || "").trim();
  const dinero = (valor) => `$${Number(valor || 0).toFixed(2)}`;

  const enviarPush = async ({ titulo, mensaje, url = "/" }) => {
    try {
      const respuesta = await fetch("/api/enviar-push", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ titulo, mensaje, url })
      });

      if (!respuesta.ok) {
        const resultado = await respuesta.json().catch(() => null);
        console.log("Push no enviado:", resultado);
      }
    } catch (error) {
      console.log("Error enviando push:", error);
    }
  };

  const crearNotificacionAdmin = async ({ titulo, mensaje, url = "/admin", tipo = "piezas" }) => {
    try {
      await supabase.from("notificaciones").insert([
        {
          titulo,
          mensaje,
          tipo,
          url,
          leida: false,
          creado_en: new Date().toISOString()
        }
      ]);
    } catch (error) {
      console.log("No se pudo guardar notificación en dashboard:", error);
    }
  };

  const notificarAdmin = async ({ titulo, mensaje, url = "/admin", tipo = "piezas" }) => {
    await crearNotificacionAdmin({ titulo, mensaje, url, tipo });
    await enviarPush({ titulo, mensaje, url });
  };

  const obtenerBasePublicaApp = () => {
    const origenActual = window.location.origin;
    if (origenActual.includes("localhost") || origenActual.includes("127.0.0.1")) {
      return "https://pc-motors-admin-app.vercel.app";
    }
    return origenActual;
  };

  const construirLinkEstadoTrabajo = (trabajo) => {
    if (!trabajo?.id) return "";
    return `${obtenerBasePublicaApp()}/estado-trabajo/${trabajo.id}`;
  };

  const enviarLinkEstadoCliente = (trabajo) => {
    if (!trabajo?.id) {
      alert("Este trabajo no tiene ID válido para crear el link.");
      return;
    }

    const telefono = String(
      trabajo.telefono_cliente ||
      trabajo.cliente_telefono ||
      editForm.telefono_cliente ||
      ""
    ).replace(/\D/g, "");

    const link = construirLinkEstadoTrabajo(trabajo);
    const mensaje = encodeURIComponent(
      `Hola ${trabajo.cliente_nombre || editForm.cliente_nombre || "cliente"}, PC Motors te comparte el link para revisar el estado de tu vehículo: ${link}`
    );

    const url = telefono
      ? `sms:${telefono}?&body=${mensaje}`
      : `sms:?&body=${mensaje}`;

    window.location.href = url;
  };

  const parsearJsonArray = (valor) => {
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
    id: pieza.id || `${Date.now()}-pieza-${index}`,
    nombre: String(pieza.nombre || pieza.name || "").trim(),
    cantidad: Number(pieza.cantidad || pieza.qty || 1),
    nota: String(pieza.nota || pieza.notas || "").trim(),
    solicitado_por: pieza.solicitado_por || pieza.mecanico_nombre || form.mecanico_nombre || "",
    solicitado_por_id: pieza.solicitado_por_id || pieza.mecanico_id || form.mecanico_id || null,
    solicitado_en: pieza.solicitado_en || new Date().toISOString(),
    estado_pedido: pieza.estado_pedido || pieza.estado || "solicitada",
    actualizado_en: pieza.actualizado_en || null,

    // El mecánico no captura ni ve precios. Estos campos se conservan para que el admin pueda completarlos.
    costo: Number(pieza.costo ?? pieza.costo_real ?? 0),
    costo_real: Number(pieza.costo_real ?? pieza.costo ?? 0),
    venta: Number(pieza.venta ?? pieza.precio_venta ?? pieza.precio_cliente ?? 0),
    precio_venta: Number(pieza.precio_venta ?? pieza.venta ?? pieza.precio_cliente ?? 0),
    precio_cliente: Number(pieza.precio_cliente ?? pieza.venta ?? pieza.precio_venta ?? 0),
    precio_normal: Number(pieza.precio_normal ?? pieza.precio_regular ?? 0),
    visible_mecanico: true
  });

  const calcularTotalPiezasCosto = (piezas) =>
    (piezas || []).reduce((total, pieza) => total + Number(pieza.costo || pieza.costo_real || 0) * Number(pieza.cantidad || 1), 0);

  const calcularTotalPiezasVenta = (piezas) =>
    (piezas || []).reduce((total, pieza) => total + Number(pieza.venta || pieza.precio_venta || pieza.precio_cliente || 0) * Number(pieza.cantidad || 1), 0);

  const buscarVin = async () => {
    await buscarVinPorValor(form.vin, "form");
  };

  const buscarVinEdit = async () => {
    await buscarVinPorValor(editForm.vin, "edit");
  };

  const aplicarDatosVin = (vin, data, destino = "form") => {
    const actualizador = destino === "edit" ? setEditForm : setForm;

    actualizador((prev) => ({
      ...prev,
      vin,
      anio: data?.ModelYear || prev.anio,
      marca: data?.Make || prev.marca,
      modelo: data?.Model || prev.modelo,
      motor:
        data?.EngineModel ||
        data?.EngineConfiguration ||
        data?.DisplacementL ||
        prev.motor,
      trim: data?.Trim || data?.Series || prev.trim,
      tipo_vehiculo: data?.VehicleType || prev.tipo_vehiculo
    }));
  };

  const buscarVinPorValor = async (vinValor, destino = "form") => {
    const vin = limpiarTexto(vinValor).toUpperCase();

    if (vin.length < 11) {
      alert("No se detectó un VIN válido. Si la cámara no lo lee, escríbelo manualmente.");
      return;
    }

    setBuscandoVin(true);

    try {
      const url = `https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVinValuesExtended/${encodeURIComponent(vin)}?format=json`;
      const respuesta = await fetch(url);
      const json = await respuesta.json();
      const data = json?.Results?.[0];

      if (!data) {
        alert("No se encontraron datos para ese VIN.");
        setBuscandoVin(false);
        return;
      }

      aplicarDatosVin(vin, data, destino);
      alert("Datos del vehículo completados por VIN.");
    } catch (error) {
      console.log(error);
      alert("Error buscando el VIN. Revisa internet o intenta otra vez.");
    }

    setBuscandoVin(false);
  };

  const escanearVinDesdeImagen = async (archivo, destino = "form") => {
    if (!archivo) return;

    if (!("BarcodeDetector" in window)) {
      alert("Este navegador no permite escanear VIN automáticamente. Toma la foto y escribe el VIN manualmente.");
      return;
    }

    setEscaneandoVin(true);

    try {
      const formatos = ["code_39", "code_128", "qr_code", "data_matrix"];
      const detector = new window.BarcodeDetector({ formats: formatos });
      const bitmap = await createImageBitmap(archivo);
      const codigos = await detector.detect(bitmap);
      const textoDetectado = String(codigos?.[0]?.rawValue || "").toUpperCase();
      const vin = (textoDetectado.match(/[A-HJ-NPR-Z0-9]{17}/) || [textoDetectado])[0];

      if (!vin || vin.length < 11) {
        alert("No pude leer el VIN de la imagen. Intenta con mejor luz o escríbelo manualmente.");
        setEscaneandoVin(false);
        return;
      }

      await buscarVinPorValor(vin, destino);
    } catch (error) {
      console.log("Error escaneando VIN:", error);
      alert("No se pudo escanear el VIN. Escríbelo manualmente o intenta otra foto.");
    }

    setEscaneandoVin(false);
  };

  const buscarPiezaEnTienda = (vehiculo, pieza) => {
    if (!vehiculo?.anio || !vehiculo?.marca || !vehiculo?.modelo) {
      alert("Primero completa año, marca y modelo del vehículo.");
      return;
    }

    if (!pieza.trim()) {
      alert("Escribe la pieza que quieres buscar.");
      return;
    }

    return true;
  };

  const abrirTiendaConBusqueda = async (tienda, vehiculo, pieza) => {
    if (!buscarPiezaEnTienda(vehiculo, pieza)) return;

    const busqueda = construirBusqueda(vehiculo, pieza);

    try {
      await navigator.clipboard.writeText(busqueda);
    } catch (error) {
      console.log("No se pudo copiar la búsqueda automáticamente:", error);
    }

    const urlsTiendas = {
      "AutoZone Pro": "https://www.autozonepro.com",
      "O'Reilly Pro": "https://www.oreillypro.com",
      "Advance Professional": "https://my.advancepro.com"
    };

    window.open(
      urlsTiendas[tienda.nombre] || tienda.crearUrl(vehiculo, pieza),
      "_blank",
      "noopener,noreferrer"
    );

    alert(
      `Búsqueda copiada:

${busqueda}

Pega con CTRL + V dentro de la tienda para buscar la pieza.`
    );
  };

  const crearTrabajo = async () => {
    const cliente = limpiarTexto(form.cliente_nombre);
    const telefonoCliente = limpiarTexto(form.telefono_cliente);
    const mecanico = limpiarTexto(form.mecanico_nombre);
    const problema = limpiarTexto(form.problema);

    if (!form.mecanico_id || !mecanico) {
      alert("Selecciona un mecánico registrado.");
      return;
    }

    if (!cliente || !problema) {
      alert("Falta nombre del cliente o problema del vehículo.");
      return;
    }

    if (!limpiarTexto(form.vin) && !limpiarTexto(form.placa)) {
      alert("Debes poner VIN o placa del vehículo.");
      return;
    }

    const confirmar = confirm(
      `¿Crear cliente, vehículo, orden y trabajo para este vehículo?\n\nCliente: ${cliente}\nVehículo: ${form.anio} ${form.marca} ${form.modelo}\nMecánico: ${mecanico}`
    );

    if (!confirmar) return;

    setGuardando(true);

    const vehiculoTexto = `${form.anio || ""} ${form.marca || ""} ${form.modelo || ""}`.trim() || "Vehículo sin datos";
    const ahora = new Date().toISOString();

    let clienteCreado = null;
    let vehiculoCreado = null;
    let ordenCreada = null;

    const limpiarCreacionParcial = async () => {
      if (ordenCreada?.id) await supabase.from("ordenes_trabajo").delete().eq("id", ordenCreada.id);
      if (vehiculoCreado?.id) await supabase.from("vehiculos").delete().eq("id", vehiculoCreado.id);
      if (clienteCreado?.id) await supabase.from("clientes").delete().eq("id", clienteCreado.id);
    };

    const { data: clienteData, error: errorCliente } = await supabase
      .from("clientes")
      .insert([
        {
          nombre: cliente,
          telefono: telefonoCliente || null,
          estado: "activo",
          archivado: false,
          notas: `Creado desde Panel Mecánico por ${mecanico}.`
        }
      ])
      .select()
      .single();

    if (errorCliente) {
      console.log("Error creando cliente desde panel mecánico:", errorCliente);
      alert(JSON.stringify(errorCliente, null, 2));
      setGuardando(false);
      return;
    }

    clienteCreado = clienteData;

    const vehiculoPayload = {
      cliente_id: clienteCreado.id,
      anio: limpiarTexto(form.anio) || null,
      marca: limpiarTexto(form.marca) || null,
      modelo: limpiarTexto(form.modelo) || null,
      color: limpiarTexto(form.color) || null,
      placa: limpiarTexto(form.placa).toUpperCase() || null,
      vin: limpiarTexto(form.vin).toUpperCase() || null,
      millaje: limpiarTexto(form.millaje) || null,
      notas: `${vehiculoTexto}${limpiarTexto(form.motor) ? ` / Motor: ${limpiarTexto(form.motor)}` : ""}${limpiarTexto(form.trim) ? ` / Trim: ${limpiarTexto(form.trim)}` : ""}`
    };

    const { data: vehiculoData, error: errorVehiculo } = await supabase
      .from("vehiculos")
      .insert([vehiculoPayload])
      .select()
      .single();

    if (errorVehiculo) {
      console.log("Error creando vehículo desde panel mecánico:", errorVehiculo);
      await limpiarCreacionParcial();
      alert(JSON.stringify(errorVehiculo, null, 2));
      setGuardando(false);
      return;
    }

    vehiculoCreado = vehiculoData;

    const { data: ordenData, error: errorOrden } = await supabase
      .from("ordenes_trabajo")
      .insert([
        {
          cliente_id: clienteCreado.id,
          vehiculo_id: vehiculoCreado.id,
          diagnostico: problema,
          mecanico,
          estado: "Diagnosticando",
          prioridad: "normal",
          notas: `Orden creada desde Panel Mecánico por ${mecanico}.`
        }
      ])
      .select()
      .single();

    if (errorOrden) {
      console.log("Error creando orden desde panel mecánico:", errorOrden);
      await limpiarCreacionParcial();
      alert(JSON.stringify(errorOrden, null, 2));
      setGuardando(false);
      return;
    }

    ordenCreada = ordenData;

    const nuevoTrabajo = {
      mecanico_id: form.mecanico_id,
      cliente_nombre: cliente,
      cliente_telefono: telefonoCliente || null,
      telefono_cliente: telefonoCliente || null,
      mecanico_nombre: mecanico,
      vehiculo: vehiculoTexto,
      anio: limpiarTexto(form.anio),
      marca: limpiarTexto(form.marca),
      modelo: limpiarTexto(form.modelo),
      motor: limpiarTexto(form.motor),
      trim: limpiarTexto(form.trim),
      tipo_vehiculo: limpiarTexto(form.tipo_vehiculo),
      color: limpiarTexto(form.color),
      placa: limpiarTexto(form.placa).toUpperCase(),
      vin: limpiarTexto(form.vin).toUpperCase(),
      millaje: limpiarTexto(form.millaje),
      problema,
      trabajo: problema,
      descripcion_trabajo: problema,
      notas_mecanico: limpiarTexto(form.notas_mecanico),
      notas: limpiarTexto(form.notas_mecanico) || `Trabajo creado desde Panel Mecánico por ${mecanico}.`,
      estado: "diagnostico",
      fase_actual: "diagnostico",
      origen: "panel_mecanico",
      creado_por: mecanico,
      hora_inicio: ahora,
      diagnostico_inicio: ahora,
      diagnostico_minutos: 0,
      reparacion_minutos: 0,
      costo_piezas: 0,
      venta_piezas: 0,
      mano_obra: 0,
      estimado_mano_obra: 0,
      estimado_piezas: [],
      cliente_id: clienteCreado.id,
      vehiculo_id: vehiculoCreado.id,
      orden_id: ordenCreada.id,
      solicitud_id: null
    };

    let { data, error } = await supabase
      .from("trabajos_mecanicos")
      .insert([nuevoTrabajo])
      .select()
      .single();

    if (error) {
      const mensajeError = `${error.message || ""} ${error.details || ""}`.toLowerCase();

      if (
        mensajeError.includes("cliente_telefono") ||
        mensajeError.includes("telefono_cliente") ||
        mensajeError.includes("problema") ||
        mensajeError.includes("descripcion_trabajo") ||
        mensajeError.includes("anio") ||
        mensajeError.includes("marca") ||
        mensajeError.includes("modelo") ||
        mensajeError.includes("motor") ||
        mensajeError.includes("trim") ||
        mensajeError.includes("tipo_vehiculo") ||
        mensajeError.includes("color") ||
        mensajeError.includes("placa") ||
        mensajeError.includes("vin") ||
        mensajeError.includes("millaje") ||
        mensajeError.includes("estimado_mano_obra") ||
        mensajeError.includes("estimado_piezas")
      ) {
        const trabajoBasico = { ...nuevoTrabajo };
        delete trabajoBasico.cliente_telefono;
        delete trabajoBasico.telefono_cliente;
        delete trabajoBasico.problema;
        delete trabajoBasico.descripcion_trabajo;
        delete trabajoBasico.anio;
        delete trabajoBasico.marca;
        delete trabajoBasico.modelo;
        delete trabajoBasico.motor;
        delete trabajoBasico.trim;
        delete trabajoBasico.tipo_vehiculo;
        delete trabajoBasico.color;
        delete trabajoBasico.placa;
        delete trabajoBasico.vin;
        delete trabajoBasico.millaje;
        delete trabajoBasico.estimado_mano_obra;
        delete trabajoBasico.estimado_piezas;

        const segundoIntento = await supabase
          .from("trabajos_mecanicos")
          .insert([trabajoBasico])
          .select()
          .single();

        data = segundoIntento.data;
        error = segundoIntento.error;
      }
    }

    if (error) {
      console.log(error);
      await limpiarCreacionParcial();
      alert(JSON.stringify(error, null, 2));
      setGuardando(false);
      return;
    }

    await notificarAdmin({
      titulo: "🚘 Vehículo registrado por mecánico",
      mensaje: `${vehiculoTexto || "Vehículo"} - ${cliente} / Mecánico: ${mecanico}`,
      url: "/admin",
      tipo: "trabajo"
    });

    alert(
      "Trabajo creado correctamente.\n\n" +
      `Cliente #${clienteCreado.id}\nVehículo #${vehiculoCreado.id}\nOrden #${ordenCreada.id}\nTrabajo #${data?.id || ""}\n\n` +
      "Ahora aparece en tus trabajos activos, Clientes Activos y Control Trabajos."
    );

    setForm({
      mecanico_nombre: form.mecanico_nombre,
      mecanico_id: form.mecanico_id,
      cliente_nombre: "",
      telefono_cliente: "",
      anio: "",
      marca: "",
      modelo: "",
      motor: "",
      trim: "",
      tipo_vehiculo: "",
      color: "",
      placa: "",
      vin: "",
      millaje: "",
      problema: "",
      notas_mecanico: ""
    });
    setPiezaBuscar("");
    setGuardando(false);
    await cargarTrabajosMecanico(form.mecanico_id, form.mecanico_nombre);
    if (data) abrirTrabajo(data);
  };

  const abrirTrabajo = (trabajo) => {
    const piezas = parsearJsonArray(trabajo.estimado_piezas).map(normalizarPieza);

    setTrabajoSeleccionado(trabajo);
    setEditForm({
      id: trabajo.id,
      cliente_nombre: trabajo.cliente_nombre || "",
      telefono_cliente: trabajo.telefono_cliente || trabajo.cliente_telefono || "",
      vehiculo: trabajo.vehiculo || "",
      anio: trabajo.anio || "",
      marca: trabajo.marca || "",
      modelo: trabajo.modelo || "",
      motor: trabajo.motor || "",
      trim: trabajo.trim || "",
      color: trabajo.color || "",
      placa: trabajo.placa || "",
      vin: trabajo.vin || "",
      millaje: trabajo.millaje || "",
      problema: trabajo.problema || trabajo.trabajo || trabajo.descripcion_trabajo || "",
      resultado_diagnostico: trabajo.resultado_diagnostico || "",
      notas_mecanico: trabajo.notas_mecanico || trabajo.notas || "",
      estado: trabajo.estado || "diagnostico",
      costo_piezas: String(trabajo.costo_piezas || calcularTotalPiezasCosto(piezas) || ""),
      venta_piezas: String(trabajo.venta_piezas || calcularTotalPiezasVenta(piezas) || ""),
      mano_obra: String(trabajo.mano_obra || trabajo.estimado_mano_obra || ""),
      estimado_mano_obra: String(trabajo.estimado_mano_obra || trabajo.mano_obra || ""),
      estimado_piezas: piezas
    });
    setPiezaBuscarTrabajo("");
  };

  const agregarPieza = () => {
    const nombre = limpiarTexto(piezaDraft.nombre);
    if (!nombre) {
      alert("Escribe el nombre de la pieza.");
      return;
    }

    const nuevaPieza = normalizarPieza({
      id: `${Date.now()}-pieza-panel`,
      nombre,
      cantidad: Number(piezaDraft.cantidad || 1),
      nota: limpiarTexto(piezaDraft.nota),
      estado_pedido: "solicitada",
      solicitado_por: form.mecanico_nombre,
      solicitado_por_id: form.mecanico_id,
      solicitado_en: new Date().toISOString(),
      costo: 0,
      costo_real: 0,
      venta: 0,
      precio_venta: 0,
      precio_cliente: 0,
      precio_normal: 0,
      visible_mecanico: true
    });

    setEditForm((prev) => {
      const piezas = [...(prev.estimado_piezas || []), nuevaPieza];
      return {
        ...prev,
        estimado_piezas: piezas,
        costo_piezas: String(calcularTotalPiezasCosto(piezas)),
        venta_piezas: String(calcularTotalPiezasVenta(piezas))
      };
    });

    setPiezaDraft({ nombre: "", cantidad: "1", nota: "" });
  };

  const actualizarPieza = (index, campo, valor) => {
    setEditForm((prev) => {
      const piezas = [...(prev.estimado_piezas || [])];
      const piezaActual = piezas[index] || {};

      piezas[index] = normalizarPieza({
        ...piezaActual,
        [campo]: campo === "cantidad" ? Number(valor || 1) : valor
      }, index);

      return {
        ...prev,
        estimado_piezas: piezas,
        costo_piezas: String(calcularTotalPiezasCosto(piezas)),
        venta_piezas: String(calcularTotalPiezasVenta(piezas))
      };
    });
  };

  const eliminarPieza = (index) => {
    setEditForm((prev) => {
      const piezas = [...(prev.estimado_piezas || [])];
      piezas.splice(index, 1);

      return {
        ...prev,
        estimado_piezas: piezas,
        costo_piezas: String(calcularTotalPiezasCosto(piezas)),
        venta_piezas: String(calcularTotalPiezasVenta(piezas))
      };
    });
  };

  const valorNoVacio = (nuevo, anterior = "") => {
    const texto = limpiarTexto(nuevo);
    return texto || anterior || "";
  };

  const sincronizarRelacionesTrabajo = async (trabajoBase, datos) => {
    try {
      if (trabajoBase?.cliente_id) {
        await supabase
          .from("clientes")
          .update({
            nombre: datos.cliente_nombre || trabajoBase.cliente_nombre || null,
            telefono: datos.telefono_cliente || trabajoBase.telefono_cliente || trabajoBase.cliente_telefono || null,
            estado: "activo"
          })
          .eq("id", trabajoBase.cliente_id);
      }

      if (trabajoBase?.vehiculo_id) {
        await supabase
          .from("vehiculos")
          .update({
            anio: datos.anio || null,
            marca: datos.marca || null,
            modelo: datos.modelo || null,
            color: datos.color || null,
            placa: datos.placa || null,
            vin: datos.vin || null,
            millaje: datos.millaje || null,
            notas: `${datos.vehiculo || ""}${datos.motor ? ` / Motor: ${datos.motor}` : ""}${datos.trim ? ` / Trim: ${datos.trim}` : ""}`.trim() || null
          })
          .eq("id", trabajoBase.vehiculo_id);
      }

      if (trabajoBase?.orden_id) {
        await supabase
          .from("ordenes_trabajo")
          .update({
            diagnostico: datos.problema || datos.trabajo || null,
            estado: datos.estado || "Diagnosticando",
            notas: datos.notas_mecanico || datos.notas || null
          })
          .eq("id", trabajoBase.orden_id);
      }
    } catch (error) {
      console.log("No se pudieron sincronizar cliente/vehículo/orden:", error);
    }
  };

  const guardarTrabajoActivo = async () => {
    if (!trabajoSeleccionado?.id) return;

    const problema = limpiarTexto(editForm.problema);
    if (!problema) {
      alert("El problema/trabajo no puede quedar vacío.");
      return;
    }

    setGuardandoTrabajo(true);

    const anioFinal = valorNoVacio(editForm.anio, trabajoSeleccionado.anio);
    const marcaFinal = valorNoVacio(editForm.marca, trabajoSeleccionado.marca);
    const modeloFinal = valorNoVacio(editForm.modelo, trabajoSeleccionado.modelo);
    const vehiculoTexto = limpiarTexto(editForm.vehiculo) || limpiarTexto(trabajoSeleccionado.vehiculo) || `${anioFinal || ""} ${marcaFinal || ""} ${modeloFinal || ""}`.trim();
    const piezas = (editForm.estimado_piezas || []).map(normalizarPieza).filter((pieza) => pieza.nombre);
    const costoPiezas = calcularTotalPiezasCosto(piezas);
    const ventaPiezas = calcularTotalPiezasVenta(piezas);
    const manoObra = Number(trabajoSeleccionado.mano_obra || trabajoSeleccionado.estimado_mano_obra || 0);

    const updateData = {
      cliente_nombre: valorNoVacio(editForm.cliente_nombre, trabajoSeleccionado.cliente_nombre) || null,
      telefono_cliente: valorNoVacio(editForm.telefono_cliente, trabajoSeleccionado.telefono_cliente || trabajoSeleccionado.cliente_telefono) || null,
      vehiculo: vehiculoTexto || null,
      anio: anioFinal,
      marca: marcaFinal,
      modelo: modeloFinal,
      motor: valorNoVacio(editForm.motor, trabajoSeleccionado.motor),
      trim: valorNoVacio(editForm.trim, trabajoSeleccionado.trim),
      color: valorNoVacio(editForm.color, trabajoSeleccionado.color),
      placa: valorNoVacio(editForm.placa, trabajoSeleccionado.placa).toUpperCase(),
      vin: valorNoVacio(editForm.vin, trabajoSeleccionado.vin).toUpperCase(),
      millaje: valorNoVacio(editForm.millaje, trabajoSeleccionado.millaje),
      problema,
      trabajo: problema,
      descripcion_trabajo: problema,
      resultado_diagnostico: limpiarTexto(editForm.resultado_diagnostico) || null,
      notas_mecanico: limpiarTexto(editForm.notas_mecanico) || null,
      notas: limpiarTexto(editForm.notas_mecanico) || null,
      estado: editForm.estado || "diagnostico",
      fase_actual: editForm.estado || "diagnostico",
      estimado_piezas: piezas,
      estimado_mano_obra: trabajoSeleccionado.estimado_mano_obra || manoObra,
      costo_piezas: costoPiezas,
      venta_piezas: ventaPiezas,
      mano_obra: trabajoSeleccionado.mano_obra || manoObra,
      estimado_estado: piezas.length > 0 ? (trabajoSeleccionado.estimado_estado || "sin_estimado") : (trabajoSeleccionado.estimado_estado || "sin_estimado"),
      solicitud_piezas_estado: piezas.some((pieza) => String(pieza.estado_pedido || "").toLowerCase() === "solicitada") ? "solicitada" : trabajoSeleccionado.solicitud_piezas_estado
    };

    let { error } = await supabase
      .from("trabajos_mecanicos")
      .update(updateData)
      .eq("id", trabajoSeleccionado.id);

    if (error) {
      const mensaje = `${error.message || ""} ${error.details || ""}`.toLowerCase();
      if (mensaje.includes("estimado_piezas") || mensaje.includes("estimado_mano_obra") || mensaje.includes("estimado_estado")) {
        const updateSinEstimado = { ...updateData };
        delete updateSinEstimado.estimado_piezas;
        delete updateSinEstimado.estimado_mano_obra;
        delete updateSinEstimado.estimado_estado;
        const segundoIntento = await supabase
          .from("trabajos_mecanicos")
          .update(updateSinEstimado)
          .eq("id", trabajoSeleccionado.id);
        error = segundoIntento.error;
      }
    }

    if (error) {
      console.log(error);
      alert(JSON.stringify(error, null, 2));
      setGuardandoTrabajo(false);
      return;
    }

    await sincronizarRelacionesTrabajo(trabajoSeleccionado, updateData);

    const piezasAnteriores = parsearJsonArray(trabajoSeleccionado.estimado_piezas)
      .map(normalizarPieza)
      .filter((pieza) => pieza.nombre);

    const nombresAnteriores = new Set(
      piezasAnteriores.map((pieza) => String(pieza.nombre || "").trim().toLowerCase())
    );

    const piezasNuevas = piezas.filter((pieza) => {
      const nombre = String(pieza.nombre || "").trim().toLowerCase();
      return nombre && !nombresAnteriores.has(nombre);
    });

    if (piezasNuevas.length > 0) {
      const listaPiezas = piezasNuevas
        .slice(0, 4)
        .map((pieza) => `${pieza.nombre} x${pieza.cantidad || 1}`)
        .join(", ");

      await notificarAdmin({
        titulo: "🔧 Solicitud de piezas",
        mensaje: `${form.mecanico_nombre || "Mecánico"} solicitó: ${listaPiezas} / ${editForm.cliente_nombre || "Cliente"}`,
        url: "/admin",
        tipo: "piezas"
      });
    }

    alert("Trabajo actualizado correctamente. El administrador ya puede verlo en Control Trabajos.");
    setGuardandoTrabajo(false);
    await cargarTrabajosMecanico(form.mecanico_id, form.mecanico_nombre);

    setTrabajoSeleccionado((prev) => prev ? { ...prev, ...updateData } : prev);
  };

  const vehiculoListo = form.anio && form.marca && form.modelo;
  const vehiculoEditListo = editForm.anio && editForm.marca && editForm.modelo;

  if (!autorizado) {
    return (
      <div style={pageBox}>
        <div style={loginCard}>
          <h1 style={titleStyle}>🔐 Panel Mecánico</h1>
          <p style={subtitleStyle}>
            Acceso privado para mecánicos de PC Motors.
          </p>

          <label style={labelStyle}>
            Usuario
            <input
              type="text"
              placeholder="mecanicos"
              value={usuario}
              onChange={(e) => setUsuario(e.target.value)}
              style={inputStyle}
              autoComplete="username"
            />
          </label>

          <label style={labelStyleFull}>
            Contraseña
            <input
              type="password"
              placeholder="0000"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={inputStyle}
              autoComplete="current-password"
            />
          </label>

          <button
            onClick={() => {
              const usuarioCorrecto = usuario.trim().toLowerCase() === USUARIO_TALLER;
              const passwordCorrecto = password.trim() === PASSWORD_TALLER;

              if (usuarioCorrecto && passwordCorrecto) {
                setAutorizado(true);
                return;
              }

              alert("Usuario o contraseña incorrectos.");
            }}
            style={primaryButton}
          >
            🔧 Entrar al panel mecánico
          </button>

          <button
            onClick={() => {
              window.location.href = "/";
            }}
            style={cancelButton}
          >
            ⬅ Volver al inicio
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={pageBox}>
      <h1 style={titleStyle}>🛠 Panel Mecánico</h1>
      <p style={subtitleStyle}>Crear y actualizar trabajos por VIN o placa. Todo aparece en el sistema principal del administrador.</p>

      <div style={sectionBox}>
        <h2 style={sectionTitle}>Mecánico activo</h2>
        <label style={labelStyle}>
          Mecánico registrado
          <select
            value={form.mecanico_id}
            onChange={(e) => seleccionarMecanico(e.target.value)}
            style={inputStyle}
            disabled={cargandoMecanicos}
          >
            <option value="">
              {cargandoMecanicos ? "Cargando mecánicos..." : "Seleccione un mecánico"}
            </option>
            {mecanicos.map((mecanico) => (
              <option key={mecanico.id} value={mecanico.id}>
                {mecanico.nombre}
              </option>
            ))}
          </select>
        </label>
      </div>

      {form.mecanico_id && (
        <div style={sectionBox}>
          <h2 style={sectionTitle}>📋 Mis trabajos activos</h2>
          <button onClick={() => cargarTrabajosMecanico()} style={blueButton} disabled={cargandoTrabajos}>
            {cargandoTrabajos ? "Cargando..." : "🔄 Actualizar trabajos"}
          </button>

          {cargandoTrabajos ? (
            <p style={subtitleStyle}>Cargando trabajos...</p>
          ) : trabajosActivos.length === 0 ? (
            <div style={emptyStyle}>No tienes trabajos activos en este momento.</div>
          ) : (
            <div style={jobListBox}>
              {trabajosActivos.map((trabajo) => (
                <div key={trabajo.id} style={jobCardStyle}>
                  <div>
                    <strong style={{ color: "#f59e0b" }}>{trabajo.cliente_nombre || "Cliente no registrado"}</strong>
                    <p style={compactText}>{trabajo.vehiculo || `${trabajo.anio || ""} ${trabajo.marca || ""} ${trabajo.modelo || ""}`.trim() || "Vehículo no registrado"}</p>
                    <p style={compactText}>Estado: {trabajo.estado || "diagnostico"}</p>
                    {trabajo.placa && <p style={compactText}>Placa: {trabajo.placa}</p>}
                    {trabajo.vin && <p style={compactText}>VIN: {trabajo.vin}</p>}
                  </div>
                  <button onClick={() => abrirTrabajo(trabajo)} style={editButton}>✏️ Abrir / editar</button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {trabajoSeleccionado && (
        <div style={sectionBox}>
          <h2 style={sectionTitle}>✏️ Editar trabajo activo</h2>
          <p style={subtitleStyle}>Trabajo #{trabajoSeleccionado.id} — los cambios se reflejan en Control Trabajos del administrador.</p>

          <div style={gridStyle}>
            <Input label="Cliente" value={editForm.cliente_nombre} onChange={(v) => setEditForm({ ...editForm, cliente_nombre: v })} />
            <Input label="Teléfono cliente" value={editForm.telefono_cliente} onChange={(v) => setEditForm({ ...editForm, telefono_cliente: v })} />
            <Input label="Vehículo" value={editForm.vehiculo} onChange={(v) => setEditForm({ ...editForm, vehiculo: v })} />
            <Input label="Año" value={editForm.anio} onChange={(v) => setEditForm({ ...editForm, anio: v })} />
            <Input label="Marca" value={editForm.marca} onChange={(v) => setEditForm({ ...editForm, marca: v })} />
            <Input label="Modelo" value={editForm.modelo} onChange={(v) => setEditForm({ ...editForm, modelo: v })} />
            <Input label="Motor" value={editForm.motor} onChange={(v) => setEditForm({ ...editForm, motor: v })} />
            <Input label="Trim / versión" value={editForm.trim} onChange={(v) => setEditForm({ ...editForm, trim: v })} />
            <Input label="Color" value={editForm.color} onChange={(v) => setEditForm({ ...editForm, color: v })} />
            <Input label="Placa" value={editForm.placa} onChange={(v) => setEditForm({ ...editForm, placa: v.toUpperCase() })} />
            <Input label="VIN" value={editForm.vin} onChange={(v) => setEditForm({ ...editForm, vin: v.toUpperCase() })} />
            <label style={labelStyle}>
              Escanear VIN con cámara
              <input type="file" accept="image/*" capture="environment" onChange={(e) => escanearVinDesdeImagen(e.target.files?.[0], "edit")} style={inputStyle} />
            </label>
            <button onClick={buscarVinEdit} style={blueButton} disabled={buscandoVin || escaneandoVin}>
              {buscandoVin || escaneandoVin ? "Procesando VIN..." : "🔎 Rellenar por VIN"}
            </button>
            <Input label="Millaje" value={editForm.millaje} onChange={(v) => setEditForm({ ...editForm, millaje: v })} />
            <label style={labelStyle}>
              Estado del trabajo
              <select value={editForm.estado} onChange={(e) => setEditForm({ ...editForm, estado: e.target.value })} style={inputStyle}>
                {estadosTrabajo.map((estado) => (
                  <option key={estado.value} value={estado.value}>{estado.label}</option>
                ))}
              </select>
            </label>
          </div>

          <Textarea label="Problema / trabajo a realizar" value={editForm.problema} onChange={(v) => setEditForm({ ...editForm, problema: v })} />
          <Textarea label="Resultado del diagnóstico" value={editForm.resultado_diagnostico} onChange={(v) => setEditForm({ ...editForm, resultado_diagnostico: v })} />
          <Textarea label="Notas del mecánico" value={editForm.notas_mecanico} onChange={(v) => setEditForm({ ...editForm, notas_mecanico: v })} />

          <div style={estimateBox}>
            <h3 style={sectionTitle}>🔩 Solicitud de piezas</h3>
            <p style={subtitleStyle}>El mecánico solo solicita piezas. Los precios, costos, taxes y estimados finales los completa el administrador.</p>

            {(editForm.estimado_piezas || []).length === 0 ? (
              <div style={emptyStyle}>No hay piezas solicitadas todavía.</div>
            ) : (
              <div style={jobListBox}>
                {(editForm.estimado_piezas || []).map((pieza, index) => (
                  <div key={pieza.id || index} style={pieceRowStyle}>
                    <input placeholder="Pieza" value={pieza.nombre || ""} onChange={(e) => actualizarPieza(index, "nombre", e.target.value)} style={pieceInputStyle} />
                    <input type="number" placeholder="Cant." value={pieza.cantidad || ""} onChange={(e) => actualizarPieza(index, "cantidad", e.target.value)} style={pieceSmallInputStyle} />
                    <input placeholder="Nota opcional" value={pieza.nota || ""} onChange={(e) => actualizarPieza(index, "nota", e.target.value)} style={pieceInputStyle} />
                    <span style={pieceStatusStyle}>{pieza.estado_pedido || "solicitada"}</span>
                    <button onClick={() => eliminarPieza(index)} style={deleteButton}>🗑</button>
                  </div>
                ))}
              </div>
            )}

            <div style={pieceRowStyle}>
              <input placeholder="Nombre de pieza" value={piezaDraft.nombre} onChange={(e) => setPiezaDraft({ ...piezaDraft, nombre: e.target.value })} style={pieceInputStyle} />
              <input type="number" placeholder="Cant." value={piezaDraft.cantidad} onChange={(e) => setPiezaDraft({ ...piezaDraft, cantidad: e.target.value })} style={pieceSmallInputStyle} />
              <input placeholder="Nota opcional" value={piezaDraft.nota} onChange={(e) => setPiezaDraft({ ...piezaDraft, nota: e.target.value })} style={pieceInputStyle} />
              <span style={pieceStatusStyle}>solicitada</span>
              <button onClick={agregarPieza} style={storeButton}>➕ Pedir pieza</button>
            </div>

            <div style={totalsBox}>
              <span>Piezas solicitadas: <strong>{(editForm.estimado_piezas || []).length}</strong></span>
              <span>Los precios solo son visibles para el administrador.</span>
            </div>
          </div>

          <div style={sectionBoxInner}>
            <h3 style={sectionTitle}>🔎 Buscar piezas para este trabajo</h3>
            <input
              placeholder="Ejemplo: alternator, brake pads, radiator, starter..."
              value={piezaBuscarTrabajo}
              onChange={(e) => setPiezaBuscarTrabajo(e.target.value)}
              style={inputStyle}
            />
            <div style={actionsBox}>
              {tiendas.map((tienda) => (
                <button
                  key={`trabajo-${tienda.nombre}`}
                  onClick={() => {
                    abrirTiendaConBusqueda(tienda, editForm, piezaBuscarTrabajo);
                  }}
                  style={storeButton}
                >
                  Buscar en {tienda.nombre}
                </button>
              ))}
            </div>
          </div>

          <div style={actionsBox}>
            <button onClick={guardarTrabajoActivo} style={primaryButton} disabled={guardandoTrabajo}>
              {guardandoTrabajo ? "Guardando..." : "💾 Guardar cambios del trabajo"}
            </button>
            <button onClick={() => enviarLinkEstadoCliente(trabajoSeleccionado)} style={smsStatusButton}>
              📩 Enviar link de estatus al cliente
            </button>
            <button onClick={() => setTrabajoSeleccionado(null)} style={cancelButton}>Cerrar editor</button>
          </div>
        </div>
      )}

      <div style={sectionBox}>
        <h2 style={sectionTitle}>➕ Crear nuevo trabajo</h2>
        <div style={sectionBoxInner}>
          <h3 style={sectionTitle}>1) Identificación del vehículo</h3>
          <div style={gridStyle}>
            <Input label="VIN" value={form.vin} onChange={(v) => actualizarCampo("vin", v.toUpperCase())} />
            <Input label="Placa" value={form.placa} onChange={(v) => actualizarCampo("placa", v.toUpperCase())} />
            <label style={labelStyle}>
              Escanear VIN con cámara
              <input type="file" accept="image/*" capture="environment" onChange={(e) => escanearVinDesdeImagen(e.target.files?.[0], "form")} style={inputStyle} />
            </label>
            <button onClick={buscarVin} style={blueButton} disabled={buscandoVin || escaneandoVin}>
              {buscandoVin || escaneandoVin ? "Procesando VIN..." : "🔎 Rellenar por VIN"}
            </button>
          </div>
        </div>

        <div style={sectionBoxInner}>
          <h3 style={sectionTitle}>2) Datos del cliente y auto</h3>
          <div style={gridStyle}>
            <Input label="Cliente" value={form.cliente_nombre} onChange={(v) => actualizarCampo("cliente_nombre", v)} />
            <Input label="Teléfono cliente" value={form.telefono_cliente} onChange={(v) => actualizarCampo("telefono_cliente", v)} />
            <Input label="Año" value={form.anio} onChange={(v) => actualizarCampo("anio", v)} />
            <Input label="Marca" value={form.marca} onChange={(v) => actualizarCampo("marca", v)} />
            <Input label="Modelo" value={form.modelo} onChange={(v) => actualizarCampo("modelo", v)} />
            <Input label="Motor" value={form.motor} onChange={(v) => actualizarCampo("motor", v)} />
            <Input label="Trim / versión" value={form.trim} onChange={(v) => actualizarCampo("trim", v)} />
            <Input label="Color" value={form.color} onChange={(v) => actualizarCampo("color", v)} />
            <Input label="Millaje" value={form.millaje} onChange={(v) => actualizarCampo("millaje", v)} />
          </div>

          <Textarea label="Problema / trabajo a realizar" value={form.problema} onChange={(v) => actualizarCampo("problema", v)} />
          <Textarea label="Notas del mecánico" value={form.notas_mecanico} onChange={(v) => actualizarCampo("notas_mecanico", v)} />

          <button onClick={crearTrabajo} style={primaryButton} disabled={guardando || cargandoMecanicos || !form.mecanico_id}>
            {guardando ? "Guardando..." : "✅ Crear trabajo en el sistema"}
          </button>
        </div>
      </div>

      <div style={sectionBox}>
        <h2 style={sectionTitle}>3) Buscar piezas por tienda</h2>
        <p style={subtitleStyle}>Escribe la pieza y abre la búsqueda en la tienda que prefieras.</p>
        <input
          placeholder="Ejemplo: alternator, brake pads, radiator, starter..."
          value={piezaBuscar}
          onChange={(e) => setPiezaBuscar(e.target.value)}
          style={inputStyle}
        />
        <div style={actionsBox}>
          {tiendas.map((tienda) => (
            <button
              key={tienda.nombre}
              onClick={() => {
                abrirTiendaConBusqueda(tienda, form, piezaBuscar);
              }}
              style={storeButton}
            >
              Buscar en {tienda.nombre}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function Input({ label, value, onChange }) {
  return (
    <label style={labelStyle}>
      {label}
      <input value={value} onChange={(e) => onChange(e.target.value)} style={inputStyle} />
    </label>
  );
}

function Textarea({ label, value, onChange }) {
  return (
    <label style={labelStyleFull}>
      {label}
      <textarea value={value} onChange={(e) => onChange(e.target.value)} style={textareaStyle} />
    </label>
  );
}

const pageBox = { color: "white", padding: "25px", minHeight: "100vh", background: "#111827" };
const titleStyle = { color: "#f59e0b", fontSize: "38px", marginBottom: "8px" };
const subtitleStyle = { color: "#d1d5db", fontSize: "16px" };
const compactText = { color: "#d1d5db", margin: "4px 0" };
const loginCard = { maxWidth: "430px", margin: "80px auto", background: "#1f2937", border: "1px solid #f59e0b", borderRadius: "14px", padding: "24px" };
const sectionBox = { background: "rgba(31,41,55,0.95)", border: "1px solid #374151", borderRadius: "14px", padding: "18px", marginTop: "18px" };
const sectionBoxInner = { background: "rgba(17,24,39,0.75)", border: "1px solid #374151", borderRadius: "12px", padding: "14px", marginTop: "14px" };
const estimateBox = { background: "rgba(15,23,42,0.95)", border: "1px solid #f59e0b", borderRadius: "12px", padding: "14px", marginTop: "14px" };
const sectionTitle = { color: "#f59e0b", marginTop: 0 };
const gridStyle = { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(230px,1fr))", gap: "14px", alignItems: "end" };
const labelStyle = { display: "grid", gap: "6px", color: "white", fontWeight: "bold" };
const labelStyleFull = { display: "grid", gap: "6px", color: "white", fontWeight: "bold", marginTop: "14px" };
const inputStyle = { width: "100%", padding: "12px", borderRadius: "9px", border: "1px solid #374151", background: "#111827", color: "white", fontSize: "15px" };
const textareaStyle = { ...inputStyle, minHeight: "95px", resize: "vertical" };
const primaryButton = { padding: "13px 16px", background: "#16a34a", color: "white", border: "none", borderRadius: "9px", cursor: "pointer", fontWeight: "bold", marginTop: "16px" };
const smsStatusButton = { padding: "12px 16px", background: "#0ea5e9", color: "white", border: "none", borderRadius: "8px", cursor: "pointer", fontWeight: "bold" };
const cancelButton = { padding: "13px 16px", background: "#6b7280", color: "white", border: "none", borderRadius: "9px", cursor: "pointer", fontWeight: "bold", marginTop: "16px" };
const blueButton = { padding: "13px 16px", background: "#2563eb", color: "white", border: "none", borderRadius: "9px", cursor: "pointer", fontWeight: "bold" };
const editButton = { padding: "10px 12px", background: "#2563eb", color: "white", border: "none", borderRadius: "8px", cursor: "pointer", fontWeight: "bold" };
const deleteButton = { padding: "10px", background: "#dc2626", color: "white", border: "none", borderRadius: "8px", cursor: "pointer", fontWeight: "bold" };
const actionsBox = { display: "flex", gap: "12px", flexWrap: "wrap", marginTop: "14px" };
const storeButton = { padding: "12px 14px", background: "#f59e0b", color: "#111827", border: "none", borderRadius: "9px", cursor: "pointer", fontWeight: "bold" };
const emptyStyle = { background: "#111827", border: "1px solid #374151", borderRadius: "10px", padding: "14px", color: "#d1d5db", marginTop: "12px" };
const jobListBox = { display: "grid", gap: "10px", marginTop: "12px" };
const jobCardStyle = { display: "grid", gridTemplateColumns: "1fr auto", gap: "12px", alignItems: "center", background: "#111827", border: "1px solid #374151", borderRadius: "10px", padding: "12px" };
const pieceRowStyle = { display: "grid", gridTemplateColumns: "2fr 90px 2fr 130px auto", gap: "8px", alignItems: "center", marginTop: "10px" };
const pieceInputStyle = { ...inputStyle, minWidth: 0 };
const pieceSmallInputStyle = { ...inputStyle, minWidth: 0 };
const totalsBox = { display: "flex", gap: "12px", flexWrap: "wrap", background: "#111827", border: "1px solid #374151", borderRadius: "10px", padding: "12px", marginTop: "12px", color: "#d1d5db" };
const pieceStatusStyle = { background: "#334155", color: "white", borderRadius: "999px", padding: "8px 10px", textAlign: "center", fontWeight: "bold" };

export default PanelMecanico;
