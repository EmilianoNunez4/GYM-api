import { openDB } from "idb";

const DB_NAME = "gimnasioDB";
const DB_VERSION = 1;
const PERSON_STORE = "personas";
const PAYMENT_STORE = "pagos";

export async function getDB() {
  return openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(PERSON_STORE)) {
        db.createObjectStore(PERSON_STORE, { keyPath: "id", autoIncrement: true });
      }
      if (!db.objectStoreNames.contains(PAYMENT_STORE)) {
        const pagos = db.createObjectStore(PAYMENT_STORE, { keyPath: "id", autoIncrement: true });
        pagos.createIndex("persona_mes", ["personaId", "mes"], { unique: true });
      }
    },
  });
}

export async function addPersona(nombre) {
  const db = await getDB();
  const id = await db.add(PERSON_STORE, { nombre });
  return { id, nombre };
}

export async function getPersonas() {
  const db = await getDB();
  return db.getAll(PERSON_STORE);
}

export async function addPago(personaId, mes) {
  const db = await getDB();
  await db.put(PAYMENT_STORE, { personaId, mes });
}

export async function getPagosByPersona(personaId) {
  const db = await getDB();
  const pagos = [];
  let cursor = await db.transaction(PAYMENT_STORE).store.openCursor();
  while (cursor) {
    if (cursor.value.personaId === personaId) {
      pagos.push(cursor.value);
    }
    cursor = await cursor.continue();
  }
  return pagos;
}