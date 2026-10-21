import type { Participant } from "@ski/shared";
import { useCallback, useState } from "react";

const key = (tripId: string) => `ski:participant:${tripId}`;

function read(tripId: string): Participant | null {
  try {
    const raw = localStorage.getItem(key(tripId));
    return raw ? (JSON.parse(raw) as Participant) : null;
  } catch {
    return null;
  }
}

/** Quién eres en este viaje; se recuerda en este navegador. */
export function useParticipant(tripId: string) {
  const [state, setState] = useState(() => ({ tripId, participant: read(tripId) }));
  // Si cambia el viaje sin desmontar el componente, releer
  if (state.tripId !== tripId) setState({ tripId, participant: read(tripId) });
  const setParticipant = useCallback(
    (p: Participant | null) => {
      try {
        if (p) localStorage.setItem(key(tripId), JSON.stringify(p));
        else localStorage.removeItem(key(tripId));
      } catch {
        // sin almacenamiento: vale para esta sesión
      }
      setState({ tripId, participant: p });
    },
    [tripId],
  );
  return [state.tripId === tripId ? state.participant : read(tripId), setParticipant] as const;
}
