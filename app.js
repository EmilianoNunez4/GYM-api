const DB_NAME = "gimnasioDB";
const DB_VERSION = 6;
let db;

function openDB() {
    return new Promise((resolve, reject) => {
        if (db) return resolve(db);
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
            db = request.result;
            resolve(db);
        };
        request.onupgradeneeded = function(e) {
            let db = e.target.result;
            if (!db.objectStoreNames.contains("personas"))
                db.createObjectStore("personas", { keyPath: "id", autoIncrement: true });
            if (!db.objectStoreNames.contains("pagos")) {
                let store = db.createObjectStore("pagos", { keyPath: "id", autoIncrement: true });
                store.createIndex("persona_mes", ["personaId", "mes"], { unique: true });
            }
        };
    });
}

// ------ NUEVO: función para marcar persona como eliminada ------
async function marcarPersonaEliminada(personaId) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction("personas", "readwrite");
        const store = tx.objectStore("personas");
        const req = store.get(personaId);
        req.onsuccess = function() {
            const persona = req.result;
            if (persona) {
                persona.eliminado = true;
                const updateReq = store.put(persona);
                updateReq.onsuccess = () => resolve();
                updateReq.onerror = () => reject(updateReq.error);
            } else {
                reject("No se encontró la persona.");
            }
        };
        req.onerror = () => reject(req.error);
    });
}

// ------ NUEVO: función para obtener solo personas eliminadas ------
async function obtenerPersonasEliminadas() {
    const db = await openDB();
    return new Promise((resolve) => {
        const tx = db.transaction("personas", "readonly");
        const store = tx.objectStore("personas");
        const personasEliminadas = [];
        store.openCursor().onsuccess = function(e) {
            const cursor = e.target.result;
            if (cursor) {
                if (cursor.value.eliminado) {
                    personasEliminadas.push(cursor.value);
                }
                cursor.continue();
            } else {
                resolve(personasEliminadas);
            }
        };
    });
}

async function agregarPersona(nombre, actividad, montoInicial, fechaAlta, mesRegistro) {
    const db = await openDB();

    if (!fechaAlta) {
        const hoy = new Date();
        fechaAlta = hoy.toISOString().slice(0, 10);
    }

    const fechaHoraRegistro = new Date().toISOString();

    return new Promise((resolve, reject) => {
        const tx = db.transaction("personas", "readwrite");
        const store = tx.objectStore("personas");

        const req = store.add({
            nombre,
            actividad,
            telefono,
            fechaAlta,
            mesRegistro,
            fechaHoraRegistro,
            montoInicial: montoInicial || null,
            eliminado: false
        });

        req.onsuccess = async () => {
            const personaId = req.result;

            if (montoInicial && montoInicial > 0) {
                await agregarPago(personaId, montoInicial, fechaAlta, 30);
            }

            resolve(personaId);
        };

        req.onerror = () => reject(req.error);
    });
}


// ------ MODIFICADO: obtenerPersonas solo muestra no eliminadas ------
async function obtenerPersonas() {
    const db = await openDB();
    return new Promise((resolve) => {
        const tx = db.transaction("personas", "readonly");
        const store = tx.objectStore("personas");
        const personas = [];
        store.openCursor().onsuccess = function(e) {
            const cursor = e.target.result;
            if (cursor) {
                if (!cursor.value.eliminado) { // <--- solo no eliminadas
                    personas.push(cursor.value);
                }
                cursor.continue();
            } else {
                resolve(personas);
            }
        };
    });
}

