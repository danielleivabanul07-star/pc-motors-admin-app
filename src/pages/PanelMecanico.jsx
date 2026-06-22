import { useState } from "react";
import { supabase } from "../services/supabase";

const CODIGO_TALLER = "PCMOTORS2026";

const tiendas = [
  {
    nombre: "AutoZone",
    crearUrl: (vehiculo, pieza) =>
      `https://www.autozone.com/searchresult?searchText=${encodeURIComponent(`${pieza} ${vehiculo.anio} ${vehiculo.marca} ${vehiculo.modelo}`)}`
  },
  {
    nombre: "O'Reilly",
    crearUrl: (vehiculo, pieza) =>
      `https://www.oreillyauto.com/search?q=${encodeURIComponent(`${pieza} ${vehiculo.anio} ${vehiculo.marca} ${vehiculo.modelo}`)}`
  },
  {
    nombre: "Advance Auto Parts",
    crearUrl: (vehiculo, pieza) =>
      `https://shop.advanceautoparts.com/web/SearchResults?searchTerm=${encodeURIComponent(`${pieza} ${vehiculo.anio} ${vehiculo.marca} ${vehiculo.modelo}`)}`
  }
];

function PanelMecanico() {
  const [autorizado, setAutorizado] = useState(false);
  const [codigo, setCodigo] = useState("");
  const [buscandoVin, setBuscandoVin] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [piezaBuscar, setPiezaBuscar] = useState("");

  const [form, setForm] = useState({
    mecanico_nombre: "",
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

  const actualizarCampo = (campo, valor) => {
    setForm((prev) => ({ ...prev, [campo]: valor }));
  };

  const limpiarTexto = (valor) => String(valor || "").trim();

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

  const crearTrabajo = async () => {
    const cliente = limpiarTexto(form.cliente_nombre);
    const mecanico = limpiarTexto(form.mecanico_nombre);
    const problema = limpiarTexto(form.problema);

    if (!mecanico || !cliente || !problema) {
      alert("Falta nombre del mecánico, cliente o problema del vehículo.");
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

    const nuevoTrabajo = {
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
      descripcion_trabajo: problema,
      notas_mecanico: limpiarTexto(form.notas_mecanico),
      estado: "activo",
      origen: "panel_mecanico",
      creado_por: mecanico,
      hora_inicio: new Date().toISOString()
    };

    const { error } = await supabase.from("trabajos_mecanicos").insert([nuevoTrabajo]);

    if (error) {
      console.log(error);
      alert(JSON.stringify(error, null, 2));
      setGuardando(false);
      return;
    }

    alert("Trabajo creado correctamente. Ya aparece en el sistema principal.");

    setForm({
      mecanico_nombre: form.mecanico_nombre,
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
  };

  const vehiculoListo = form.anio && form.marca && form.modelo;

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
      <p style={subtitleStyle}>Crear trabajos por VIN o placa. Los trabajos aparecen en el sistema principal.</p>

      <div style={sectionBox}>
        <h2 style={sectionTitle}>1) Identificación del vehículo</h2>
        <div style={gridStyle}>
          <Input label="VIN" value={form.vin} onChange={(v) => actualizarCampo("vin", v.toUpperCase())} />
          <Input label="Placa" value={form.placa} onChange={(v) => actualizarCampo("placa", v.toUpperCase())} />
          <button onClick={buscarVin} style={blueButton} disabled={buscandoVin}>
            {buscandoVin ? "Buscando VIN..." : "🔎 Rellenar por VIN"}
          </button>
        </div>
      </div>

      <div style={sectionBox}>
        <h2 style={sectionTitle}>2) Datos del cliente y auto</h2>
        <div style={gridStyle}>
          <Input label="Mecánico" value={form.mecanico_nombre} onChange={(v) => actualizarCampo("mecanico_nombre", v)} />
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

        <button onClick={crearTrabajo} style={primaryButton} disabled={guardando}>
          {guardando ? "Guardando..." : "✅ Crear trabajo en el sistema"}
        </button>
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
                if (!vehiculoListo) {
                  alert("Primero completa año, marca y modelo del vehículo.");
                  return;
                }
                if (!piezaBuscar.trim()) {
                  alert("Escribe la pieza que quieres buscar.");
                  return;
                }
                window.open(tienda.crearUrl(form, piezaBuscar), "_blank", "noopener,noreferrer");
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
const loginCard = { maxWidth: "430px", margin: "80px auto", background: "#1f2937", border: "1px solid #f59e0b", borderRadius: "14px", padding: "24px" };
const sectionBox = { background: "rgba(31,41,55,0.95)", border: "1px solid #374151", borderRadius: "14px", padding: "18px", marginTop: "18px" };
const sectionTitle = { color: "#f59e0b", marginTop: 0 };
const gridStyle = { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(230px,1fr))", gap: "14px", alignItems: "end" };
const labelStyle = { display: "grid", gap: "6px", color: "white", fontWeight: "bold" };
const labelStyleFull = { display: "grid", gap: "6px", color: "white", fontWeight: "bold", marginTop: "14px" };
const inputStyle = { width: "100%", padding: "12px", borderRadius: "9px", border: "1px solid #374151", background: "#111827", color: "white", fontSize: "15px" };
const textareaStyle = { ...inputStyle, minHeight: "95px", resize: "vertical" };
const primaryButton = { padding: "13px 16px", background: "#16a34a", color: "white", border: "none", borderRadius: "9px", cursor: "pointer", fontWeight: "bold", marginTop: "16px" };
const blueButton = { padding: "13px 16px", background: "#2563eb", color: "white", border: "none", borderRadius: "9px", cursor: "pointer", fontWeight: "bold" };
const actionsBox = { display: "flex", gap: "12px", flexWrap: "wrap", marginTop: "14px" };
const storeButton = { padding: "12px 14px", background: "#f59e0b", color: "#111827", border: "none", borderRadius: "9px", cursor: "pointer", fontWeight: "bold" };

export default PanelMecanico;
