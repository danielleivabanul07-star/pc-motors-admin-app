import { useState } from "react";
import logoPC from "../assets/logo-pcmotors.png";

export default function InicioAcceso() {
  const [logoActual, setLogoActual] = useState(logoPC);

  const irA = (ruta) => {
    window.location.href = ruta;
  };

  return (
    <div style={pageStyle}>
      <div style={cardStyle}>
        <div style={logoBoxStyle}>
          <img
            src={logoActual}
            alt="PC MOTORS"
            style={logoStyle}
            onError={() => {
              if (logoActual !== "/logo-pc-motors.png.png") {
                setLogoActual("/logo-pc-motors.png.png");
              }
            }}
          />
        </div>

        <h1 style={titleStyle}>PC MOTORS</h1>
        <p style={subtitleStyle}>Seleccione cómo desea entrar al sistema.</p>

        <div style={gridStyle}>
          <button onClick={() => irA("/admin")} style={adminButton}>
            🔐 Administrador
            <span style={buttonSubtext}>Panel administrativo completo</span>
          </button>

          <button onClick={() => irA("/taller")} style={mechanicButton}>
            🔧 Panel Mecánico
            <span style={buttonSubtext}>Registro y actualización de trabajos</span>
          </button>

          <button onClick={() => irA("/estado-cliente")} style={clientButton}>
            🚗 Cliente
            <span style={buttonSubtext}>Ver estado de mi vehículo</span>
          </button>
        </div>

        <div style={linksBox}>
          <button onClick={() => irA("/solicitar-cita")} style={linkButton}>
            📅 Solicitar una cita
          </button>

          <button onClick={() => irA("/registro-publico")} style={linkButton}>
            📱 Registro de servicio
          </button>
        </div>
      </div>
    </div>
  );
}

const pageStyle = {
  minHeight: "100vh",
  background: "linear-gradient(135deg, #020617, #111827)",
  color: "white",
  fontFamily: "Arial",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "18px",
  boxSizing: "border-box"
};

const cardStyle = {
  width: "100%",
  maxWidth: "780px",
  background: "rgba(31, 41, 55, 0.96)",
  border: "1px solid #f59e0b",
  borderRadius: "20px",
  padding: "clamp(20px, 5vw, 34px)",
  boxShadow: "0 20px 60px rgba(0,0,0,0.48)"
};

const logoBoxStyle = {
  width: "126px",
  height: "126px",
  margin: "0 auto 18px auto",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  background: "#020617",
  borderRadius: "16px",
  overflow: "hidden"
};

const logoStyle = {
  width: "100%",
  height: "100%",
  objectFit: "contain",
  borderRadius: "16px"
};

const titleStyle = {
  color: "#f59e0b",
  textAlign: "center",
  margin: "0 0 8px 0",
  fontSize: "clamp(34px, 9vw, 46px)",
  lineHeight: 1.05
};

const subtitleStyle = {
  color: "#d1d5db",
  textAlign: "center",
  marginBottom: "26px",
  fontSize: "16px"
};

const gridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))",
  gap: "14px"
};

const baseButton = {
  minHeight: "118px",
  border: "1px solid #374151",
  borderRadius: "16px",
  color: "white",
  fontSize: "20px",
  fontWeight: "bold",
  cursor: "pointer",
  padding: "18px",
  display: "flex",
  flexDirection: "column",
  alignItems: "flex-start",
  justifyContent: "center",
  textAlign: "left",
  gap: "8px",
  boxShadow: "0 10px 25px rgba(0,0,0,0.25)"
};

const adminButton = {
  ...baseButton,
  background: "linear-gradient(135deg, #f59e0b, #b45309)",
  color: "#111827"
};

const mechanicButton = {
  ...baseButton,
  background: "linear-gradient(135deg, #2563eb, #1e3a8a)"
};

const clientButton = {
  ...baseButton,
  background: "linear-gradient(135deg, #16a34a, #14532d)"
};

const buttonSubtext = {
  fontSize: "13px",
  fontWeight: "normal",
  opacity: 0.95
};

const linksBox = {
  display: "flex",
  gap: "12px",
  flexWrap: "wrap",
  justifyContent: "center",
  marginTop: "22px"
};

const linkButton = {
  background: "#111827",
  color: "#f59e0b",
  border: "1px solid #f59e0b",
  borderRadius: "999px",
  padding: "11px 15px",
  cursor: "pointer",
  fontWeight: "bold"
};