async function agregarPago(personaId, monto, fechaPagoManual = null, diasDuracion = 30) {
    const db = await openDB();

    // Fecha del pago
    const fechaPago = fechaPagoManual || new Date().toISOString().slice(0, 10);

    // Calcular vencimiento
    const fechaVenc = new Date(fechaPago);
    fechaVenc.setDate(fechaVenc.getDate() + diasDuracion);
    const venceHasta = fechaVenc.toISOString().slice(0, 10);

    return new Promise((resolve, reject) => {
        const tx = db.transaction("pagos", "readwrite");
        const store = tx.objectStore("pagos");

        const nuevoPago = {
            personaId,
            monto: parseFloat(monto),
            fechaPago,
            diasDuracion,
            venceHasta
        };

        const req = store.add(nuevoPago);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
    });
}
async function obtenerPagosPorPersona(personaId) {
    const db = await openDB();
    return new Promise((resolve) => {
        const tx = db.transaction("pagos", "readonly");
        const store = tx.objectStore("pagos");
        const pagos = [];
        store.openCursor().onsuccess = function(e) {
            const cursor = e.target.result;
            if (cursor) {
                if (cursor.value.personaId === personaId) pagos.push(cursor.value);
                cursor.continue();
            } else {
                resolve(pagos);
            }
        };
    });
}

function mesActualYYYYMM() {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}
function nombreMesEsp(yyyymm) {
    if (!yyyymm) return "";
    const [year, mes] = yyyymm.split("-");
    const meses = [
        "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
        "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
    ];
    return `${meses[parseInt(mes, 10) - 1]} ${year}`;
}
function formatFecha(fechaISO) {
    if (!fechaISO) return "";
    const [y, m, d] = fechaISO.split("-");
    return `${d}/${m}/${y}`;
}
function formatFechaHora(fechaISO) {
    const d = new Date(fechaISO);
    if (isNaN(d)) return "";
    return d.toLocaleDateString("es-AR") + " " + d.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" });
}
function estadoPagoColor(pagos) {
    if (!pagos.length) {
        return { texto: "En falta", color: "rojo", class: "estado-en-falta" };
    }

    const hoy = new Date();
    const hoyStr = hoy.toISOString().slice(0, 10);

    // Buscar el último vencimiento
    const ultimoPago = pagos.sort((a, b) => b.venceHasta.localeCompare(a.venceHasta))[0];
    const vence = new Date(ultimoPago.venceHasta);
    const diffDias = Math.floor((vence - hoy) / (1000 * 60 * 60 * 24));

    if (diffDias < 0) {
        return { texto: "En falta", color: "rojo", class: "estado-en-falta" };
    } else if (diffDias <= 5) {
        return { texto: "Por vencer", color: "amarillo", class: "estado-por-vencer" };
    } else {
        return { texto: "Al día", color: "verde", class: "estado-al-dia" };
    }
}

// --- UI Logic ---
const formPersona = document.getElementById("form-persona");
const inputNombre = document.getElementById("nombre");
const inputActividad = document.getElementById("actividad");
const inputMontoInicial = document.getElementById("monto-inicial");
const inputFechaAlta = document.getElementById("fecha-alta");
const inputMesRegistro = document.getElementById("mes-registro");
const cardsPersonas = document.getElementById("cards-personas");
const filtroActividad = document.getElementById("filtro-actividad");
const buscadorNombre = document.getElementById("buscador-nombre");
const totalPersonas = document.getElementById("total-personas");

const modal = document.getElementById("modal-pago");
const cerrarModal = document.getElementById("cerrar-modal");
const tituloModal = document.getElementById("titulo-modal");
const formPago = document.getElementById("form-pago");
const inputMesPago = document.getElementById("mes-pago");
const inputMontoPago = document.getElementById("monto-pago");
const listaPagos = document.getElementById("lista-pagos");

let pagadorActual = null;

if (inputFechaAlta) {
    const today = new Date();
    inputFechaAlta.value = today.toISOString().slice(0,10);
}
if (inputMesRegistro) {
    const today = new Date();
    inputMesRegistro.value = today.toISOString().slice(0,7);
}

// ------ NUEVO: sección para personas dadas de baja ------
const cardsPersonasBaja = document.createElement("div");
cardsPersonasBaja.id = "cards-personas-baja";
cardsPersonasBaja.style.marginTop = "40px";
cardsPersonasBaja.innerHTML = `
    <h3 style="color: #777;">Personas dadas de baja</h3>
    <div id="cards-baja-list"></div>
`;
cardsPersonas.parentNode.insertBefore(cardsPersonasBaja, cardsPersonas.nextSibling);

