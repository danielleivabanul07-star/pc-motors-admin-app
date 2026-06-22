import { useEffect, useState } from "react";
import { supabase } from "./services/supabase";
import Sidebar from "./components/Sidebar";
import Reportes from "./pages/Reportes";
import Dashboard from "./pages/Dashboard";
import Clientes from "./pages/Clientes";
import Solicitudes from "./pages/Solicitudes";
import RegistroCliente from "./pages/RegistroCliente";
import Historial from "./pages/Historial";
import ArchivoHistorico from "./pages/ArchivoHistorico";
import Mecanicos from "./pages/Mecanicos";
import ReportesMecanicos from "./pages/ReportesMecanicos";
import ControlTrabajosMecanicos from "./pages/ControlTrabajosMecanicos";
import ManoObraPrecios from "./pages/ManoObraPrecios";
import FirmaEstimadoCliente from "./pages/FirmaEstimadoCliente";
import Login from "./pages/Login";
import logoPC from "./assets/logo-pcmotors.png";
import PanelMecanico from "./pages/PanelMecanico";
function App() {
  const [page, setPage] = useState("dashboard");
  const [session, setSession] = useState(null);
  const [cargandoAuth, setCargandoAuth] = useState(true);
  const [esMovil, setEsMovil] = useState(() => window.innerWidth <= 768);

  const path = window.location.pathname;

  const esFirmaEstimado = path.startsWith("/firma-estimado/");
  const tokenFirma = esFirmaEstimado
    ? path.replace("/firma-estimado/", "")
    : "";

  const esRegistroPublico = path === "/registro-publico";

  useEffect(() => {
    const detectarTamano = () => setEsMovil(window.innerWidth <= 768);
    detectarTamano();

    window.addEventListener("resize", detectarTamano);
    return () => window.removeEventListener("resize", detectarTamano);
  }, []);

  useEffect(() => {
    let activo = true;

    const cargarSesion = async () => {
      const { data } = await supabase.auth.getSession();

      if (activo) {
        setSession(data?.session || null);
        setCargandoAuth(false);
      }
    };

    cargarSesion();

    const { data: listener } = supabase.auth.onAuthStateChange((_event, nuevaSession) => {
      setSession(nuevaSession || null);
      setCargandoAuth(false);
    });

    return () => {
      activo = false;
      listener?.subscription?.unsubscribe();
    };
  }, []);

  const cerrarSesion = async () => {
    await supabase.auth.signOut();
    setSession(null);
    setPage("dashboard");
  };

  if (esFirmaEstimado) {
    return <FirmaEstimadoCliente token={tokenFirma} />;
  }

  if (esRegistroPublico) {
    return <RegistroCliente />;
  }

  if (cargandoAuth) {
    return (
      <div style={loadingStyle}>
        <div style={loadingBox}>
          <img
            src={logoPC}
            alt="PC MOTORS"
            style={loadingLogo}
            onError={(e) => {
              e.currentTarget.src = "/logo-pc-motors.png.png";
            }}
          />
          <h2>Cargando PC Motors...</h2>
        </div>
      </div>
    );
  }

  if (!session) {
    return <Login />;
  }

  return (
    <div
      className="app-shell"
      style={{
        ...appStyle,
        flexDirection: esMovil ? "column" : "row",
        backgroundImage: esMovil
          ? "linear-gradient(rgba(17,24,39,0.93), rgba(17,24,39,0.92))"
          : `linear-gradient(rgba(17,24,39,0.65), rgba(17,24,39,0.45)), url(${logoPC})`,
        backgroundSize: esMovil ? "auto" : "1350px",
        backgroundRepeat: "no-repeat",
        backgroundPosition: "center",
        backgroundAttachment: esMovil ? "scroll" : "fixed"
      }}
    >
      <div className="sidebar-mobile-wrap">
        <Sidebar page={page} setPage={setPage} />
      </div>

      <main
        className="app-main"
        style={{
          ...mainStyle,
          padding: esMovil ? "12px" : "30px",
          width: esMovil ? "100%" : "auto",
          maxWidth: esMovil ? "100vw" : "none"
        }}
      >
        <div
          className="top-session-bar"
          style={{
            ...topBarStyle,
            flexDirection: esMovil ? "column" : "row",
            alignItems: esMovil ? "stretch" : "center",
            fontSize: esMovil ? "13px" : "15px"
          }}
        >
          <div>
            <strong>Sesión activa:</strong>{" "}
            <span style={{ color: "#f59e0b" }}>
              {session?.user?.email || "Administrador"}
            </span>
          </div>

          <button onClick={cerrarSesion} style={logoutButton}>
            🚪 Cerrar sesión
          </button>
        </div>

        {page === "dashboard" && <Dashboard />}
        {page === "clientes" && <Clientes />}
        {page === "solicitudes" && <Solicitudes />}
        {page === "registro" && <RegistroCliente />}
        {page === "historial" && <Historial />}
        {page === "archivo" && <ArchivoHistorico />}
        {page === "mecanicos" && <Mecanicos />}
        {page === "mano-obra-precios" && <ManoObraPrecios />}
        {page === "control-trabajos-mecanicos" && <ControlTrabajosMecanicos />}
        {page === "reportes" && <Reportes />}
        {page === "reportes-mecanicos" && <ReportesMecanicos />}
        {page === "panel-mecanico" && <PanelMecanico />}
      </main>
    </div>
  );
}

const appStyle = {
  display: "flex",
  minHeight: "100vh",
  color: "white",
  fontFamily: "Arial",
  overflowX: "hidden"
};

const mainStyle = {
  flex: 1,
  padding: "30px",
  overflowX: "hidden"
};

const topBarStyle = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: "15px",
  background: "rgba(2, 6, 23, 0.9)",
  border: "1px solid #374151",
  borderRadius: "12px",
  padding: "12px 16px",
  marginBottom: "25px"
};

const logoutButton = {
  background: "#dc2626",
  color: "white",
  border: "none",
  borderRadius: "8px",
  padding: "10px 14px",
  fontWeight: "bold",
  cursor: "pointer"
};

const loadingStyle = {
  minHeight: "100vh",
  background: "#020617",
  color: "white",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontFamily: "Arial",
  padding: "20px"
};

const loadingBox = {
  textAlign: "center",
  background: "#111827",
  border: "1px solid #f59e0b",
  borderRadius: "16px",
  padding: "25px",
  width: "100%",
  maxWidth: "360px"
};

const loadingLogo = {
  width: "110px",
  height: "110px",
  objectFit: "contain",
  borderRadius: "14px",
  marginBottom: "15px"
};

export default App;
