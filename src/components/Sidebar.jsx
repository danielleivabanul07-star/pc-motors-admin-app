import logoPC from "../assets/logo-pcmotors.png";

function Sidebar({ page, setPage }) {
  const items = [
    { id: "dashboard", label: "📊 Dashboard" },
    { id: "clientes", label: "👥 Clientes Activos" },
    { id: "historial", label: "📁 Historial" },
    { id: "solicitudes", label: "📥 Solicitudes" },
    { id: "registro", label: "📱 Registro Cliente" },
    { id: "archivo", label: "🗄 Archivo Histórico" },
    { id: "mecanicos", label: "🔧 Mecánicos" },
    { id: "mano-obra-precios", label: "💵 Mano de Obra" },
    // NUEVO MÓDULO
    { id: "control-trabajos-mecanicos", label: "🛠 Control Trabajos" },

    { id: "reportes", label: "📈 Reportes" },
    { id: "reportes-mecanicos", label: "🔧 Reportes Mecánicos" }
  ];

  return (
    <aside style={sidebarStyle}>
      <img
        src={logoPC}
        alt="PC MOTORS"
        style={logoImageStyle}
      />

      <h2 style={logoStyle}>PC MOTORS</h2>

      <p style={smallText}>
        ADMIN PANEL
      </p>

      <nav style={{ marginTop: "30px" }}>
        {items.map((item) => (
          <button
            key={item.id}
            onClick={() => setPage(item.id)}
            style={{
              ...buttonStyle,
              background:
                page === item.id
                  ? "#f59e0b"
                  : "transparent",
              color:
                page === item.id
                  ? "#111827"
                  : "white"
            }}
          >
            {item.label}
          </button>
        ))}
      </nav>
    </aside>
  );
}

const logoImageStyle = {
  width: "140px",
  display: "block",
  margin: "0 auto 15px auto",
  borderRadius: "12px"
};

const sidebarStyle = {
  width: "260px",
  minHeight: "100vh",
  background: "#020617",
  color: "white",
  padding: "25px",
  borderRight: "1px solid #f59e0b"
};

const logoStyle = {
  color: "#f59e0b",
  margin: 0,
  textAlign: "center"
};

const smallText = {
  fontSize: "12px",
  color: "#9ca3af",
  marginTop: "5px",
  textAlign: "center"
};

const buttonStyle = {
  width: "100%",
  padding: "14px",
  marginBottom: "10px",
  border: "1px solid #374151",
  borderRadius: "10px",
  cursor: "pointer",
  textAlign: "left",
  fontSize: "16px"
};

export default Sidebar;