// ------ NUEVO: renderizar cards de bajas ------
async function refrescarCardsBaja() {
    const personasEliminadas = await obtenerPersonasEliminadas();
    const cardsBajaList = document.getElementById("cards-baja-list");
    cardsBajaList.innerHTML = "";

    for (const persona of personasEliminadas) {
        const pagos = await obtenerPagosPorPersona(persona.id);
        const div = document.createElement("div");
        div.className = "card-persona card-baja";
        div.style.background = "#f4f4f4";
        div.style.border = "1px solid #ccc";
        div.style.color = "#888";
        div.style.marginBottom = "15px";
        div.style.padding = "15px";
        div.innerHTML = `
            <span class="estado-label" style="background:#ccc;color:#444;">Dado de baja</span>
            <div><b>Nombre:</b> ${persona.nombre}</div>
            <div><b>Actividad:</b> ${persona.actividad || ""}</div>
            <div><b>Teléfono:</b> ${persona.telefono || "-"}</div>
            <div><b>Fecha alta:</b> ${formatFecha(persona.fechaAlta)}</div>
            <div><b>Mes de registro:</b> ${nombreMesEsp(persona.mesRegistro)}</div>
            ${persona.montoInicial ? `<div><b>Monto inicial:</b> $${parseFloat(persona.montoInicial).toLocaleString()}</div>` : ""}
            <div style="margin-top:8px;">
            </div>
            <div class="card-actions">
              <button class="btn-alta" data-id="${persona.id}">Dar de alta</button>
            </div>
        `;
        // Botón para ver pagos
        const btnVerPagos = document.createElement("button");
        btnVerPagos.textContent = "Ver Pagos";
        btnVerPagos.classList.add("btn-ver-pagos");
        btnVerPagos.onclick = async () => {
            const pagos = await obtenerPagosPorPersona(persona.id);
            if (!pagos.length) {
                Swal.fire({
                    title: "Sin pagos registrados",
                    text: `${persona.nombre} no tiene pagos cargados.`,
                    icon: "info"
                });
                return;
            }

            pagos.sort((a, b) => new Date(a.fechaPago) - new Date(b.fechaPago)); // orden cronológico

            let contenido = `
                <div style="text-align:left;">
                ${pagos.map((p, i) => `
                    <b>Pago N° ${i + 1}.</b><br>
                    🗓️ Fecha: <b>${formatFecha(p.fechaPago)}</b><br>
                    💰 Monto: $${p.monto.toLocaleString()}<br>
                    ⏳ Válido hasta: ${formatFecha(p.venceHasta)}<br><br>
                `).join("")}
                </div>
            `;

            Swal.fire({
                title: `Pagos de ${persona.nombre}`,
                html: contenido,
                width: 420,
                confirmButtonText: "Cerrar"
            });
        };

    div.querySelector(".card-actions").appendChild(btnVerPagos);
      div.querySelector(".btn-alta").onclick = async () => {
        const resultado = await Swal.fire({
            title: `¿Reactivar a ${persona.nombre}?`,
            text: "Esta persona volverá a figurar como activa",
            icon: "question",
            showCancelButton: true,
            confirmButtonText: "Sí, reactivar",
            cancelButtonText: "Cancelar",
            confirmButtonColor: "#16bb5d",
            cancelButtonColor: "#e74c3c"
        });

        if (resultado.isConfirmed) {
            await marcarPersonaActiva(persona.id);
            await refrescarCards();

            Swal.fire({
                title: "Reactivado",
                text: `${persona.nombre} volvió a estar activo.`,
                icon: "success",
                timer: 2000,
                showConfirmButton: false
            });
        }
    };
        cardsBajaList.appendChild(div);
    }
}

