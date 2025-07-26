import React, { useState } from "react";
import { nombreMesEsp } from "../utils";

export default function PaymentModal({ show, onClose, onSubmit, pagos, persona }) {
  const [mes, setMes] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });

  function handleSubmit(e) {
    e.preventDefault();
    onSubmit(mes);
    onClose();
  }

  if (!show) return null;

  return (
    <div style={modalStyle}>
      <div style={modalContentStyle}>
        <h3>Registrar pago para {persona.nombre}</h3>
        <form onSubmit={handleSubmit}>
          <label>
            Mes pagado:
            <input
              type="month"
              value={mes}
              onChange={(e) => setMes(e.target.value)}
              required
            />
          </label>
          <button type="submit" style={{ marginLeft: 8 }}>Registrar Pago</button>
        </form>
        <h4>Pagos anteriores</h4>
        <ul>
          {pagos.map((p) => (
            <li key={p.mes}>{nombreMesEsp(p.mes)}</li>
          ))}
        </ul>
        <button onClick={onClose} style={{ marginTop: 10 }}>Cerrar</button>
      </div>
    </div>
  );
}

const modalStyle = {
  position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
  background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center"
};
const modalContentStyle = {
  background: "#fff", padding: 20, borderRadius: 8, minWidth: 300
};