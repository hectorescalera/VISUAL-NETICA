// MAPA DE HORARIOS ESCOLARES COMPLETO
const HORARIOS_GRUPOS = {
  "6R_LUN": { inicio: "09:00", fin: "10:20" },
  "4B_LUN": { inicio: "12:00", fin: "13:20" },
  
  "4V_MAR": { inicio: "07:40", fin: "09:00" },
  "6V_MAR": { inicio: "09:00", fin: "10:20" },
  "3A_MAR": { inicio: "11:20", fin: "12:40" },
  "4R_MAR": { inicio: "12:40", fin: "14:00" },
  
  "3B_MIE": { inicio: "07:40", fin: "09:00" },
  "6B_MIE": { inicio: "09:00", fin: "10:20" },
  "3N_MIE": { inicio: "11:20", fin: "12:40" },
  "3R_MIE": { inicio: "12:40", fin: "14:00" },
  
  "5B_JUE": { inicio: "07:40", fin: "09:00" },
  "5V_JUE": { inicio: "09:00", fin: "10:20" },
  "5A_JUE": { inicio: "11:20", fin: "12:40" },
  "5R_JUE": { inicio: "12:40", fin: "14:00" },
  
  "4A_VIE": { inicio: "09:00", fin: "10:20" },
  "6A_VIE": { inicio: "11:20", fin: "12:40" },
  "3V_VIE": { inicio: "12:40", fin: "14:00" }
};

const DIAS_SEMANA = { LUN: 1, MAR: 2, MIE: 3, JUE: 4, VIE: 5 };
const NOMBRES_DIAS = {
  LUN: "Lunes",
  MAR: "Martes",
  MIE: "Miércoles",
  JUE: "Jueves",
  VIE: "Viernes"
};

const ALUMNOS_LISTA_ANTERIOR = "Jorge Escudero, Emiliano Duarte, Natalia Baca, Luz, Samarah Urrutia, Regina Villalobos, Leonardo García, Gerardo González, Victoria Silva, Lucía Achaval, Elías, Carlos Orozco, Liam Luján, Carol Islas, Ana Ibarra, Lourdes Quiróz, Bibiana Gómez, Manuel Ramírez, Marcelo Vázquez, Slaimen Ferez, Óscar Carrasco, Pablo, León Flores, Andrea Chávez, Mauro López";

function crearGruposPredeterminados() {
  return Object.entries(HORARIOS_GRUPOS).map(([id, horario]) => {
    const [codigo, dia] = id.split("_");
    const coincidencia = codigo.match(/^(\d+)([A-Z])$/);
    const nombre = coincidencia ? `${coincidencia[1]}° ${coincidencia[2]}` : codigo;
    return {
      id,
      nombre,
      dia,
      inicio: horario.inicio,
      fin: horario.fin,
      alumnos: id === "4A_VIE" ? ALUMNOS_LISTA_ANTERIOR.split(",").map(alumno => alumno.trim()) : []
    };
  });
}

let gruposConfigurados = crearGruposPredeterminados();
let grupoActivoKey = null;
let grupoHorarioAutomaticoKey = null;
let grupoCambioPendienteKey = null;
let grupoCambioPendienteManual = false;
let horaInicioClase = null;
let horaDesarmeClase = null;
let horaFinClase = null;
let sesionCerrada = false;
let sesionCierreIntentada = false;
let sesionCierrePendiente = false;
let sesionSoloLectura = false;

let temaActual = "theme-dark";
let fuenteActual = "font-orbitron";
let imagenLocalBase64 = null;
let cantidadEquipos = 7;
let minutosAntesDesarme = 8;

// REGISTRO DE EQUIPOS POR SESIÓN Y TEMPORIZADOR DE GUARDADO DE ALUMNOS
const CLAVE_REGISTRO_EQUIPOS = "robotica_historial_equipos";
const CLAVE_REGISTRO_ASISTENCIA = "robotica_historial_asistencia";
const CLAVE_REGISTRO_EVALUACION = "robotica_historial_evaluacion";
const ESTADOS_EQUIPO_EVALUACION = ["pendiente", "terminado", "no_terminado"];
const ESTADOS_ASISTENCIA = [
  { valor: "", etiqueta: "Sin marcar", marca: "□", clase: "sin-marcar" },
  { valor: "presente", etiqueta: "Presente", marca: "✓", clase: "presente" },
  { valor: "falta", etiqueta: "Falta", marca: "×", clase: "falta" },
  { valor: "justificada", etiqueta: "Justificada", marca: "/", clase: "justificada" }
];
const ESTADOS_ASISTENCIA_ANTERIORES = [
  { valor: "falta", etiqueta: "Falta (registro anterior)", marca: "×", clase: "falta" },
  { valor: "retardo", etiqueta: "Retardo (registro anterior)", marca: "R", clase: "retardo" }
];
let historialEquipos = [];
let equiposActuales = [];
let equiposActualesFijados = false;
let alumnoArrastradoEquipo = null;
let registroEquiposActualId = null;
let claveSesionEquipos = null;
let periodosEscolares = {
  "period-1": { inicio: "", fin: "" },
  "period-2": { inicio: "", fin: "" },
  "period-3": { inicio: "", fin: "" }
};
let historialAsistencia = [];
let asistenciaActual = new Map();
let asistenciaTomada = false;
let modoAsistenciaActivo = false;
let historialEvaluacion = [];
let resultadosEquiposActuales = new Map();
let calificacionesManualesActuales = new Map();
let ajustesCalificacionActuales = new Map();
let calificacionMinimaFalta = 0;
let calificacionMaximaAjustes = 10;
let calificacionPredeterminadaIndividual = 6;
let calificacionMinimaEquipo = 8;
let calificacionMaximaEquipo = 10;
let calificacionPredeterminadaEquipo = 8;
let modoEvaluacionActivo = false;
let temporizadorGuardadoAlumnos = null;

// INICIALIZACIÓN Y CARGA DE LOCALSTORAGE
document.addEventListener("DOMContentLoaded", () => {
  cargarHistorialEquipos();
  cargarHistorialAsistencia();
  cargarHistorialEvaluacion();
  cargarConfiguracionGuardada();
  revisarHorarioAutomatico();
  actualizarResumenAsistencia();
  actualizarControlesEvaluacion();
  renderizarHistorialAsistencia();

  // Al editar el cuadro de alumnos, se guarda en la lista del grupo activo
  document.getElementById("input-students").addEventListener("input", () => {
    clearTimeout(temporizadorGuardadoAlumnos);
    temporizadorGuardadoAlumnos = setTimeout(guardarAlumnosDelGrupoActivo, 500);
    actualizarResumenAsistencia();
  });

  actualizarEquipos(cantidadEquipos);
  actualizarReloj();
  setInterval(actualizarReloj, 1000);
  setInterval(revisarHorarioAutomatico, 1000);
});

function actualizarReloj() {
  const ahora = new Date();
  document.getElementById("main-clock").innerText = formatearHora12(
    ahora.getHours(),
    ahora.getMinutes(),
    ahora.getSeconds()
  );

  const opcionesFecha = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
  document.getElementById("current-date").innerText = ahora.toLocaleDateString('es-MX', opcionesFecha);

  if (horaInicioClase && horaFinClase) {
    evaluarEstadoClase(ahora);
  }
}

function revisarHorarioAutomatico(ahora = new Date()) {
  const diaActual = ahora.getDay();
  const minutosActuales = ahora.getHours() * 60 + ahora.getMinutes();
  const grupoEnHorario = gruposConfigurados.find(grupo => {
    if (DIAS_SEMANA[grupo.dia] !== diaActual) return false;
    const [inicioHoras, inicioMinutos] = grupo.inicio.split(":").map(Number);
    const [finHoras, finMinutos] = grupo.fin.split(":").map(Number);
    const minutosInicio = inicioHoras * 60 + inicioMinutos;
    const minutosFin = finHoras * 60 + finMinutos;
    return minutosActuales >= minutosInicio && minutosActuales < minutosFin;
  });
  const siguienteGrupoHorarioKey = grupoEnHorario ? grupoEnHorario.id : null;

  if (siguienteGrupoHorarioKey === grupoHorarioAutomaticoKey) return;
  grupoHorarioAutomaticoKey = siguienteGrupoHorarioKey;

  if (grupoEnHorario) {
    solicitarCambioGrupo(grupoEnHorario.id, false);
  }
}

function cambiarGrupo() {
  solicitarCambioGrupo(document.getElementById("group-select").value, true);
}

function solicitarCambioGrupo(grupoKey, seleccionManual = false) {
  if (grupoKey === grupoActivoKey) return;
  if (modoAsistenciaActivo || modoEvaluacionActivo) {
    grupoCambioPendienteKey = grupoKey;
    grupoCambioPendienteManual = seleccionManual;
    document.getElementById("group-select").value = grupoActivoKey || "";
    mostrarAvisoCambioGrupoPendiente();
    return;
  }

  aplicarCambioGrupo(grupoKey, seleccionManual);
}

function mostrarAvisoCambioGrupoPendiente() {
  const grupoPendiente = gruposConfigurados.find(grupo => grupo.id === grupoCambioPendienteKey);
  const modosActivos = [];
  if (modoAsistenciaActivo) modosActivos.push("toma de lista");
  if (modoEvaluacionActivo) modosActivos.push("evaluación de equipos");
  const aviso = document.getElementById("session-change-notice");
  aviso.innerText = `El cambio al grupo ${grupoPendiente ? grupoPendiente.nombre : "sin grupo"} está pendiente. Termina y desactiva ${modosActivos.join(" y ")} para aplicarlo; la sesión actual seguirá abierta.`;
  aviso.classList.remove("hidden");
}

function aplicarCambioGrupoPendienteSiListo() {
  if (modoAsistenciaActivo || modoEvaluacionActivo || grupoCambioPendienteKey === null) return;
  const grupoPendienteKey = grupoCambioPendienteKey;
  const seleccionPendienteManual = grupoCambioPendienteManual;
  grupoCambioPendienteKey = null;
  grupoCambioPendienteManual = false;
  aplicarCambioGrupo(grupoPendienteKey, seleccionPendienteManual);
}

function actualizarAvisoCierrePendiente() {
  const modosActivos = [];
  if (modoAsistenciaActivo) modosActivos.push("la toma de asistencia");
  if (modoEvaluacionActivo) modosActivos.push("la evaluación de equipos");
  const aviso = document.getElementById("session-end-notice");
  const horarioTerminado = horaFinClase && new Date() >= horaFinClase;
  const motivo = horarioTerminado ? "El horario terminó" : "Se solicitó cerrar la sesión";
  aviso.innerText = `${motivo}. La sesión seguirá abierta para que completes ${modosActivos.join(" y ")}. Al desactivar el último modo se guardarán los pendientes y se cerrará automáticamente.`;
  aviso.classList.remove("hidden");
}

function aplicarCambioGrupo(grupoKey, seleccionManual = false) {
  const claseActualIniciada = horaInicioClase && new Date() >= horaInicioClase;
  if (claveSesionEquipos && grupoKey !== grupoActivoKey && claseActualIniciada && !sesionSoloLectura && !cerrarSesionActual()) {
    document.getElementById("group-select").value = grupoActivoKey || "";
    return;
  }
  grupoCambioPendienteKey = null;
  grupoCambioPendienteManual = false;
  document.getElementById("session-change-notice").classList.add("hidden");
  document.getElementById("session-end-notice").classList.add("hidden");
  document.getElementById("group-select").value = grupoKey;
  modoEvaluacionActivo = false;
  sesionCerrada = false;
  sesionCierreIntentada = false;
  sesionCierrePendiente = false;
  sesionSoloLectura = false;
  registroEquiposActualId = null;

  const select = document.getElementById("group-select");
  grupoActivoKey = select.value;
  const grupoActivo = gruposConfigurados.find(grupo => grupo.id === grupoActivoKey);

  if (!grupoActivo) {
    claveSesionEquipos = null;
    equiposActuales = [];
    equiposActualesFijados = false;
    asistenciaActual = new Map();
    asistenciaTomada = false;
    modoAsistenciaActivo = false;
    resultadosEquiposActuales = new Map();
    calificacionesManualesActuales = new Map();
    ajustesCalificacionActuales = new Map();
    sesionCerrada = false;
    sesionCierreIntentada = false;
    sesionCierrePendiente = false;
    sesionSoloLectura = false;
    registroEquiposActualId = null;
    limpiarRelojClase();
    document.getElementById("input-students").disabled = false;
    document.getElementById("input-students").value = "";
    mostrarEquipos([]);
    actualizarResumenAsistencia();
    actualizarControlesEvaluacion();
    renderizarHistorialAsistencia();
    actualizarEstadoEquipos("Selecciona un grupo para sortear o fijar equipos.");
    return;
  }

  const ahora = new Date();
  const diaClase = DIAS_SEMANA[grupoActivo.dia];
  let diferenciaDias = (diaClase - ahora.getDay() + 7) % 7;
  const fechaClase = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate() + diferenciaDias);
  horaInicioClase = crearFechaHorario(fechaClase, grupoActivo.inicio);
  horaFinClase = crearFechaHorario(fechaClase, grupoActivo.fin);

  if (diferenciaDias === 0 && ahora >= horaFinClase) {
    diferenciaDias = 7;
    const fechaSiguiente = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate() + diferenciaDias);
    horaInicioClase = crearFechaHorario(fechaSiguiente, grupoActivo.inicio);
    horaFinClase = crearFechaHorario(fechaSiguiente, grupoActivo.fin);
  }
  sesionSoloLectura = seleccionManual && ahora >= horaFinClase;

  document.getElementById("input-students").value = grupoActivo.alumnos.join("\n");
  document.querySelector(".daily-roster").open = true;

  claveSesionEquipos = crearClaveSesionEquipos(grupoActivo, horaInicioClase);
  cargarEquiposSesionActual();
  cargarAsistenciaSesionActual();
  cargarEvaluacionSesionActual();
  sesionSoloLectura = sesionSoloLectura || sesionCerrada;
  document.getElementById("input-students").disabled = sesionSoloLectura;
  if (sesionSoloLectura) {
    actualizarEstadoEquipos("Horario concluido: solo lectura. Administra sus registros desde el historial.");
    actualizarResumenAsistencia();
    actualizarControlesEvaluacion();
  }

  actualizarHoraDesarme();

  document.getElementById("end-time").innerText = formatearHoraCorta(horaFinClase);

  actualizarReloj();
}

function crearFechaHorario(fecha, hora) {
  const [horas, minutos] = hora.split(":").map(Number);
  const fechaHorario = new Date(fecha);
  fechaHorario.setHours(horas, minutos, 0, 0);
  return fechaHorario;
}

function actualizarHoraDesarme(minutos = minutosAntesDesarme) {
  document.getElementById("disassemble-label").innerText = `Hora de Desarmar (${minutos} min antes)`;
  if (!horaFinClase) {
    document.getElementById("disassemble-time").innerText = "--:--";
    return;
  }

  horaDesarmeClase = new Date(horaFinClase.getTime() - (minutos * 60 * 1000));
  document.getElementById("disassemble-time").innerText = formatearHoraCorta(horaDesarmeClase);
}

function previsualizarMinutosDesarme() {
  const minutos = document.getElementById("input-disassemble-minutes").valueAsNumber;
  if (Number.isInteger(minutos) && minutos > 0) {
    actualizarHoraDesarme(minutos);
  }
}

function evaluarEstadoClase(ahora) {
  const timeCard = document.getElementById("time-card");
  const statusBadge = document.getElementById("status-badge");
  const progressBar = document.getElementById("class-progress");
  const timeRemainingText = document.getElementById("time-remaining-text");

  const totalDuracion = horaFinClase - horaInicioClase;
  const transcurrido = ahora - horaInicioClase;

  if (ahora < horaInicioClase) {
    statusBadge.innerText = "ESPERANDO INICIO";
    actualizarClaseIndicador(statusBadge, "status-idle");
    statusBadge.style.background = "#334155";
    timeCard.classList.remove("disassemble-alert");
    progressBar.style.width = "0%";
    timeRemainingText.innerText = formatearTiempoParaIniciar(horaInicioClase, ahora);
  } else if (ahora >= horaInicioClase && ahora < horaDesarmeClase) {
    statusBadge.innerText = "🔨 MODO CONSTRUCCIÓN";
    actualizarClaseIndicador(statusBadge, "status-building");
    statusBadge.style.background = "var(--status-green)";
    timeCard.classList.remove("disassemble-alert");

    const pct = Math.min(100, Math.max(0, (transcurrido / totalDuracion) * 100));
    progressBar.style.width = `${pct}%`;
    progressBar.style.backgroundColor = "var(--accent-blue)";

    const minParaDesarme = Math.ceil((horaDesarmeClase - ahora) / 60000);
    timeRemainingText.innerText = `Tiempo para desarmar: ${minParaDesarme} min`;
  } else if (ahora >= horaDesarmeClase && ahora < horaFinClase) {
    statusBadge.innerText = "⚠️ HORA DE DESARMAR";
    actualizarClaseIndicador(statusBadge, "status-disassemble");
    statusBadge.style.background = "var(--alert-orange)";
    timeCard.classList.add("disassemble-alert");

    const pct = Math.min(100, Math.max(0, (transcurrido / totalDuracion) * 100));
    progressBar.style.width = `${pct}%`;
    progressBar.style.backgroundColor = "var(--alert-orange)";

    const minParaFin = Math.ceil((horaFinClase - ahora) / 60000);
    timeRemainingText.innerText = `¡Atención! Fin de clase en: ${minParaFin} min`;
  } else {
    statusBadge.innerText = "CLASE CONCLUIDA";
    actualizarClaseIndicador(statusBadge, "status-finished");
    statusBadge.style.background = "var(--alert-red)";
    timeCard.classList.remove("disassemble-alert");
    progressBar.style.width = "100%";
    progressBar.style.backgroundColor = "var(--alert-red)";
    timeRemainingText.innerText = "Momento de guardar kits y cambiar de grupo";
    if (!sesionCerrada && !sesionCierreIntentada) {
      sesionCierreIntentada = true;
      cerrarSesionActual();
    }
  }
}

