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
let horaInicioClase = null;
let horaDesarmeClase = null;
let horaFinClase = null;

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
let claveSesionEquipos = null;
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
    document.getElementById("group-select").value = grupoEnHorario.id;
    cambiarGrupo();
  }
}

function cambiarGrupo() {
  if (modoAsistenciaActivo && !finalizarAsistenciaActual()) {
    document.getElementById("group-select").value = grupoActivoKey || "";
    return;
  }
  modoEvaluacionActivo = false;

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
    limpiarRelojClase();
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
  let diasHastaClase = (diaClase - ahora.getDay() + 7) % 7;
  let fechaClase = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate() + diasHastaClase);
  horaInicioClase = crearFechaHorario(fechaClase, grupoActivo.inicio);
  horaFinClase = crearFechaHorario(fechaClase, grupoActivo.fin);

  if (diasHastaClase === 0 && ahora >= horaFinClase) {
    diasHastaClase = 7;
    fechaClase = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate() + diasHastaClase);
    horaInicioClase = crearFechaHorario(fechaClase, grupoActivo.inicio);
    horaFinClase = crearFechaHorario(fechaClase, grupoActivo.fin);
  }

  document.getElementById("input-students").value = grupoActivo.alumnos.join("\n");
  document.querySelector(".daily-roster").open = true;

  claveSesionEquipos = crearClaveSesionEquipos(grupoActivo, horaInicioClase);
  cargarEquiposSesionActual();
  cargarAsistenciaSesionActual();
  cargarEvaluacionSesionActual();

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

    historialEquipos = registros.filter(esRegistroEquipoValido);
    if (historialEquipos.length !== registros.length) {
      console.error("Se omitieron registros de equipos con datos inválidos.");
    }
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
  const registro = historialEquipos.find(item => item.clave === claveSesionEquipos);
  const cantidadCoincide = registro && registro.cantidadEquipos === cantidadEquipos;
  equiposActualesFijados = Boolean(registro && registro.fijado && cantidadCoincide);
  equiposActuales = equiposActualesFijados ? registro.equipos : [];
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

function guardarRegistroEquipos(registro) {
  const indice = historialEquipos.findIndex(item => item.clave === registro.clave);
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
  estado.innerText = mensaje;
  estado.classList.toggle("is-pinned", equiposActualesFijados);
  document.getElementById("btn-fix-teams").disabled =
    !claveSesionEquipos || equiposActualesFijados || !equiposActuales.some(equipo => equipo.length > 0);
  const registroSesion = historialEquipos.find(item => item.clave === claveSesionEquipos);
  document.getElementById("btn-reset-teams").disabled =
    !claveSesionEquipos
    || (!equiposActualesFijados && !equiposActuales.some(equipo => equipo.length > 0)
      && !(registroSesion && registroSesion.fijado));
}

