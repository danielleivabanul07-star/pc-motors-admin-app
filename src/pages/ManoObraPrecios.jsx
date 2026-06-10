import { useEffect, useMemo, useState } from "react";
import { supabase } from "../services/supabase";

export default function ManoObraPrecios() {
  const formBase = {
    categoria: "",
    servicio: "",
    precio_min: "",
    precio_max: "",
    precio_sugerido: "",
    notas: ""
  };

  const [servicios, setServicios] = useState([]);
  const [form, setForm] = useState(formBase);
  const [editando, setEditando] = useState(null);
  const [busqueda, setBusqueda] = useState("");
  const [categoriaFiltro, setCategoriaFiltro] = useState("todas");
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    cargarServicios();
  }, []);

  useEffect(() => {
    const channel = supabase
      .channel("mano-obra-precios-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "mano_obra_precios" }, cargarServicios)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const dinero = (valor) => `$${Number(valor || 0).toFixed(2)}`;

  const precioMinimo = (item) => Number(item.precio_min ?? item.precio ?? 0);
  const precioMaximo = (item) => Number(item.precio_max ?? item.precio ?? 0);
  const precioSugerido = (item) => Number(item.precio_sugerido ?? item.precio ?? item.precio_min ?? 0);

  const cargarServicios = async () => {
    setCargando(true);

    const { data, error } = await supabase
      .from("mano_obra_precios")
      .select("*")
      .order("categoria", { ascending: true })
      .order("servicio", { ascending: true });

    if (error) {
      console.log(error);
      alert("Error cargando precios de mano de obra.\n\n" + JSON.stringify(error, null, 2));
      setCargando(false);
      return;
    }

    setServicios(data || []);
    setCargando(false);
  };

  const limpiarForm = () => {
    setForm(formBase);
    setEditando(null);
  };

  const guardarServicio = async () => {
    const categoria = form.categoria.trim() || "General";
    const servicio = form.servicio.trim();
    const precioMin = Number(form.precio_min || 0);
    const precioMax = Number(form.precio_max || 0);
    const precioSug = Number(form.precio_sugerido || 0);

    if (!servicio) {
      alert("Escribe el nombre del servicio.");
      return;
    }

    if (!Number.isFinite(precioMin) || precioMin < 0) {
      alert("Escribe un precio mínimo válido.");
      return;
    }

    if (!Number.isFinite(precioMax) || precioMax < 0) {
      alert("Escribe un precio máximo válido.");
      return;
    }

    if (!Number.isFinite(precioSug) || precioSug < 0) {
      alert("Escribe un precio sugerido válido.");
      return;
    }

    if (precioMax > 0 && precioMin > precioMax) {
      alert("El precio mínimo no puede ser mayor que el precio máximo.");
      return;
    }

    const precioFinalSugerido = precioSug || precioMin;

    const payload = {
      categoria,
      servicio,
      precio: precioFinalSugerido,
      precio_min: precioMin,
      precio_max: precioMax || precioMin,
      precio_sugerido: precioFinalSugerido,
      notas: form.notas.trim() || null,
      activo: true
    };

    const query = editando?.id
      ? supabase.from("mano_obra_precios").update(payload).eq("id", editando.id)
      : supabase.from("mano_obra_precios").insert([payload]);

    const { error } = await query;

    if (error) {
      console.log(error);
      alert(JSON.stringify(error, null, 2));
      return;
    }

    alert(editando?.id ? "Servicio actualizado correctamente." : "Servicio agregado correctamente.");
    limpiarForm();
    await cargarServicios();
  };

  const editarServicio = (item) => {
    setEditando(item);
    setForm({
      categoria: item.categoria || "",
      servicio: item.servicio || "",
      precio_min: String(precioMinimo(item) || ""),
      precio_max: String(precioMaximo(item) || ""),
      precio_sugerido: String(precioSugerido(item) || ""),
      notas: item.notas || ""
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const cambiarEstado = async (item, activo) => {
    const confirmar = confirm(
      activo
        ? `¿Activar nuevamente este servicio?\n\n${item.servicio}`
        : `¿Desactivar este servicio?\n\n${item.servicio}`
    );

    if (!confirmar) return;

    const { error } = await supabase
      .from("mano_obra_precios")
      .update({ activo })
      .eq("id", item.id);

    if (error) {
      console.log(error);
      alert(JSON.stringify(error, null, 2));
      return;
    }

    await cargarServicios();
  };

  const eliminarServicio = async (item) => {
    const confirmar = prompt(
      `Para eliminar definitivamente este servicio escribe ELIMINAR:\n\n${item.servicio}`
    );

    if (confirmar !== "ELIMINAR") {
      alert("Eliminación cancelada.");
      return;
    }

    const { error } = await supabase
      .from("mano_obra_precios")
      .delete()
      .eq("id", item.id);

    if (error) {
      console.log(error);
      alert(JSON.stringify(error, null, 2));
      return;
    }

    await cargarServicios();
  };

  const categorias = useMemo(() => {
    const lista = servicios.map((s) => s.categoria || "General");
    return ["todas", ...Array.from(new Set(lista)).sort()];
  }, [servicios]);

  const serviciosFiltrados = servicios.filter((item) => {
    const texto = busqueda.trim().toLowerCase();
    const coincideTexto = !texto ||
      String(item.servicio || "").toLowerCase().includes(texto) ||
      String(item.categoria || "").toLowerCase().includes(texto) ||
      String(item.notas || "").toLowerCase().includes(texto);

    const coincideCategoria = categoriaFiltro === "todas" || (item.categoria || "General") === categoriaFiltro;

    return coincideTexto && coincideCategoria;
  });

  const activos = servicios.filter((s) => s.activo !== false).length;
  const inactivos = servicios.filter((s) => s.activo === false).length;

  return (
    <div>
      <h1 style={titleStyle}>🔧 Catálogo de Mano de Obra</h1>
      <p style={subtitleStyle}>Rangos internos de precios para diagnósticos, reparaciones y servicios del taller.</p>

      <div style={summaryGrid}>
        <div style={summaryCard}><strong>Servicios activos</strong><span style={summaryNumber}>{activos}</span></div>
        <div style={summaryCard}><strong>Servicios inactivos</strong><span style={summaryNumber}>{inactivos}</span></div>
        <div style={summaryCard}><strong>Total registrados</strong><span style={summaryNumber}>{servicios.length}</span></div>
      </div>

      <div style={formBox}>
        <h2 style={{ color: "#f59e0b", marginTop: 0 }}>{editando ? "✏️ Editar Servicio" : "➕ Agregar Servicio"}</h2>

        <input
          placeholder="Categoría. Ejemplo: Frenos, Motor, Diagnóstico, Suspensión"
          value={form.categoria}
          onChange={(e) => setForm({ ...form, categoria: e.target.value })}
          style={inputStyle}
        />

        <input
          placeholder="Servicio. Ejemplo: Diagnóstico eléctrico"
          value={form.servicio}
          onChange={(e) => setForm({ ...form, servicio: e.target.value })}
          style={inputStyle}
        />

        <div style={rangeGrid}>
          <input
            type="number"
            placeholder="Precio mínimo. Ejemplo: 80"
            value={form.precio_min}
            onChange={(e) => setForm({ ...form, precio_min: e.target.value })}
            style={inputStyle}
          />

          <input
            type="number"
            placeholder="Precio máximo. Ejemplo: 150"
            value={form.precio_max}
            onChange={(e) => setForm({ ...form, precio_max: e.target.value })}
            style={inputStyle}
          />

          <input
            type="number"
            placeholder="Precio sugerido interno. Ejemplo: 100"
            value={form.precio_sugerido}
            onChange={(e) => setForm({ ...form, precio_sugerido: e.target.value })}
            style={inputStyle}
          />
        </div>

        <p style={helpText}>
          El precio sugerido es solo para uso interno del taller. En el estimado del cliente no debe mostrarse como “sugerido”.
        </p>

        <textarea
          placeholder="Notas opcionales"
          value={form.notas}
          onChange={(e) => setForm({ ...form, notas: e.target.value })}
          style={{ ...inputStyle, minHeight: "80px" }}
        />

        <button onClick={guardarServicio} style={saveButton}>{editando ? "Guardar Cambios" : "Agregar Precio"}</button>
        {editando && <button onClick={limpiarForm} style={cancelButton}>Cancelar edición</button>}
      </div>

      <div style={filtersBox}>
        <input
          placeholder="Buscar por servicio, categoría o notas..."
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          style={searchInputStyle}
        />

        <select value={categoriaFiltro} onChange={(e) => setCategoriaFiltro(e.target.value)} style={selectStyle}>
          {categorias.map((cat) => (
            <option key={cat} value={cat}>{cat === "todas" ? "Todas las categorías" : cat}</option>
          ))}
        </select>
      </div>

      {cargando ? (
        <p>Cargando...</p>
      ) : serviciosFiltrados.length === 0 ? (
        <div style={emptyStyle}>No hay servicios para mostrar.</div>
      ) : (
        <div style={gridStyle}>
          {serviciosFiltrados.map((item) => {
            const min = precioMinimo(item);
            const max = precioMaximo(item);
            const sugerido = precioSugerido(item);

            return (
              <div key={item.id} style={{ ...cardStyle, opacity: item.activo === false ? 0.55 : 1 }}>
                <div style={cardHeader}>
                  <h2 style={{ color: "#f59e0b", margin: 0 }}>{item.servicio}</h2>
                  <span style={item.activo === false ? inactiveBadge : activeBadge}>
                    {item.activo === false ? "Inactivo" : "Activo"}
                  </span>
                </div>

                <p><strong>Categoría:</strong> {item.categoria || "General"}</p>
                <p><strong>Rango:</strong> <span style={priceBadge}>{dinero(min)} - {dinero(max)}</span></p>
                <p><strong>Precio sugerido interno:</strong> <span style={internalBadge}>{dinero(sugerido)}</span></p>
                <p><strong>Notas:</strong><br />{item.notas || "Sin notas"}</p>

                <button onClick={() => editarServicio(item)} style={editButton}>✏️ Editar</button>
                {item.activo === false ? (
                  <button onClick={() => cambiarEstado(item, true)} style={activateButton}>✅ Activar</button>
                ) : (
                  <button onClick={() => cambiarEstado(item, false)} style={disableButton}>⏸ Desactivar</button>
                )}
                <button onClick={() => eliminarServicio(item)} style={deleteButton}>🗑 Eliminar</button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

const titleStyle = {
  fontSize: "36px",
  color: "#f59e0b",
  marginBottom: "5px"
};

const subtitleStyle = {
  color: "#d1d5db",
  marginTop: 0,
  marginBottom: "25px"
};

const summaryGrid = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: "16px",
  marginBottom: "25px"
};

const summaryCard = {
  background: "rgba(31,41,55,0.92)",
  border: "1px solid #f59e0b",
  borderRadius: "12px",
  padding: "18px"
};

const summaryNumber = {
  display: "block",
  color: "#f59e0b",
  fontSize: "30px",
  fontWeight: "bold",
  marginTop: "8px"
};

const formBox = {
  background: "rgba(31,41,55,0.94)",
  border: "1px solid #f59e0b",
  borderRadius: "14px",
  padding: "20px",
  marginBottom: "25px"
};

const rangeGrid = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
  gap: "12px"
};

const inputStyle = {
  width: "100%",
  padding: "13px",
  marginBottom: "12px",
  borderRadius: "8px",
  border: "1px solid #374151",
  background: "#111827",
  color: "white",
  boxSizing: "border-box"
};

const helpText = {
  color: "#d1d5db",
  fontSize: "13px",
  marginTop: "0",
  marginBottom: "12px"
};

const saveButton = {
  width: "100%",
  padding: "13px",
  border: "none",
  borderRadius: "8px",
  background: "#16a34a",
  color: "white",
  fontWeight: "bold",
  cursor: "pointer",
  marginTop: "5px"
};

const cancelButton = {
  width: "100%",
  padding: "13px",
  border: "none",
  borderRadius: "8px",
  background: "#6b7280",
  color: "white",
  fontWeight: "bold",
  cursor: "pointer",
  marginTop: "10px"
};

const filtersBox = {
  display: "grid",
  gridTemplateColumns: "2fr 1fr",
  gap: "12px",
  marginBottom: "20px"
};

const searchInputStyle = {
  padding: "13px",
  borderRadius: "8px",
  border: "1px solid #f59e0b",
  background: "#111827",
  color: "white"
};

const selectStyle = {
  padding: "13px",
  borderRadius: "8px",
  border: "1px solid #f59e0b",
  background: "#111827",
  color: "white"
};

const gridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
  gap: "18px"
};

const cardStyle = {
  background: "rgba(31,41,55,0.94)",
  border: "1px solid #f59e0b",
  borderRadius: "14px",
  padding: "18px"
};

const cardHeader = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: "10px"
};

const activeBadge = {
  background: "#16a34a",
  color: "white",
  padding: "6px 10px",
  borderRadius: "8px",
  fontWeight: "bold"
};

const inactiveBadge = {
  background: "#991b1b",
  color: "white",
  padding: "6px 10px",
  borderRadius: "8px",
  fontWeight: "bold"
};

const priceBadge = {
  background: "#f59e0b",
  color: "#111827",
  padding: "5px 9px",
  borderRadius: "8px",
  fontWeight: "bold"
};

const internalBadge = {
  background: "#374151",
  color: "white",
  padding: "5px 9px",
  borderRadius: "8px",
  fontWeight: "bold"
};

const editButton = {
  width: "100%",
  padding: "12px",
  border: "none",
  borderRadius: "8px",
  background: "#2563eb",
  color: "white",
  fontWeight: "bold",
  cursor: "pointer",
  marginTop: "8px"
};

const activateButton = {
  width: "100%",
  padding: "12px",
  border: "none",
  borderRadius: "8px",
  background: "#16a34a",
  color: "white",
  fontWeight: "bold",
  cursor: "pointer",
  marginTop: "8px"
};

const disableButton = {
  width: "100%",
  padding: "12px",
  border: "none",
  borderRadius: "8px",
  background: "#d97706",
  color: "white",
  fontWeight: "bold",
  cursor: "pointer",
  marginTop: "8px"
};

const deleteButton = {
  width: "100%",
  padding: "12px",
  border: "none",
  borderRadius: "8px",
  background: "#991b1b",
  color: "white",
  fontWeight: "bold",
  cursor: "pointer",
  marginTop: "8px"
};

const emptyStyle = {
  background: "rgba(31,41,55,0.94)",
  borderRadius: "12px",
  padding: "25px",
  border: "1px solid #374151"
};