function formatearTiempoParaIniciar(inicio, ahora) {
  const minutosTotales = Math.ceil((inicio - ahora) / 60000);
  const dias = Math.floor(minutosTotales / 1440);
  const horas = Math.floor((minutosTotales % 1440) / 60);
  const minutos = minutosTotales % 60;
  const partes = [];

  if (dias > 0) partes.push(`${dias} día${dias === 1 ? "" : "s"}`);
  if (horas > 0) partes.push(`${horas} h`);
  if (minutos > 0) partes.push(`${minutos} min`);

  return `Faltan ${partes.join(", ")} para iniciar`;
}

function actualizarClaseIndicador(indicador, estado) {
  indicador.classList.remove("status-idle", "status-building", "status-disassemble", "status-finished");
  indicador.classList.add(estado);
}

function limpiarRelojClase() {
  horaInicioClase = null;
  horaDesarmeClase = null;
  horaFinClase = null;
  document.getElementById("disassemble-time").innerText = "--:--";
  document.getElementById("end-time").innerText = "--:--";
  const statusBadge = document.getElementById("status-badge");
  statusBadge.innerText = "CLASE NO INICIADA";
  actualizarClaseIndicador(statusBadge, "status-idle");
  document.getElementById("time-remaining-text").innerText = "Selecciona un grupo para iniciar el cronómetro";
  document.getElementById("class-progress").style.width = "0%";
  document.getElementById("time-card").classList.remove("disassemble-alert");
}

function formatearHoraCorta(dateObj) {
  return formatearHora12(dateObj.getHours(), dateObj.getMinutes());
}

function formatearHoraProgramada(hora) {
  const [horas, minutos] = hora.split(":").map(Number);
  return formatearHora12(horas, minutos);
}

function formatearHora12(horas, minutos, segundos) {
  const hora12 = String(horas % 12 || 12).padStart(2, "0");
  const minutosFormateados = String(minutos).padStart(2, "0");
  const segundosFormateados = segundos === undefined
    ? ""
    : `:${String(segundos).padStart(2, "0")}`;
  const periodo = horas >= 12 ? "PM" : "AM";
  return `${hora12}:${minutosFormateados}${segundosFormateados} ${periodo}`;
}

// CONTROL DE EQUIPOS
function toggleSeccionEquipos() {
  const section = document.getElementById("teams-section");
  const arrow = document.getElementById("toggle-arrow");
  actualizarEquipos(cantidadEquipos);
  section.classList.toggle("collapsed");
  const seccionColapsada = section.classList.contains("collapsed");
  document.body.classList.toggle("teams-expanded", !seccionColapsada);
  if (!seccionColapsada && equiposActuales.some(equipo => equipo.length > 0)) {
    document.querySelector(".daily-roster").open = false;
  }
  if (seccionColapsada) {
    arrow.innerText = "▲ Mostrar Equipos";
  } else {
    arrow.innerText = "▼ Ocultar Equipos";
  }
}

function actualizarEquipos(cantidad, conservarAlumnos = true) {
  const grid = document.getElementById("teams-grid-content");
  const equiposCompletos = grid.children.length === cantidad
    && Array.from(grid.children).every(card => {
      const lista = card.querySelector(".team-members-list");
      return lista && lista.children.length > 0;
    });

  if (equiposCompletos) {
    document.getElementById("teams-title").innerText = `EQUIPOS DE TRABAJO (${cantidad} EQUIPOS)`;
    return;
  }

  const alumnos = conservarAlumnos
    ? Array.from(grid.querySelectorAll(".team-members-list li"))
      .map(item => {
        const nombre = item.querySelector(".team-member-name");
        return nombre ? nombre.innerText : item.innerText;
      })
      .filter(nombre => nombre !== "Sin asignar")
    : [];

  grid.innerHTML = "";
  document.getElementById("teams-title").innerText = `EQUIPOS DE TRABAJO (${cantidad} EQUIPOS)`;

  for (let equipo = 1; equipo <= cantidad; equipo++) {
    const card = document.createElement("div");
    card.className = "team-card";

    const title = document.createElement("div");
    title.className = "team-title";
    title.innerText = `Equipo ${equipo}`;

    const list = document.createElement("ul");
    list.className = "team-members-list";
    list.id = `team-${equipo}`;

    card.append(title, list);
    grid.appendChild(card);
  }

  alumnos.forEach((alumno, index) => {
    const equipo = (index % cantidad) + 1;
    const list = document.getElementById(`team-${equipo}`);
    const item = document.createElement("li");
    const nombre = document.createElement("span");
    nombre.className = "team-member-name";
    nombre.innerText = alumno;
    item.appendChild(nombre);
    list.appendChild(item);
  });

  grid.querySelectorAll(".team-members-list").forEach(list => {
    if (list.children.length === 0) {
      const item = document.createElement("li");
      const nombre = document.createElement("span");
      nombre.className = "team-member-name";
      nombre.innerText = "Sin asignar";
      item.appendChild(nombre);
      list.appendChild(item);
    }
  });
}

// REGISTRO DE EQUIPOS FIJADOS POR GRUPO Y FECHA
function cargarHistorialEquipos() {
  try {
    const guardado = localStorage.getItem(CLAVE_REGISTRO_EQUIPOS);
    const registros = guardado ? JSON.parse(guardado) : [];
    if (!Array.isArray(registros)) {
      throw new Error("El registro guardado no tiene el formato esperado.");
    }

    const registrosValidos = registros.filter(esRegistroEquipoValido);
    if (registrosValidos.length !== registros.length) {
      console.error("Se omitieron registros de equipos con datos inválidos.");
    }
    const revisionesPorClave = new Map();
    historialEquipos = registrosValidos.map((registro, indice) => {
      const revision = (revisionesPorClave.get(registro.clave) || 0) + 1;
      revisionesPorClave.set(registro.clave, revision);
      return {
        ...registro,
        id: registro.id || `legado:${registro.clave}:${indice}`,
        revision: Number.isInteger(registro.revision) ? registro.revision : revision
      };
    });
  } catch (e) {
    console.error("No se pudo cargar el historial de equipos", e);
    alert("No se pudo cargar el historial de equipos guardado en este navegador.");
    historialEquipos = [];
  }
}

function esRegistroEquipoValido(registro) {
  return registro
    && typeof registro.clave === "string"
    && typeof registro.grupoId === "string"
    && typeof registro.grupoNombre === "string"
    && typeof registro.dia === "string"
    && /^\d{4}-\d{2}-\d{2}$/.test(registro.fecha)
    && typeof registro.inicio === "string"
    && typeof registro.fin === "string"
    && Number.isInteger(registro.cantidadEquipos)
    && registro.cantidadEquipos > 0
    && Array.isArray(registro.equipos)
    && registro.equipos.length === registro.cantidadEquipos
    && registro.equipos.every(equipo =>
      Array.isArray(equipo) && equipo.every(alumno => typeof alumno === "string")
    )
    && (registro.id === undefined || typeof registro.id === "string")
    && (registro.revision === undefined || (Number.isInteger(registro.revision) && registro.revision > 0))
    && (registro.evaluacion === undefined || registro.evaluacion === null || esRegistroEvaluacionValido(registro.evaluacion))
    && typeof registro.fijado === "boolean"
    && typeof registro.actualizadoEn === "string";
}

function crearClaveSesionEquipos(grupo, fecha) {
  const fechaLocal = [
    fecha.getFullYear(),
    String(fecha.getMonth() + 1).padStart(2, "0"),
    String(fecha.getDate()).padStart(2, "0")
  ].join("-");
  return `${grupo.id}|${fechaLocal}`;
}

function cargarEquiposSesionActual() {
  const registro = obtenerUltimoRegistroEquipo(claveSesionEquipos);
  const cantidadCoincide = registro && registro.cantidadEquipos === cantidadEquipos;
  equiposActualesFijados = Boolean(registro && registro.fijado && cantidadCoincide);
  registroEquiposActualId = equiposActualesFijados ? registro.id : null;
  equiposActuales = equiposActualesFijados ? registro.equipos.map(equipo => [...equipo]) : [];
  mostrarEquipos(equiposActuales);

  if (registro && registro.fijado && !cantidadCoincide) {
    actualizarEstadoEquipos(
      `Esta sesión tiene un registro con ${registro.cantidadEquipos} equipos. Sortéalos de nuevo para usar los ${cantidadEquipos} actuales.`
    );
  } else if (equiposActualesFijados) {
    actualizarEstadoEquipos("Equipos fijados para esta sesión.");
  } else {
    actualizarEstadoEquipos("Sin equipos fijados para esta sesión. Puedes sortear y fijar una combinación.");
  }
}

function obtenerUltimoRegistroEquipo(clave) {
  if (!clave) return null;
  return historialEquipos
    .filter(item => item.clave === clave)
    .sort((a, b) =>
      b.actualizadoEn.localeCompare(a.actualizadoEn)
      || (b.revision || 0) - (a.revision || 0)
    )[0] || null;
}

