import { useEffect, useState } from "react";
import { supabase } from "../services/supabase";

function Mecanicos() {
  const [tiempos, setTiempos] = useState([]);
  const [clientesFinalizados, setClientesFinalizados] = useState([]);
  const [trabajosMecanicos, setTrabajosMecanicos] = useState([]);
  const [facturasTrabajos, setFacturasTrabajos] = useState([]);
  const [mecanicosDB, setMecanicosDB] = useState([]);
  const [busqueda, setBusqueda] = useState("");
  const [cargando, setCargando] = useState(true);
  const [editandoId, setEditandoId] = useState(null);

  const formInicial = {
    nombre: "",
    telefono: "",
    email: "",
    tipo_pago: "salario_fijo",
    salario_fijo: "",
    pago_hora: "",
    porcentaje_comision: ""
  };

  const [form, setForm] = useState(formInicial);

  useEffect(() => {
    cargarDatos();
  }, []);

  useEffect(() => {
    const canal = supabase
      .channel("mecanicos-tiempo-real")
      .on("postgres_changes", { event: "*", schema: "public", table: "mecanicos" }, cargarDatos)
      .on("postgres_changes", { event: "*", schema: "public", table: "tiempos_mecanicos" }, cargarDatos)
      .on("postgres_changes", { event: "*", schema: "public", table: "clientes" }, cargarDatos)
      .on("postgres_changes", { event: "*", schema: "public", table: "trabajos_mecanicos" }, cargarDatos)
      .on("postgres_changes", { event: "*", schema: "public", table: "facturas_trabajos" }, cargarDatos)
      .subscribe();

    return () => {
      supabase.removeChannel(canal);
    };
  }, []);

  const dinero = (valor) => `$${Number(valor || 0).toFixed(2)}`;

  const redondearDinero = (valor) => Math.round(Number(valor || 0) * 100) / 100;

  const calcularGananciaPiezasConCargo = (costoPiezasValor, ventaPiezasValor) => {
    const costoPiezas = Number(costoPiezasValor || 0);
    const ventaPiezas = Number(ventaPiezasValor || 0);
    const cargoPiezas6 = redondearDinero(ventaPiezas * 0.06);
    return redondearDinero((ventaPiezas - costoPiezas) + cargoPiezas6);
  };

  const normalizar = (valor) => String(valor || "").trim().toLowerCase();

  const convertirFechaSupabase = (valor) => {
    if (!valor) return null;
    const texto = String(valor);
    if (texto.endsWith("Z") || texto.includes("+")) return new Date(texto);
    return new Date(texto + "Z");
  };

  const cargarDatos = async () => {
    setCargando(true);

    const { data: tiemposData, error: errorTiempos } = await supabase
      .from("tiempos_mecanicos")
      .select("*")
      .order("hora_inicio", { ascending: false });

    if (errorTiempos) {
      console.log(errorTiempos);
      alert("Error cargando tiempos");
      setCargando(false);
      return;
    }

    const { data: mecanicosData, error: errorMecanicos } = await supabase
      .from("mecanicos")
      .select("*")
      .eq("activo", true)
      .order("nombre", { ascending: true });

    if (errorMecanicos) {
      console.log(errorMecanicos);
      alert("Error cargando mecánicos");
      setCargando(false);
      return;
    }

    const { data: clientesData, error: errorClientes } = await supabase
      .from("clientes")
      .select("*")
      .eq("estado", "finalizado");

    if (errorClientes) {
      console.log(errorClientes);
      alert("Error cargando clientes finalizados");
      setCargando(false);
      return;
    }

    const { data: trabajosData, error: errorTrabajos } = await supabase
      .from("trabajos_mecanicos")
      .select("*")
      .order("id", { ascending: false });

    if (errorTrabajos) {
      console.log(errorTrabajos);
      alert("Error cargando trabajos mecánicos");
      setCargando(false);
      return;
    }

    const { data: facturasData, error: errorFacturas } = await supabase
      .from("facturas_trabajos")
      .select("*")
      .order("creado_en", { ascending: false });

    if (errorFacturas) {
      console.log(errorFacturas);
      alert("Error cargando facturas de trabajos");
      setCargando(false);
      return;
    }

    setTiempos(tiemposData || []);
    setMecanicosDB(mecanicosData || []);
    setClientesFinalizados(clientesData || []);
    setTrabajosMecanicos(trabajosData || []);
    setFacturasTrabajos(facturasData || []);
    setCargando(false);
  };

  const limpiarFormulario = () => {
    setForm(formInicial);
    setEditandoId(null);
  };

  const guardarMecanico = async () => {
    if (!form.nombre.trim()) {
      alert("Escribe el nombre del mecánico");
      return;
    }

    const datosMecanico = {
      nombre: form.nombre.trim(),
      telefono: form.telefono.trim() || null,
      email: form.email.trim() || null,
      tipo_pago: form.tipo_pago,
      salario_fijo: Number(form.salario_fijo || 0),
      pago_hora: Number(form.pago_hora || 0),
      porcentaje_comision: Number(form.porcentaje_comision || 0),
      activo: true
    };

    if (editandoId) {
      const { error } = await supabase
        .from("mecanicos")
        .update(datosMecanico)
        .eq("id", editandoId);

      if (error) {
        console.log(error);
        alert(JSON.stringify(error, null, 2));
        return;
      }

      alert("Mecánico actualizado correctamente");
    } else {
      const { error } = await supabase.from("mecanicos").insert([datosMecanico]);

      if (error) {
        console.log(error);
        alert(JSON.stringify(error, null, 2));
        return;
      }

      alert("Mecánico guardado correctamente");
    }

    limpiarFormulario();
    cargarDatos();
  };

  const buscarMecanicoDB = (nombre) => {
    return mecanicosDB.find((m) => normalizar(m.nombre) === normalizar(nombre));
  };

  const editarMecanico = (mecanico) => {
    if (!mecanico.mecanicoDB) {
      alert("Este mecánico tiene datos registrados, pero todavía no está creado formalmente. Regístralo primero para poder editar su tipo de pago.");
      return;
    }

    setEditandoId(mecanico.mecanicoDB.id);
    setForm({
      nombre: mecanico.mecanicoDB.nombre || "",
      telefono: mecanico.mecanicoDB.telefono || "",
      email: mecanico.mecanicoDB.email || "",
      tipo_pago: mecanico.mecanicoDB.tipo_pago || "salario_fijo",
      salario_fijo: mecanico.mecanicoDB.salario_fijo || "",
      pago_hora: mecanico.mecanicoDB.pago_hora || "",
      porcentaje_comision: mecanico.mecanicoDB.porcentaje_comision || ""
    });

    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const desactivarMecanico = async (mecanico) => {
    if (!mecanico.mecanicoDB) {
      alert("Este mecánico no está registrado formalmente en la tabla de mecánicos.");
      return;
    }

    const confirmar = confirm(`¿Desactivar a ${mecanico.nombre}? No se borran sus registros anteriores.`);
    if (!confirmar) return;

    const { error } = await supabase
      .from("mecanicos")
      .update({ activo: false })
      .eq("id", mecanico.mecanicoDB.id);

    if (error) {
      console.log(error);
      alert(JSON.stringify(error, null, 2));
      return;
    }

    alert("Mecánico desactivado correctamente");
    cargarDatos();
  };

  const limpiarDatosDeMecanico = async (mecanico) => {
    const confirmar = confirm(
      `¿Eliminar TODOS los datos de trabajo y tiempo de ${mecanico.nombre}?\n\nSe eliminarán tiempos de órdenes, trabajos manuales, facturas asociadas a esos trabajos y fotos registradas.\n\nEsta acción no se puede deshacer.`
    );

    if (!confirmar) return;

    const confirmarTexto = prompt('Para confirmar escribe exactamente: ELIMINAR');
    if (confirmarTexto !== "ELIMINAR") {
      alert("Eliminación cancelada.");
      return;
    }

    const trabajosDelMecanico = trabajosMecanicos.filter(
      (trabajo) => normalizar(trabajo.mecanico_nombre) === normalizar(mecanico.nombre)
    );
    const idsTrabajos = trabajosDelMecanico.map((trabajo) => trabajo.id);

    if (idsTrabajos.length > 0) {
      const { error: errorFotos } = await supabase
        .from("fotos_trabajos_mecanicos")
        .delete()
        .in("trabajo_id", idsTrabajos);

      if (errorFotos) {
        console.log(errorFotos);
        alert(JSON.stringify(errorFotos, null, 2));
        return;
      }

      const { error: errorFacturas } = await supabase
        .from("facturas_trabajos")
        .delete()
        .in("trabajo_id", idsTrabajos);

      if (errorFacturas) {
        console.log(errorFacturas);
        alert(JSON.stringify(errorFacturas, null, 2));
        return;
      }

      const { error: errorTrabajos } = await supabase
        .from("trabajos_mecanicos")
        .delete()
        .in("id", idsTrabajos);

      if (errorTrabajos) {
        console.log(errorTrabajos);
        alert(JSON.stringify(errorTrabajos, null, 2));
        return;
      }
    }

    const { error: errorTiempos } = await supabase
      .from("tiempos_mecanicos")
      .delete()
      .eq("mecanico", mecanico.nombre);

    if (errorTiempos) {
      console.log(errorTiempos);
      alert(JSON.stringify(errorTiempos, null, 2));
      return;
    }

    alert("Datos del mecánico eliminados correctamente");
    cargarDatos();
  };

  const limpiarMecanicosDePrueba = async () => {
    const nombresFormales = mecanicosDB.map((m) => normalizar(m.nombre));

    const nombresPruebaTiempos = tiempos
      .map((t) => t.mecanico)
      .filter(Boolean)
      .filter((nombre) => !nombresFormales.includes(normalizar(nombre)));

    const nombresPruebaTrabajos = trabajosMecanicos
      .map((t) => t.mecanico_nombre)
      .filter(Boolean)
      .filter((nombre) => !nombresFormales.includes(normalizar(nombre)));

    const nombresPrueba = [...new Set([...nombresPruebaTiempos, ...nombresPruebaTrabajos])];

    if (nombresPrueba.length === 0) {
      alert("No hay mecánicos de prueba para limpiar.");
      return;
    }

    const confirmar = confirm(
      `Se eliminarán datos de estos mecánicos no registrados:\n\n${nombresPrueba.join(", ")}\n\n¿Continuar?`
    );

    if (!confirmar) return;

    const { error: errorTiempos } = await supabase
      .from("tiempos_mecanicos")
      .delete()
      .in("mecanico", nombresPrueba);

    if (errorTiempos) {
      console.log(errorTiempos);
      alert(JSON.stringify(errorTiempos, null, 2));
      return;
    }

    const trabajosPrueba = trabajosMecanicos.filter((trabajo) =>
      nombresPrueba.some((nombre) => normalizar(nombre) === normalizar(trabajo.mecanico_nombre))
    );

    const idsTrabajos = trabajosPrueba.map((trabajo) => trabajo.id);

    if (idsTrabajos.length > 0) {
      await supabase.from("fotos_trabajos_mecanicos").delete().in("trabajo_id", idsTrabajos);
      await supabase.from("facturas_trabajos").delete().in("trabajo_id", idsTrabajos);
      await supabase.from("trabajos_mecanicos").delete().in("id", idsTrabajos);
    }

    alert("Mecánicos de prueba limpiados correctamente");
    cargarDatos();
  };

  const convertirMinutos = (minutos) => {
    const total = Number(minutos || 0);
    const horas = Math.floor(total / 60);
    const resto = total % 60;

    if (horas === 0) return `${resto} min`;
    if (resto === 0) return `${horas} h`;
    return `${horas} h ${resto} min`;
  };

  const inicioSemana = () => {
    const hoy = new Date();
    const dia = hoy.getDay();
    const diferencia = dia === 0 ? 6 : dia - 1;
    const inicio = new Date(hoy);
    inicio.setDate(hoy.getDate() - diferencia);
    inicio.setHours(0, 0, 0, 0);
    return inicio;
  };

  const finSemana = () => {
    const inicio = inicioSemana();
    const fin = new Date(inicio);
    fin.setDate(inicio.getDate() + 6);
    fin.setHours(23, 59, 59, 999);
    return fin;
  };

  const inicioMes = () => {
    const hoy = new Date();
    return new Date(hoy.getFullYear(), hoy.getMonth(), 1);
  };

  const finMes = () => {
    const hoy = new Date();
    return new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0, 23, 59, 59, 999);
  };

  const clientePerteneceAMecanico = (cliente, nombreMecanico) => {
    const mecanicosTexto = normalizar(cliente.mecanico_principal);
    return mecanicosTexto.includes(normalizar(nombreMecanico));
  };

  const fechaTrabajoManual = (trabajo) => {
    return convertirFechaSupabase(
      trabajo.factura_creada_en || trabajo.hora_fin || trabajo.creado_en || trabajo.hora_inicio
    );
  };

  const trabajoManualEstaFacturado = (trabajo) => {
    return Boolean(trabajo.numero_factura) || facturasTrabajos.some((f) => f.trabajo_id === trabajo.id);
  };

  const numeroFacturaClienteExiste = (numeroFactura) => {
    if (!numeroFactura) return false;
    return clientesFinalizados.some(
      (cliente) => normalizar(cliente.numero_factura) === normalizar(numeroFactura)
    );
  };

  const facturasUnicasPorTrabajo = () => {
    const mapa = new Map();

    facturasTrabajos.forEach((factura) => {
      if (!factura.trabajo_id) return;
      if (!mapa.has(factura.trabajo_id)) {
        mapa.set(factura.trabajo_id, factura);
      }
    });

    return mapa;
  };

  const calcularProduccion = (nombreMecanico, desde, hasta) => {
    const facturasUnicas = facturasUnicasPorTrabajo();
    const trabajosContados = new Set();
    const clientesContados = new Set();

    const clientes = clientesFinalizados.filter((cliente) => {
      if (!cliente.finalizado_en) return false;
      const fecha = convertirFechaSupabase(cliente.finalizado_en);
      if (!fecha || fecha < desde || fecha > hasta) return false;
      if (!clientePerteneceAMecanico(cliente, nombreMecanico)) return false;
      if (clientesContados.has(cliente.id)) return false;
      clientesContados.add(cliente.id);
      return true;
    });

    let produccionTotal = clientes.reduce((total, cliente) => total + Number(cliente.total_final || 0), 0);
    let manoObraGenerada = clientes.reduce((total, cliente) => total + Number(cliente.costo_mano_obra || 0), 0);
    let gananciaPiezas = clientes.reduce((total, cliente) => total + Number(cliente.ganancia_piezas || 0), 0);

    let trabajosFinalizados = clientes.length;

    trabajosMecanicos.forEach((trabajo) => {
      if (normalizar(trabajo.mecanico_nombre) !== normalizar(nombreMecanico)) return;
      if (!trabajoManualEstaFacturado(trabajo)) return;
      if (numeroFacturaClienteExiste(trabajo.numero_factura)) return;
      if (trabajosContados.has(trabajo.id)) return;

      const fecha = fechaTrabajoManual(trabajo);
      if (!fecha || fecha < desde || fecha > hasta) return;

      trabajosContados.add(trabajo.id);
      trabajosFinalizados += 1;

      const factura = facturasUnicas.get(trabajo.id);

      if (factura) {
        produccionTotal += Number(factura.total || 0);
        manoObraGenerada += Number(factura.mano_obra || 0);
        gananciaPiezas += calcularGananciaPiezasConCargo(factura.costo_piezas, factura.venta_piezas);
      } else {
        produccionTotal += Number(trabajo.total_generado || 0);
        manoObraGenerada += Number(trabajo.mano_obra || 0);
        gananciaPiezas += Number(trabajo.ganancia_piezas || 0);
      }
    });

    return {
      trabajosFinalizados,
      produccionTotal,
      manoObraGenerada,
      gananciaPiezas
    };
  };

  const obtenerClaveSemana = (fecha) => {
    if (!fecha || Number.isNaN(fecha.getTime())) return null;

    const copia = new Date(fecha);
    copia.setHours(0, 0, 0, 0);

    const dia = copia.getDay();
    const diferencia = dia === 0 ? 6 : dia - 1;
    copia.setDate(copia.getDate() - diferencia);

    return copia.toISOString().slice(0, 10);
  };

  const fechaEnRango = (fecha, desde, hasta) => {
    return fecha && !Number.isNaN(fecha.getTime()) && fecha >= desde && fecha <= hasta;
  };

  const contarSemanasTrabajadas = (nombreMecanico, desde, hasta) => {
    const semanas = new Set();

    const agregarSemana = (fecha) => {
      if (!fechaEnRango(fecha, desde, hasta)) return;
      const clave = obtenerClaveSemana(fecha);
      if (clave) semanas.add(clave);
    };

    tiempos.forEach((tiempo) => {
      if (normalizar(tiempo.mecanico) !== normalizar(nombreMecanico)) return;
      agregarSemana(convertirFechaSupabase(tiempo.hora_inicio || tiempo.hora_fin));
    });

    clientesFinalizados.forEach((cliente) => {
      if (!clientePerteneceAMecanico(cliente, nombreMecanico)) return;
      agregarSemana(convertirFechaSupabase(cliente.finalizado_en));
    });

    trabajosMecanicos.forEach((trabajo) => {
      if (normalizar(trabajo.mecanico_nombre) !== normalizar(nombreMecanico)) return;
      agregarSemana(fechaTrabajoManual(trabajo));
    });

    return semanas.size;
  };

  const calcularPago = (mecanico, minutos, manoObraComisionable, semanasTrabajadas) => {
    if (!mecanico) return 0;

    const horas = Number(minutos || 0) / 60;
    const salarioFijo = Number(mecanico.salario_fijo || 0);
    const pagoHora = Number(mecanico.pago_hora || 0);
    const porcentaje = Number(mecanico.porcentaje_comision || 0) / 100;
    const baseComision = Number(manoObraComisionable || 0);
    const semanasReales = Math.max(0, Number(semanasTrabajadas || 0));

    if (mecanico.tipo_pago === "salario_fijo") {
      return salarioFijo * semanasReales;
    }

    if (mecanico.tipo_pago === "por_hora") {
      return horas * pagoHora;
    }

    if (mecanico.tipo_pago === "comision") {
      return baseComision * porcentaje;
    }

    if (mecanico.tipo_pago === "salario_mas_comision") {
      return (salarioFijo * semanasReales) + (baseComision * porcentaje);
    }

    return 0;
  };

  const agruparPorMecanico = () => {
    const semana = inicioSemana();
    const mes = inicioMes();
    const finSemanaActual = finSemana();
    const finMesActual = finMes();
    const resumen = {};

    const asegurarMecanico = (nombre) => {
      if (!nombre) return null;

      if (!resumen[nombre]) {
        resumen[nombre] = {
          nombre,
          totalMinutos: 0,
          semanaMinutos: 0,
          mesMinutos: 0,
          trabajos: 0,
          activos: 0,
          trabajosManuales: 0,
          trabajosOrdenes: 0
        };
      }

      return resumen[nombre];
    };

    mecanicosDB.forEach((mecanico) => asegurarMecanico(mecanico.nombre));

    tiempos.forEach((tiempo) => {
      if (!tiempo.mecanico) return;
      const item = asegurarMecanico(tiempo.mecanico);
      if (!item) return;

      const minutos = Number(tiempo.minutos_trabajados || 0);
      const fecha = convertirFechaSupabase(tiempo.hora_inicio);

      item.totalMinutos += minutos;
      item.trabajos += 1;
      item.trabajosOrdenes += 1;

      if (!tiempo.hora_fin) item.activos += 1;
      if (fecha && fecha >= semana) item.semanaMinutos += minutos;
      if (fecha && fecha >= mes) item.mesMinutos += minutos;
    });

    trabajosMecanicos.forEach((trabajo) => {
      if (!trabajo.mecanico_nombre) return;
      const item = asegurarMecanico(trabajo.mecanico_nombre);
      if (!item) return;

      const minutos = Number(trabajo.minutos_trabajados || 0);
      const fecha = convertirFechaSupabase(trabajo.hora_inicio || trabajo.creado_en);

      item.totalMinutos += minutos;
      item.trabajos += 1;
      item.trabajosManuales += 1;

      if (trabajo.estado === "activo") item.activos += 1;
      if (fecha && fecha >= semana) item.semanaMinutos += minutos;
      if (fecha && fecha >= mes) item.mesMinutos += minutos;
    });

    return Object.values(resumen)
      .map((resumenMecanico) => {
        const mecanicoDB = buscarMecanicoDB(resumenMecanico.nombre);
        const produccionSemana = calcularProduccion(resumenMecanico.nombre, semana, finSemanaActual);
        const produccionMes = calcularProduccion(resumenMecanico.nombre, mes, finMesActual);
        const semanasTrabajadasSemana = contarSemanasTrabajadas(resumenMecanico.nombre, semana, finSemanaActual);
        const semanasTrabajadasMes = contarSemanasTrabajadas(resumenMecanico.nombre, mes, finMesActual);

        return {
          ...resumenMecanico,
          mecanicoDB,
          tipo_pago: mecanicoDB?.tipo_pago || "No configurado",
          salario_fijo: mecanicoDB?.salario_fijo || 0,
          pago_hora: mecanicoDB?.pago_hora || 0,
          porcentaje_comision: mecanicoDB?.porcentaje_comision || 0,
          trabajosFinalizadosSemana: produccionSemana.trabajosFinalizados,
          trabajosFinalizadosMes: produccionMes.trabajosFinalizados,
          produccionSemana: produccionSemana.produccionTotal,
          produccionMes: produccionMes.produccionTotal,
          manoObraSemana: produccionSemana.manoObraGenerada,
          manoObraMes: produccionMes.manoObraGenerada,
          gananciaPiezasSemana: produccionSemana.gananciaPiezas,
          gananciaPiezasMes: produccionMes.gananciaPiezas,
          semanasTrabajadasSemana,
          semanasTrabajadasMes,
          baseComisionSemana: produccionSemana.manoObraGenerada,
          baseComisionMes: produccionMes.manoObraGenerada,
          pagoSemana: calcularPago(
            mecanicoDB,
            resumenMecanico.semanaMinutos,
            produccionSemana.manoObraGenerada,
            semanasTrabajadasSemana
          ),
          pagoMes: calcularPago(
            mecanicoDB,
            resumenMecanico.mesMinutos,
            produccionMes.manoObraGenerada,
            semanasTrabajadasMes
          )
        };
      })
      .sort((a, b) => b.produccionMes - a.produccionMes);
  };

  const mecanicos = agruparPorMecanico().filter((mecanico) =>
    mecanico.nombre.toLowerCase().includes(busqueda.toLowerCase())
  );

  const mostrarTipoPago = (tipo) => {
    if (tipo === "salario_fijo") return "Salario fijo semanal";
    if (tipo === "por_hora") return "Pago por hora";
    if (tipo === "comision") return "Comisión";
    if (tipo === "salario_mas_comision") return "Salario semanal + comisión";
    return tipo;
  };

  const guardarReporteMecanico = async (tipo, mecanico) => {
    if (!mecanico.mecanicoDB) {
      alert("Este mecánico debe estar registrado formalmente antes de guardar reportes.");
      return;
    }

    const esSemanal = tipo === "semanal";
    const totalMinutos = esSemanal ? mecanico.semanaMinutos : mecanico.mesMinutos;
    const produccionTotal = esSemanal ? mecanico.produccionSemana : mecanico.produccionMes;
    const manoObraGenerada = esSemanal ? mecanico.manoObraSemana : mecanico.manoObraMes;
    const pagoCalculado = esSemanal ? mecanico.pagoSemana : mecanico.pagoMes;
    const totalTrabajos = esSemanal ? mecanico.trabajosFinalizadosSemana : mecanico.trabajosFinalizadosMes;

    const confirmar = confirm(
      `¿Guardar reporte ${esSemanal ? "semanal" : "mensual"} de ${mecanico.nombre}?\n\nPago calculado: ${dinero(pagoCalculado)}`
    );

    if (!confirmar) return;

    const { error } = await supabase.from("reportes_mecanicos").insert([
      {
        tipo,
        mecanico_id: mecanico.mecanicoDB.id,
        mecanico_nombre: mecanico.nombre,
        fecha_inicio: esSemanal
          ? inicioSemana().toISOString().slice(0, 10)
          : inicioMes().toISOString().slice(0, 10),
        fecha_fin: esSemanal
          ? finSemana().toISOString().slice(0, 10)
          : finMes().toISOString().slice(0, 10),
        total_trabajos: totalTrabajos,
        total_minutos: totalMinutos,
        total_horas: Number((totalMinutos / 60).toFixed(2)),
        produccion_total: Number(produccionTotal || 0),
        mano_obra_generada: Number(manoObraGenerada || 0),
        pago_calculado: Number(pagoCalculado || 0),
        tipo_pago: mecanico.tipo_pago,
        estado_pago: "pendiente"
      }
    ]);

    if (error) {
      console.log(error);
      alert(JSON.stringify(error, null, 2));
      return;
    }

    alert("Reporte de mecánico guardado correctamente");
  };

  return (
    <div>
      <h1 style={titleStyle}>👨‍🔧 Panel de Mecánicos</h1>

      <div style={formBox}>
        <h2 style={{ color: "#f59e0b", marginTop: 0 }}>
          {editandoId ? "✏️ Editar Mecánico" : "➕ Registrar Mecánico"}
        </h2>

        <input placeholder="Nombre del mecánico" value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} style={inputStyle} />
        <input placeholder="Teléfono" value={form.telefono} onChange={(e) => setForm({ ...form, telefono: e.target.value })} style={inputStyle} />
        <input placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} style={inputStyle} />

        <select value={form.tipo_pago} onChange={(e) => setForm({ ...form, tipo_pago: e.target.value })} style={inputStyle}>
          <option value="salario_fijo">Salario fijo semanal</option>
          <option value="por_hora">Pago por hora</option>
          <option value="comision">Comisión</option>
          <option value="salario_mas_comision">Salario semanal + comisión</option>
        </select>

        <input placeholder="Salario fijo semanal" type="number" value={form.salario_fijo} onChange={(e) => setForm({ ...form, salario_fijo: e.target.value })} style={inputStyle} />
        <input placeholder="Pago por hora" type="number" value={form.pago_hora} onChange={(e) => setForm({ ...form, pago_hora: e.target.value })} style={inputStyle} />
        <input placeholder="Porcentaje comisión. Ejemplo: 40" type="number" value={form.porcentaje_comision} onChange={(e) => setForm({ ...form, porcentaje_comision: e.target.value })} style={inputStyle} />

        <button onClick={guardarMecanico} style={saveButton}>
          {editandoId ? "Guardar Cambios" : "Guardar Mecánico"}
        </button>

        {editandoId && <button onClick={limpiarFormulario} style={cancelButton}>Cancelar Edición</button>}
      </div>

      <button onClick={limpiarMecanicosDePrueba} style={cleanButton}>🧹 Limpiar Mecánicos de Prueba</button>

      <input placeholder="Buscar mecánico..." value={busqueda} onChange={(e) => setBusqueda(e.target.value)} style={searchStyle} />

      {cargando ? (
        <p>Cargando mecánicos...</p>
      ) : mecanicos.length === 0 ? (
        <div style={emptyStyle}>No hay mecánicos registrados.</div>
      ) : (
        <div style={gridStyle}>
          {mecanicos.map((mecanico) => (
            <div key={mecanico.nombre} style={cardStyle}>
              <h2 style={{ color: "#f59e0b", marginTop: 0 }}>{mecanico.nombre}</h2>

              <p><strong>Tipo de pago:</strong> {mostrarTipoPago(mecanico.tipo_pago)}</p>
              <p><strong>Salario fijo semanal:</strong> {dinero(mecanico.salario_fijo)}</p>
              <p><strong>Pago por hora:</strong> {dinero(mecanico.pago_hora)}</p>
              <p><strong>Comisión:</strong> {Number(mecanico.porcentaje_comision || 0)}%</p>

              <hr style={lineStyle} />

              <p><strong>⏱ Esta semana:</strong> {convertirMinutos(mecanico.semanaMinutos)}</p>
              <p><strong>🗓 Este mes:</strong> {convertirMinutos(mecanico.mesMinutos)}</p>
              <p><strong>📊 Total histórico:</strong> {convertirMinutos(mecanico.totalMinutos)}</p>
              <p><strong>🔧 Trabajos registrados:</strong> {mecanico.trabajos}</p>
              <p><strong>📋 Desde órdenes/clientes:</strong> {mecanico.trabajosOrdenes}</p>
              <p><strong>🛠 Desde control trabajos:</strong> {mecanico.trabajosManuales}</p>
              <p><strong>🟢 Trabajos activos:</strong> {mecanico.activos}</p>

              <hr style={lineStyle} />

              <p><strong>Trabajos facturados semana:</strong> {mecanico.trabajosFinalizadosSemana}</p>
              <p><strong>Trabajos facturados mes:</strong> {mecanico.trabajosFinalizadosMes}</p>
              <p><strong>Producción real semana:</strong> {dinero(mecanico.produccionSemana)}</p>
              <p><strong>Producción real mes:</strong> {dinero(mecanico.produccionMes)}</p>
              <p><strong>Mano de obra semana:</strong> {dinero(mecanico.manoObraSemana)}</p>
              <p><strong>Mano de obra mes:</strong> {dinero(mecanico.manoObraMes)}</p>
              <p><strong>Ganancia piezas semana:</strong> {dinero(mecanico.gananciaPiezasSemana)}</p>
              <p><strong>Ganancia piezas mes:</strong> {dinero(mecanico.gananciaPiezasMes)}</p>
              <p><strong>Base comisión semana:</strong> {dinero(mecanico.baseComisionSemana)}</p>
              <p><strong>Base comisión mes:</strong> {dinero(mecanico.baseComisionMes)}</p>
              <p>
                <strong>💰 Comisión ganada semana:</strong>{" "}
                {dinero(
                  mecanico.tipo_pago === "comision" ||
                  mecanico.tipo_pago === "salario_mas_comision"
                    ? mecanico.baseComisionSemana *
                        (Number(mecanico.porcentaje_comision || 0) / 100)
                    : 0
                )}
              </p>
              <p>
                <strong>💰 Comisión ganada mes:</strong>{" "}
                {dinero(
                  mecanico.tipo_pago === "comision" ||
                  mecanico.tipo_pago === "salario_mas_comision"
                    ? mecanico.baseComisionMes *
                        (Number(mecanico.porcentaje_comision || 0) / 100)
                    : 0
                )}
              </p>
              <p><strong>Semanas reales trabajadas semana:</strong> {mecanico.semanasTrabajadasSemana}</p>
              <p><strong>Semanas reales trabajadas mes:</strong> {mecanico.semanasTrabajadasMes}</p>

              <hr style={lineStyle} />

              <p><strong>Pago calculado semana:</strong> {dinero(mecanico.pagoSemana)}</p>
              <p><strong>Pago calculado mes:</strong> {dinero(mecanico.pagoMes)}</p>

              <p style={{ color: "#22c55e", fontWeight: "bold", fontSize: "18px" }}>
                💵 Total a pagar semana: {dinero(mecanico.pagoSemana)}
              </p>

              <p style={{ color: "#22c55e", fontWeight: "bold", fontSize: "18px" }}>
                💵 Total a pagar mes: {dinero(mecanico.pagoMes)}
              </p>

              <button onClick={() => guardarReporteMecanico("semanal", mecanico)} style={reportButton}>💾 Guardar Reporte Semanal</button>
              <button onClick={() => guardarReporteMecanico("mensual", mecanico)} style={reportButton}>💾 Guardar Reporte Mensual</button>
              <button onClick={() => editarMecanico(mecanico)} style={editButton}>✏️ Editar Mecánico</button>
              <button onClick={() => desactivarMecanico(mecanico)} style={deleteButton}>🚫 Desactivar</button>
              <button onClick={() => limpiarDatosDeMecanico(mecanico)} style={cleanButtonSmall}>🧹 Limpiar Datos</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const titleStyle = { color: "#f59e0b", marginBottom: "20px" };
const formBox = { background: "rgba(31, 41, 55, 0.95)", padding: "20px", borderRadius: "14px", border: "1px solid #f59e0b", marginBottom: "25px" };
const inputStyle = { width: "100%", padding: "12px", marginBottom: "12px", borderRadius: "8px", border: "1px solid #374151", background: "#111827", color: "white", boxSizing: "border-box" };
const saveButton = { width: "100%", padding: "12px", background: "#16a34a", color: "white", border: "none", borderRadius: "8px", cursor: "pointer", fontWeight: "bold", marginBottom: "10px" };
const cancelButton = { width: "100%", padding: "12px", background: "#6b7280", color: "white", border: "none", borderRadius: "8px", cursor: "pointer", fontWeight: "bold" };
const cleanButton = { width: "100%", padding: "12px", background: "#92400e", color: "white", border: "none", borderRadius: "8px", cursor: "pointer", fontWeight: "bold", marginBottom: "18px" };
const searchStyle = { width: "100%", padding: "12px", marginBottom: "25px", borderRadius: "10px", border: "1px solid #374151", background: "#1f2937", color: "white" };
const gridStyle = { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))", gap: "20px" };
const cardStyle = { background: "rgba(31, 41, 55, 0.95)", padding: "20px", borderRadius: "14px", border: "1px solid #374151", color: "white" };
const lineStyle = { border: "none", borderTop: "1px solid #374151", margin: "15px 0" };
const reportButton = { width: "100%", padding: "12px", marginTop: "10px", background: "#16a34a", color: "white", border: "none", borderRadius: "8px", cursor: "pointer", fontWeight: "bold" };
const editButton = { width: "100%", padding: "12px", marginTop: "15px", background: "#2563eb", color: "white", border: "none", borderRadius: "8px", cursor: "pointer", fontWeight: "bold" };
const deleteButton = { width: "100%", padding: "12px", marginTop: "10px", background: "#dc2626", color: "white", border: "none", borderRadius: "8px", cursor: "pointer", fontWeight: "bold" };
const cleanButtonSmall = { width: "100%", padding: "12px", marginTop: "10px", background: "#92400e", color: "white", border: "none", borderRadius: "8px", cursor: "pointer", fontWeight: "bold" };
const emptyStyle = { background: "#1f2937", padding: "20px", borderRadius: "12px", border: "1px solid #374151" };

export default Mecanicos;