function mostrarEquipos(equipos) {
  const grid = document.getElementById("teams-grid-content");
  grid.innerHTML = "";
  document.getElementById("teams-title").innerText = `EQUIPOS DE TRABAJO (${cantidadEquipos} EQUIPOS)`;

  for (let n = 1; n <= cantidadEquipos; n++) {
    const card = document.createElement("div");
    card.className = "team-card";

    const title = document.createElement("div");
    title.className = "team-title";
    const titleText = document.createElement("span");
    titleText.innerText = `Equipo ${n}`;
    title.appendChild(titleText);
    if (modoEvaluacionActivo) {
      title.appendChild(crearControlResultadoEquipo(n));
    }

    const list = document.createElement("ul");
    list.className = "team-members-list";
    list.id = `team-${n}`;

    const miembros = equipos[n - 1] || [];
    (miembros.length ? miembros : ["Sin asignar"]).forEach(nombre => {
      const li = document.createElement("li");
      const nombreAlumno = document.createElement("span");
      nombreAlumno.className = "team-member-name";
      nombreAlumno.innerText = nombre;
      li.appendChild(nombreAlumno);
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

function fijarEquiposActuales() {
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
    clave: claveSesionEquipos,
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
  actualizarEstadoEquipos("Equipos fijados para esta sesión y guardados en el historial.");
  renderizarHistorialEquipos();
}

function reiniciarEquiposSesion() {
  if (!claveSesionEquipos) return;

  const registro = historialEquipos.find(item => item.clave === claveSesionEquipos);
  if (registro && registro.fijado) {
    const registroReiniciado = { ...registro, fijado: false };
    if (!guardarRegistroEquipos(registroReiniciado)) return;
  }

  if (!reiniciarResultadosEquiposEvaluacion()) return;
  equiposActuales = [];
  equiposActualesFijados = false;
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
  renderizarHistorialEquipos();
  document.getElementById("team-history-modal").classList.remove("hidden");
}

function cerrarHistorialEquipos() {
  document.getElementById("team-history-modal").classList.add("hidden");
}

function abrirConfiguracionCalificaciones() {
  document.getElementById("select-minimum-grade").value = String(calificacionMinimaFalta);
  document.getElementById("select-maximum-grade").value = String(calificacionMaximaAjustes);
  document.getElementById("grades-config-modal").classList.remove("hidden");
}

function cerrarConfiguracionCalificaciones() {
  document.getElementById("grades-config-modal").classList.add("hidden");
}

function guardarConfiguracionCalificaciones() {
  const minima = Number(document.getElementById("select-minimum-grade").value);
  const maxima = Number(document.getElementById("select-maximum-grade").value);
  if (![0, 5, 6].includes(minima) || ![8, 9, 10].includes(maxima) || minima > maxima) {
    alert("La calificación mínima debe ser menor o igual que la máxima.");
    return;
  }
  const minimaAnterior = calificacionMinimaFalta;
  const maximaAnterior = calificacionMaximaAjustes;
  calificacionMinimaFalta = minima;
  calificacionMaximaAjustes = maxima;
  if (historialEvaluacion.some(item => item.clave === claveSesionEquipos) && !guardarSnapshotEvaluacionSiExiste()) {
    calificacionMinimaFalta = minimaAnterior;
    calificacionMaximaAjustes = maximaAnterior;
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

  const registros = [...historialEquipos].sort((a, b) => {
    const porFecha = b.fecha.localeCompare(a.fecha);
    return porFecha || b.actualizadoEn.localeCompare(a.actualizadoEn);
  });

  if (registros.length === 0) {
    const vacio = document.createElement("p");
    vacio.className = "team-history-empty";
    vacio.innerText = "Todavía no hay equipos fijados. Las combinaciones aparecerán aquí al pulsar «Fijar equipos».";
    lista.appendChild(vacio);
    return;
  }

  registros.forEach(registro => {
    const detalle = document.createElement("details");
    detalle.className = "team-history-record";
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
    resumen.append(textoResumen, botonDescarga);

    const metadatos = document.createElement("p");
    metadatos.className = "team-history-meta";
    metadatos.innerText = `${registro.inicio}–${registro.fin} · ${registro.cantidadEquipos} equipos`;

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
    detalle.append(resumen, metadatos, equipos, descargarTabla, tabla);
    lista.appendChild(detalle);
  });
}

function filasHistorialEquipo(registro) {
  const evaluacion = historialEvaluacion.find(item => item.clave === registro.clave);
  const asistencia = historialAsistencia.find(item => item.clave === registro.clave);
  const listaCerrada = Boolean(asistencia && asistencia.tomada !== false);
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
      minima: evaluacion && Number.isInteger(evaluacion.calificacionMinima)
        ? evaluacion.calificacionMinima
        : asistencia && Number.isInteger(asistencia.calificacionMinima)
          ? asistencia.calificacionMinima
          : calificacionMinimaFalta,
      maxima: evaluacion && Number.isInteger(evaluacion.calificacionMaxima)
        ? evaluacion.calificacionMaxima
        : calificacionMaximaAjustes
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
  const evaluacion = historialEvaluacion.find(item => item.clave === registro.clave);
  return registro.equipos.map((miembros, indice) => ({
    Grupo: registro.grupoNombre,
    Fecha: registro.fecha,
    Equipo: `Equipo ${indice + 1}`,
    Resultado: etiquetaResultadoEquipo(
      evaluacion ? evaluacion.resultadosEquipos[indice] || "pendiente" : "pendiente"
    ),
    Integrantes: miembros.join(", ")
  }));
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
    "Fijado": registro.fijado ? "Sí" : "No"
  }));
  const libro = window.XLSX.utils.book_new();
  [
    { nombre: "Sesiones", filas: filasSesiones, columnas: ["Grupo", "Fecha", "Día", "Horario", "Cantidad de equipos", "Fijado"] },
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
    window.XLSX.writeFile(libro, `historial-${registro.grupoId}-${registro.fecha}.xlsx`);
  } catch (error) {
    console.error("No se pudo exportar el historial del equipo", error);
    alert("No se pudo descargar el historial de este grupo.");
  }
}

function descargarHistorialEquipos() {
  if (!window.XLSX) {
    alert("No se pudo cargar el componente de Excel. Revisa tu conexión a internet e inténtalo de nuevo.");
    return;
  }
  if (historialEquipos.length === 0) {
    alert("Todavía no hay equipos fijados para descargar.");
    return;
  }
  try {
    window.XLSX.writeFile(crearLibroHistorial(historialEquipos), "historial-completo-equipos.xlsx");
  } catch (error) {
    console.error("No se pudo exportar el historial completo de equipos", error);
    alert("No se pudo descargar el historial completo.");
  }
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
  columnas.forEach(titulo => {
    const celda = document.createElement("th");
    celda.innerText = titulo;
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
  if (!claveSesionEquipos) {
    alert("Selecciona un grupo antes de tomar asistencia.");
    return;
  }

  if (modoAsistenciaActivo) {
    finalizarAsistenciaActual();
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
    && (registro.calificacionMinima === undefined || [0, 5, 6].includes(registro.calificacionMinima))
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
  boton.disabled = !claveSesionEquipos;
  boton.classList.toggle("is-active", modoEvaluacionActivo);
  boton.setAttribute("aria-pressed", String(modoEvaluacionActivo));
  boton.title = modoEvaluacionActivo
    ? "Desactivar evaluación de equipos y notas individuales"
    : "Activar evaluación de equipos y notas individuales";
  boton.setAttribute("aria-label", boton.title);
}

function alternarModoEvaluacion() {
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
}

function obtenerResultadoEquipo(numeroEquipo) {
  return resultadosEquiposActuales.get(numeroEquipo) || "pendiente";
}

function crearControlResultadoEquipo(numeroEquipo) {
  const resultado = obtenerResultadoEquipo(numeroEquipo);
  if (!modoEvaluacionActivo) {
    const indicador = document.createElement("span");
    indicador.className = `team-result-indicator team-result-${resultado}`;
    indicador.innerText = resultado === "terminado" ? "✓" : resultado === "no_terminado" ? "×" : "○";
    indicador.title = `Equipo ${numeroEquipo}: ${etiquetaResultadoEquipo(resultado)}`;
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
  if (!modoEvaluacionActivo) {
    const indicador = document.createElement("span");
    indicador.className = `grade-indicator grade-indicator-${calificacion.tipo}`;
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
  const ajustePermitido = !calificacion.falta && calificacion.base !== null;
  controles.append(
    crearBotonAjusteCalificacion(alumno, -1, ajuste, !ajustePermitido || calificacion.nota <= calificacionMinimaFalta),
    crearBotonAjusteCalificacion(alumno, 1, ajuste, !ajustePermitido || calificacion.nota >= calificacionMaximaAjustes)
  );

  const input = document.createElement("input");
  input.type = "number";
  input.className = `grade-input grade-indicator-${calificacion.tipo}`;
  input.min = "0";
  input.max = "10";
  input.step = "1";
  input.value = calificacion.nota === null ? "" : String(calificacion.nota);
  input.placeholder = "—";
  input.title = calificacion.manual
    ? `Calificación manual de ${alumno}`
    : "Calificación automática; escribe un entero de 0 a 10 para reemplazarla";
  input.setAttribute("aria-label", `Calificación de ${alumno}, entero de 0 a 10`);
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
    maxima: calificacionMaximaAjustes
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
  maxima
}) {
  if (notasManuales.has(alumno)) {
    return { nota: notasManuales.get(alumno), manual: true, tipo: "manual", falta: false, base: null };
  }

  const estadoAsistencia = estadosAsistencia.get(alumno) || "";
  const falta = estadoAsistencia === "falta" || (!estadoAsistencia && listaCerrada);
  if (falta) return { nota: minima, manual: false, tipo: "automatica", falta: true, base: minima };

  const resultado = resultados.get(numeroEquipo) || "pendiente";
  const base = resultado === "terminado" ? 10 : resultado === "no_terminado" ? 8 : null;
  if (base === null) return { nota: null, manual: false, tipo: "pendiente", falta: false, base: null };
  const nota = Math.min(maxima, Math.max(minima, base + (ajustes.get(alumno) || 0)));
  return { nota, manual: false, tipo: "automatica", falta: false, base };
}

function ajustarCalificacion(alumno, cantidad) {
  if (!modoEvaluacionActivo || !claveSesionEquipos) return;
  const equipo = equiposActuales.findIndex(miembros => miembros.includes(alumno));
  if (equipo < 0) return;
  const calificacion = obtenerCalificacionAlumno(alumno, equipo + 1);
  if (calificacion.manual || calificacion.falta || calificacion.base === null) return;

  const nuevaNota = Math.min(
    calificacionMaximaAjustes,
    Math.max(calificacionMinimaFalta, calificacion.nota + cantidad)
  );
  const nuevosAjustes = new Map(ajustesCalificacionActuales);
  nuevosAjustes.set(alumno, (ajustesCalificacionActuales.get(alumno) || 0) + nuevaNota - calificacion.nota);
  if (!guardarRegistroEvaluacion(resultadosEquiposActuales, calificacionesManualesActuales, nuevosAjustes)) return;
  ajustesCalificacionActuales = nuevosAjustes;
  mostrarEquipos(equiposActuales);
}

function guardarResultadoEquipo(numeroEquipo, resultado) {
  if (!modoEvaluacionActivo || !claveSesionEquipos) return;
  if (!ESTADOS_EQUIPO_EVALUACION.includes(resultado)) return;

  const resultadosNuevos = new Map(resultadosEquiposActuales);
  if (resultado === "pendiente") resultadosNuevos.delete(numeroEquipo);
  else resultadosNuevos.set(numeroEquipo, resultado);
  if (!guardarRegistroEvaluacion(resultadosNuevos, calificacionesManualesActuales)) return;

  resultadosEquiposActuales = resultadosNuevos;
  mostrarEquipos(equiposActuales);
}

function guardarCalificacionManual(alumno, input) {
  if (!modoEvaluacionActivo || !claveSesionEquipos) return;

  const calificacionesNuevas = new Map(calificacionesManualesActuales);
  if (input === null || input.value.trim() === "") {
    calificacionesNuevas.delete(alumno);
  } else {
    const nota = input.valueAsNumber;
    if (!Number.isInteger(nota) || nota < 0 || nota > 10) {
      input.setCustomValidity("Ingresa una calificación entera entre 0 y 10.");
      input.reportValidity();
      return;
    }
    calificacionesNuevas.set(alumno, nota);
  }

  if (!guardarRegistroEvaluacion(resultadosEquiposActuales, calificacionesNuevas, ajustesCalificacionActuales)) return;
  calificacionesManualesActuales = calificacionesNuevas;
  mostrarEquipos(equiposActuales);
}

function crearRegistroEvaluacion(resultados, calificaciones, ajustes = ajustesCalificacionActuales) {
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
    actualizadoEn: new Date().toISOString()
  };
}

function guardarRegistroEvaluacion(resultados, calificaciones, ajustes = ajustesCalificacionActuales) {
  const registro = crearRegistroEvaluacion(resultados, calificaciones, ajustes);
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
    && (registro.calificacionMinima === undefined || [0, 5, 6].includes(registro.calificacionMinima))
    && (registro.calificacionMaxima === undefined || [8, 9, 10].includes(registro.calificacionMaxima))
    && !(Number.isInteger(registro.calificacionMinima)
      && Number.isInteger(registro.calificacionMaxima)
      && registro.calificacionMinima > registro.calificacionMaxima)
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
  modoEvaluacionActivo = false;
  actualizarControlesEvaluacion();
  mostrarEquipos(equiposActuales);
  if (equiposRestaurados && !equiposActualesFijados) {
    actualizarEstadoEquipos("Equipos de esta evaluación restaurados. Fíjalos si quieres conservarlos en el historial de equipos.");
  }
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
  boton.disabled = !claveSesionEquipos;
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
  const registro = crearRegistroAsistencia(asistenciaActual, true);
  if (!registro || !guardarRegistroAsistencia(registro)) return false;

  asistenciaTomada = true;
  modoAsistenciaActivo = false;
  actualizarResumenAsistencia();
  mostrarEquipos(equiposActuales);
  renderizarHistorialAsistencia();
  return true;
}

function guardarEstadoAsistencia(alumno, valor) {
  if (!modoAsistenciaActivo || !claveSesionEquipos) return;
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

  if (!reiniciarResultadosEquiposEvaluacion()) return;
  const equipos = Array.from({ length: cantidadEquipos }, () => []);
  alumnos.forEach((alumno, index) => equipos[index % cantidadEquipos].push(alumno));
  equiposActuales = equipos;
  equiposActualesFijados = false;
  mostrarEquipos(equipos);
  actualizarEstadoEquipos("Sorteo nuevo sin fijar. Puedes volver a sortear o guardar esta combinación.");

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
      if ([0, 5, 6].includes(config.minimumAbsenceGrade)) {
        calificacionMinimaFalta = config.minimumAbsenceGrade;
      }
      if ([8, 9, 10].includes(config.maximumAdjustmentGrade)) {
        calificacionMaximaAjustes = config.maximumAdjustmentGrade;
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
