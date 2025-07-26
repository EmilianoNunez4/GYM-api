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
        fechaAlta = hoy.toISOString().slice(0,10);
    }
    if (!mesRegistro) {
        const hoy = new Date();
        mesRegistro = hoy.toISOString().slice(0,7);
    }
    const fechaHoraRegistro = new Date().toISOString();
    return new Promise((resolve, reject) => {
        const tx = db.transaction("personas", "readwrite");
        const store = tx.objectStore("personas");
        const req = store.add({ 
            nombre, 
            actividad, 
            fechaAlta, 
            mesRegistro, 
            fechaHoraRegistro, 
            montoInicial: montoInicial || null,
            eliminado: false // <--- campo agregado
        });
        req.onsuccess = async () => {
            if (montoInicial && montoInicial > 0) {
                const personaId = req.result;
                await agregarPago(personaId, mesRegistro, montoInicial, fechaHoraRegistro);
            }
            resolve(req.result);
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

async function agregarPago(personaId, mes, monto, fechaHoraManual = null) {
    const db = await openDB();
    const fechaHora = fechaHoraManual || new Date().toISOString();
    return new Promise((resolve, reject) => {
        const tx = db.transaction("pagos", "readwrite");
        const store = tx.objectStore("pagos");
        const req = store.put({ personaId, mes, monto: parseFloat(monto), fechaHora });
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
    const mesActual = mesActualYYYYMM();
    const pagoMesActual = pagos.find(p => p.mes === mesActual);
    if (!pagoMesActual) return { texto: "En falta", color: "rojo", class: "estado-en-falta" };
    const hoy = new Date();
    const año = hoy.getFullYear();
    const mes = hoy.getMonth();
    const ultimoDia = new Date(año, mes + 1, 0).getDate();
    const diasRestantes = ultimoDia - hoy.getDate();
    if (diasRestantes <= 5) {
        return { texto: "Por vencer", color: "amarillo", class: "estado-por-vencer" };
    }
    return { texto: "Al día", color: "verde", class: "estado-al-dia" };
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
            <div><b>Fecha alta:</b> ${formatFecha(persona.fechaAlta)}</div>
            <div><b>Mes de registro:</b> ${nombreMesEsp(persona.mesRegistro)}</div>
            ${persona.montoInicial ? `<div><b>Monto inicial:</b> $${parseFloat(persona.montoInicial).toLocaleString()}</div>` : ""}
            <div style="margin-top:8px;">
                <b>Cuotas abonadas:</b>
                <ul style="margin:0;padding-left:20px;">
                    ${pagos.length === 0 ? "<li style='color:#bbb;'>Sin pagos</li>" : pagos.map(pago => `
                        <li>
                          ${nombreMesEsp(pago.mes)} — $${parseFloat(pago.monto).toLocaleString()} — ${formatFechaHora(pago.fechaHora)}
                        </li>
                    `).join("")}
                </ul>
            </div>
        `;
        cardsBajaList.appendChild(div);
    }
}

// ------ MODIFICADO: refrescarCards también actualiza bajas ------
async function refrescarCards() {
    const personas = await obtenerPersonas();
    // Filtrado:
    const actividadSeleccionada = filtroActividad.value;
    let personasFiltradas = personas;
    if (actividadSeleccionada) {
        personasFiltradas = personas.filter(p => p.actividad === actividadSeleccionada);
    }
    // Mostrar total
    totalPersonas.textContent = `Total: ${personasFiltradas.length}`;
    // Render cards
    cardsPersonas.innerHTML = "";
    for (const persona of personasFiltradas) {
        const pagos = await obtenerPagosPorPersona(persona.id);
        const estado = estadoPagoColor(pagos);
        const div = document.createElement("div");
        div.className = `card-persona ${estado.class}`;
        div.innerHTML = `
            <span class="estado-label ${estado.color}">${estado.texto}</span>
            <div><b>Nombre:</b> ${persona.nombre}</div>
            <div><b>Actividad:</b> ${persona.actividad || ""}</div>
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
        // NUEVO: botón dar de baja
        div.querySelector(".btn-baja").onclick = async () => {
            if (confirm("¿Seguro que quieres dar de baja a esta persona?")) {
                await marcarPersonaEliminada(persona.id);
                await refrescarCards();
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
    const mesRegistro = inputMesRegistro.value;
    if (!nombre) { alert("Ingrese el nombre."); return; }
    if (!actividad) { alert("Seleccione o ingrese la actividad."); return; }
    await agregarPersona(nombre, actividad, isNaN(montoInicial) ? null : montoInicial, fechaAlta, mesRegistro);
    inputNombre.value = "";
    inputActividad.value = "";
    inputMontoInicial.value = "";
    inputFechaAlta.value = new Date().toISOString().slice(0,10);
    inputMesRegistro.value = new Date().toISOString().slice(0,7);
    refrescarCards();
};
filtroActividad.addEventListener("change", refrescarCards);

function abrirModalPago() {
    tituloModal.textContent = `Registrar pago para ${pagadorActual.nombre}`;
    inputMesPago.value = mesActualYYYYMM();
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
    await agregarPago(pagadorActual.id, mes, monto);
    await refrescarCards();
    cerrarModalPago();
};
async function mostrarPagosAnteriores() {
    const pagos = await obtenerPagosPorPersona(pagadorActual.id);
    listaPagos.innerHTML = "";
    pagos.sort((a, b) => b.mes.localeCompare(a.mes));
    for (const p of pagos) {
        const li = document.createElement("li");
        li.textContent = `${nombreMesEsp(p.mes)} — $${parseFloat(p.monto).toLocaleString()} — ${formatFechaHora(p.fechaHora)}`;
        listaPagos.appendChild(li);
    }
}

if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
        navigator.serviceWorker.register("service-worker.js");
    });
}

refrescarCards();

document.getElementById("btn-exportar-excel").onclick = async function() {
    const personas = await obtenerPersonas();
    let pagosPorPersona = {};
    for (const persona of personas) {
        pagosPorPersona[persona.id] = await obtenerPagosPorPersona(persona.id);
    }
    let data = [];
    for (const persona of personas) {
        const pagos = pagosPorPersona[persona.id];
        if (!pagos.length) {
            data.push({
                "Nombre": persona.nombre,
                "Actividad": persona.actividad || "",
                "Fecha de alta": formatFecha(persona.fechaAlta),
                "Mes de registro": nombreMesEsp(persona.mesRegistro),
                "Monto inicial": persona.montoInicial != null ? persona.montoInicial : "",
                "Pago - Mes pagado": "",
                "Pago - Monto pagado": "",
                "Pago - Fecha y hora": ""
            });
        } else {
            for (const pago of pagos) {
                data.push({
                    "Nombre": persona.nombre,
                    "Actividad": persona.actividad || "",
                    "Fecha de alta": formatFecha(persona.fechaAlta),
                    "Mes de registro": nombreMesEsp(persona.mesRegistro),
                    "Monto inicial": persona.montoInicial != null ? persona.montoInicial : "",
                    "Pago - Mes pagado": nombreMesEsp(pago.mes),
                    "Pago - Monto pagado": pago.monto,
                    "Pago - Fecha y hora": formatFechaHora(pago.fechaHora)
                });
            }
        }
    }
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Gimnasio");
    XLSX.writeFile(wb, "gimnasio_registros.xlsx");
};