function crearIdSnapshotEquipo() {
  return `${claveSesionEquipos}#${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function desfijarSnapshotActual() {
  const registro = historialEquipos.find(item => item.id === registroEquiposActualId)
    || obtenerUltimoRegistroEquipo(claveSesionEquipos);
  if (!registro || !registro.fijado) return true;

  const registroDesfijado = {
    ...registro,
    fijado: false,
    evaluacion: historialEvaluacion.find(item => item.clave === claveSesionEquipos) || registro.evaluacion || null,
    actualizadoEn: new Date().toISOString()
  };
  if (!guardarRegistroEquipos(registroDesfijado)) return false;
  equiposActualesFijados = false;
  registroEquiposActualId = null;
  return true;
}

function guardarRegistroEquipos(registro) {
  const indice = registro.id
    ? historialEquipos.findIndex(item => item.id === registro.id)
    : historialEquipos.findIndex(item => item.clave === registro.clave);
  const historialAnterior = historialEquipos;
  historialEquipos = [...historialEquipos];
  if (indice === -1) {
    historialEquipos.push(registro);
  } else {
    historialEquipos[indice] = registro;
  }

  try {
    localStorage.setItem(CLAVE_REGISTRO_EQUIPOS, JSON.stringify(historialEquipos));
    return true;
  } catch (e) {
    historialEquipos = historialAnterior;
    console.error("No se pudo guardar el registro de equipos", e);
    alert("No se pudieron guardar los equipos. Revisa el espacio disponible del navegador.");
    return false;
  }
}

function actualizarEstadoEquipos(mensaje) {
  const estado = document.getElementById("teams-assignment-status");
  estado.innerText = sesionSoloLectura
    ? "Horario concluido: solo lectura. Administra sus registros desde el historial."
    : mensaje;
  estado.classList.toggle("is-pinned", equiposActualesFijados);
  document.getElementById("btn-random-teams").disabled = !claveSesionEquipos || sesionSoloLectura;
  document.getElementById("btn-fix-teams").disabled =
    !claveSesionEquipos || sesionSoloLectura || equiposActualesFijados || !equiposActuales.some(equipo => equipo.length > 0);
  const registroSesion = obtenerUltimoRegistroEquipo(claveSesionEquipos);
  document.getElementById("btn-reset-teams").disabled =
    !claveSesionEquipos || sesionSoloLectura
    || (!equiposActualesFijados && !equiposActuales.some(equipo => equipo.length > 0)
      && !(registroSesion && registroSesion.fijado));
}

function mostrarEquipos(equipos) {
  const grid = document.getElementById("teams-grid-content");
  grid.innerHTML = "";
  document.getElementById("teams-title").innerText = `EQUIPOS DE TRABAJO (${cantidadEquipos} EQUIPOS)`;
  const permiteAcomodar = puedeAcomodarEquiposManualmente();

  for (let n = 1; n <= cantidadEquipos; n++) {
    const card = document.createElement("div");
    card.className = "team-card";

    const title = document.createElement("div");
    title.className = "team-title";
    const titleText = document.createElement("span");
    titleText.innerText = `Equipo ${n}`;
    title.appendChild(titleText);
    title.appendChild(crearControlResultadoEquipo(n));

    const list = document.createElement("ul");
    list.className = "team-members-list";
    list.id = `team-${n}`;
    list.dataset.teamIndex = String(n - 1);
    list.addEventListener("dragover", event => {
      if (!permiteAcomodar || !alumnoArrastradoEquipo) return;
      event.preventDefault();
      if (event.dataTransfer) event.dataTransfer.dropEffect = "move";
      list.classList.add("is-drop-target");
    });
    list.addEventListener("dragleave", event => {
      if (!list.contains(event.relatedTarget)) list.classList.remove("is-drop-target");
    });
    list.addEventListener("drop", event => {
      if (!permiteAcomodar || !alumnoArrastradoEquipo) return;
      event.preventDefault();
      list.classList.remove("is-drop-target");
      const alumnoMovido = alumnoArrastradoEquipo;
      alumnoArrastradoEquipo = null;
      moverAlumnoEntreEquipos(
        alumnoMovido.indiceEquipo,
        Number(list.dataset.teamIndex),
        alumnoMovido.alumno
      );
    });

    const miembros = equipos[n - 1] || [];
    (miembros.length ? miembros : ["Sin asignar"]).forEach(nombre => {
      const li = document.createElement("li");
      const nombreAlumno = document.createElement("span");
      nombreAlumno.className = "team-member-name";
      nombreAlumno.innerText = nombre;
      li.appendChild(nombreAlumno);
      if (nombre !== "Sin asignar" && permiteAcomodar) {
        li.draggable = true;
        li.classList.add("team-member-draggable");
        li.title = "Arrastra a otro equipo antes de fijar la combinación";
        li.addEventListener("dragstart", event => {
          if (!puedeAcomodarEquiposManualmente()) {
            event.preventDefault();
            return;
          }
          alumnoArrastradoEquipo = { indiceEquipo: n - 1, alumno: nombre };
          if (event.dataTransfer) {
            event.dataTransfer.effectAllowed = "move";
            event.dataTransfer.setData("text/plain", nombre);
          }
          li.classList.add("is-dragging");
        });
        li.addEventListener("dragend", () => {
          alumnoArrastradoEquipo = null;
          li.classList.remove("is-dragging");
          grid.querySelectorAll(".team-members-list").forEach(teamList =>
            teamList.classList.remove("is-drop-target")
          );
        });
      }
      if (nombre !== "Sin asignar") {
        if (modoAsistenciaActivo) {
          li.appendChild(crearMarcaAsistencia(nombre));
        }
        if (modoEvaluacionActivo) {
          li.appendChild(crearControlCalificacion(nombre, n));
        }
      }
      list.appendChild(li);
    });

    card.append(title, list);
    grid.appendChild(card);
  }
}

function puedeAcomodarEquiposManualmente() {
  return Boolean(
    claveSesionEquipos
    && !sesionSoloLectura
    && !equiposActualesFijados
    && !modoAsistenciaActivo
    && !modoEvaluacionActivo
    && !asistenciaTomada
    && resultadosEquiposActuales.size === 0
    && calificacionesManualesActuales.size === 0
    && ajustesCalificacionActuales.size === 0
  );
}

function moverAlumnoEntreEquipos(indiceOrigen, indiceDestino, alumno) {
  if (!puedeAcomodarEquiposManualmente() || indiceOrigen === indiceDestino) return;
  const equipoOrigen = equiposActuales[indiceOrigen];
  const equipoDestino = equiposActuales[indiceDestino];
  if (!equipoOrigen || !equipoDestino || equipoDestino.includes(alumno)) return;
  const indiceAlumno = equipoOrigen.indexOf(alumno);
  if (indiceAlumno === -1) return;

  equipoOrigen.splice(indiceAlumno, 1);
  equipoDestino.push(alumno);
  mostrarEquipos(equiposActuales);
  actualizarEstadoEquipos("Alumno movido. Puedes seguir ajustando los equipos y fijarlos cuando termines.");
}

function fijarEquiposActuales() {
  if (sesionSoloLectura) {
    alert("Este horario ya pasó. Para cambiar este registro, edítalo desde el historial de equipos.");
    return;
  }
  const grupo = gruposConfigurados.find(item => item.id === grupoActivoKey);
  if (!grupo || !claveSesionEquipos || !horaInicioClase) {
    alert("Selecciona un grupo antes de fijar los equipos.");
    return;
  }

  if (!equiposActuales.some(equipo => equipo.length > 0)) {
    alert("Primero sortea los equipos que quieres fijar.");
    return;
  }

  const fecha = claveSesionEquipos.slice(claveSesionEquipos.lastIndexOf("|") + 1);
  const registro = {
    id: crearIdSnapshotEquipo(),
    clave: claveSesionEquipos,
    revision: historialEquipos
      .filter(item => item.clave === claveSesionEquipos)
      .reduce((maxima, item) => Math.max(maxima, Number(item.revision) || 0), 0) + 1,
    grupoId: grupo.id,
    grupoNombre: grupo.nombre,
    dia: grupo.dia,
    fecha,
    inicio: grupo.inicio,
    fin: grupo.fin,
    cantidadEquipos: cantidadEquipos,
    equipos: equiposActuales.map(equipo => [...equipo]),
    fijado: true,
    actualizadoEn: new Date().toISOString()
  };

  if (!guardarRegistroEquipos(registro)) return;
  equiposActualesFijados = true;
  registroEquiposActualId = registro.id;
  mostrarEquipos(equiposActuales);
  actualizarEstadoEquipos("Equipos fijados para esta sesión y guardados en el historial.");
  renderizarHistorialEquipos();
}

function reiniciarEquiposSesion() {
  if (sesionSoloLectura) {
    alert("Este horario ya pasó. Administra sus registros desde el historial de equipos.");
    return;
  }
  if (!claveSesionEquipos) return;

  const registro = obtenerUltimoRegistroEquipo(claveSesionEquipos);
  if (registro && registro.fijado) {
    const registroReiniciado = {
      ...registro,
      fijado: false,
      evaluacion: historialEvaluacion.find(item => item.clave === claveSesionEquipos) || registro.evaluacion || null
    };
    if (!guardarRegistroEquipos(registroReiniciado)) return;
    equiposActualesFijados = false;
    registroEquiposActualId = null;
  }

  if (!reiniciarResultadosEquiposEvaluacion()) {
    actualizarEstadoEquipos("La combinación anterior se conservó en el historial, pero no se pudo reiniciar la evaluación.");
    return;
  }
  equiposActuales = [];
  equiposActualesFijados = false;
  registroEquiposActualId = null;
  mostrarEquipos([]);
  guardarSnapshotEvaluacionSiExiste();
  actualizarEstadoEquipos(
    registro
      ? "Equipos reiniciados para esta sesión. El registro anterior sigue en el historial."
      : "Sorteo reiniciado. Puedes generar y fijar una combinación nueva."
  );
  renderizarHistorialEquipos();
}

function abrirHistorialEquipos() {
  prepararFiltrosHistorialEquipos();
  renderizarHistorialEquipos();
  document.getElementById("team-history-modal").classList.remove("hidden");
}

function cerrarHistorialEquipos() {
  document.getElementById("team-history-modal").classList.add("hidden");
}

function abrirConfiguracionCalificaciones() {
  document.getElementById("input-individual-minimum-grade").value = String(calificacionMinimaFalta);
  document.getElementById("input-individual-maximum-grade").value = String(calificacionMaximaAjustes);
  document.getElementById("input-individual-default-grade").value = String(calificacionPredeterminadaIndividual);
  document.getElementById("input-team-minimum-grade").value = String(calificacionMinimaEquipo);
  document.getElementById("input-team-maximum-grade").value = String(calificacionMaximaEquipo);
  document.getElementById("input-team-default-grade").value = String(calificacionPredeterminadaEquipo);
  document.getElementById("grades-config-modal").classList.remove("hidden");
}

function cerrarConfiguracionCalificaciones() {
  document.getElementById("grades-config-modal").classList.add("hidden");
}

function guardarConfiguracionCalificaciones() {
  const minimaIndividual = document.getElementById("input-individual-minimum-grade").valueAsNumber;
  const maximaIndividual = document.getElementById("input-individual-maximum-grade").valueAsNumber;
  const predeterminadaIndividual = document.getElementById("input-individual-default-grade").valueAsNumber;
  const minimaEquipo = document.getElementById("input-team-minimum-grade").valueAsNumber;
  const maximaEquipo = document.getElementById("input-team-maximum-grade").valueAsNumber;
  const predeterminadaEquipo = document.getElementById("input-team-default-grade").valueAsNumber;
  const configuracionValida = [
    [minimaIndividual, maximaIndividual, predeterminadaIndividual],
    [minimaEquipo, maximaEquipo, predeterminadaEquipo]
  ].every(([minima, maxima, predeterminada]) =>
    Number.isInteger(minima)
    && Number.isInteger(maxima)
    && Number.isInteger(predeterminada)
    && minima >= 0
    && maxima <= 10
    && minima <= predeterminada
    && predeterminada <= maxima
  );
  if (!configuracionValida) {
    alert("Cada calificación debe ser un entero de 0 a 10, y la predeterminada debe quedar entre la mínima y la máxima.");
    return;
  }
  const configuracionAnterior = [
    calificacionMinimaFalta,
    calificacionMaximaAjustes,
    calificacionPredeterminadaIndividual,
    calificacionMinimaEquipo,
    calificacionMaximaEquipo,
    calificacionPredeterminadaEquipo
  ];
  calificacionMinimaFalta = minimaIndividual;
  calificacionMaximaAjustes = maximaIndividual;
  calificacionPredeterminadaIndividual = predeterminadaIndividual;
  calificacionMinimaEquipo = minimaEquipo;
  calificacionMaximaEquipo = maximaEquipo;
  calificacionPredeterminadaEquipo = predeterminadaEquipo;
  if (!sesionSoloLectura
    && historialEvaluacion.some(item => item.clave === claveSesionEquipos)
    && !guardarSnapshotEvaluacionSiExiste()) {
    [
      calificacionMinimaFalta,
      calificacionMaximaAjustes,
      calificacionPredeterminadaIndividual,
      calificacionMinimaEquipo,
      calificacionMaximaEquipo,
      calificacionPredeterminadaEquipo
    ] = configuracionAnterior;
    return;
  }
  guardarEnLocalStorage();
  mostrarEquipos(equiposActuales);
  if (!document.getElementById("team-history-modal").classList.contains("hidden")) {
    renderizarHistorialEquipos();
  }
  cerrarConfiguracionCalificaciones();
}

function renderizarHistorialEquipos() {
  const lista = document.getElementById("team-history-list");
  lista.innerHTML = "";

  const rango = obtenerRangoFiltroHistorial();
  const grupoFiltro = document.getElementById("team-history-group-filter").value || "all";
  const registros = historialEquipos.filter(registro =>
    (!rango.error && (!rango.desde || registro.fecha >= rango.desde) && (!rango.hasta || registro.fecha <= rango.hasta))
    && (grupoFiltro === "all" || registro.grupoId === grupoFiltro)
  ).sort((a, b) => {
    const porFecha = b.fecha.localeCompare(a.fecha);
    return porFecha
      || b.actualizadoEn.localeCompare(a.actualizadoEn)
      || (b.revision || 0) - (a.revision || 0);
  });

  const contador = document.getElementById("team-history-count");
  contador.innerText = `${registros.length} registro${registros.length === 1 ? "" : "s"} visible${registros.length === 1 ? "" : "s"} de ${historialEquipos.length}.`;
  if (registros.length === 0) {
    const vacio = document.createElement("p");
    vacio.className = "team-history-empty";
    vacio.innerText = rango.error
      || "No hay combinaciones para este filtro. Cambia el periodo o el grupo para consultar otros registros.";
    lista.appendChild(vacio);
    return;
  }

  registros.forEach(registro => {
    const detalle = document.createElement("details");
    detalle.className = "team-history-record";
    const ultimoRegistro = obtenerUltimoRegistroEquipo(registro.clave);
    const registroAsistencia = historialAsistencia.find(item => item.clave === registro.clave);
    const asistenciaCerrada = Boolean(registroAsistencia && registroAsistencia.tomada !== false);
    const estadosAsistencia = new Map(
      registroAsistencia ? registroAsistencia.marcas.map(marca => [marca.alumno, marca.estado]) : []
    );

    const fecha = new Date(`${registro.fecha}T00:00:00`);
    const fechaTexto = fecha.toLocaleDateString("es-MX", {
      day: "2-digit",
      month: "short",
      year: "numeric"
    });
    const resumen = document.createElement("summary");
    resumen.className = "team-history-record-header";
    const textoResumen = document.createElement("span");
    textoResumen.innerText = `${registro.grupoNombre} · ${NOMBRES_DIAS[registro.dia] || registro.dia} ${fechaTexto}`;
    const version = document.createElement("span");
    const esVersionActual = ultimoRegistro && ultimoRegistro.id === registro.id;
    version.className = "team-history-version";
    version.innerText = `${esVersionActual ? (registro.fijado ? "Actual" : "Desfijada") : "Anterior"} · v${registro.revision || 1}`;
    const botonDescarga = document.createElement("button");
    botonDescarga.type = "button";
    botonDescarga.className = "btn-secondary team-history-download";
    botonDescarga.innerText = "⬇ Excel";
    botonDescarga.title = `Descargar historial de ${registro.grupoNombre} del ${fechaTexto}`;
    botonDescarga.addEventListener("click", event => {
      event.preventDefault();
      event.stopPropagation();
      descargarRegistroEquipo(registro);
    });
    resumen.append(textoResumen, version, botonDescarga);

    const acciones = document.createElement("div");
    acciones.className = "team-history-record-actions";
    const botonEditar = document.createElement("button");
    botonEditar.type = "button";
    botonEditar.className = "btn-secondary";
    botonEditar.innerText = "Editar integrantes";
    botonEditar.addEventListener("click", event => {
      event.preventDefault();
      event.stopPropagation();
      const editor = detalle.querySelector(".team-history-editor");
      editor.classList.toggle("hidden");
    });
    const botonEliminar = document.createElement("button");
    botonEliminar.type = "button";
    botonEliminar.className = "btn-danger";
    botonEliminar.innerText = "Eliminar registro";
    botonEliminar.addEventListener("click", event => {
      event.preventDefault();
      event.stopPropagation();
      eliminarRegistroEquipo(registro.id);
    });
    acciones.append(botonEditar, botonEliminar);

    const editor = crearEditorRegistroEquipo(registro);

    const metadatos = document.createElement("p");
    metadatos.className = "team-history-meta";
    const fechaActualizacion = new Date(registro.actualizadoEn).toLocaleString("es-MX", {
      dateStyle: "short",
      timeStyle: "short"
    });
    const fechaModificacion = registro.modificadoEn
      ? new Date(registro.modificadoEn).toLocaleString("es-MX", { dateStyle: "short", timeStyle: "short" })
      : fechaActualizacion;
    metadatos.innerText = `${registro.inicio}–${registro.fin} · ${registro.cantidadEquipos} equipos · Modificado ${fechaModificacion}`;

    const equipos = document.createElement("div");
    equipos.className = "team-history-teams";
    const marcas = new Map(
      registroAsistencia ? registroAsistencia.marcas.map(item => [item.alumno, item.estado]) : []
    );
    const alumnosNotas = filasHistorialEquipo(registro);
    registro.equipos.forEach((miembros, indice) => {
      const equipo = document.createElement("section");
      const titulo = document.createElement("strong");
      titulo.innerText = `Equipo ${indice + 1}`;
      const listaMiembros = document.createElement("div");
      listaMiembros.className = "team-history-members";

      if (miembros.length === 0) {
        const vacio = document.createElement("p");
        vacio.innerText = "Sin asignar";
        listaMiembros.appendChild(vacio);
      } else {
        miembros.forEach(alumno => {
          const fila = document.createElement("div");
          fila.className = "team-history-member";
          const nombre = document.createElement("span");
          nombre.className = "team-history-member-name";
          nombre.innerText = alumno;
          fila.appendChild(nombre);

          const estado = estadosAsistencia.get(alumno) || "";
          if (asistenciaCerrada || estado) {
            const estadoInfo = obtenerEstadoAsistencia(estado, asistenciaCerrada);
            if (estadoInfo.clase === "falta") fila.classList.add("is-absent");
            fila.appendChild(crearIndicadorAsistencia(estado, asistenciaCerrada, true));
          }
          const datoAlumno = alumnosNotas.find(item => item.Nombre === alumno && item.Equipo === `Equipo ${indice + 1}`);
          if (datoAlumno && datoAlumno.Calificación !== "") {
            const nota = document.createElement("span");
            nota.className = "team-history-grade";
            nota.innerText = `Nota: ${datoAlumno.Calificación}`;
            fila.appendChild(nota);
          }

          listaMiembros.appendChild(fila);
        });
      }

      equipo.append(titulo, listaMiembros);
      equipos.appendChild(equipo);
    });

    const tabla = crearTablaHistorialAlumnos(alumnosNotas);
    const descargarTabla = document.createElement("button");
    descargarTabla.type = "button";
    descargarTabla.className = "btn-secondary team-history-download-table";
    descargarTabla.innerText = "Ver hoja de datos";
    descargarTabla.setAttribute("aria-expanded", "false");
    descargarTabla.addEventListener("click", () => {
      const visible = !tabla.classList.contains("hidden");
      tabla.classList.toggle("hidden", visible);
      descargarTabla.setAttribute("aria-expanded", String(!visible));
      descargarTabla.innerText = visible ? "Ver hoja de datos" : "Ocultar hoja de datos";
    });
    detalle.append(resumen, acciones, editor, metadatos, equipos, descargarTabla, tabla);
    lista.appendChild(detalle);
  });
}

function crearEditorRegistroEquipo(registro) {
  const editor = document.createElement("section");
  editor.className = "team-history-editor hidden";
  const ayuda = document.createElement("p");
  ayuda.innerText = "Edita la lista de cada equipo, un alumno por línea. Esto modifica solo esta versión del historial.";
  const grid = document.createElement("div");
  grid.className = "team-history-edit-grid";
  const entradas = registro.equipos.map((miembros, indice) => {
    const etiqueta = document.createElement("label");
    etiqueta.innerText = `Equipo ${indice + 1}`;
    const area = document.createElement("textarea");
    area.value = miembros.join("\n");
    area.setAttribute("aria-label", `Integrantes del equipo ${indice + 1}`);
    etiqueta.appendChild(area);
    grid.appendChild(etiqueta);
    return area;
  });
  const botones = document.createElement("div");
  botones.className = "team-history-record-actions";
  const guardar = document.createElement("button");
  guardar.type = "button";
  guardar.className = "btn-secondary";
  guardar.innerText = "Guardar cambios";
  guardar.addEventListener("click", () => {
    const equiposEditados = entradas.map(area => parsearListaAlumnos(area.value));
    const alumnos = equiposEditados.flat();
    const alumnosNormalizados = alumnos.map(alumno => alumno.trim().toLocaleLowerCase("es-MX"));
    if (alumnosNormalizados.some(alumno => !alumno) || new Set(alumnosNormalizados).size !== alumnos.length) {
      alert("Cada alumno debe aparecer una sola vez y tener un nombre válido.");
      return;
    }

    if (!window.confirm(`¿Guardar los cambios en la versión ${registro.revision || 1} del historial de ${registro.grupoNombre} del ${registro.fecha}?`)) {
      return;
    }
    const actualizado = {
      ...registro,
      equipos: equiposEditados,
      modificadoEn: new Date().toISOString(),
      editadoManualmente: true
    };
    if (!guardarRegistroEquipos(actualizado)) return;
    if (claveSesionEquipos === registro.clave && registroEquiposActualId === registro.id) {
      equiposActuales = equiposEditados.map(equipo => [...equipo]);
      mostrarEquipos(equiposActuales);
      actualizarEstadoEquipos("Se actualizó esta versión desde el historial.");
    }
    renderizarHistorialEquipos();
  });
  const cancelar = document.createElement("button");
  cancelar.type = "button";
  cancelar.className = "btn-secondary";
  cancelar.innerText = "Cancelar";
  cancelar.addEventListener("click", () => editor.classList.add("hidden"));
  botones.append(guardar, cancelar);
  editor.append(ayuda, grid, botones);
  return editor;
}

function eliminarRegistroEquipo(id) {
  const registro = historialEquipos.find(item => item.id === id);
  if (!registro) return;
  if (!window.confirm(`¿Eliminar solo la versión ${registro.revision || 1} de ${registro.grupoNombre} del ${registro.fecha}? Esta acción no se puede deshacer.`)) return;

  const historialAnterior = historialEquipos;
  historialEquipos = historialEquipos.filter(item => item.id !== id);
  try {
    localStorage.setItem(CLAVE_REGISTRO_EQUIPOS, JSON.stringify(historialEquipos));
  } catch (error) {
    historialEquipos = historialAnterior;
    console.error("No se pudo eliminar el registro de equipos", error);
    alert("No se pudo eliminar el registro. Revisa el espacio disponible del navegador.");
    return;
  }

  if (claveSesionEquipos === registro.clave && registroEquiposActualId === id) {
    cargarEquiposSesionActual();
    actualizarEstadoEquipos("Se eliminó la versión seleccionada del historial.");
  }
  renderizarHistorialEquipos();
}

function prepararFiltrosHistorialEquipos() {
  const selectorGrupo = document.getElementById("team-history-group-filter");
  const grupoAnterior = selectorGrupo.value || "all";
  selectorGrupo.innerHTML = "";
  const todos = document.createElement("option");
  todos.value = "all";
  todos.innerText = "Todos los grupos";
  selectorGrupo.appendChild(todos);
  const gruposFiltro = new Map(gruposConfigurados.map(grupo => [grupo.id, grupo.nombre]));
  historialEquipos.forEach(registro => {
    if (!gruposFiltro.has(registro.grupoId)) gruposFiltro.set(registro.grupoId, registro.grupoNombre);
  });
  gruposFiltro.forEach((nombre, id) => {
    const opcion = document.createElement("option");
    opcion.value = id;
    opcion.innerText = nombre;
    selectorGrupo.appendChild(opcion);
  });
  selectorGrupo.value = gruposFiltro.has(grupoAnterior) ? grupoAnterior : "all";
  document.getElementById("team-history-period-filter").value = "today";
  document.getElementById("team-history-date-from").value = "";
  document.getElementById("team-history-date-to").value = "";
  Object.entries(periodosEscolares).forEach(([periodo, fechas]) => {
    document.getElementById(`${periodo}-start`).value = fechas.inicio;
    document.getElementById(`${periodo}-end`).value = fechas.fin;
  });
  actualizarFiltrosHistorialEquipos();
}

function actualizarFiltrosHistorialEquipos() {
  const filtro = document.getElementById("team-history-period-filter").value;
  document.getElementById("team-history-custom-range").classList.toggle("hidden", filtro !== "custom");
  renderizarHistorialEquipos();
}

function fechaLocalISO(fecha) {
  return [
    fecha.getFullYear(),
    String(fecha.getMonth() + 1).padStart(2, "0"),
    String(fecha.getDate()).padStart(2, "0")
  ].join("-");
}

function obtenerRangoFiltroHistorial(filtro = document.getElementById("team-history-period-filter").value) {
  const hoy = new Date();
  const hoyISO = fechaLocalISO(hoy);
  if (filtro === "today") return { desde: hoyISO, hasta: hoyISO };
  if (filtro === "all") return { desde: "", hasta: "" };
  if (filtro === "week") {
    const inicio = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() - ((hoy.getDay() + 6) % 7));
    const fin = new Date(inicio.getFullYear(), inicio.getMonth(), inicio.getDate() + 6);
    return { desde: fechaLocalISO(inicio), hasta: fechaLocalISO(fin) };
  }
  if (filtro === "custom") {
    const desde = document.getElementById("team-history-date-from").value;
    const hasta = document.getElementById("team-history-date-to").value;
    if (!desde && !hasta) return { desde: "", hasta: "", error: "Elige al menos una fecha para consultar el rango." };
    if (desde && hasta && desde > hasta) return { desde, hasta, error: "La fecha inicial no puede ser posterior a la fecha final." };
    return { desde, hasta };
  }

  const periodo = periodosEscolares[filtro];
  if (!periodo || !periodo.inicio || !periodo.fin) {
    return { desde: "", hasta: "", error: `Configura las fechas de ${filtro.replace("-", " ")} para consultar sus registros.` };
  }
  return { desde: periodo.inicio, hasta: periodo.fin };
}

function guardarPeriodosEscolares() {
  const nuevosPeriodos = {};
  for (let numero = 1; numero <= 3; numero++) {
    const id = `period-${numero}`;
    const inicio = document.getElementById(`${id}-start`).value;
    const fin = document.getElementById(`${id}-end`).value;
    if (Boolean(inicio) !== Boolean(fin) || (inicio && fin && inicio > fin)) {
      alert(`Revisa las fechas de Periodo ${numero}: ingresa inicio y fin, y asegúrate de que el inicio no sea posterior al fin.`);
      return;
    }
    nuevosPeriodos[id] = { inicio, fin };
  }
  if (!esConfiguracionPeriodosValida(nuevosPeriodos)) {
    alert("Los periodos escolares no pueden traslaparse. Ajusta sus fechas para evitar registros duplicados al descargar.");
    return;
  }

  const periodosAnteriores = periodosEscolares;
  periodosEscolares = nuevosPeriodos;
  try {
    guardarEnLocalStorage();
  } catch (error) {
    periodosEscolares = periodosAnteriores;
    console.error("No se pudieron guardar las fechas de los periodos", error);
    alert("No se pudieron guardar los periodos escolares en este navegador.");
    return;
  }
  actualizarFiltrosHistorialEquipos();
  alert("Se guardaron las fechas de los periodos escolares.");
}

function esConfiguracionPeriodosValida(periodos) {
  const ids = ["period-1", "period-2", "period-3"];
  if (!ids.every(id => {
    const fechas = periodos[id];
    return fechas
      && typeof fechas.inicio === "string"
      && typeof fechas.fin === "string"
      && (!fechas.inicio || /^\d{4}-\d{2}-\d{2}$/.test(fechas.inicio))
      && (!fechas.fin || /^\d{4}-\d{2}-\d{2}$/.test(fechas.fin))
      && Boolean(fechas.inicio) === Boolean(fechas.fin)
      && (!fechas.inicio || fechas.inicio <= fechas.fin);
  })) return false;

  const configurados = ids.map(id => periodos[id])
    .filter(fechas => fechas.inicio && fechas.fin)
    .sort((a, b) => a.inicio.localeCompare(b.inicio));
  return configurados.every((fechas, indice) =>
    indice === 0 || configurados[indice - 1].fin < fechas.inicio
  );
}

function filasHistorialEquipo(registro) {
  const evaluacion = obtenerEvaluacionSnapshot(registro);
  const asistencia = historialAsistencia.find(item => item.clave === registro.clave);
  const listaCerrada = Boolean(asistencia && asistencia.tomada !== false);
  const minimaIndividual = evaluacion && Number.isInteger(evaluacion.calificacionMinimaIndividual)
    ? evaluacion.calificacionMinimaIndividual
    : evaluacion && Number.isInteger(evaluacion.calificacionMinima)
      ? evaluacion.calificacionMinima
      : asistencia && Number.isInteger(asistencia.calificacionMinima)
        ? asistencia.calificacionMinima
        : calificacionMinimaFalta;
  const maximaIndividual = evaluacion && Number.isInteger(evaluacion.calificacionMaximaIndividual)
    ? evaluacion.calificacionMaximaIndividual
    : Number.isInteger(evaluacion && evaluacion.calificacionMaxima)
      ? evaluacion.calificacionMaxima
      : calificacionMaximaAjustes;
  const configuracionEquipo = {
    minima: evaluacion && Number.isInteger(evaluacion.calificacionMinimaEquipo)
      ? evaluacion.calificacionMinimaEquipo
      : calificacionMinimaEquipo,
    maxima: evaluacion && Number.isInteger(evaluacion.calificacionMaximaEquipo)
      ? evaluacion.calificacionMaximaEquipo
      : calificacionMaximaEquipo,
    predeterminada: evaluacion && Number.isInteger(evaluacion.calificacionPredeterminadaEquipo)
      ? evaluacion.calificacionPredeterminadaEquipo
      : calificacionPredeterminadaEquipo
  };
  const cerrada = Boolean(evaluacion && evaluacion.cerrada);
  const resultados = new Map(
    evaluacion ? evaluacion.resultadosEquipos.map((resultado, indice) => [indice + 1, resultado]) : []
  );
  const notasManuales = new Map(evaluacion ? evaluacion.calificaciones.map(item => [item.alumno, item.nota]) : []);
  const ajustes = new Map(
    evaluacion && Array.isArray(evaluacion.ajustes)
      ? evaluacion.ajustes.map(item => [item.alumno, item.ajuste])
      : []
  );
  const estados = new Map(asistencia ? asistencia.marcas.map(item => [item.alumno, item.estado]) : []);
  return registro.equipos.flatMap((miembros, indice) => miembros.map(alumno => {
    const nota = calcularCalificacion({
      alumno,
      numeroEquipo: indice + 1,
      resultados,
      notasManuales,
      ajustes,
      estadosAsistencia: estados,
      asistenciaTomada: listaCerrada,
      minima: minimaIndividual,
      maxima: maximaIndividual,
      predeterminadaIndividual: evaluacion && Number.isInteger(evaluacion.calificacionPredeterminadaIndividual)
        ? evaluacion.calificacionPredeterminadaIndividual
        : calificacionPredeterminadaIndividual,
      ...configuracionEquipo,
      sesionCerrada: cerrada
    });
    const estado = estados.get(alumno) || "";
    return {
      Grupo: registro.grupoNombre,
      Fecha: registro.fecha,
      Día: NOMBRES_DIAS[registro.dia] || registro.dia,
      Horario: `${registro.inicio}–${registro.fin}`,
      Equipo: `Equipo ${indice + 1}`,
      Nombre: alumno,
      Asistencia: obtenerValorAsistenciaReporte(estado, listaCerrada),
      Calificación: nota.nota === null ? "" : nota.nota,
      "Resultado del equipo": etiquetaResultadoEquipo(resultados.get(indice + 1) || "pendiente"),
      Ajuste: ajustes.get(alumno) || 0
    };
  }));
}

function obtenerValorAsistenciaReporte(estado, listaCerrada) {
  const clase = obtenerEstadoAsistencia(estado, listaCerrada).clase;
  if (clase === "presente" || clase === "retardo") return 1;
  if (clase === "falta" || clase === "justificada") return 0;
  return "";
}

function filasEquiposHistorial(registro) {
  const evaluacion = obtenerEvaluacionSnapshot(registro);
  return registro.equipos.map((miembros, indice) => ({
    Grupo: registro.grupoNombre,
    Fecha: registro.fecha,
    Equipo: `Equipo ${indice + 1}`,
    Resultado: etiquetaResultadoEquipo(
      evaluacion ? evaluacion.resultadosEquipos[indice] || "pendiente" : "pendiente"
    ),
    "Calificación del equipo": calcularCalificacionEquipo(
      evaluacion ? evaluacion.resultadosEquipos[indice] || "pendiente" : "pendiente",
      Boolean(evaluacion && evaluacion.cerrada),
      evaluacion && Number.isInteger(evaluacion.calificacionMinimaEquipo)
        ? evaluacion.calificacionMinimaEquipo
        : calificacionMinimaEquipo,
      evaluacion && Number.isInteger(evaluacion.calificacionMaximaEquipo)
        ? evaluacion.calificacionMaximaEquipo
        : calificacionMaximaEquipo,
      evaluacion && Number.isInteger(evaluacion.calificacionPredeterminadaEquipo)
        ? evaluacion.calificacionPredeterminadaEquipo
        : calificacionPredeterminadaEquipo
    ) ?? "",
    Integrantes: miembros.join(", ")
  }));
}

function obtenerEvaluacionSnapshot(registro) {
  if (registro.evaluacion) return registro.evaluacion;
  const ultimo = obtenerUltimoRegistroEquipo(registro.clave);
  return ultimo && ultimo.id === registro.id
    ? historialEvaluacion.find(item => item.clave === registro.clave)
    : null;
}

function crearLibroHistorial(registros) {
  const filasAlumnos = registros.flatMap(filasHistorialEquipo);
  const filasEquipos = registros.flatMap(filasEquiposHistorial);
  const filasSesiones = registros.map(registro => ({
    Grupo: registro.grupoNombre,
    Fecha: registro.fecha,
    Día: NOMBRES_DIAS[registro.dia] || registro.dia,
    Horario: `${registro.inicio}–${registro.fin}`,
    "Cantidad de equipos": registro.cantidadEquipos,
    Versión: registro.revision || 1,
    "Fijado": registro.fijado ? "Sí" : "No"
  }));
  const libro = window.XLSX.utils.book_new();
  [
    { nombre: "Sesiones", filas: filasSesiones, columnas: ["Grupo", "Fecha", "Día", "Horario", "Cantidad de equipos", "Versión", "Fijado"] },
    { nombre: "Alumnos", filas: filasAlumnos, columnas: ["Grupo", "Fecha", "Día", "Horario", "Equipo", "Nombre", "Asistencia", "Calificación", "Resultado del equipo", "Ajuste"] },
    { nombre: "Equipos", filas: filasEquipos, columnas: ["Grupo", "Fecha", "Equipo", "Resultado", "Integrantes"] }
  ].forEach(({ nombre, filas, columnas }) => {
    const hoja = window.XLSX.utils.json_to_sheet(filas, { header: columnas });
    hoja["!cols"] = columnas.map(clave => ({
      wch: Math.min(32, Math.max(clave.length + 2, ...filas.map(fila => String(fila[clave] || "").length + 2)))
    }));
    window.XLSX.utils.book_append_sheet(libro, hoja, nombre);
  });
  return libro;
}

function descargarRegistroEquipo(registro) {
  if (!window.XLSX) {
    alert("No se pudo cargar el componente de Excel. Revisa tu conexión a internet e inténtalo de nuevo.");
    return;
  }
  try {
    const libro = crearLibroHistorial([registro]);
    window.XLSX.writeFile(libro, `historial-${registro.grupoId}-${registro.fecha}-v${registro.revision || 1}.xlsx`);
  } catch (error) {
    console.error("No se pudo exportar el historial del equipo", error);
    alert("No se pudo descargar el historial de este grupo.");
  }
}

function descargarHistorialEquipos() {
  descargarHistorialPeriodo("all");
}

function descargarHistorialPeriodo(periodo) {
  if (!window.XLSX) {
    alert("No se pudo cargar el componente de Excel. Revisa tu conexión a internet e inténtalo de nuevo.");
    return;
  }
  const rango = periodo === "all" ? null : periodosEscolares[periodo];
  if (periodo !== "all" && (!rango || !rango.inicio || !rango.fin)) {
    alert(`Configura las fechas de ${periodo.replace("-", " ")} antes de descargar.`);
    return;
  }
  const registros = historialEquipos.filter(registro =>
    !rango || (registro.fecha >= rango.inicio && registro.fecha <= rango.fin)
  );
  if (registros.length === 0) {
    alert("No hay registros de equipos en ese periodo.");
    return;
  }

  try {
    const libro = crearLibroHistorial(registros);
    const nombreArchivo = periodo === "all"
      ? "historial-completo-equipos.xlsx"
      : `historial-${periodo}-${rango.inicio}-${rango.fin}.xlsx`;
    window.XLSX.writeFile(libro, nombreArchivo);
  } catch (error) {
    console.error("No se pudo exportar el historial de equipos", error);
    alert("No se pudo descargar el historial del periodo seleccionado.");
  }
}

function reiniciarCicloEscolar() {
  if (!window.confirm("Se eliminarán los historiales de equipos, asistencia y evaluación, además de las listas de alumnos. Se conservarán los grupos, horarios, colores y calificaciones configuradas. ¿Continuar?")) return;
  if (!window.confirm("Esta acción es permanente. ¿Confirmas que quieres preparar un nuevo ciclo escolar?")) return;

  const clavesHistorial = [
    CLAVE_REGISTRO_EQUIPOS,
    CLAVE_REGISTRO_ASISTENCIA,
    CLAVE_REGISTRO_EVALUACION
  ];
  const almacenamientoAnterior = new Map(
    [...clavesHistorial, "robotica_config"].map(clave => [clave, localStorage.getItem(clave)])
  );
  const estadoAnterior = {
    equipos: historialEquipos,
    asistencia: historialAsistencia,
    evaluacion: historialEvaluacion,
    grupos: gruposConfigurados,
    periodos: periodosEscolares
  };

  try {
    historialEquipos = [];
    historialAsistencia = [];
    historialEvaluacion = [];
    gruposConfigurados = gruposConfigurados.map(grupo => ({ ...grupo, alumnos: [] }));
    periodosEscolares = {
      "period-1": { inicio: "", fin: "" },
      "period-2": { inicio: "", fin: "" },
      "period-3": { inicio: "", fin: "" }
    };
    clavesHistorial.forEach(clave => localStorage.removeItem(clave));
    guardarEnLocalStorage();
  } catch (error) {
    historialEquipos = estadoAnterior.equipos;
    historialAsistencia = estadoAnterior.asistencia;
    historialEvaluacion = estadoAnterior.evaluacion;
    gruposConfigurados = estadoAnterior.grupos;
    periodosEscolares = estadoAnterior.periodos;
    almacenamientoAnterior.forEach((valor, clave) => {
      if (valor === null) localStorage.removeItem(clave);
      else localStorage.setItem(clave, valor);
    });
    console.error("No se pudo reiniciar el ciclo escolar", error);
    alert("No se pudo reiniciar el ciclo escolar. No se aplicaron los cambios.");
    return;
  }

  asistenciaActual = new Map();
  asistenciaTomada = false;
  resultadosEquiposActuales = new Map();
  calificacionesManualesActuales = new Map();
  ajustesCalificacionActuales = new Map();
  equiposActuales = [];
  equiposActualesFijados = false;
  registroEquiposActualId = null;
  sesionCerrada = false;
  sesionCierreIntentada = false;
  sesionCierrePendiente = false;
  sesionSoloLectura = false;
  modoAsistenciaActivo = false;
  modoEvaluacionActivo = false;
  grupoCambioPendienteKey = null;
  grupoCambioPendienteManual = false;
  grupoHorarioAutomaticoKey = null;
  grupoActivoKey = null;
  claveSesionEquipos = null;
  document.getElementById("group-select").value = "";
  document.getElementById("session-change-notice").classList.add("hidden");
  document.getElementById("session-end-notice").classList.add("hidden");
  document.getElementById("input-students").disabled = false;
  document.getElementById("input-students").value = "";
  limpiarRelojClase();
  actualizarEquipos(cantidadEquipos, false);
  mostrarEquipos(equiposActuales);
  renderizarEditorGrupos();
  renderizarHistorialEquipos();
  renderizarHistorialAsistencia();
  actualizarResumenAsistencia();
  actualizarControlesEvaluacion();
  actualizarEstadoEquipos("Ciclo escolar reiniciado. Configura los grupos y alumnos para comenzar.");
  prepararFiltrosHistorialEquipos();
  alert("El ciclo escolar quedó reiniciado. Puedes configurar las nuevas listas de alumnos y periodos.");
}

function crearTablaHistorialAlumnos(alumnos) {
  const contenedor = document.createElement("div");
  contenedor.className = "team-history-table-wrap hidden";
  const tabla = document.createElement("table");
  tabla.className = "team-history-table";
  const encabezado = tabla.createTHead().insertRow();
  const columnas = [
    "Nombre",
    "Equipo",
    "Asistencia",
    "Calificación",
    "Resultado del equipo",
    "Ajuste"
  ];
  let columnaOrdenada = null;
  let direccionOrden = 1;
  columnas.forEach(titulo => {
    const celda = document.createElement("th");
    celda.setAttribute("aria-sort", "none");
    const botonOrden = document.createElement("button");
    botonOrden.type = "button";
    botonOrden.className = "team-history-sort";
    botonOrden.innerText = `${titulo} ↕`;
    botonOrden.setAttribute("aria-label", `Ordenar por ${titulo}`);
    botonOrden.addEventListener("click", () => {
      if (columnaOrdenada === titulo) {
        direccionOrden *= -1;
      } else {
        columnaOrdenada = titulo;
        direccionOrden = 1;
      }

      columnas.forEach((columna, indice) => {
        const encabezadoColumna = encabezado.cells[indice];
        const estaOrdenada = columna === columnaOrdenada;
        encabezadoColumna.setAttribute(
          "aria-sort",
          estaOrdenada ? (direccionOrden === 1 ? "ascending" : "descending") : "none"
        );
        const boton = encabezadoColumna.querySelector("button");
        boton.innerText = `${columna} ${estaOrdenada ? (direccionOrden === 1 ? "↑" : "↓") : "↕"}`;
        boton.setAttribute("aria-label", `Ordenar por ${columna}${estaOrdenada ? (direccionOrden === 1 ? " ascendente" : " descendente") : ""}`);
      });

      const filas = Array.from(cuerpo.rows);
      const comparadorTexto = new Intl.Collator("es-MX", { numeric: true, sensitivity: "base" });
      filas.sort((filaA, filaB) => {
        const valorA = filaA.cells[columnas.indexOf(titulo)].innerText.trim();
        const valorB = filaB.cells[columnas.indexOf(titulo)].innerText.trim();
        const vacioA = valorA === "" || valorA === "—";
        const vacioB = valorB === "" || valorB === "—";
        if (vacioA !== vacioB) return vacioA ? 1 : -1;

        const comparacion = titulo === "Calificación"
          ? Number(valorA) - Number(valorB)
          : comparadorTexto.compare(valorA, valorB);
        return comparacion * direccionOrden;
      });
      filas.forEach(fila => cuerpo.appendChild(fila));
    });
    celda.appendChild(botonOrden);
    encabezado.appendChild(celda);
  });
  const cuerpo = tabla.createTBody();
  alumnos.forEach(alumno => {
    const fila = cuerpo.insertRow();
    columnas.forEach(columna => {
      const valor = columna === "Ajuste" && alumno[columna] > 0
        ? `+${alumno[columna]}`
        : alumno[columna];
      fila.insertCell().innerText = String(valor);
    });
  });
  contenedor.appendChild(tabla);
  return contenedor;
}

function alternarModoAsistencia() {
  if (sesionSoloLectura) {
    alert("Este horario ya pasó. Administra sus registros desde el historial de equipos.");
    return;
  }
  if (!claveSesionEquipos) {
    alert("Selecciona un grupo antes de tomar asistencia.");
    return;
  }

  if (modoAsistenciaActivo) {
    if (finalizarAsistenciaActual() && cerrarSesionPendienteSiListo()) {
      aplicarCambioGrupoPendienteSiListo();
    }
    return;
  }

  if (!equiposActuales.some(equipo => equipo.length > 0)) {
    alert("Primero sortea o carga los equipos para tomar asistencia junto a los nombres.");
    return;
  }

  const seccion = document.getElementById("teams-section");
  if (seccion.classList.contains("collapsed")) {
    seccion.classList.remove("collapsed");
    document.body.classList.add("teams-expanded");
    document.getElementById("toggle-arrow").innerText = "▼ Ocultar Equipos";
  }
  document.querySelector(".daily-roster").open = false;

  modoAsistenciaActivo = true;
  actualizarResumenAsistencia();
  mostrarEquipos(equiposActuales);
}

function abrirHistorialAsistencia() {
  renderizarHistorialAsistencia();
  document.getElementById("attendance-history-modal").classList.remove("hidden");
}

function cerrarHistorialAsistencia() {
  document.getElementById("attendance-history-modal").classList.add("hidden");
}

// ASISTENCIA POR GRUPO Y FECHA
function cargarHistorialAsistencia() {
  try {
    const guardado = localStorage.getItem(CLAVE_REGISTRO_ASISTENCIA);
    const registros = guardado ? JSON.parse(guardado) : [];
    if (!Array.isArray(registros)) {
      throw new Error("El historial de asistencia no tiene el formato esperado.");
    }

    historialAsistencia = registros.filter(esRegistroAsistenciaValido);
    if (historialAsistencia.length !== registros.length) {
      console.error("Se omitieron registros de asistencia con datos inválidos.");
    }
  } catch (e) {
    console.error("No se pudo cargar el historial de asistencia", e);
    alert("No se pudo cargar el historial de asistencia guardado en este navegador.");
    historialAsistencia = [];
  }
}

function esRegistroAsistenciaValido(registro) {
  const estadosValidos = ESTADOS_ASISTENCIA
    .map(estado => estado.valor)
    .concat(ESTADOS_ASISTENCIA_ANTERIORES.map(estado => estado.valor));
  return registro
    && typeof registro.clave === "string"
    && typeof registro.grupoId === "string"
    && typeof registro.grupoNombre === "string"
    && typeof registro.dia === "string"
    && /^\d{4}-\d{2}-\d{2}$/.test(registro.fecha)
    && typeof registro.inicio === "string"
    && typeof registro.fin === "string"
    && Array.isArray(registro.alumnos)
    && registro.alumnos.every(alumno => typeof alumno === "string")
    && Array.isArray(registro.marcas)
    && registro.marcas.every(marca =>
      marca
      && typeof marca.alumno === "string"
      && estadosValidos.includes(marca.estado)
    )
    && (registro.tomada === undefined || typeof registro.tomada === "boolean")
    && (registro.calificacionMinima === undefined || (Number.isInteger(registro.calificacionMinima) && registro.calificacionMinima >= 0 && registro.calificacionMinima <= 10))
    && typeof registro.actualizadoEn === "string";
}

function cargarAsistenciaSesionActual() {
  const registro = historialAsistencia.find(item => item.clave === claveSesionEquipos);
  asistenciaActual = new Map(
    registro
      ? registro.marcas.map(marca => [marca.alumno, normalizarEstadoAsistencia(marca.estado)])
      : []
  );
  asistenciaTomada = Boolean(registro && registro.tomada !== false);
  modoAsistenciaActivo = false;
  actualizarResumenAsistencia();
  renderizarHistorialAsistencia();
  mostrarEquipos(equiposActuales);
}

function normalizarEstadoAsistencia(valor) {
  if (valor === "retardo") return "presente";
  return valor;
}

function obtenerEstadoAsistencia(valor, tomada = false) {
  const estado = ESTADOS_ASISTENCIA.find(item => item.valor === valor)
    || ESTADOS_ASISTENCIA_ANTERIORES.find(item => item.valor === valor);
  if (estado && !valor && tomada) {
    return { ...estado, etiqueta: "Falta", marca: "×", clase: "falta" };
  }
  return estado || ESTADOS_ASISTENCIA[0];
}

function crearIndicadorAsistencia(valor, tomada, compacto = false) {
  const estado = obtenerEstadoAsistencia(valor, tomada);
  const marca = document.createElement("span");
  marca.className = compacto
    ? `attendance-status attendance-status-${estado.clase}`
    : `attendance-marker attendance-marker-${estado.clase}`;
  marca.innerText = estado.marca;
  marca.title = estado.etiqueta;
  marca.setAttribute("aria-label", estado.etiqueta);
  return marca;
}

function crearMarcaAsistencia(alumno) {
  const valor = asistenciaActual.get(alumno) || "";
  const estado = obtenerEstadoAsistencia(valor, asistenciaTomada);
  if (!modoAsistenciaActivo) return crearIndicadorAsistencia(valor, asistenciaTomada, true);

  const marca = document.createElement("button");
  marca.type = "button";
  marca.className = `attendance-marker attendance-marker-${estado.clase} attendance-control`;
  marca.innerText = estado.marca;
  marca.title = `Cambiar ${alumno}: ${estado.etiqueta}. Clic para alternar`;
  marca.setAttribute("aria-label", `${alumno}: ${estado.etiqueta}. Alternar estado`);
  marca.setAttribute("aria-pressed", valor === "presente" ? "true" : valor ? "mixed" : "false");
  marca.addEventListener("click", () => ciclarEstadoAsistencia(alumno));

  return marca;
}

function actualizarControlesEvaluacion() {
  const boton = document.getElementById("btn-evaluation-mode");
  const botonCerrarSesion = document.getElementById("btn-close-session");
  boton.disabled = !claveSesionEquipos || sesionSoloLectura;
  botonCerrarSesion.disabled = !claveSesionEquipos || sesionSoloLectura || sesionCerrada;
  boton.classList.toggle("is-active", modoEvaluacionActivo);
  boton.setAttribute("aria-pressed", String(modoEvaluacionActivo));
  boton.title = modoEvaluacionActivo
    ? "Desactivar evaluación de equipos y notas individuales"
    : "Activar evaluación de equipos y notas individuales";
  boton.setAttribute("aria-label", boton.title);
}

function alternarModoEvaluacion() {
  if (sesionSoloLectura) {
    alert("Este horario ya pasó. Administra sus registros desde el historial de equipos.");
    return;
  }
  if (!claveSesionEquipos) {
    alert("Selecciona un grupo antes de evaluar.");
    return;
  }

  if (!equiposActuales.some(equipo => equipo.length > 0)) {
    alert("Primero sortea o carga los equipos para evaluar.");
    return;
  }

  modoEvaluacionActivo = !modoEvaluacionActivo;
  if (modoEvaluacionActivo) {
    const seccion = document.getElementById("teams-section");
    if (seccion.classList.contains("collapsed")) {
      seccion.classList.remove("collapsed");
      document.body.classList.add("teams-expanded");
      document.getElementById("toggle-arrow").innerText = "▼ Ocultar Equipos";
    }
    document.querySelector(".daily-roster").open = false;
  }
  actualizarControlesEvaluacion();
  mostrarEquipos(equiposActuales);
  if (cerrarSesionPendienteSiListo()) aplicarCambioGrupoPendienteSiListo();
}

function obtenerResultadoEquipo(numeroEquipo) {
  return resultadosEquiposActuales.get(numeroEquipo) || "pendiente";
}

function calcularCalificacionEquipo(resultado, cerrada, minima, maxima, predeterminada) {
  if (resultado === "terminado") return maxima;
  if (resultado === "no_terminado") return minima;
  return cerrada ? predeterminada : null;
}

function obtenerCalificacionEquipo(numeroEquipo) {
  return calcularCalificacionEquipo(
    obtenerResultadoEquipo(numeroEquipo),
    sesionCerrada,
    calificacionMinimaEquipo,
    calificacionMaximaEquipo,
    calificacionPredeterminadaEquipo
  );
}

function crearControlResultadoEquipo(numeroEquipo) {
  const resultado = obtenerResultadoEquipo(numeroEquipo);
  if (!modoEvaluacionActivo) {
    const indicador = document.createElement("span");
    indicador.className = `team-result-indicator team-result-${resultado}`;
    const nota = obtenerCalificacionEquipo(numeroEquipo);
    const marca = resultado === "terminado" ? "✓" : resultado === "no_terminado" ? "×" : "○";
    indicador.innerText = nota === null ? marca : `${marca} ${nota}`;
    indicador.title = `Equipo ${numeroEquipo}: ${etiquetaResultadoEquipo(resultado)}${nota === null ? "" : ` · calificación ${nota}`}`;
    indicador.setAttribute("aria-label", indicador.title);
    return indicador;
  }

  const controles = document.createElement("span");
  controles.className = "team-result-controls";
  controles.append(
    crearBotonResultadoEquipo(numeroEquipo, "terminado", "✓", "Marcar equipo como terminado", resultado),
    crearBotonResultadoEquipo(numeroEquipo, "no_terminado", "×", "Marcar equipo como no terminado", resultado)
  );
  return controles;
}

function crearBotonResultadoEquipo(numeroEquipo, estado, marca, etiqueta, resultadoActual) {
  const boton = document.createElement("button");
  boton.type = "button";
  boton.className = `team-result-button team-result-${estado}`;
  if (resultadoActual === estado) boton.classList.add("is-selected");
  boton.innerText = marca;
  boton.title = `${etiqueta} · clic de nuevo para dejar pendiente`;
  boton.setAttribute("aria-label", `Equipo ${numeroEquipo}: ${etiqueta}`);
  boton.setAttribute("aria-pressed", String(resultadoActual === estado));
  boton.addEventListener("click", () => guardarResultadoEquipo(
    numeroEquipo,
    resultadoActual === estado ? "pendiente" : estado
  ));
  return boton;
}

function etiquetaResultadoEquipo(resultado) {
  if (resultado === "terminado") return "terminado";
  if (resultado === "no_terminado") return "no terminado";
  return "pendiente";
}

function crearControlCalificacion(alumno, numeroEquipo) {
  const calificacion = obtenerCalificacionAlumno(alumno, numeroEquipo);
  const resultadoEquipo = obtenerResultadoEquipo(numeroEquipo);
  const claseEstadoEquipo = resultadoEquipo === "terminado"
    ? "grade-result-terminado"
    : resultadoEquipo === "no_terminado"
      ? "grade-result-no_terminado"
      : "";
  if (!modoEvaluacionActivo) {
    const indicador = document.createElement("span");
    indicador.className = `grade-indicator grade-indicator-${calificacion.tipo} ${claseEstadoEquipo}`;
    indicador.innerText = calificacion.nota === null ? "—" : String(calificacion.nota);
    indicador.title = calificacion.manual
      ? `Calificación manual de ${alumno}`
      : calificacion.nota === null
        ? "Calificación pendiente del resultado del equipo"
        : `Calificación automática: ${calificacion.nota}`;
    indicador.setAttribute("aria-label", indicador.title);
    return indicador;
  }

  const controles = document.createElement("span");
  controles.className = "grade-controls";

  const ajuste = ajustesCalificacionActuales.get(alumno) || 0;
  const rangoCalificacion = calificacionMaximaAjustes - calificacionMinimaFalta;
  const ajustePermitido = !calificacion.falta && !calificacion.manual && rangoCalificacion > 0;
  const noPuedeReducir = calificacion.nota === null
    ? ajuste <= -rangoCalificacion
    : calificacion.nota <= calificacionMinimaFalta;
  const noPuedeAumentar = calificacion.nota === null
    ? ajuste >= rangoCalificacion
    : calificacion.nota >= calificacionMaximaAjustes;
  controles.append(
    crearBotonAjusteCalificacion(alumno, -1, ajuste, !ajustePermitido || noPuedeReducir),
    crearBotonAjusteCalificacion(alumno, 1, ajuste, !ajustePermitido || noPuedeAumentar)
  );

  const input = document.createElement("input");
  input.type = "number";
  input.className = `grade-input grade-indicator-${calificacion.tipo} ${claseEstadoEquipo}`;
  input.min = String(calificacionMinimaFalta);
  input.max = String(calificacionMaximaAjustes);
  input.step = "1";
  input.value = calificacion.nota === null ? "" : String(calificacion.nota);
  input.placeholder = calificacion.nota === null ? "Nota" : "";
  input.title = calificacion.manual
    ? `Calificación manual de ${alumno}; se mantiene aunque cambie el resultado del equipo`
    : `Escribe la calificación manual de ${alumno} en cualquier momento; tendrá prioridad sobre el resultado del equipo`;
  input.setAttribute("aria-label", `Calificación de ${alumno}, entero de ${calificacionMinimaFalta} a ${calificacionMaximaAjustes}`);
  let cambioManual = false;
  input.addEventListener("input", () => {
    input.setCustomValidity("");
    cambioManual = true;
  });
  input.addEventListener("change", () => {
    if (!cambioManual) return;
    cambioManual = false;
    guardarCalificacionManual(alumno, input);
  });
  input.addEventListener("blur", () => {
    if (!cambioManual) return;
    cambioManual = false;
    guardarCalificacionManual(alumno, input);
  });
  controles.appendChild(input);

  if (calificacion.nota === null && ajuste !== 0) {
    const ajustePendiente = document.createElement("span");
    ajustePendiente.className = "grade-adjustment-pending";
    ajustePendiente.innerText = `Δ${ajuste > 0 ? "+" : ""}${ajuste}`;
    ajustePendiente.title = `Ajuste pendiente: ${ajuste > 0 ? "+" : ""}${ajuste}. Se aplicará a la calificación automática cuando se defina el resultado del equipo o se cierre la sesión.`;
    controles.appendChild(ajustePendiente);
  }

  if (calificacion.manual) {
    const reiniciar = document.createElement("button");
    reiniciar.type = "button";
    reiniciar.className = "grade-reset-button";
    reiniciar.innerText = "↺";
    reiniciar.title = `Restablecer calificación automática de ${alumno}`;
    reiniciar.setAttribute("aria-label", reiniciar.title);
    reiniciar.addEventListener("click", () => guardarCalificacionManual(alumno, null));
    controles.appendChild(reiniciar);
  }
  return controles;
}

function crearBotonAjusteCalificacion(alumno, cantidad, ajuste, deshabilitado) {
  const boton = document.createElement("button");
  boton.type = "button";
  boton.className = "grade-adjust-button";
  boton.innerText = cantidad > 0 ? "+" : "−";
  boton.title = `${cantidad > 0 ? "Sumar" : "Restar"} un punto a la calificación automática (ajuste actual: ${ajuste > 0 ? "+" : ""}${ajuste})`;
  boton.setAttribute("aria-label", boton.title);
  boton.disabled = deshabilitado || !modoEvaluacionActivo || !claveSesionEquipos;
  boton.addEventListener("click", () => ajustarCalificacion(alumno, cantidad));
  return boton;
}

function obtenerCalificacionAlumno(alumno, numeroEquipo) {
  if (calificacionesManualesActuales.has(alumno)) {
    return {
      nota: calificacionesManualesActuales.get(alumno),
      manual: true,
      tipo: "manual",
      falta: false,
      base: null
    };
  }

  return calcularCalificacion({
    alumno,
    numeroEquipo,
    resultados: resultadosEquiposActuales,
    notasManuales: calificacionesManualesActuales,
    ajustes: ajustesCalificacionActuales,
    estadosAsistencia: asistenciaActual,
    asistenciaTomada,
    minima: calificacionMinimaFalta,
    maxima: calificacionMaximaAjustes,
    predeterminadaIndividual: calificacionPredeterminadaIndividual,
    minimaEquipo: calificacionMinimaEquipo,
    maximaEquipo: calificacionMaximaEquipo,
    predeterminadaEquipo: calificacionPredeterminadaEquipo,
    sesionCerrada
  });
}

function calcularCalificacion({
  alumno,
  numeroEquipo,
  resultados,
  notasManuales,
  ajustes,
  estadosAsistencia,
  asistenciaTomada: listaCerrada,
  minima,
  maxima,
  predeterminadaIndividual = 6,
  minimaEquipo = 8,
  maximaEquipo = 10,
  predeterminadaEquipo = 8,
  sesionCerrada: estaCerrada = false
}) {
  if (notasManuales.has(alumno)) {
    return { nota: notasManuales.get(alumno), manual: true, tipo: "manual", falta: false, base: null };
  }

  const estadoAsistencia = estadosAsistencia.get(alumno) || "";
  const falta = estadoAsistencia === "falta" || (!estadoAsistencia && listaCerrada);
  if (falta) return { nota: minima, manual: false, tipo: "automatica", falta: true, base: minima };

  const resultado = resultados.get(numeroEquipo) || "pendiente";
  const baseEquipo = calcularCalificacionEquipo(
    resultado,
    estaCerrada,
    minimaEquipo,
    maximaEquipo,
    predeterminadaEquipo
  );
  const base = resultado === "pendiente" && estaCerrada
    ? predeterminadaIndividual
    : baseEquipo;
  if (base === null) return { nota: null, manual: false, tipo: "pendiente", falta: false, base: null };
  const nota = Math.min(maxima, Math.max(minima, base + (ajustes.get(alumno) || 0)));
  return { nota, manual: false, tipo: "automatica", falta: false, base };
}

function ajustarCalificacion(alumno, cantidad) {
  if (!modoEvaluacionActivo || !claveSesionEquipos || sesionSoloLectura) return;
  const equipo = equiposActuales.findIndex(miembros => miembros.includes(alumno));
  if (equipo < 0) return;
  const calificacion = obtenerCalificacionAlumno(alumno, equipo + 1);
  if (calificacion.manual || calificacion.falta) return;

  const ajusteActual = ajustesCalificacionActuales.get(alumno) || 0;
  let nuevoAjuste;
  if (calificacion.base === null) {
    const rangoCalificacion = calificacionMaximaAjustes - calificacionMinimaFalta;
    nuevoAjuste = Math.max(-rangoCalificacion, Math.min(rangoCalificacion, ajusteActual + cantidad));
  } else {
    const nuevaNota = Math.min(
      calificacionMaximaAjustes,
      Math.max(calificacionMinimaFalta, calificacion.nota + cantidad)
    );
    nuevoAjuste = ajusteActual + nuevaNota - calificacion.nota;
  }
  if (nuevoAjuste === ajusteActual) return;

  const nuevosAjustes = new Map(ajustesCalificacionActuales);
  nuevosAjustes.set(alumno, nuevoAjuste);
  if (!guardarRegistroEvaluacion(resultadosEquiposActuales, calificacionesManualesActuales, nuevosAjustes)) return;
  ajustesCalificacionActuales = nuevosAjustes;
  mostrarEquipos(equiposActuales);
}

function guardarResultadoEquipo(numeroEquipo, resultado) {
  if (!modoEvaluacionActivo || !claveSesionEquipos || sesionSoloLectura) return;
  if (!ESTADOS_EQUIPO_EVALUACION.includes(resultado)) return;

  const resultadosNuevos = new Map(resultadosEquiposActuales);
  if (resultado === "pendiente") resultadosNuevos.delete(numeroEquipo);
  else resultadosNuevos.set(numeroEquipo, resultado);
  if (!guardarRegistroEvaluacion(resultadosNuevos, calificacionesManualesActuales)) return;

  resultadosEquiposActuales = resultadosNuevos;
  mostrarEquipos(equiposActuales);
}

function guardarCalificacionManual(alumno, input) {
  if (!modoEvaluacionActivo || !claveSesionEquipos || sesionSoloLectura) return;

  const calificacionesNuevas = new Map(calificacionesManualesActuales);
  if (input === null || input.value.trim() === "") {
    calificacionesNuevas.delete(alumno);
  } else {
    const nota = input.valueAsNumber;
    if (!Number.isInteger(nota) || nota < calificacionMinimaFalta || nota > calificacionMaximaAjustes) {
      input.setCustomValidity(`Ingresa una calificación entera entre ${calificacionMinimaFalta} y ${calificacionMaximaAjustes}.`);
      input.reportValidity();
      return;
    }
    calificacionesNuevas.set(alumno, nota);
  }

  if (!guardarRegistroEvaluacion(resultadosEquiposActuales, calificacionesNuevas, ajustesCalificacionActuales)) return;
  calificacionesManualesActuales = calificacionesNuevas;
  mostrarEquipos(equiposActuales);
}

function crearRegistroEvaluacion(
  resultados,
  calificaciones,
  ajustes = ajustesCalificacionActuales,
  cerrada = sesionCerrada
) {
  const grupo = gruposConfigurados.find(item => item.id === grupoActivoKey);
  if (!grupo || !claveSesionEquipos) return null;

  const fecha = claveSesionEquipos.slice(claveSesionEquipos.lastIndexOf("|") + 1);
  return {
    clave: claveSesionEquipos,
    grupoId: grupo.id,
    grupoNombre: grupo.nombre,
    dia: grupo.dia,
    fecha,
    inicio: grupo.inicio,
    fin: grupo.fin,
    cantidadEquipos,
    equipos: Array.from(
      { length: cantidadEquipos },
      (_, indice) => [...(equiposActuales[indice] || [])]
    ),
    resultadosEquipos: Array.from(
      { length: cantidadEquipos },
      (_, indice) => resultados.get(indice + 1) || "pendiente"
    ),
    calificaciones: Array.from(calificaciones, ([alumno, nota]) => ({ alumno, nota })),
    ajustes: Array.from(ajustes, ([alumno, ajuste]) => ({ alumno, ajuste })),
    calificacionMinima: calificacionMinimaFalta,
    calificacionMaxima: calificacionMaximaAjustes,
    calificacionMinimaIndividual: calificacionMinimaFalta,
    calificacionMaximaIndividual: calificacionMaximaAjustes,
    calificacionPredeterminadaIndividual,
    calificacionMinimaEquipo,
    calificacionMaximaEquipo,
    calificacionPredeterminadaEquipo,
    cerrada,
    actualizadoEn: new Date().toISOString()
  };
}

function guardarRegistroEvaluacion(
  resultados,
  calificaciones,
  ajustes = ajustesCalificacionActuales,
  cerrada = sesionCerrada
) {
  const registro = crearRegistroEvaluacion(resultados, calificaciones, ajustes, cerrada);
  if (!registro) return false;

  const indice = historialEvaluacion.findIndex(item => item.clave === registro.clave);
  const historialAnterior = historialEvaluacion;
  historialEvaluacion = [...historialEvaluacion];
  if (indice === -1) historialEvaluacion.push(registro);
  else historialEvaluacion[indice] = registro;

  try {
    localStorage.setItem(CLAVE_REGISTRO_EVALUACION, JSON.stringify(historialEvaluacion));
    return true;
  } catch (e) {
    historialEvaluacion = historialAnterior;
    console.error("No se pudo guardar la evaluación", e);
    alert("No se pudo guardar la evaluación. Revisa el espacio disponible del navegador.");
    return false;
  }
}

function cargarHistorialEvaluacion() {
  try {
    const guardado = localStorage.getItem(CLAVE_REGISTRO_EVALUACION);
    const registros = guardado ? JSON.parse(guardado) : [];
    if (!Array.isArray(registros)) {
      throw new Error("El historial de evaluación no tiene el formato esperado.");
    }

    historialEvaluacion = registros.filter(esRegistroEvaluacionValido);
    if (historialEvaluacion.length !== registros.length) {
      console.error("Se omitieron registros de evaluación con datos inválidos.");
    }
  } catch (e) {
    console.error("No se pudo cargar el historial de evaluación", e);
    alert("No se pudo cargar la evaluación guardada en este navegador.");
    historialEvaluacion = [];
  }
}

function esRegistroEvaluacionValido(registro) {
  return registro
    && typeof registro.clave === "string"
    && typeof registro.grupoId === "string"
    && typeof registro.grupoNombre === "string"
    && typeof registro.dia === "string"
    && /^\d{4}-\d{2}-\d{2}$/.test(registro.fecha)
    && typeof registro.inicio === "string"
    && typeof registro.fin === "string"
    && Number.isInteger(registro.cantidadEquipos)
    && registro.cantidadEquipos > 0
    && Array.isArray(registro.equipos)
    && registro.equipos.length === registro.cantidadEquipos
    && registro.equipos.every(equipo =>
      Array.isArray(equipo) && equipo.every(alumno => typeof alumno === "string")
    )
    && Array.isArray(registro.resultadosEquipos)
    && registro.resultadosEquipos.length === registro.cantidadEquipos
    && registro.resultadosEquipos.every(resultado =>
      ESTADOS_EQUIPO_EVALUACION.includes(resultado)
    )
    && Array.isArray(registro.calificaciones)
    && registro.calificaciones.every(calificacion =>
      calificacion
      && typeof calificacion.alumno === "string"
      && Number.isInteger(calificacion.nota)
      && calificacion.nota >= 0
      && calificacion.nota <= 10
    )
    && (registro.ajustes === undefined || (
      Array.isArray(registro.ajustes)
      && registro.ajustes.every(ajuste =>
        ajuste
        && typeof ajuste.alumno === "string"
        && Number.isInteger(ajuste.ajuste)
      )
    ))
    && (registro.calificacionMinima === undefined || (Number.isInteger(registro.calificacionMinima) && registro.calificacionMinima >= 0 && registro.calificacionMinima <= 10))
    && (registro.calificacionMaxima === undefined || (Number.isInteger(registro.calificacionMaxima) && registro.calificacionMaxima >= 0 && registro.calificacionMaxima <= 10))
    && (registro.calificacionMinimaIndividual === undefined || (Number.isInteger(registro.calificacionMinimaIndividual) && registro.calificacionMinimaIndividual >= 0 && registro.calificacionMinimaIndividual <= 10))
    && (registro.calificacionMaximaIndividual === undefined || (Number.isInteger(registro.calificacionMaximaIndividual) && registro.calificacionMaximaIndividual >= 0 && registro.calificacionMaximaIndividual <= 10))
    && (registro.calificacionPredeterminadaIndividual === undefined || (Number.isInteger(registro.calificacionPredeterminadaIndividual) && registro.calificacionPredeterminadaIndividual >= 0 && registro.calificacionPredeterminadaIndividual <= 10))
    && (registro.calificacionMinimaEquipo === undefined || (Number.isInteger(registro.calificacionMinimaEquipo) && registro.calificacionMinimaEquipo >= 0 && registro.calificacionMinimaEquipo <= 10))
    && (registro.calificacionMaximaEquipo === undefined || (Number.isInteger(registro.calificacionMaximaEquipo) && registro.calificacionMaximaEquipo >= 0 && registro.calificacionMaximaEquipo <= 10))
    && (registro.calificacionPredeterminadaEquipo === undefined || (Number.isInteger(registro.calificacionPredeterminadaEquipo) && registro.calificacionPredeterminadaEquipo >= 0 && registro.calificacionPredeterminadaEquipo <= 10))
    && (registro.cerrada === undefined || typeof registro.cerrada === "boolean")
    && !(Number.isInteger(registro.calificacionMinima)
      && Number.isInteger(registro.calificacionMaxima)
      && registro.calificacionMinima > registro.calificacionMaxima)
    && !(Number.isInteger(registro.calificacionMinimaIndividual)
      && Number.isInteger(registro.calificacionMaximaIndividual)
      && registro.calificacionMinimaIndividual > registro.calificacionMaximaIndividual)
    && !(Number.isInteger(registro.calificacionMinimaEquipo)
      && Number.isInteger(registro.calificacionMaximaEquipo)
      && registro.calificacionMinimaEquipo > registro.calificacionMaximaEquipo)
    && !(Number.isInteger(registro.calificacionMinimaIndividual)
      && Number.isInteger(registro.calificacionMaximaIndividual)
      && Number.isInteger(registro.calificacionPredeterminadaIndividual)
      && (registro.calificacionPredeterminadaIndividual < registro.calificacionMinimaIndividual
        || registro.calificacionPredeterminadaIndividual > registro.calificacionMaximaIndividual))
    && !(Number.isInteger(registro.calificacionMinimaEquipo)
      && Number.isInteger(registro.calificacionMaximaEquipo)
      && Number.isInteger(registro.calificacionPredeterminadaEquipo)
      && (registro.calificacionPredeterminadaEquipo < registro.calificacionMinimaEquipo
        || registro.calificacionPredeterminadaEquipo > registro.calificacionMaximaEquipo))
    && typeof registro.actualizadoEn === "string";
}

function cargarEvaluacionSesionActual() {
  const registro = historialEvaluacion.find(item => item.clave === claveSesionEquipos);
  const cantidadCoincide = registro && registro.cantidadEquipos === cantidadEquipos;
  const equiposRestaurados = !equiposActuales.some(equipo => equipo.length > 0)
    && cantidadCoincide
    && registro.equipos.some(equipo => equipo.length > 0);
  if (equiposRestaurados) {
    equiposActuales = registro.equipos.map(equipo => [...equipo]);
  }

  resultadosEquiposActuales = new Map();
  if (cantidadCoincide) {
    registro.resultadosEquipos.forEach((resultado, indice) => {
      if (resultado !== "pendiente") resultadosEquiposActuales.set(indice + 1, resultado);
    });
  }
  calificacionesManualesActuales = new Map(
    registro ? registro.calificaciones.map(item => [item.alumno, item.nota]) : []
  );
  ajustesCalificacionActuales = new Map(
    registro && Array.isArray(registro.ajustes)
      ? registro.ajustes.map(item => [item.alumno, item.ajuste])
      : []
  );
  sesionCerrada = Boolean(registro && registro.cerrada);
  sesionCierreIntentada = sesionCerrada;
  modoEvaluacionActivo = false;
  actualizarControlesEvaluacion();
  mostrarEquipos(equiposActuales);
  if (equiposRestaurados && !equiposActualesFijados) {
    actualizarEstadoEquipos("Equipos de esta evaluación restaurados. Fíjalos si quieres conservarlos en el historial de equipos.");
  }
}

function cerrarSesionActual() {
  if (!claveSesionEquipos || sesionCerrada) return true;
  if (sesionSoloLectura) return false;
  if (modoAsistenciaActivo || modoEvaluacionActivo) {
    sesionCierrePendiente = true;
    actualizarAvisoCierrePendiente();
    return false;
  }
  if (!finalizarAsistenciaActual()) return false;
  if (!guardarRegistroEvaluacion(
    resultadosEquiposActuales,
    calificacionesManualesActuales,
    ajustesCalificacionActuales,
    true
  )) return false;

  sesionCerrada = true;
  sesionCierreIntentada = true;
  sesionCierrePendiente = false;
  sesionSoloLectura = true;
  modoEvaluacionActivo = false;
  document.getElementById("session-end-notice").classList.add("hidden");
  actualizarControlesEvaluacion();
  actualizarResumenAsistencia();
  actualizarEstadoEquipos("Sesión cerrada. Los registros anteriores se administran desde el historial.");
  mostrarEquipos(equiposActuales);
  return true;
}

function cerrarSesionPendienteSiListo() {
  if (!sesionCierrePendiente) return true;
  if (modoAsistenciaActivo || modoEvaluacionActivo) {
    actualizarAvisoCierrePendiente();
    return false;
  }
  return cerrarSesionActual();
}

function reiniciarResultadosEquiposEvaluacion() {
  if (resultadosEquiposActuales.size === 0) return true;
  const resultadosPendientes = new Map();
  if (!guardarRegistroEvaluacion(resultadosPendientes, calificacionesManualesActuales)) return false;
  resultadosEquiposActuales = resultadosPendientes;
  return true;
}

function guardarSnapshotEvaluacionSiExiste() {
  const registro = historialEvaluacion.find(item => item.clave === claveSesionEquipos);
  if (!registro) return true;
  return guardarRegistroEvaluacion(resultadosEquiposActuales, calificacionesManualesActuales);
}

function contarAsistencia(alumnos, estados, tomada) {
  const conteo = { presente: 0, falta: 0, retardo: 0, justificada: 0, pendiente: 0 };
  alumnos.forEach(alumno => {
    const estado = estados.get(alumno);
    if (estado === "presente") {
      conteo.presente++;
    } else if (estado === "justificada") {
      conteo.justificada++;
    } else if (estado === "retardo") {
      conteo.retardo++;
    } else if (estado === "falta" || tomada) {
      conteo.falta++;
    } else {
      conteo.pendiente++;
    }
  });
  return conteo;
}

function formatearResumenAsistencia(conteo) {
  const resumen = `${conteo.presente} presentes · ${conteo.falta} faltas · ${conteo.justificada} justificadas`;
  const retardos = conteo.retardo ? ` · ${conteo.retardo} retardos anteriores` : "";
  const pendientes = conteo.pendiente ? ` · ${conteo.pendiente} pendientes` : "";
  return `${resumen}${retardos}${pendientes}`;
}

function actualizarResumenAsistencia() {
  const resumen = document.getElementById("attendance-summary");
  const boton = document.getElementById("btn-attendance-mode");
  boton.disabled = !claveSesionEquipos || sesionSoloLectura;
  boton.classList.toggle("is-active", modoAsistenciaActivo);
  boton.setAttribute("aria-pressed", String(modoAsistenciaActivo));
  boton.title = modoAsistenciaActivo ? "Finalizar toma de asistencia" : "Activar toma de asistencia";
  boton.setAttribute("aria-label", boton.title);

  if (!claveSesionEquipos) {
    resumen.innerText = "Selecciona un grupo para tomar asistencia.";
    return;
  }

  const alumnos = parsearListaAlumnos(document.getElementById("input-students").value);
  const estadoLista = modoAsistenciaActivo
    ? "Tomando lista"
    : asistenciaTomada ? "Lista cerrada" : "Lista pendiente";
  resumen.innerText = `${estadoLista} · ${formatearResumenAsistencia(contarAsistencia(alumnos, asistenciaActual, asistenciaTomada))}`;
}

function ciclarEstadoAsistencia(alumno) {
  if (!modoAsistenciaActivo) return;
  const estadoActual = asistenciaActual.get(alumno) || "";
  const estados = ESTADOS_ASISTENCIA.map(estado => estado.valor);
  const indiceActual = estados.indexOf(estadoActual);
  const siguienteEstado = estados[(indiceActual + 1) % estados.length];
  guardarEstadoAsistencia(alumno, siguienteEstado);
}

function crearRegistroAsistencia(estados, tomada) {
  const grupo = gruposConfigurados.find(item => item.id === grupoActivoKey);
  if (!grupo || !claveSesionEquipos) return null;

  const fecha = claveSesionEquipos.slice(claveSesionEquipos.lastIndexOf("|") + 1);
  return {
    clave: claveSesionEquipos,
    grupoId: grupo.id,
    grupoNombre: grupo.nombre,
    dia: grupo.dia,
    fecha,
    inicio: grupo.inicio,
    fin: grupo.fin,
    alumnos: parsearListaAlumnos(document.getElementById("input-students").value),
    marcas: Array.from(estados, ([nombre, estado]) => ({ alumno: nombre, estado })),
    tomada,
    calificacionMinima: calificacionMinimaFalta,
    actualizadoEn: new Date().toISOString()
  };
}

function finalizarAsistenciaActual() {
  const estadosFinales = new Map(asistenciaActual);
  parsearListaAlumnos(document.getElementById("input-students").value).forEach(alumno => {
    if (!estadosFinales.has(alumno)) estadosFinales.set(alumno, "presente");
  });
  const registro = crearRegistroAsistencia(estadosFinales, true);
  if (!registro || !guardarRegistroAsistencia(registro)) return false;

  asistenciaActual = estadosFinales;
  asistenciaTomada = true;
  modoAsistenciaActivo = false;
  actualizarResumenAsistencia();
  mostrarEquipos(equiposActuales);
  renderizarHistorialAsistencia();
  return true;
}

function guardarEstadoAsistencia(alumno, valor) {
  if (!modoAsistenciaActivo || !claveSesionEquipos || sesionSoloLectura) return;
  if (!ESTADOS_ASISTENCIA.some(estado => estado.valor === valor)) return;

  const nuevosEstados = new Map(asistenciaActual);
  if (valor) nuevosEstados.set(alumno, valor);
  else nuevosEstados.delete(alumno);

  const registro = crearRegistroAsistencia(nuevosEstados, asistenciaTomada);
  if (!registro || !guardarRegistroAsistencia(registro)) return;

  asistenciaActual = nuevosEstados;
  actualizarMarcaAsistenciaEnEquipos(alumno);
  actualizarResumenAsistencia();
  renderizarHistorialAsistencia();
}

function actualizarMarcaAsistenciaEnEquipos(alumno) {
  document.querySelectorAll(".team-members-list li").forEach(fila => {
    if (!fila.firstChild || fila.firstChild.textContent !== alumno) return;
    const marcaActual = fila.querySelector(".attendance-marker");
    const marcaNueva = crearMarcaAsistencia(alumno);

    if (marcaActual && marcaActual.tagName === marcaNueva.tagName) {
      marcaActual.className = marcaNueva.className;
      marcaActual.innerText = marcaNueva.innerText;
      marcaActual.title = marcaNueva.title;
      marcaActual.setAttribute("aria-label", marcaNueva.getAttribute("aria-label"));
      if (modoAsistenciaActivo) {
        marcaActual.setAttribute("aria-pressed", marcaNueva.getAttribute("aria-pressed"));
      }
    } else if (marcaActual) {
      marcaActual.replaceWith(marcaNueva);
    }

    const lista = fila.closest(".team-members-list");
    const numeroEquipo = Number(lista.id.replace("team-", ""));
    const calificacionActual = fila.querySelector(".grade-indicator, .grade-controls");
    if (calificacionActual) {
      calificacionActual.replaceWith(crearControlCalificacion(alumno, numeroEquipo));
    }
  });
}

function guardarRegistroAsistencia(registro) {
  const indice = historialAsistencia.findIndex(item => item.clave === registro.clave);
  const historialAnterior = historialAsistencia;
  historialAsistencia = [...historialAsistencia];
  if (indice === -1) {
    historialAsistencia.push(registro);
  } else {
    historialAsistencia[indice] = registro;
  }

  try {
    localStorage.setItem(CLAVE_REGISTRO_ASISTENCIA, JSON.stringify(historialAsistencia));
    return true;
  } catch (e) {
    historialAsistencia = historialAnterior;
    console.error("No se pudo guardar la asistencia", e);
    alert("No se pudo guardar la asistencia. Revisa el espacio disponible del navegador.");
    return false;
  }
}

function renderizarHistorialAsistencia() {
  const lista = document.getElementById("attendance-history-list");
  lista.innerHTML = "";

  const registros = [...historialAsistencia].sort((a, b) => {
    const porFecha = b.fecha.localeCompare(a.fecha);
    return porFecha || b.actualizadoEn.localeCompare(a.actualizadoEn);
  });

  if (registros.length === 0) {
    const vacio = document.createElement("p");
    vacio.className = "attendance-history-empty";
    vacio.innerText = "Todavía no hay asistencias guardadas.";
    lista.appendChild(vacio);
    return;
  }

  registros.forEach(registro => {
    const detalle = document.createElement("details");
    detalle.className = "attendance-history-record";

    const fecha = new Date(`${registro.fecha}T00:00:00`);
    const fechaTexto = fecha.toLocaleDateString("es-MX", {
      day: "2-digit",
      month: "short",
      year: "numeric"
    });
    const resumen = document.createElement("summary");
    resumen.innerText = `${registro.grupoNombre} · ${NOMBRES_DIAS[registro.dia] || registro.dia} ${fechaTexto}`;

    const estados = new Map(registro.marcas.map(marca => [marca.alumno, marca.estado]));
    const metadatos = document.createElement("p");
    metadatos.className = "attendance-history-meta";
    const tomada = registro.tomada !== false;
    metadatos.innerText = `${registro.inicio}–${registro.fin} · ${formatearResumenAsistencia(contarAsistencia(registro.alumnos, estados, tomada))}`;

    const tabla = document.createElement("table");
    tabla.className = "attendance-history-table";
    const cuerpo = tabla.createTBody();
    registro.alumnos.forEach(alumno => {
      const fila = cuerpo.insertRow();
      const nombre = fila.insertCell();
      nombre.innerText = alumno;
      const estado = estados.get(alumno) || "";
      const estadoInfo = obtenerEstadoAsistencia(estado, tomada);
      fila.insertCell().append(
        crearIndicadorAsistencia(estado, tomada),
        document.createTextNode(` ${estadoInfo.etiqueta}`)
      );
    });

    detalle.append(resumen, metadatos, tabla);
    lista.appendChild(detalle);
  });
}

// GUARDADO DE LA LISTA DE ALUMNOS DEL GRUPO ACTIVO
function guardarAlumnosDelGrupoActivo() {
  if (sesionSoloLectura) return;
  const grupo = gruposConfigurados.find(g => g.id === grupoActivoKey);
  if (!grupo) return;
  grupo.alumnos = parsearListaAlumnos(document.getElementById("input-students").value);
  guardarEnLocalStorage();

  const registro = historialAsistencia.find(item => item.clave === claveSesionEquipos);
  if (registro) {
    guardarRegistroAsistencia({
      ...registro,
      alumnos: [...grupo.alumnos],
      marcas: Array.from(asistenciaActual, ([nombre, estado]) => ({ alumno: nombre, estado })),
      actualizadoEn: new Date().toISOString()
    });
  }

  renderizarHistorialAsistencia();
}

function generarEquiposAleatorios() {
  if (sesionSoloLectura) {
    alert("Este horario ya pasó. Para cambiar este registro, edítalo desde el historial de equipos.");
    return;
  }
  if (!grupoActivoKey || !claveSesionEquipos) {
    alert("Selecciona un grupo antes de sortear los equipos.");
    return;
  }

  const inputEstudiantes = document.getElementById("input-students").value;
  let alumnos = inputEstudiantes.split(/[,\n]/).map(name => name.trim()).filter(name => name.length > 0);

  if (alumnos.length === 0) {
    alert("Agrega alumnos a la lista de este grupo antes de sortear los equipos.");
    return;
  }

  for (let i = alumnos.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [alumnos[i], alumnos[j]] = [alumnos[j], alumnos[i]];
  }

  if (equiposActualesFijados && !desfijarSnapshotActual()) return;
  if (!reiniciarResultadosEquiposEvaluacion()) return;
  const equipos = Array.from({ length: cantidadEquipos }, () => []);
  alumnos.forEach((alumno, index) => equipos[index % cantidadEquipos].push(alumno));
  equiposActuales = equipos;
  equiposActualesFijados = false;
  mostrarEquipos(equipos);
  actualizarEstadoEquipos(
    puedeAcomodarEquiposManualmente()
      ? "Sorteo nuevo sin fijar. Arrastra alumnos para ajustar los equipos y fija la combinación cuando termines."
      : "Sorteo nuevo sin fijar. Puedes volver a sortear o guardar esta combinación."
  );

  const section = document.getElementById("teams-section");
  section.classList.remove("collapsed");
  document.body.classList.add("teams-expanded");
  document.querySelector(".daily-roster").open = false;
  document.getElementById("toggle-arrow").innerText = "▼ Ocultar Equipos";
  guardarSnapshotEvaluacionSiExiste();
}

function alternarMedios() {
  const imgCont = document.getElementById("image-container");
  const vidCont = document.getElementById("video-container");

  if (imgCont.classList.contains("hidden")) {
    imgCont.classList.remove("hidden");
    vidCont.classList.add("hidden");
  } else {
    imgCont.classList.add("hidden");
    vidCont.classList.remove("hidden");
  }
}

// LECTOR DE IMÁGENES LOCALES
function cargarImagenLocal(input) {
  if (input.files && input.files[0]) {
    const reader = new FileReader();
    reader.onload = function(e) {
      imagenLocalBase64 = e.target.result;
      document.getElementById("robot-image").src = imagenLocalBase64;
      guardarEnLocalStorage();
    };
    reader.readAsDataURL(input.files[0]);
  }
}

function formatearUrlYouTube(url) {
  if (!url) return "";
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
  const match = url.match(regExp);
  return (match && match[2].length === 11) ? `https://www.youtube.com/embed/${match[2]}` : url;
}

