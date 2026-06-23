import { useEffect, useState } from "react";
import { supabase } from "../services/supabase";

const CODIGO_TALLER = "PCMOTORS2026";

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
  const [codigo, setCodigo] = useState("");
  const [buscandoVin, setBuscandoVin] = useState(false);
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
    costo: "",
    venta: ""
  });

  useEffect(() => {
    cargarMecanicos();
  }, []);

  useEffect(() => {
    if (autorizado && form.mecanico_id) {
      cargarTrabajosMecanico(form.mecanico_id, form.mecanico_nombre);
    }
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
    costo: Number(pieza.costo ?? pieza.costo_real ?? 0),
    costo_real: Number(pieza.costo_real ?? pieza.costo ?? 0),
    venta: Number(pieza.venta ?? pieza.precio_venta ?? pieza.precio_cliente ?? 0),
    precio_venta: Number(pieza.precio_venta ?? pieza.venta ?? pieza.precio_cliente ?? 0),
    precio_cliente: Number(pieza.precio_cliente ?? pieza.venta ?? pieza.precio_venta ?? 0),
    precio_normal: Number(pieza.precio_normal ?? pieza.precio_regular ?? 0)
  });

  const calcularTotalPiezasCosto = (piezas) =>
    (piezas || []).reduce((total, pieza) => total + Number(pieza.costo || pieza.costo_real || 0) * Number(pieza.cantidad || 1), 0);

  const calcularTotalPiezasVenta = (piezas) =>
    (piezas || []).reduce((total, pieza) => total + Number(pieza.venta || pieza.precio_venta || pieza.precio_cliente || 0) * Number(pieza.cantidad || 1), 0);

  const buscarVin = async () => {
    const vin = limpiarTexto(form.vin).toUpperCase();

    if (vin.length < 11) {
      alert("Escribe un VIN válido. Lo ideal son 17 caracteres.");
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

      setForm((prev) => ({
        ...prev,
        vin,
        anio: data.ModelYear || prev.anio,
        marca: data.Make || prev.marca,
        modelo: data.Model || prev.modelo,
        motor:
          data.EngineModel ||
          data.EngineConfiguration ||
          data.DisplacementL ||
          prev.motor,
        trim: data.Trim || data.Series || prev.trim,
        tipo_vehiculo: data.VehicleType || prev.tipo_vehiculo
      }));

      alert("Datos del vehículo completados por VIN.");
    } catch (error) {
      console.log(error);
      alert("Error buscando el VIN. Revisa internet o intenta otra vez.");
    }

    setBuscandoVin(false);
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
      `¿Crear trabajo para este vehículo?\n\nCliente: ${cliente}\nVehículo: ${form.anio} ${form.marca} ${form.modelo}\nMecánico: ${mecanico}`
    );

    if (!confirmar) return;

    setGuardando(true);

    const vehiculoTexto = `${form.anio || ""} ${form.marca || ""} ${form.modelo || ""}`.trim();
    const ahora = new Date().toISOString();

    const nuevoTrabajo = {
      mecanico_id: form.mecanico_id,
      cliente_nombre: cliente,
      telefono_cliente: limpiarTexto(form.telefono_cliente),
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
      notas: limpiarTexto(form.notas_mecanico),
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
      estimado_piezas: []
    };

    const { data, error } = await supabase
      .from("trabajos_mecanicos")
      .insert([nuevoTrabajo])
      .select()
      .single();

    if (error) {
      console.log(error);
      alert(JSON.stringify(error, null, 2));
      setGuardando(false);
      return;
    }

    alert("Trabajo creado correctamente. Ahora aparece en tus trabajos activos y en el sistema principal.");

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
      costo: Number(piezaDraft.costo || 0),
      costo_real: Number(piezaDraft.costo || 0),
      venta: Number(piezaDraft.venta || 0),
      precio_venta: Number(piezaDraft.venta || 0),
      precio_cliente: Number(piezaDraft.venta || 0)
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

    setPiezaDraft({ nombre: "", cantidad: "1", costo: "", venta: "" });
  };

  const actualizarPieza = (index, campo, valor) => {
    setEditForm((prev) => {
      const piezas = [...(prev.estimado_piezas || [])];
      piezas[index] = normalizarPieza({
        ...(piezas[index] || {}),
        [campo]: campo === "nombre" ? valor : Number(valor || 0)
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

  const guardarTrabajoActivo = async () => {
    if (!trabajoSeleccionado?.id) return;

    const problema = limpiarTexto(editForm.problema);
    if (!problema) {
      alert("El problema/trabajo no puede quedar vacío.");
      return;
    }

    setGuardandoTrabajo(true);

    const vehiculoTexto = limpiarTexto(editForm.vehiculo) || `${editForm.anio || ""} ${editForm.marca || ""} ${editForm.modelo || ""}`.trim();
    const piezas = (editForm.estimado_piezas || []).map(normalizarPieza).filter((pieza) => pieza.nombre);
    const costoPiezas = Number(editForm.costo_piezas || calcularTotalPiezasCosto(piezas) || 0);
    const ventaPiezas = Number(editForm.venta_piezas || calcularTotalPiezasVenta(piezas) || 0);
    const manoObra = Number(editForm.mano_obra || editForm.estimado_mano_obra || 0);

    const updateData = {
      cliente_nombre: limpiarTexto(editForm.cliente_nombre) || null,
      telefono_cliente: limpiarTexto(editForm.telefono_cliente) || null,
      vehiculo: vehiculoTexto || null,
      anio: limpiarTexto(editForm.anio),
      marca: limpiarTexto(editForm.marca),
      modelo: limpiarTexto(editForm.modelo),
      motor: limpiarTexto(editForm.motor),
      trim: limpiarTexto(editForm.trim),
      color: limpiarTexto(editForm.color),
      placa: limpiarTexto(editForm.placa).toUpperCase(),
      vin: limpiarTexto(editForm.vin).toUpperCase(),
      millaje: limpiarTexto(editForm.millaje),
      problema,
      trabajo: problema,
      descripcion_trabajo: problema,
      resultado_diagnostico: limpiarTexto(editForm.resultado_diagnostico) || null,
      notas_mecanico: limpiarTexto(editForm.notas_mecanico) || null,
      notas: limpiarTexto(editForm.notas_mecanico) || null,
      estado: editForm.estado || "diagnostico",
      fase_actual: editForm.estado || "diagnostico",
      estimado_piezas: piezas,
      estimado_mano_obra: manoObra,
      costo_piezas: costoPiezas,
      venta_piezas: ventaPiezas,
      mano_obra: manoObra,
      estimado_estado: piezas.length > 0 || manoObra > 0 ? "estimado_pendiente" : (trabajoSeleccionado.estimado_estado || "sin_estimado")
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
          <p style={subtitleStyle}>Acceso privado para registrar vehículos del taller.</p>
          <input
            type="password"
            placeholder="Código de acceso"
            value={codigo}
            onChange={(e) => setCodigo(e.target.value)}
            style={inputStyle}
          />
          <button
            onClick={() => {
              if (codigo === CODIGO_TALLER) setAutorizado(true);
              else alert("Código incorrecto.");
            }}
            style={primaryButton}
          >
            Entrar
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
            <h3 style={sectionTitle}>🔩 Piezas y mano de obra estimada</h3>
            <p style={subtitleStyle}>Aquí el mecánico puede dejar las piezas solicitadas y valores estimados para que el administrador los revise, ordene piezas y genere el estimado final.</p>

            {(editForm.estimado_piezas || []).length === 0 ? (
              <div style={emptyStyle}>No hay piezas solicitadas todavía.</div>
            ) : (
              <div style={jobListBox}>
                {(editForm.estimado_piezas || []).map((pieza, index) => (
                  <div key={pieza.id || index} style={pieceRowStyle}>
                    <input placeholder="Pieza" value={pieza.nombre || ""} onChange={(e) => actualizarPieza(index, "nombre", e.target.value)} style={pieceInputStyle} />
                    <input type="number" placeholder="Cant." value={pieza.cantidad || ""} onChange={(e) => actualizarPieza(index, "cantidad", e.target.value)} style={pieceSmallInputStyle} />
                    <input type="number" placeholder="Costo" value={pieza.costo || pieza.costo_real || ""} onChange={(e) => actualizarPieza(index, "costo", e.target.value)} style={pieceSmallInputStyle} />
                    <input type="number" placeholder="Venta" value={pieza.venta || pieza.precio_venta || pieza.precio_cliente || ""} onChange={(e) => actualizarPieza(index, "venta", e.target.value)} style={pieceSmallInputStyle} />
                    <button onClick={() => eliminarPieza(index)} style={deleteButton}>🗑</button>
                  </div>
                ))}
              </div>
            )}

            <div style={pieceRowStyle}>
              <input placeholder="Nombre de pieza" value={piezaDraft.nombre} onChange={(e) => setPiezaDraft({ ...piezaDraft, nombre: e.target.value })} style={pieceInputStyle} />
              <input type="number" placeholder="Cant." value={piezaDraft.cantidad} onChange={(e) => setPiezaDraft({ ...piezaDraft, cantidad: e.target.value })} style={pieceSmallInputStyle} />
              <input type="number" placeholder="Costo" value={piezaDraft.costo} onChange={(e) => setPiezaDraft({ ...piezaDraft, costo: e.target.value })} style={pieceSmallInputStyle} />
              <input type="number" placeholder="Venta" value={piezaDraft.venta} onChange={(e) => setPiezaDraft({ ...piezaDraft, venta: e.target.value })} style={pieceSmallInputStyle} />
              <button onClick={agregarPieza} style={storeButton}>➕ Pieza</button>
            </div>

            <div style={gridStyle}>
              <Input label="Costo piezas" value={editForm.costo_piezas} onChange={(v) => setEditForm({ ...editForm, costo_piezas: v })} />
              <Input label="Venta piezas estimada" value={editForm.venta_piezas} onChange={(v) => setEditForm({ ...editForm, venta_piezas: v })} />
              <Input label="Mano de obra estimada" value={editForm.mano_obra} onChange={(v) => setEditForm({ ...editForm, mano_obra: v, estimado_mano_obra: v })} />
            </div>

            <div style={totalsBox}>
              <span>Costo piezas: <strong>{dinero(editForm.costo_piezas)}</strong></span>
              <span>Venta piezas: <strong>{dinero(editForm.venta_piezas)}</strong></span>
              <span>Mano de obra: <strong>{dinero(editForm.mano_obra)}</strong></span>
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
            <button onClick={buscarVin} style={blueButton} disabled={buscandoVin}>
              {buscandoVin ? "Buscando VIN..." : "🔎 Rellenar por VIN"}
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
const cancelButton = { padding: "13px 16px", background: "#6b7280", color: "white", border: "none", borderRadius: "9px", cursor: "pointer", fontWeight: "bold", marginTop: "16px" };
const blueButton = { padding: "13px 16px", background: "#2563eb", color: "white", border: "none", borderRadius: "9px", cursor: "pointer", fontWeight: "bold" };
const editButton = { padding: "10px 12px", background: "#2563eb", color: "white", border: "none", borderRadius: "8px", cursor: "pointer", fontWeight: "bold" };
const deleteButton = { padding: "10px", background: "#dc2626", color: "white", border: "none", borderRadius: "8px", cursor: "pointer", fontWeight: "bold" };
const actionsBox = { display: "flex", gap: "12px", flexWrap: "wrap", marginTop: "14px" };
const storeButton = { padding: "12px 14px", background: "#f59e0b", color: "#111827", border: "none", borderRadius: "9px", cursor: "pointer", fontWeight: "bold" };
const emptyStyle = { background: "#111827", border: "1px solid #374151", borderRadius: "10px", padding: "14px", color: "#d1d5db", marginTop: "12px" };
const jobListBox = { display: "grid", gap: "10px", marginTop: "12px" };
const jobCardStyle = { display: "grid", gridTemplateColumns: "1fr auto", gap: "12px", alignItems: "center", background: "#111827", border: "1px solid #374151", borderRadius: "10px", padding: "12px" };
const pieceRowStyle = { display: "grid", gridTemplateColumns: "2fr 90px 120px 120px auto", gap: "8px", alignItems: "center", marginTop: "10px" };
const pieceInputStyle = { ...inputStyle, minWidth: 0 };
const pieceSmallInputStyle = { ...inputStyle, minWidth: 0 };
const totalsBox = { display: "flex", gap: "12px", flexWrap: "wrap", background: "#111827", border: "1px solid #374151", borderRadius: "10px", padding: "12px", marginTop: "12px", color: "#d1d5db" };

export default PanelMecanico;