// ------ MODIFICADO: refrescarCards también actualiza bajas ------
async function refrescarCards() {
    const personas = await obtenerPersonas();
    // Filtrado:
    const actividadSeleccionada = filtroActividad.value.trim().toLowerCase();
    const nombreBuscado = buscadorNombre.value.trim().toLowerCase();

    let personasFiltradas = personas.filter(p => {
        const actividadPersona = (p.actividad || "").toLowerCase();
        const nombrePersona = (p.nombre || "").toLowerCase();

        const coincideActividad = !actividadSeleccionada || actividadPersona === actividadSeleccionada;
        const coincideNombre = !nombreBuscado || nombrePersona.includes(nombreBuscado);

        return coincideActividad && coincideNombre;
    });


    // Mostrar total
    totalPersonas.textContent = `Total: ${personasFiltradas.length}`;
    // Render cards
   cardsPersonas.innerHTML = "";
const mensajeNoEncontrado = document.getElementById("mensaje-no-encontrado");
const hayFiltrosActivos = actividadSeleccionada || nombreBuscado;
if (hayFiltrosActivos && personasFiltradas.length === 0) {
    mensajeNoEncontrado.style.display = "block";
} else {
    mensajeNoEncontrado.style.display = "none";
}

for (const persona of personasFiltradas) {
    const pagos = await obtenerPagosPorPersona(persona.id);
    const estado = estadoPagoColor(pagos);
    const div = document.createElement("div");
    div.className = `card-persona ${estado.class}`;
    div.innerHTML = `
        <span class="estado-label ${estado.color}">${estado.texto}</span>
        <div><b>Nombre:</b> ${persona.nombre}</div>
        <div><b>Actividad:</b> ${persona.actividad || ""}</div>
        <div><b>Teléfono:</b> ${persona.telefono || "-"}</div>
        <div><b>Fecha alta:</b> ${formatFecha(persona.fechaAlta)}</div>
        <div><b>Mes de registro:</b> ${nombreMesEsp(persona.mesRegistro)}</div>
        ${persona.montoInicial ? `<div><b>Monto inicial:</b> $${parseFloat(persona.montoInicial).toLocaleString()}</div>` : ""}
        <div class="card-actions">
            <button data-id="${persona.id}" data-nombre="${persona.nombre}">Registrar Pago / Ver Pagos</button>
            <button data-id="${persona.id}" class="btn-baja">Dar de baja</button>
        </div>
    `;
    div.querySelector("button[data-nombre]").onclick = () => {
        pagadorActual = { id: persona.id, nombre: persona.nombre };
        abrirModalPago();
    };

    // Botón dar de baja
    div.querySelector(".btn-baja").onclick = async () => {
        const resultado = await Swal.fire({
            title: `¿Dar de baja a ${persona.nombre}?`,
            text: "Esta persona pasará a la lista de bajas.",
            icon: "warning",
            showCancelButton: true,
            confirmButtonText: "Sí, dar de baja",
            cancelButtonText: "Cancelar",
            confirmButtonColor: "#e74c3c",
            cancelButtonColor: "#3788fc"
        });

        if (resultado.isConfirmed) {
            await marcarPersonaEliminada(persona.id);
            await refrescarCards();

            Swal.fire({
                title: "Dado de baja",
                text: `${persona.nombre} fue movido a la lista de bajas.`,
                icon: "success",
                timer: 2000,
                showConfirmButton: false
            });
        }
    };
    cardsPersonas.appendChild(div);
}
// Actualiza la sección de bajas
await refrescarCardsBaja();
}

formPersona.onsubmit = async function(e) {
    e.preventDefault();
    const nombre = inputNombre.value.trim();
    const actividad = inputActividad.value.trim();
    const montoInicial = parseFloat(inputMontoInicial.value);
    const fechaAlta = inputFechaAlta.value;
    const telefono = inputTelefono.value.trim();
    const mesRegistro = inputMesRegistro.value;
    if (!nombre) { alert("Ingrese el nombre."); return; }
    if (!actividad) { alert("Seleccione o ingrese la actividad."); return; }
    await agregarPersona(nombre, actividad, isNaN(montoInicial) ? null : montoInicial, fechaAlta, mesRegistro, telefono);
    inputNombre.value = "";
    inputActividad.value = "";
    inputMontoInicial.value = "";
    inputTelefono.value = "";
    inputFechaAlta.value = new Date().toISOString().slice(0,10);
    inputMesRegistro.value = new Date().toISOString().slice(0,7);
    refrescarCards();
};
filtroActividad.addEventListener("change", refrescarCards);
buscadorNombre.addEventListener("input", refrescarCards);

