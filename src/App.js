import React, { useEffect, useState } from "react";
import { addPersona, getPersonas, addPago, getPagosByPersona } from "./db";
import PersonForm from "./components/PersonForm";
import PersonList from "./components/PersonList";
import PaymentModal from "./components/PaymentModal";

export default function App() {
  const [personas, setPersonas] = useState([]);
  const [pagos, setPagos] = useState({});
  const [modal, setModal] = useState({ show: false, persona: null });

  useEffect(() => {
    cargarDatos();
    // eslint-disable-next-line
  }, []);

  async function cargarDatos() {
    const per = await getPersonas();
    setPersonas(per);
    const pagosObj = {};
    for (let p of per) {
      pagosObj[p.id] = await getPagosByPersona(p.id);
    }
    setPagos(pagosObj);
  }

  async function handleAddPersona(nombre) {
    await addPersona(nombre);
    await cargarDatos();
  }

  function handleOpenPago(persona) {
    setModal({ show: true, persona });
  }

  function handleClosePago() {
    setModal({ show: false, persona: null });
  }

  async function handleRegistrarPago(mes) {
    await addPago(modal.persona.id, mes);
    await cargarDatos();
  }

  return (
    <div style={{ maxWidth: 600, margin: "auto", padding: 20 }}>
      <h2>Gimnasio PWA</h2>
      <PersonForm onAdd={handleAddPersona} />
      <PersonList personas={personas} pagos={pagos} onOpenPago={handleOpenPago} />
      <PaymentModal
        show={modal.show}
        onClose={handleClosePago}
        onSubmit={handleRegistrarPago}
        pagos={modal.persona ? pagos[modal.persona.id] || [] : []}
        persona={modal.persona || {}}
      />
    </div>
  );
}