// APLICACIÓN EN VIVO Y PERSISTENCIA
function cambiarPaleta(themeClass) {
  temaActual = themeClass;
  actualizarClasesBody();
  localStorage.setItem("robotica_theme", themeClass);
}

function cambiarFuente(fontClass) {
  fuenteActual = fontClass;
  actualizarClasesBody();
  localStorage.setItem("robotica_font", fontClass);
}

function actualizarClasesBody() {
  document.body.className = `${temaActual} ${fuenteActual}`;
}

function abrirModalConfig() {
  // Recarga el editor con lo último guardado para no sobrescribir cambios recientes
  renderizarEditorGrupos();
  document.getElementById("config-modal").classList.remove("hidden");
}

function cerrarModalConfig() {
  document.getElementById("config-modal").classList.add("hidden");
  actualizarHoraDesarme();
}

function ajustarCantidadEquipos(cambio) {
  const input = document.getElementById("input-team-count");
  const cantidadActual = Number.isInteger(input.valueAsNumber) ? input.valueAsNumber : 7;
  input.value = Math.max(1, cantidadActual + cambio);
}

function ajustarMinutosDesarme(cambio) {
  const input = document.getElementById("input-disassemble-minutes");
  const cantidadActual = Number.isInteger(input.valueAsNumber) ? input.valueAsNumber : 8;
  input.value = Math.max(1, cantidadActual + cambio);
  previsualizarMinutosDesarme();
}