function abrirModalPago() {
    tituloModal.textContent = `Registrar pago para ${pagadorActual.nombre}`;
    inputMesPago.value = new Date().toISOString().slice(0, 10); // formato yyyy-mm-dd
    inputMontoPago.value = "";
    mostrarPagosAnteriores();
    modal.style.display = "block";
}
function cerrarModalPago() {
    modal.style.display = "none";
    listaPagos.innerHTML = "";
}
cerrarModal.onclick = cerrarModalPago;
window.onclick = function(event) {
    if (event.target == modal) cerrarModalPago();
};
formPago.onsubmit = async function(e) {
    e.preventDefault();
    const mes = inputMesPago.value;
    const monto = parseFloat(inputMontoPago.value);
    if (isNaN(monto) || monto <= 0) {
        alert("Por favor, ingrese un monto válido.");
        return;
    }
    await agregarPago(pagadorActual.id, monto, inputMesPago.value);
    await refrescarCards();
    cerrarModalPago();
};

function fechaLarga(fechaISO) {
    const meses = [
        "enero", "febrero", "marzo", "abril", "mayo", "junio",
        "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"
    ];
    const [y, m, d] = fechaISO.split("-");
    return `${parseInt(d)} de ${meses[parseInt(m) - 1]} del ${y}`;
}

async function mostrarPagosAnteriores() {
    const pagos = await obtenerPagosPorPersona(pagadorActual.id);
    listaPagos.innerHTML = "";
    pagos.sort((a, b) => new Date(b.fechaPago) - new Date(a.fechaPago));
    for (const p of pagos) {
        const li = document.createElement("li");
        li.innerHTML = `
            <div class="pago-box" style="
                background: #fef9f1;
                border: 1px solid #e0c231;
                padding: 12px 16px;
                margin-bottom: 8px;
                border-radius: 12px;
                box-shadow: 0 2px 6px rgba(0,0,0,0.05);
            ">
                📅 <b>Pago:</b> ${fechaLarga(p.fechaPago)}<br>
                💵 <b>Monto:</b> $${parseFloat(p.monto).toLocaleString()}<br>
                🕓 <b>Válido hasta:</b> ${fechaLarga(p.venceHasta)}
            </div>
        `;
        listaPagos.appendChild(li);
    }
}

if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
        navigator.serviceWorker.register("service-worker.js");
    });
}

refrescarCards();

