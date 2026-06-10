import { useState } from "react";
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
import logoPC from "./assets/logo-pcmotors.png";

function App() {
  const [page, setPage] = useState("dashboard");

  const path = window.location.pathname;
  const esFirmaEstimado = path.startsWith("/firma-estimado/");
  const tokenFirma = esFirmaEstimado ? path.replace("/firma-estimado/", "") : "";

  if (esFirmaEstimado) {
    return <FirmaEstimadoCliente token={tokenFirma} />;
  }

  return (
    <div
      style={{
        ...appStyle,
        backgroundImage: `linear-gradient(rgba(17,24,39,0.65), rgba(17,24,39,0.45)), url(${logoPC})`,
        backgroundSize: "1350px",
        backgroundRepeat: "no-repeat",
        backgroundPosition: "center",
        backgroundAttachment: "fixed"
      }}
    >
      <Sidebar page={page} setPage={setPage} />

      <main style={mainStyle}>
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
      </main>
    </div>
  );
}

const appStyle = {
  display: "flex",
  minHeight: "100vh",
  color: "white",
  fontFamily: "Arial"
};

const mainStyle = {
  flex: 1,
  padding: "30px"
};

export default App;