function parsearListaAlumnos(texto) {
  return texto.split(/[,\n]/).map(alumno => alumno.trim()).filter(Boolean);
}

function crearIdGrupo() {
  return `grupo-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function renderizarSelectorGrupos() {
  const select = document.getElementById("group-select");
  const seleccionActual = select.value;
  select.innerHTML = "";

  const opcionInicial = document.createElement("option");
  opcionInicial.value = "";
  opcionInicial.innerText = "-- Seleccionar Grupo --";
  select.appendChild(opcionInicial);

  Object.keys(DIAS_SEMANA).forEach(dia => {
    const gruposDelDia = gruposConfigurados
      .filter(grupo => grupo.dia === dia)
      .sort((a, b) => a.inicio.localeCompare(b.inicio));
    if (gruposDelDia.length === 0) return;

    const optgroup = document.createElement("optgroup");
    optgroup.label = NOMBRES_DIAS[dia];
    gruposDelDia.forEach(grupo => {
      const opcion = document.createElement("option");
      opcion.value = grupo.id;
      opcion.innerText = `${grupo.nombre} (${formatearHoraProgramada(grupo.inicio)} - ${formatearHoraProgramada(grupo.fin)})`;
      optgroup.appendChild(opcion);
    });
    select.appendChild(optgroup);
  });

  if (gruposConfigurados.some(grupo => grupo.id === seleccionActual)) {
    select.value = seleccionActual;
  }
}

function crearCampoGrupo(textoEtiqueta, control, identificador) {
  const campo = document.createElement("div");
  campo.className = "group-config-field";
  const etiqueta = document.createElement("label");
  etiqueta.htmlFor = identificador;
  etiqueta.innerText = textoEtiqueta;
  control.id = identificador;
  campo.append(etiqueta, control);
  return campo;
}

function renderizarEditorGrupos(grupos = gruposConfigurados) {
  const contenedor = document.getElementById("groups-config-list");
  contenedor.innerHTML = "";

  grupos.forEach((grupo, indice) => {
    const tarjeta = document.createElement("div");
    tarjeta.className = "group-config-card";
    tarjeta.dataset.groupId = grupo.id;

    const encabezado = document.createElement("div");
    encabezado.className = "group-config-card-heading";
    const titulo = document.createElement("strong");
    titulo.innerText = grupo.nombre || `Grupo ${indice + 1}`;
    const quitar = document.createElement("button");
    quitar.type = "button";
    quitar.className = "btn-remove-group";
    quitar.innerText = "Quitar";
    quitar.setAttribute("aria-label", `Quitar ${grupo.nombre || `grupo ${indice + 1}`}`);
    quitar.addEventListener("click", () => tarjeta.remove());
    encabezado.append(titulo, quitar);

    const datos = document.createElement("div");
    datos.className = "group-config-fields";

    const nombre = document.createElement("input");
    nombre.type = "text";
    nombre.className = "group-name";
    nombre.value = grupo.nombre;
    nombre.placeholder = "Ej. 4° A";

    const dia = document.createElement("select");
    dia.className = "group-day";
    Object.entries(NOMBRES_DIAS).forEach(([codigo, nombreDia]) => {
      const opcion = document.createElement("option");
      opcion.value = codigo;
      opcion.innerText = nombreDia;
      dia.appendChild(opcion);
    });
    dia.value = grupo.dia;

    const inicio = document.createElement("input");
    inicio.type = "time";
    inicio.className = "group-start";
    inicio.value = grupo.inicio;

    const fin = document.createElement("input");
    fin.type = "time";
    fin.className = "group-end";
    fin.value = grupo.fin;

    const nombres = document.createElement("textarea");
    nombres.className = "group-students";
    nombres.rows = 3;
    nombres.value = grupo.alumnos.join("\n");
    nombres.placeholder = "Un alumno por línea";

    datos.append(
      crearCampoGrupo("Nombre del grupo", nombre, `group-name-${indice}`),
      crearCampoGrupo("Día", dia, `group-day-${indice}`),
      crearCampoGrupo("Inicio", inicio, `group-start-${indice}`),
      crearCampoGrupo("Fin", fin, `group-end-${indice}`)
    );
    tarjeta.append(
      encabezado,
      datos,
      crearCampoGrupo("Alumnos (uno por línea)", nombres, `group-students-${indice}`)
    );
    contenedor.appendChild(tarjeta);
  });
}

function agregarGrupoConfig() {
  const gruposActuales = Array.from(document.querySelectorAll("#groups-config-list .group-config-card"))
    .map(tarjeta => ({
      id: tarjeta.dataset.groupId || crearIdGrupo(),
      nombre: tarjeta.querySelector(".group-name").value,
      dia: tarjeta.querySelector(".group-day").value,
      inicio: tarjeta.querySelector(".group-start").value,
      fin: tarjeta.querySelector(".group-end").value,
      alumnos: parsearListaAlumnos(tarjeta.querySelector(".group-students").value)
    }));
  gruposActuales.push({
    id: crearIdGrupo(),
    nombre: "",
    dia: "LUN",
    inicio: "08:00",
    fin: "09:00",
    alumnos: []
  });
  renderizarEditorGrupos(gruposActuales);
}

function leerGruposDesdeEditor(mostrarErrores = true) {
  const tarjetas = Array.from(document.querySelectorAll("#groups-config-list .group-config-card"));
  const grupos = [];
  const claves = new Set();

  for (let indice = 0; indice < tarjetas.length; indice++) {
    const tarjeta = tarjetas[indice];
    const nombre = tarjeta.querySelector(".group-name").value.trim();
    const dia = tarjeta.querySelector(".group-day").value;
    const inicio = tarjeta.querySelector(".group-start").value;
    const fin = tarjeta.querySelector(".group-end").value;
    const alumnos = parsearListaAlumnos(tarjeta.querySelector(".group-students").value);
    const numeroFila = indice + 1;

    if (!nombre || !DIAS_SEMANA[dia] || !/^\d{2}:\d{2}$/.test(inicio) || !/^\d{2}:\d{2}$/.test(fin) || inicio >= fin) {
      if (mostrarErrores) alert(`Revisa el grupo ${numeroFila}: indica nombre, día y un horario válido donde el fin sea posterior al inicio.`);
      return null;
    }

    const clave = `${dia}:${nombre.toLocaleLowerCase()}`;
    if (claves.has(clave)) {
      if (mostrarErrores) alert(`El grupo "${nombre}" aparece más de una vez el mismo día.`);
      return null;
    }
    claves.add(clave);
    grupos.push({ id: tarjeta.dataset.groupId || crearIdGrupo(), nombre, dia, inicio, fin, alumnos });
  }

  return grupos;
}

function normalizarTextoCSV(texto) {
  return texto.trim().toLocaleLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function detectarDelimitadorCSV(texto) {
  const primeraLinea = texto.split(/\r?\n/, 1)[0];
  let comas = 0;
  let puntosYComas = 0;
  let tabulaciones = 0;
  let entreComillas = false;
  for (let i = 0; i < primeraLinea.length; i++) {
    if (primeraLinea[i] === '"') {
      if (entreComillas && primeraLinea[i + 1] === '"') i++;
      else entreComillas = !entreComillas;
    } else if (!entreComillas && primeraLinea[i] === ",") {
      comas++;
    } else if (!entreComillas && primeraLinea[i] === ";") {
      puntosYComas++;
    } else if (!entreComillas && primeraLinea[i] === "\t") {
      tabulaciones++;
    }
  }
  if (tabulaciones > Math.max(comas, puntosYComas)) return "\t";
  return puntosYComas > comas ? ";" : ",";
}

function parsearCSV(texto, delimitador) {
  const filas = [];
  let fila = [];
  let campo = "";
  let entreComillas = false;
  const contenido = texto.replace(/^\uFEFF/, "");

  for (let i = 0; i < contenido.length; i++) {
    const caracter = contenido[i];
    if (caracter === '"') {
      if (entreComillas && contenido[i + 1] === '"') {
        campo += '"';
        i++;
      } else {
        entreComillas = !entreComillas;
      }
    } else if (!entreComillas && caracter === delimitador) {
      fila.push(campo);
      campo = "";
    } else if (!entreComillas && (caracter === "\n" || caracter === "\r")) {
      if (caracter === "\r" && contenido[i + 1] === "\n") i++;
      fila.push(campo);
      if (fila.some(valor => valor.trim() !== "")) filas.push(fila);
      fila = [];
      campo = "";
    } else {
      campo += caracter;
    }
  }

  if (entreComillas) throw new Error("El archivo CSV tiene comillas sin cerrar.");
  fila.push(campo);
  if (fila.some(valor => valor.trim() !== "")) filas.push(fila);
  return filas;
}

function convertirFilasCSVAGrupos(texto) {
  const filas = parsearCSV(texto, detectarDelimitadorCSV(texto));
  if (filas.length < 2) throw new Error("El archivo debe incluir encabezados y al menos una fila de datos.");

  const encabezados = filas[0].map(encabezado => normalizarTextoCSV(encabezado).replace(/\s+/g, ""));
  const columnas = {
    nombre: encabezados.indexOf("grupo"),
    dia: encabezados.indexOf("dia"),
    inicio: encabezados.indexOf("horainicio"),
    fin: encabezados.indexOf("horafin"),
    alumnos: encabezados.reduce((resultado, encabezado, indice) => {
      if (encabezado === "alumno" || /^alumno\s*\d+$/.test(encabezado)) resultado.push(indice);
      return resultado;
    }, [])
  };
  if ([columnas.nombre, columnas.dia, columnas.inicio, columnas.fin].some(indice => indice < 0)) {
    throw new Error("Faltan columnas. Usa: Grupo, Día, Hora inicio y Hora fin; los alumnos son opcionales.");
  }

  const diasPorNombre = Object.entries(NOMBRES_DIAS).reduce((resultado, [codigo, nombre]) => {
    resultado[normalizarTextoCSV(codigo)] = codigo;
    resultado[normalizarTextoCSV(nombre)] = codigo;
    return resultado;
  }, {});
  const gruposImportados = new Map();

  filas.slice(1).forEach((fila, indice) => {
    const numeroFila = indice + 2;
    const obtener = columna => (fila[columna] || "").trim();
    const nombre = obtener(columnas.nombre);
    const dia = diasPorNombre[normalizarTextoCSV(obtener(columnas.dia))];
    const inicio = obtener(columnas.inicio);
    const fin = obtener(columnas.fin);
    const alumnos = columnas.alumnos.map(obtener).filter(Boolean);
    if (!nombre || !dia || !/^\d{2}:\d{2}$/.test(inicio) || !/^\d{2}:\d{2}$/.test(fin) || inicio >= fin) {
      throw new Error(`La fila ${numeroFila} tiene grupo, día u horario inválido.`);
    }

    const clave = `${dia}:${nombre.toLocaleLowerCase()}`;
    let grupo = gruposImportados.get(clave);
    if (!grupo) {
      const existente = gruposConfigurados.find(item =>
        item.dia === dia && item.nombre.toLocaleLowerCase() === nombre.toLocaleLowerCase()
      );
      grupo = { id: existente ? existente.id : crearIdGrupo(), nombre, dia, inicio, fin, alumnos: [] };
      gruposImportados.set(clave, grupo);
    } else if (grupo.inicio !== inicio || grupo.fin !== fin) {
      throw new Error(`El horario del grupo "${nombre}" cambia entre filas (fila ${numeroFila}).`);
    }

    alumnos.forEach(alumno => {
      if (!grupo.alumnos.some(item => item.toLocaleLowerCase() === alumno.toLocaleLowerCase())) {
        grupo.alumnos.push(alumno);
      }
    });
  });

  return Array.from(gruposImportados.values());
}

function normalizarHoraImportada(valor) {
  if (typeof valor === "number" && valor >= 0 && valor < 1) {
    const minutosTotales = Math.round(valor * 1440) % 1440;
    return `${String(Math.floor(minutosTotales / 60)).padStart(2, "0")}:${String(minutosTotales % 60).padStart(2, "0")}`;
  }

  const coincidencia = String(valor || "").trim().match(/^(\d{1,2}):(\d{2})(?:\s*(AM|PM))?$/i);
  if (!coincidencia) return String(valor || "").trim();

  let horas = Number(coincidencia[1]);
  const minutos = Number(coincidencia[2]);
  const periodo = coincidencia[3] && coincidencia[3].toUpperCase();
  if (minutos > 59 || (periodo && (horas < 1 || horas > 12)) || (!periodo && horas > 23)) {
    return String(valor).trim();
  }
  if (periodo) horas = (horas % 12) + (periodo === "PM" ? 12 : 0);
  return `${String(horas).padStart(2, "0")}:${String(minutos).padStart(2, "0")}`;
}

function convertirFilasExcelAGrupos(filas) {
  if (filas.length < 2) throw new Error("El archivo debe incluir encabezados y al menos una fila de datos.");
  const encabezados = filas[0].map(encabezado => normalizarTextoCSV(encabezado).replace(/\s+/g, ""));
  const columnaInicio = encabezados.indexOf("horainicio");
  const columnaFin = encabezados.indexOf("horafin");
  if (columnaInicio < 0 || columnaFin < 0) {
    throw new Error("Faltan las columnas Hora inicio y Hora fin en la hoja de cálculo.");
  }

  const filasTSV = filas.map(fila => {
    const celdas = [...fila];
    celdas[columnaInicio] = normalizarHoraImportada(celdas[columnaInicio]);
    celdas[columnaFin] = normalizarHoraImportada(celdas[columnaFin]);
    return celdas.map(escaparCampoCSV).join("\t");
  });
  return convertirFilasCSVAGrupos(filasTSV.join("\r\n"));
}

function escaparCampoCSV(valor) {
  const texto = String(valor);
  return /[;"\t\r\n]/.test(texto) ? `"${texto.replace(/"/g, '""')}"` : texto;
}