document.getElementById("btn-exportar-excel").onclick = async function () {
    const personas = await obtenerPersonas(); // Todas
    const eliminadas = personas.filter(p => p.eliminado);
    const activas = personas.filter(p => !p.eliminado);

    let pagosPorPersona = {};
    for (const persona of personas) {
        pagosPorPersona[persona.id] = await obtenerPagosPorPersona(persona.id);
    }

    let data = [];

    const filaEncabezadoActivos = [
        "Nombre", "Actividad", "Fecha de alta", "Monto inicial", 
        "Pago - Fecha", "Pago - Monto", "Pago - Válido hasta"
    ];
    const filaEncabezadoEliminados = [...filaEncabezadoActivos];

    const inicioActivos = 1; // fila 1 = segunda (después del título)
    const inicioEliminados = activas.length + 4; // estimado para aplicar estilo

    // 🟢 Tabla activos
    data.push(["🏋️ Personas activas"]);
    data.push(filaEncabezadoActivos);

    for (const persona of activas) {
        const pagos = pagosPorPersona[persona.id];
        if (!pagos.length) {
            data.push([
                persona.nombre,
                persona.actividad || "",
                formatFecha(persona.fechaAlta),
                persona.montoInicial != null ? persona.montoInicial : "",
                "", "", ""
            ]);
        } else {
            for (const pago of pagos) {
                data.push([
                    persona.nombre,
                    persona.actividad || "",
                    formatFecha(persona.fechaAlta),
                    persona.montoInicial != null ? persona.montoInicial : "",
                    formatFecha(pago.fechaPago),
                    pago.monto,
                    formatFecha(pago.venceHasta)
                ]);
            }
        }
    }

    // 🔴 Tabla eliminados
    if (eliminadas.length > 0) {
        data.push([]); // espacio vacío
        data.push(["❌ Personas eliminadas"]);
        data.push(filaEncabezadoEliminados);

        for (const persona of eliminadas) {
            const pagos = pagosPorPersona[persona.id];
            if (!pagos.length) {
                data.push([
                    persona.nombre,
                    persona.actividad || "",
                    formatFecha(persona.fechaAlta),
                    persona.montoInicial != null ? persona.montoInicial : "",
                    "", "", ""
                ]);
            } else {
                for (const pago of pagos) {
                    data.push([
                        persona.nombre,
                        persona.actividad || "",
                        formatFecha(persona.fechaAlta),
                        persona.montoInicial != null ? persona.montoInicial : "",
                        formatFecha(pago.fechaPago),
                        pago.monto,
                        formatFecha(pago.venceHasta)
                    ]);
                }
            }
        }
    }
    // Agregar línea final con la fecha y hora actual
    const ahora = new Date();
    const fechaHoraStr = ahora.toLocaleDateString() + " " + ahora.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    data.push([]);
    data.push([`🕓 Exportado el ${fechaHoraStr}`]);

    const ws = XLSX.utils.aoa_to_sheet(data);
    // 🎨 Estilos por fila
    const range = XLSX.utils.decode_range(ws['!ref']);
    for (let R = range.s.r; R <= range.e.r; R++) {
        const cellCount = data[R]?.length || 0;
        if (cellCount >= 5) {
            for (let C = 0; C < cellCount; C++) {
                const cellAddress = XLSX.utils.encode_cell({ r: R, c: C });
                if (!ws[cellAddress]) continue;

                // Estilo para encabezado de activos
                if (R === inicioActivos) {
                    ws[cellAddress].s = {
                        fill: { fgColor: { rgb: "FFF8DC" } }, // beige claro
                        font: { bold: true }
                    };
                }

                // Estilo para encabezado de eliminados
                if (R === inicioEliminados) {
                    ws[cellAddress].s = {
                        fill: { fgColor: { rgb: "FFE4E1" } }, // rosa claro
                        font: { bold: true }
                    };
                }
            }
        }
    }

    // 📐 Ajustar ancho de columnas
    ws['!cols'] = [
        { wch: 20 }, // Nombre
        { wch: 20 }, // Actividad
        { wch: 15 }, // Alta
        { wch: 15 }, // Monto
        { wch: 15 }, // Fecha pago
        { wch: 15 }, // Monto
        { wch: 18 }  // Vence hasta
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Gimnasio");

    XLSX.writeFile(wb, "gimnasio_registros.xlsx");
};


const toggleBtn = document.getElementById("toggle-dark");

// Función para actualizar el ícono del botón
const toggleCheckbox = document.getElementById("toggle-dark");
const toggleModeLabel = document.getElementById("toggle-mode-label");

function setTheme(theme) {
  if (theme === "dark") {
    document.documentElement.classList.add("dark-mode");
    toggleCheckbox.checked = true;
    toggleModeLabel.textContent = "";
  } else {
    document.documentElement.classList.remove("dark-mode");
    toggleCheckbox.checked = false;
    toggleModeLabel.textContent = "";
  }
}

// Al iniciar, lee la preferencia del usuario o la del sistema
(function() {
  let theme = localStorage.getItem("theme");
  if (!theme) {
    theme = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }
  setTheme(theme);
})();

toggleCheckbox.addEventListener("change", function() {
  const isDark = toggleCheckbox.checked;
  setTheme(isDark ? "dark" : "light");
  localStorage.setItem("theme", isDark ? "dark" : "light");
});

/* VOLVER A DAR DE ALTA USUARIO BAJADO*/

async function marcarPersonaActiva(personaId) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction("personas", "readwrite");
        const store = tx.objectStore("personas");
        const req = store.get(personaId);
        req.onsuccess = function() {
            const persona = req.result;
            if (persona) {
                persona.eliminado = false;
                const updateReq = store.put(persona);
                updateReq.onsuccess = () => resolve();
                updateReq.onerror = () => reject(updateReq.error);
            } else {
                reject("No se encontró la persona.");
            }
        };
        req.onerror = () => reject(req.error);
    });
}
