import { useCallback, useEffect, useState } from "react";
import { api, ApiError, type Slot } from "@/lib/api";

/** Loads time slots for a date. Refetches when the date changes or refetch() is called. */
export function useAvailability(date: string) {
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loading, setLoading] = useState(false);
  const [slow, setSlow] = useState(false); // true if loading takes long (server waking up)
  const [error, setError] = useState<ApiError | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!date) {
      setSlots([]);
      setError(null);
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    setLoading(true);
    setError(null);
    setSlots([]);

    api
      .getAvailability(date, controller.signal)
      .then((data) => setSlots(data.slots))
      .catch((err) => {
        if (controller.signal.aborted) return; // date changed, ignore
        setError(
          err instanceof ApiError
            ? err
            : new ApiError({ status: 0, code: "NETWORK", message: "Could not reach the server." }),
        );
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [date, tick]);

  useEffect(() => {
    if (!loading) {
      setSlow(false);
      return;
    }
    const t = setTimeout(() => setSlow(true), 4000);
    return () => clearTimeout(t);
  }, [loading]);

  const refetch = useCallback(() => setTick((t) => t + 1), []);

  return { slots, loading, slow, error, refetch };
}