function descargarPlantillaGrupos() {
  if (!window.XLSX) {
    alert("No se pudo cargar el componente de Excel. Revisa tu conexión a internet e inténtalo de nuevo.");
    return;
  }

  const filas = [["Grupo", "Día", "Hora inicio", "Hora fin", "Alumno"]];
  gruposConfigurados.forEach(grupo => {
    const alumnos = grupo.alumnos.length ? grupo.alumnos : [""];
    alumnos.forEach(alumno => filas.push([
      grupo.nombre,
      NOMBRES_DIAS[grupo.dia],
      grupo.inicio,
      grupo.fin,
      alumno
    ]));
  });

  const hoja = window.XLSX.utils.aoa_to_sheet(filas);
  hoja["!cols"] = [{ wch: 20 }, { wch: 16 }, { wch: 16 }, { wch: 16 }, { wch: 28 }];
  hoja["!autofilter"] = { ref: `A1:E${filas.length}` };
  hoja["!freeze"] = { xSplit: 0, ySplit: 1, topLeftCell: "A2", activePane: "bottomLeft", state: "frozen" };
  const libro = window.XLSX.utils.book_new();
  window.XLSX.utils.book_append_sheet(libro, hoja, "Grupos y alumnos");
  window.XLSX.writeFile(libro, "grupos-y-horarios.xlsx");
}

