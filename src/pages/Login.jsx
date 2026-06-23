import { useState } from "react";
import { supabase } from "../services/supabase";
import logoPC from "../assets/logo-pcmotors.png";

function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState("");
  const [logoActual, setLogoActual] = useState(logoPC);

  const iniciarSesion = async (e) => {
    e.preventDefault();
    setError("");

    if (!email.trim() || !password.trim()) {
      setError("Escribe el email y la contraseña.");
      return;
    }

    setCargando(true);

    const { error: errorLogin } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password
    });

    setCargando(false);

    if (errorLogin) {
      console.log(errorLogin);
      setError("Email o contraseña incorrectos.");
      return;
    }
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
        <p style={subtitleStyle}>Acceso seguro al panel administrativo</p>

        <form onSubmit={iniciarSesion}>
          <label style={labelStyle}>Email</label>
          <input
            type="email"
            placeholder="admin@pcmotors.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={inputStyle}
            autoComplete="email"
          />

          <label style={labelStyle}>Contraseña</label>
          <input
            type="password"
            placeholder="Tu contraseña"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={inputStyle}
            autoComplete="current-password"
          />

          {error && <div style={errorStyle}>{error}</div>}

          <button type="submit" style={buttonStyle} disabled={cargando}>
            {cargando ? "Entrando..." : "🔐 Entrar al sistema"}
          </button>
        </form>

        <button onClick={() => (window.location.href = "/")} style={backButton}>
          ⬅ Volver al inicio
        </button>

        <p style={smallText}>Solo personal autorizado de PC Motors.</p>
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
  padding: "14px",
  overflowX: "hidden"
};

const cardStyle = {
  width: "100%",
  maxWidth: "420px",
  background: "rgba(31, 41, 55, 0.96)",
  border: "1px solid #f59e0b",
  borderRadius: "18px",
  padding: "clamp(20px, 6vw, 30px)",
  boxShadow: "0 20px 50px rgba(0,0,0,0.45)"
};

const logoBoxStyle = {
  width: "118px",
  height: "118px",
  margin: "0 auto 18px auto",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  background: "#020617",
  borderRadius: "14px",
  overflow: "hidden"
};

const logoStyle = {
  width: "100%",
  height: "100%",
  display: "block",
  objectFit: "contain",
  borderRadius: "14px"
};

const titleStyle = {
  color: "#f59e0b",
  textAlign: "center",
  margin: "0 0 8px 0",
  fontSize: "clamp(30px, 9vw, 34px)",
  lineHeight: 1.05
};

const subtitleStyle = {
  color: "#d1d5db",
  textAlign: "center",
  marginBottom: "25px",
  fontSize: "clamp(14px, 4vw, 16px)"
};

const labelStyle = {
  display: "block",
  marginBottom: "8px",
  color: "#f59e0b",
  fontWeight: "bold"
};

const inputStyle = {
  width: "100%",
  padding: "13px",
  marginBottom: "16px",
  borderRadius: "10px",
  border: "1px solid #374151",
  background: "#111827",
  color: "white",
  fontSize: "16px",
  boxSizing: "border-box"
};

const buttonStyle = {
  width: "100%",
  padding: "14px",
  background: "#f59e0b",
  color: "#111827",
  border: "none",
  borderRadius: "10px",
  fontWeight: "bold",
  fontSize: "16px",
  cursor: "pointer",
  marginTop: "5px"
};

const backButton = {
  width: "100%",
  padding: "12px",
  background: "transparent",
  color: "#f59e0b",
  border: "1px solid #f59e0b",
  borderRadius: "10px",
  fontWeight: "bold",
  fontSize: "14px",
  cursor: "pointer",
  marginTop: "12px"
};

const errorStyle = {
  background: "#7f1d1d",
  border: "1px solid #ef4444",
  color: "white",
  padding: "10px",
  borderRadius: "8px",
  marginBottom: "14px"
};

const smallText = {
  color: "#9ca3af",
  fontSize: "12px",
  textAlign: "center",
  marginTop: "18px"
};

export default Login;
