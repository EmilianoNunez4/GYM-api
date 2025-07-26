import React, { useState } from "react";

export default function PersonForm({ onAdd }) {
  const [nombre, setNombre] = useState("");

  function handleSubmit(e) {
    e.preventDefault();
    if (nombre.trim()) {
      onAdd(nombre.trim());
      setNombre("");
    }
  }

  return (
    <form onSubmit={handleSubmit} style={{ marginBottom: 20 }}>
      <input
        value={nombre}
        onChange={(e) => setNombre(e.target.value)}
        placeholder="Nombre de la persona"
        required
      />
      <button type="submit" style={{ marginLeft: 8 }}>Registrar</button>
    </form>
  );
}