function importarGruposCSV(input) {
  const archivo = input.files && input.files[0];
  if (!archivo) return;

  const esExcel = /\.xlsx$/i.test(archivo.name);
  const lector = new FileReader();
  lector.onload = () => {
    try {
      let grupos;
      if (esExcel) {
        if (!window.XLSX) throw new Error("No se pudo cargar el componente de Excel. Revisa tu conexión a internet.");
        const libro = window.XLSX.read(lector.result, { type: "array" });
        const nombreHoja = libro.SheetNames[0];
        if (!nombreHoja) throw new Error("El archivo de Excel no contiene hojas.");
        const filas = window.XLSX.utils.sheet_to_json(libro.Sheets[nombreHoja], { header: 1, raw: false, defval: "" });
        grupos = convertirFilasExcelAGrupos(filas);
      } else {
        grupos = convertirFilasCSVAGrupos(String(lector.result || ""));
      }
      if (grupos.length === 0) throw new Error("No se encontraron grupos en el archivo.");
      renderizarEditorGrupos(grupos);
      alert(`Se cargaron ${grupos.length} grupos en el editor. Revisa los datos y pulsa "Guardar y Aplicar".`);
    } catch (error) {
      console.error("Error al importar grupos desde CSV", error);
      alert(`No se pudo importar el archivo: ${error.message}`);
    } finally {
      input.value = "";
    }
  };
  lector.onerror = () => {
    console.error("Error al leer el archivo CSV", lector.error);
    alert("No se pudo leer el archivo CSV.");
    input.value = "";
  };
  if (esExcel) lector.readAsArrayBuffer(archivo);
  else lector.readAsText(archivo, "UTF-8");
}

