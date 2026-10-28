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

// EQUIPOS GUARDADOS POR GRUPO Y TEMPORIZADOR DE GUARDADO DE ALUMNOS
let equiposPorGrupo = {};
let temporizadorGuardadoAlumnos = null;

// INICIALIZACIÓN Y CARGA DE LOCALSTORAGE
document.addEventListener("DOMContentLoaded", () => {
  cargarEquiposGuardados();
  cargarConfiguracionGuardada();
  revisarHorarioAutomatico();

  // Al editar el cuadro de alumnos, se guarda en la lista del grupo activo
  document.getElementById("input-students").addEventListener("input", () => {
    clearTimeout(temporizadorGuardadoAlumnos);
    temporizadorGuardadoAlumnos = setTimeout(guardarAlumnosDelGrupoActivo, 500);
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
    cambiarGrupo(true);
  }
}

function cambiarGrupo(cambioAutomatico = false) {
  const select = document.getElementById("group-select");
  grupoActivoKey = select.value;
  const grupoActivo = gruposConfigurados.find(grupo => grupo.id === grupoActivoKey);

  if (!grupoActivo) {
    limpiarRelojClase();
    document.getElementById("input-students").value = "";
    mostrarEquipos([]);
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

  if (cambioAutomatico) {
    delete equiposPorGrupo[grupoActivoKey];
    try {
      localStorage.setItem("robotica_equipos", JSON.stringify(equiposPorGrupo));
    } catch (e) {
      console.error("No se pudieron reiniciar los equipos del grupo", e);
    }
    mostrarEquipos([]);
  } else {
    // Muestra los equipos guardados de este grupo (o vacíos si aún no se sortean)
    const guardados = equiposPorGrupo[grupoActivoKey];
    mostrarEquipos(guardados && guardados.length === cantidadEquipos ? guardados : []);
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
  if (section.classList.contains("collapsed")) {
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
      .map(item => item.innerText)
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
    item.innerText = alumno;
    list.appendChild(item);
  });

  grid.querySelectorAll(".team-members-list").forEach(list => {
    if (list.children.length === 0) {
      const item = document.createElement("li");
      item.innerText = "Sin asignar";
      list.appendChild(item);
    }
  });
}

// EQUIPOS GUARDADOS POR GRUPO
function cargarEquiposGuardados() {
  try {
    equiposPorGrupo = JSON.parse(localStorage.getItem("robotica_equipos")) || {};
  } catch (e) {
    equiposPorGrupo = {};
  }
}

function guardarEquiposGrupo(equipos) {
  if (!grupoActivoKey) return;
  equiposPorGrupo[grupoActivoKey] = equipos;
  try {
    localStorage.setItem("robotica_equipos", JSON.stringify(equiposPorGrupo));
  } catch (e) {
    console.error("No se pudieron guardar los equipos", e);
  }
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
    title.innerText = `Equipo ${n}`;

    const list = document.createElement("ul");
    list.className = "team-members-list";
    list.id = `team-${n}`;

    const miembros = equipos[n - 1] || [];
    (miembros.length ? miembros : ["Sin asignar"]).forEach(nombre => {
      const li = document.createElement("li");
      li.innerText = nombre;
      list.appendChild(li);
    });

    card.append(title, list);
    grid.appendChild(card);
  }
}

// GUARDADO DE LA LISTA DE ALUMNOS DEL GRUPO ACTIVO
function guardarAlumnosDelGrupoActivo() {
  const grupo = gruposConfigurados.find(g => g.id === grupoActivoKey);
  if (!grupo) return;
  grupo.alumnos = parsearListaAlumnos(document.getElementById("input-students").value);
  guardarEnLocalStorage();
}

function generarEquiposAleatorios() {
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

  const equipos = Array.from({ length: cantidadEquipos }, () => []);
  alumnos.forEach((alumno, index) => equipos[index % cantidadEquipos].push(alumno));
  mostrarEquipos(equipos);
  guardarEquiposGrupo(equipos);

  const section = document.getElementById("teams-section");
  section.classList.remove("collapsed");
  document.getElementById("toggle-arrow").innerText = "▼ Ocultar Equipos";
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

function escaparCampoCSV(valor) {
  const texto = String(valor);
  return /[;"\t\r\n]/.test(texto) ? `"${texto.replace(/"/g, '""')}"` : texto;
}

function descargarPlantillaGrupos() {
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

  const contenido = "\uFEFF" + filas.map(fila => fila.map(escaparCampoCSV).join("\t")).join("\r\n");
  const enlace = document.createElement("a");
  enlace.href = URL.createObjectURL(new Blob([contenido], { type: "text/tab-separated-values;charset=utf-8" }));
  enlace.download = "grupos-y-horarios.tsv";
  document.body.appendChild(enlace);
  enlace.click();
  enlace.remove();
  setTimeout(() => URL.revokeObjectURL(enlace.href), 0);
}

function importarGruposCSV(input) {
  const archivo = input.files && input.files[0];
  if (!archivo) return;

  const lector = new FileReader();
  lector.onload = () => {
    try {
      const grupos = convertirFilasCSVAGrupos(String(lector.result || ""));
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
  lector.readAsText(archivo, "UTF-8");
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
