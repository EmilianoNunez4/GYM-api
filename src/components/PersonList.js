import React from "react";
import { mesActualYYYYMM, nombreMesEsp } from "../utils";

export default function PersonList({ personas, pagos, onOpenPago }) {
  const mesActual = mesActualYYYYMM();

  return (
    <table style={{ width: "100%", borderCollapse: "collapse" }}>
      <thead>
        <tr>
          <th>Nombre</th>
          <th>Estado ({nombreMesEsp(mesActual)})</th>
          <th>Acciones</th>
        </tr>
      </thead>
      <tbody>
        {personas.map((p) => {
          const pagosPersona = pagos[p.id] || [];
          const alDia = pagosPersona.some(pg => pg.mes === mesActual);
          return (
            <tr key={p.id} style={{ background: alDia ? "#e7ffe7" : "#ffe7e7" }}>
              <td>{p.nombre}</td>
              <td>
                <span style={{ color: alDia ? "green" : "red" }}>
                  {alDia ? "Al día" : "En falta"}
                </span>
              </td>
              <td>
                <button onClick={() => onOpenPago(p)}>Registrar Pago / Ver Pagos</button>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}