export function getAdminOrderStatusLabel(status: string): string {
  switch (status) {
    case "new":
      return "Nueva";
    case "confirmed":
      return "Confirmada";
    case "preparing":
      return "Preparando";
    case "ready":
      return "Lista";
    case "out_for_delivery":
      return "En camino";
    case "delivered":
      return "Entregada";
    case "closed":
      return "Cerrada";
    case "ready_for_pickup":
      return "Lista para recoger";
    case "picked_up":
      return "Recogida";
    case "accepted":
      return "Aceptada";
    case "served":
      return "Servida";
    case "cancelled":
      return "Cancelada";
    default:
      return status;
  }
}

export function getAdminReservationStatusLabel(status: string): string {
  switch (status) {
    case "requested":
      return "Solicitada";
    case "approved":
      return "Aprobada";
    case "rejected":
      return "Rechazada";
    case "seated":
      return "Sentada";
    case "cancelled":
      return "Cancelada";
    case "no_show":
      return "No asistió";
    default:
      return status;
  }
}