function guardarConfiguracion() {
  const gruposIngresados = leerGruposDesdeEditor();
  if (gruposIngresados === null) return;

  const cantidadIngresada = document.getElementById("input-team-count").valueAsNumber;
  if (!Number.isInteger(cantidadIngresada) || cantidadIngresada < 1) {
    alert("La cantidad de equipos debe ser un número entero mayor que cero.");
    return;
  }

  const minutosIngresados = document.getElementById("input-disassemble-minutes").valueAsNumber;
  if (!Number.isInteger(minutosIngresados) || minutosIngresados < 1) {
    alert("Los minutos antes de desarmar deben ser un número entero mayor que cero.");
    return;
  }

  cantidadEquipos = cantidadIngresada;
  minutosAntesDesarme = minutosIngresados;
  gruposConfigurados = gruposIngresados;
  renderizarSelectorGrupos();
  renderizarEditorGrupos();
  if (grupoActivoKey && gruposConfigurados.some(grupo => grupo.id === grupoActivoKey)) {
    document.getElementById("group-select").value = grupoActivoKey;
    cambiarGrupo();
  } else if (grupoActivoKey) {
    grupoActivoKey = null;
    document.getElementById("group-select").value = "";
    limpiarRelojClase();
    document.getElementById("input-students").value = "";
  }
  actualizarEquipos(cantidadEquipos);
  actualizarHoraDesarme();
  if (horaInicioClase && horaFinClase) {
    evaluarEstadoClase(new Date());
  }

  const code = document.getElementById("input-practice-code").value.trim();
  const proj = document.getElementById("input-project-name").value.trim();
  
  let fullTitle = "SESIÓN DE ROBÓTICA";
  if (code && proj) {
    fullTitle = `PRÁCTICA ${code} "${proj}"`;
  } else if (code) {
    fullTitle = `PRÁCTICA ${code}`;
  } else if (proj) {
    fullTitle = `"${proj}"`;
  }

  document.getElementById("session-name").innerText = fullTitle;
  document.getElementById("daily-quote").innerText = `"${document.getElementById("input-quote").value}"`;

  const extraNotice = document.getElementById("input-extra-notice").value.trim();
  const noticeBox = document.getElementById("extra-notice-box");
  const noticeText = document.getElementById("extra-notice-text");

  if (extraNotice !== "") {
    noticeText.innerText = extraNotice;
    noticeBox.classList.remove("hidden");
  } else {
    noticeText.innerText = "";
    noticeBox.classList.add("hidden");
  }

  if (imagenLocalBase64) {
    document.getElementById("robot-image").src = imagenLocalBase64;
  } else {
    document.getElementById("robot-image").src = document.getElementById("input-image-url").value;
  }

  const rawVideoUrl = document.getElementById("input-video-url").value;
  document.getElementById("relax-video").src = formatearUrlYouTube(rawVideoUrl);

  guardarEnLocalStorage();
  cerrarModalConfig();
}

// FUNCIONES DE GUARDADO Y RECUPERACIÓN PERMANENTE EN NAVEGADOR
function guardarEnLocalStorage() {
  const config = {
    practiceCode: document.getElementById("input-practice-code").value,
    projectName: document.getElementById("input-project-name").value,
    quote: document.getElementById("input-quote").value,
    notice: document.getElementById("input-extra-notice").value,
    imageUrl: document.getElementById("input-image-url").value,
    imageBase64: imagenLocalBase64,
    videoUrl: document.getElementById("input-video-url").value,
    groups: gruposConfigurados,
    teamCount: cantidadEquipos,
    disassembleMinutes: minutosAntesDesarme,
    minimumAbsenceGrade: calificacionMinimaFalta,
    maximumAdjustmentGrade: calificacionMaximaAjustes,
    individualMinimumGrade: calificacionMinimaFalta,
    individualMaximumGrade: calificacionMaximaAjustes,
    individualDefaultGrade: calificacionPredeterminadaIndividual,
    teamMinimumGrade: calificacionMinimaEquipo,
    teamMaximumGrade: calificacionMaximaEquipo,
    teamDefaultGrade: calificacionPredeterminadaEquipo,
    schoolPeriods: periodosEscolares,
    theme: temaActual,
    font: fuenteActual
  };
  localStorage.setItem("robotica_config", JSON.stringify(config));
}

function cargarConfiguracionGuardada() {
  const savedConfig = localStorage.getItem("robotica_config");
  if (savedConfig) {
    try {
      const config = JSON.parse(savedConfig);
      if (Array.isArray(config.groups)) {
        const gruposGuardados = config.groups.filter(grupo =>
          grupo
          && typeof grupo.id === "string"
          && typeof grupo.nombre === "string"
          && DIAS_SEMANA[grupo.dia]
          && /^\d{2}:\d{2}$/.test(grupo.inicio)
          && /^\d{2}:\d{2}$/.test(grupo.fin)
          && grupo.inicio < grupo.fin
          && Array.isArray(grupo.alumnos)
        );
        if (gruposGuardados.length !== config.groups.length) {
          throw new Error("La configuración de grupos guardada contiene datos inválidos.");
        }
        gruposConfigurados = gruposGuardados.map(grupo => ({
          ...grupo,
          alumnos: grupo.alumnos.filter(alumno => typeof alumno === "string" && alumno.trim()).map(alumno => alumno.trim())
        }));
      } else {
        gruposConfigurados = crearGruposPredeterminados();
        const alumnosAnteriores = config.students !== undefined
          ? parsearListaAlumnos(config.students)
          : ALUMNOS_LISTA_ANTERIOR.split(",").map(alumno => alumno.trim());
        const grupoAnterior = gruposConfigurados.find(grupo => grupo.id === "4A_VIE");
        if (grupoAnterior) grupoAnterior.alumnos = alumnosAnteriores;
      }

      if (config.practiceCode !== undefined) document.getElementById("input-practice-code").value = config.practiceCode;
      if (config.projectName !== undefined) document.getElementById("input-project-name").value = config.projectName;
      if (config.quote !== undefined) document.getElementById("input-quote").value = config.quote;
      if (config.notice !== undefined) document.getElementById("input-extra-notice").value = config.notice;
      if (config.imageUrl !== undefined) document.getElementById("input-image-url").value = config.imageUrl;
      if (config.videoUrl !== undefined) document.getElementById("input-video-url").value = config.videoUrl;
      if (Number.isInteger(config.teamCount) && config.teamCount > 0) {
        cantidadEquipos = config.teamCount;
      }
      document.getElementById("input-team-count").value = cantidadEquipos;
      if (Number.isInteger(config.disassembleMinutes) && config.disassembleMinutes > 0) {
        minutosAntesDesarme = config.disassembleMinutes;
      }
      document.getElementById("input-disassemble-minutes").value = minutosAntesDesarme;
      if (Number.isInteger(config.individualMinimumGrade)
        && config.individualMinimumGrade >= 0
        && config.individualMinimumGrade <= 10) {
        calificacionMinimaFalta = config.individualMinimumGrade;
      } else if (Number.isInteger(config.minimumAbsenceGrade)
        && config.minimumAbsenceGrade >= 0
        && config.minimumAbsenceGrade <= 10) {
        calificacionMinimaFalta = config.minimumAbsenceGrade;
      }
      if (Number.isInteger(config.individualMaximumGrade)
        && config.individualMaximumGrade >= 0
        && config.individualMaximumGrade <= 10) {
        calificacionMaximaAjustes = config.individualMaximumGrade;
      } else if (Number.isInteger(config.maximumAdjustmentGrade)
        && config.maximumAdjustmentGrade >= 0
        && config.maximumAdjustmentGrade <= 10) {
        calificacionMaximaAjustes = config.maximumAdjustmentGrade;
      }
      if (Number.isInteger(config.individualDefaultGrade)
        && config.individualDefaultGrade >= 0
        && config.individualDefaultGrade <= 10) {
        calificacionPredeterminadaIndividual = config.individualDefaultGrade;
      }
      if (Number.isInteger(config.teamMinimumGrade)
        && config.teamMinimumGrade >= 0
        && config.teamMinimumGrade <= 10) {
        calificacionMinimaEquipo = config.teamMinimumGrade;
      }
      if (Number.isInteger(config.teamMaximumGrade)
        && config.teamMaximumGrade >= 0
        && config.teamMaximumGrade <= 10) {
        calificacionMaximaEquipo = config.teamMaximumGrade;
      }
      if (Number.isInteger(config.teamDefaultGrade)
        && config.teamDefaultGrade >= 0
        && config.teamDefaultGrade <= 10) {
        calificacionPredeterminadaEquipo = config.teamDefaultGrade;
      }
      if (config.schoolPeriods && esConfiguracionPeriodosValida(config.schoolPeriods)) {
        periodosEscolares = config.schoolPeriods;
      } else if (config.schoolPeriods) {
        console.error("Se ignoraron las fechas de periodos escolares guardadas porque son inválidas.");
      }
      actualizarHoraDesarme();
      
      if (config.theme) {
        temaActual = config.theme;
        document.getElementById("select-palette").value = config.theme;
      }
      if (config.font) {
        fuenteActual = config.font;
        document.getElementById("select-font").value = config.font;
      }

      actualizarClasesBody();

      // Restaurar Imagen
      if (config.imageBase64) {
        imagenLocalBase64 = config.imageBase64;
        document.getElementById("robot-image").src = config.imageBase64;
      } else if (config.imageUrl) {
        document.getElementById("robot-image").src = config.imageUrl;
      }

      // Restaurar Título de Sesión
      let fullTitle = "SESIÓN DE ROBÓTICA";
      if (config.practiceCode && config.projectName) {
        fullTitle = `PRÁCTICA ${config.practiceCode} "${config.projectName}"`;
      } else if (config.practiceCode) {
        fullTitle = `PRÁCTICA ${config.practiceCode}`;
      } else if (config.projectName) {
        fullTitle = `"${config.projectName}"`;
      }
      document.getElementById("session-name").innerText = fullTitle;

      if (config.quote) {
        document.getElementById("daily-quote").innerText = `"${config.quote}"`;
      }

      if (config.notice) {
        document.getElementById("extra-notice-text").innerText = config.notice;
        document.getElementById("extra-notice-box").classList.remove("hidden");
      }

      if (config.videoUrl) {
        document.getElementById("relax-video").src = formatearUrlYouTube(config.videoUrl);
      }

    } catch (e) {
      console.error("Error al cargar configuración guardada", e);
    }
  }
  renderizarSelectorGrupos();
  renderizarEditorGrupos();
}
