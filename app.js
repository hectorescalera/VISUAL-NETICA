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

let grupoActivoKey = null;
let horaInicioClase = null;
let horaDesarmeClase = null;
let horaFinClase = null;

let temaActual = "theme-dark";
let fuenteActual = "font-orbitron";
let imagenLocalBase64 = null;

// INICIALIZACIÓN Y CARGA DE LOCALSTORAGE
document.addEventListener("DOMContentLoaded", () => {
  cargarConfiguracionGuardada();
  actualizarReloj();
  setInterval(actualizarReloj, 1000);
});

function actualizarReloj() {
  const ahora = new Date();
  const horas = String(ahora.getHours()).padStart(2, '0');
  const minutos = String(ahora.getMinutes()).padStart(2, '0');
  const segundos = String(ahora.getSeconds()).padStart(2, '0');
  document.getElementById("main-clock").innerText = `${horas}:${minutos}:${segundos}`;

  const opcionesFecha = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
  document.getElementById("current-date").innerText = ahora.toLocaleDateString('es-MX', opcionesFecha);

  if (horaInicioClase && horaFinClase) {
    evaluarEstadoClase(ahora);
  }
}

function cambiarGrupo() {
  const select = document.getElementById("group-select");
  grupoActivoKey = select.value;

  if (!grupoActivoKey || !HORARIOS_GRUPOS[grupoActivoKey]) {
    limpiarRelojClase();
    return;
  }

  const horario = HORARIOS_GRUPOS[grupoActivoKey];
  const hoyStr = new Date().toISOString().split('T')[0];

  horaInicioClase = new Date(`${hoyStr}T${horario.inicio}:00`);
  horaFinClase = new Date(`${hoyStr}T${horario.fin}:00`);
  horaDesarmeClase = new Date(horaFinClase.getTime() - (8 * 60 * 1000));

  document.getElementById("disassemble-time").innerText = formatearHoraCorta(horaDesarmeClase);
  document.getElementById("end-time").innerText = formatearHoraCorta(horaFinClase);

  actualizarReloj();
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
    statusBadge.style.background = "#334155";
    timeCard.classList.remove("disassemble-alert");
    progressBar.style.width = "0%";
    timeRemainingText.innerText = `Faltan ${Math.ceil((horaInicioClase - ahora) / 60000)} min para iniciar`;
  } else if (ahora >= horaInicioClase && ahora < horaDesarmeClase) {
    statusBadge.innerText = "🔨 MODO CONSTRUCCIÓN";
    statusBadge.style.background = "var(--status-green)";
    timeCard.classList.remove("disassemble-alert");

    const pct = Math.min(100, Math.max(0, (transcurrido / totalDuracion) * 100));
    progressBar.style.width = `${pct}%`;
    progressBar.style.backgroundColor = "var(--accent-blue)";

    const minParaDesarme = Math.ceil((horaDesarmeClase - ahora) / 60000);
    timeRemainingText.innerText = `Tiempo para desarmar: ${minParaDesarme} min`;
  } else if (ahora >= horaDesarmeClase && ahora < horaFinClase) {
    statusBadge.innerText = "⚠️ HORA DE DESARMAR";
    statusBadge.style.background = "var(--alert-orange)";
    timeCard.classList.add("disassemble-alert");

    const pct = Math.min(100, Math.max(0, (transcurrido / totalDuracion) * 100));
    progressBar.style.width = `${pct}%`;
    progressBar.style.backgroundColor = "var(--alert-orange)";

    const minParaFin = Math.ceil((horaFinClase - ahora) / 60000);
    timeRemainingText.innerText = `¡Atención! Fin de clase en: ${minParaFin} min`;
  } else {
    statusBadge.innerText = "CLASE CONCLUIDA";
    statusBadge.style.background = "var(--alert-red)";
    timeCard.classList.remove("disassemble-alert");
    progressBar.style.width = "100%";
    progressBar.style.backgroundColor = "var(--alert-red)";
    timeRemainingText.innerText = "Momento de guardar kits y cambiar de grupo";
  }
}

function limpiarRelojClase() {
  horaInicioClase = null;
  horaDesarmeClase = null;
  horaFinClase = null;
  document.getElementById("disassemble-time").innerText = "--:--";
  document.getElementById("end-time").innerText = "--:--";
  document.getElementById("status-badge").innerText = "CLASE NO INICIADA";
  document.getElementById("time-remaining-text").innerText = "Selecciona un grupo para iniciar el cronómetro";
  document.getElementById("class-progress").style.width = "0%";
  document.getElementById("time-card").classList.remove("disassemble-alert");
}

function formatearHoraCorta(dateObj) {
  const h = String(dateObj.getHours()).padStart(2, '0');
  const m = String(dateObj.getMinutes()).padStart(2, '0');
  return `${h}:${m}`;
}

// CONTROL DE EQUIPOS
function toggleSeccionEquipos() {
  const section = document.getElementById("teams-section");
  const arrow = document.getElementById("toggle-arrow");
  section.classList.toggle("collapsed");
  if (section.classList.contains("collapsed")) {
    arrow.innerText = "▲ Mostrar Equipos";
  } else {
    arrow.innerText = "▼ Ocultar Equipos";
  }
}

function generarEquiposAleatorios() {
  const inputEstudiantes = document.getElementById("input-students").value;
  let alumnos = inputEstudiantes.split(',').map(name => name.trim()).filter(name => name.length > 0);

  if (alumnos.length === 0) {
    alert("Agrega nombres de alumnos en la configuración.");
    return;
  }

  for (let i = alumnos.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [alumnos[i], alumnos[j]] = [alumnos[j], alumnos[i]];
  }

  for (let eq = 1; eq <= 7; eq++) {
    document.getElementById(`team-${eq}`).innerHTML = "";
  }

  alumnos.forEach((alumno, index) => {
    const equipoTarget = (index % 7) + 1;
    const lista = document.getElementById(`team-${equipoTarget}`);
    const li = document.createElement("li");
    li.innerText = alumno;
    lista.appendChild(li);
  });

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
  document.getElementById("config-modal").classList.remove("hidden");
}

function cerrarModalConfig() {
  document.getElementById("config-modal").classList.add("hidden");
}

function guardarConfiguracion() {
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
    students: document.getElementById("input-students").value,
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

      if (config.practiceCode !== undefined) document.getElementById("input-practice-code").value = config.practiceCode;
      if (config.projectName !== undefined) document.getElementById("input-project-name").value = config.projectName;
      if (config.quote !== undefined) document.getElementById("input-quote").value = config.quote;
      if (config.notice !== undefined) document.getElementById("input-extra-notice").value = config.notice;
      if (config.imageUrl !== undefined) document.getElementById("input-image-url").value = config.imageUrl;
      if (config.videoUrl !== undefined) document.getElementById("input-video-url").value = config.videoUrl;
      if (config.students !== undefined) document.getElementById("input-students").value = config.students;
      
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
}