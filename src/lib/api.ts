// Single place for all backend calls. The website only uses PUBLIC endpoints (never admin ones).

const BASE_URL = (
  (import.meta.env["VITE_API_BASE_URL"] as string | undefined) ?? "http://localhost:8080/api/v1"
).replace(/\/$/, "");

// First request can take 30-60s when the Render free plan is waking up.
const DEFAULT_TIMEOUT_MS = 60_000;

export type Slot = { time: string; available: boolean };
export type Availability = { date: string; slots: Slot[] };

export type Booking = {
  id: string;
  name: string;
  phone: string;
  date: string;
  time: string;
  status: "pending" | "confirmed" | "cancelled" | "completed";
  createdAt: string;
  updatedAt: string;
};

export type CreateBookingInput = { name: string; phone: string; date: string; time: string };

export class ApiError extends Error {
  status: number;
  code: string;
  details?: Record<string, string> | undefined;

  constructor(opts: { status: number; code: string; message: string; details?: Record<string, string> | undefined }) {
    super(opts.message);
    this.name = "ApiError";
    this.status = opts.status;
    this.code = opts.code;
    this.details = opts.details;
  }
}

type RequestOptions = {
  method?: "GET" | "POST" | undefined;
  body?: unknown;
  signal?: AbortSignal | undefined; // caller cancellation (e.g. date changed)
  timeoutMs?: number | undefined;
};

async function request<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const controller = new AbortController();
  let timedOut = false;

  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, opts.timeoutMs ?? DEFAULT_TIMEOUT_MS);

  opts.signal?.addEventListener("abort", () => controller.abort());

  let res: Response;
  try {
    const init: RequestInit = {
      method: opts.method ?? "GET",
      signal: controller.signal,
    };
    if (opts.body) {
      init.headers = { "Content-Type": "application/json" };
      init.body = JSON.stringify(opts.body);
    }
    res = await fetch(`${BASE_URL}${path}`, init);
  } catch {
    clearTimeout(timer);
    // cancelled by the caller on purpose: let the caller ignore it
    if (opts.signal?.aborted) throw new DOMException("Aborted", "AbortError");
    throw new ApiError({
      status: 0,
      code: timedOut ? "TIMEOUT" : "NETWORK",
      message: "Could not reach the server.",
    });
  }
  clearTimeout(timer);

  let json: any = null;
  try {
    json = await res.json();
  } catch {
    // non-JSON response, handled below
  }

  if (!res.ok || !json?.success) {
    throw new ApiError({
      status: res.status,
      code: json?.error?.code ?? "INTERNAL_ERROR",
      message: json?.error?.message ?? "Something went wrong.",
      details: json?.error?.details,
    });
  }

  return json.data as T;
}

export const api = {
  getAvailability: (date: string, signal?: AbortSignal) =>
    request<Availability>(`/availability?date=${encodeURIComponent(date)}`, { signal }),

  createBooking: (input: CreateBookingInput) =>
    request<Booking>("/bookings", { method: "POST", body: input }),
};

/** Customer-friendly text for any error. Never shows raw JSON or stack traces. */
export function friendlyMessage(err: unknown): string {
  if (!(err instanceof ApiError)) return "Something went wrong. Please try again.";
  switch (err.code) {
    case "NETWORK":
    case "TIMEOUT":
      return "We couldn't reach the server. Please check your connection and try again.";
    case "RATE_LIMITED":
      return "Too many attempts. Please wait a minute and try again.";
    case "SLOT_TAKEN":
    case "VALIDATION_ERROR":
      return err.message;
    default:
      return "Something went wrong on our side. Please try again in a moment.";
  }
}