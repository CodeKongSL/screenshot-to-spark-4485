import { useEffect, useMemo, useRef, useState } from "react";
import { X, Calendar, Clock, User, Phone, Check, Loader2, RefreshCw } from "lucide-react";

import { api, ApiError, friendlyMessage, type Booking } from "@/lib/api";
import { formatLongDate, formatTime12, todayInColombo } from "@/lib/colombo";
import { useAvailability } from "@/hooks/useAvailability";

type Props = {
  open: boolean;
  onClose: () => void;
};

type Field = "name" | "phone" | "date" | "time";
type Errors = { [K in Field]?: string | undefined };

const inputBase =
  "w-full rounded-md border bg-card py-3 pl-11 pr-4 text-sm text-royal placeholder:text-royal/40 outline-none transition focus:border-plum focus:ring-2 focus:ring-plum/20";

export function BookingModal({ open, onClose }: Props) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [errors, setErrors] = useState<Errors>({});
  const [submitError, setSubmitError] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "success">("idle");
  const [slowSubmit, setSlowSubmit] = useState(false);
  const [booking, setBooking] = useState<Booking | null>(null);
  const firstFieldRef = useRef<HTMLInputElement>(null);

  // "today" is Colombo time, not the visitor's browser time
  const today = useMemo(() => todayInColombo(), [open]);
  const { slots, loading, slow, error: availError, refetch } = useAvailability(open ? date : "");

  const noneAvailable = !loading && !availError && date !== "" && (slots.length === 0 || slots.every((s) => !s.available));

  // lock body scroll + Escape to close
  useEffect(() => {
    if (!open) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleClose();
    };
    window.addEventListener("keydown", onKey);
    const t = setTimeout(() => firstFieldRef.current?.focus(), 200);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKey);
      clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, status]);

  // reset the form a moment after closing
  useEffect(() => {
    if (open) return;
    const t = setTimeout(() => {
      setName("");
      setPhone("");
      setDate("");
      setTime("");
      setErrors({});
      setSubmitError("");
      setBooking(null);
      setStatus("idle");
    }, 300);
    return () => clearTimeout(t);
  }, [open]);

  function handleClose() {
    if (status === "sending") return;
    onClose();
  }

  // Light client-side checks only; the server is the final judge.
  function validate(): Errors {
    const e: Errors = {};
    const n = name.trim();
    if (n.length < 2 || n.length > 100) e.name = "Please enter your full name (2-100 characters)";
    if (!/^[+\d\s-]{9,16}$/.test(phone.trim())) e.phone = "Enter a valid number, e.g. 0771234567";
    if (!date) e.date = "Please choose a date";
    else if (date < today) e.date = "Please choose a future date";
    if (!time) e.time = "Please pick a time slot";
    return e;
  }

  async function handleSubmit(ev: React.FormEvent) {
    ev.preventDefault();
    if (status === "sending") return;

    setSubmitError("");
    const e = validate();
    setErrors(e);
    if (Object.keys(e).length > 0) return;

    setStatus("sending");
    setSlowSubmit(false);
    const slowTimer = setTimeout(() => setSlowSubmit(true), 4000);

    try {
      const created = await api.createBooking({ name: name.trim(), phone: phone.trim(), date, time });
      setBooking(created);
      setStatus("success");
    } catch (err) {
      setStatus("idle"); // keep the entered values
      const apiErr = err instanceof ApiError ? err : null;

      if (apiErr?.status === 422 && apiErr.details) {
        const next: Errors = {};
        for (const f of ["name", "phone", "date", "time"] as const) {
          const msg = apiErr.details[f];
          if (msg) next[f] = msg;
        }
        setErrors(next);
        setSubmitError("Please check the highlighted fields.");
      } else if (apiErr?.code === "SLOT_TAKEN") {
        setSubmitError(apiErr.message);
        setTime("");
        refetch(); // show the updated slots
      } else {
        setSubmitError(friendlyMessage(err));
      }
    } finally {
      clearTimeout(slowTimer);
      setSlowSubmit(false);
    }
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="booking-title"
    >
      <style>{`
        @keyframes bm-fade { from { opacity: 0 } to { opacity: 1 } }
        @keyframes bm-up { from { opacity: 0; transform: translateY(40px) } to { opacity: 1; transform: translateY(0) } }
        @keyframes bm-pop { 0% { transform: scale(.6); opacity: 0 } 70% { transform: scale(1.08) } 100% { transform: scale(1); opacity: 1 } }
        @keyframes bm-draw { to { stroke-dashoffset: 0 } }
      `}</style>

      {/* backdrop */}
      <div
        className="absolute inset-0 bg-royal-deep/70 backdrop-blur-sm"
        style={{ animation: "bm-fade .25s ease-out" }}
        onClick={handleClose}
      />

      {/* panel */}
      <div
        className="relative flex max-h-[88dvh] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-cream shadow-2xl"
        style={{ animation: "bm-up .35s cubic-bezier(.2,.8,.2,1)" }}
      >
        <div className="h-1 w-full bg-gradient-to-r from-gold/40 via-gold to-gold/40" />

        <button
          type="button"
          onClick={handleClose}
          aria-label="Close"
          className="absolute right-3 top-4 z-10 grid h-9 w-9 place-items-center rounded-full text-royal/70 transition hover:bg-plum/10 hover:text-plum"
        >
          <X className="h-5 w-5" strokeWidth={1.5} />
        </button>

        {status === "success" && booking ? (
          <div className="overflow-y-auto px-6 pb-8 pt-10 text-center sm:px-10">
            <div
              className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-plum text-ivory shadow-lg"
              style={{ animation: "bm-pop .5s ease-out" }}
            >
              <svg viewBox="0 0 24 24" className="h-10 w-10" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path
                  d="M5 12.5l4.5 4.5L19 7.5"
                  style={{ strokeDasharray: 24, strokeDashoffset: 24, animation: "bm-draw .5s .25s ease-out forwards" }}
                />
              </svg>
            </div>
            <h2 id="booking-title" className="mt-6 font-serif text-3xl text-royal">
              Booking Received
            </h2>
            <p className="mx-auto mt-2 max-w-xs text-sm leading-relaxed text-royal/80">
              Thank you, {booking.name.split(" ")[0]}. Your request has been received and the salon will confirm it shortly.
            </p>

            <div className="mt-6 rounded-xl border border-gold/40 bg-card p-5 text-left text-sm text-royal shadow-[var(--shadow-soft)]">
              <div className="flex items-start gap-3">
                <User className="mt-0.5 h-4 w-4 shrink-0 text-gold" strokeWidth={1.5} />
                <span>{booking.name}</span>
              </div>
              <div className="mt-3 flex items-start gap-3">
                <Calendar className="mt-0.5 h-4 w-4 shrink-0 text-gold" strokeWidth={1.5} />
                <span>{formatLongDate(booking.date)}</span>
              </div>
              <div className="mt-3 flex items-start gap-3">
                <Clock className="mt-0.5 h-4 w-4 shrink-0 text-gold" strokeWidth={1.5} />
                <span>{formatTime12(booking.time)}</span>
              </div>
              <div className="mt-3 flex items-start gap-3">
                <Phone className="mt-0.5 h-4 w-4 shrink-0 text-gold" strokeWidth={1.5} />
                <span>{booking.phone}</span>
              </div>
            </div>

            <p className="mt-4 text-xs text-royal/60">Status: Pending confirmation</p>
            <button type="button" onClick={onClose} className="btn btn-plum mt-6 w-full !rounded-md">
              Done
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} noValidate className="flex min-h-0 flex-1 flex-col">
            <div className="overflow-y-auto px-6 pb-4 pt-8 sm:px-10">
              <p className="eyebrow !text-[0.65rem] text-plum">Aureole Skin by Renu</p>
              <h2 id="booking-title" className="mt-2 font-serif text-3xl text-royal sm:text-4xl">
                Book Appointment
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-royal/75">
                Reserve your moment of calm. Choose a date and time, then tell us how to reach you.
              </p>

              <div className="mt-6 space-y-5">
                {/* date */}
                <div>
                  <label htmlFor="bm-date" className="mb-1.5 block text-[0.7rem] font-medium uppercase tracking-[0.12em] text-royal">
                    Preferred Date
                  </label>
                  <div className="relative">
                    <Calendar className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-gold" strokeWidth={1.5} />
                    <input
                      id="bm-date"
                      type="date"
                      min={today}
                      value={date}
                      aria-invalid={!!errors.date}
                      aria-describedby={errors.date ? "bm-date-err" : undefined}
                      onChange={(e) => {
                        setDate(e.target.value);
                        setTime("");
                        setSubmitError("");
                        setErrors((p) => ({ ...p, date: undefined, time: undefined }));
                      }}
                      className={`${inputBase} ${errors.date ? "border-red-400" : "border-plum/25"}`}
                    />
                  </div>
                  {errors.date && (
                    <p id="bm-date-err" className="mt-1 text-xs text-red-500">
                      {errors.date}
                    </p>
                  )}
                </div>

                {/* time */}
                <div>
                  <span className="mb-1.5 block text-[0.7rem] font-medium uppercase tracking-[0.12em] text-royal">Preferred Time</span>

                  {!date ? (
                    <p className="rounded-md border border-dashed border-plum/25 px-4 py-3 text-xs text-royal/60">
                      Select a date to see available time slots.
                    </p>
                  ) : loading ? (
                    <div aria-live="polite">
                      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                        {Array.from({ length: 8 }).map((_, i) => (
                          <div key={i} className="h-9 animate-pulse rounded-md bg-plum/10" />
                        ))}
                      </div>
                      <p className="mt-2 flex items-center gap-2 text-xs text-royal/60">
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        {slow ? "Waking up the booking system, this can take up to a minute..." : "Loading available times..."}
                      </p>
                    </div>
                  ) : availError ? (
                    <div className="rounded-md border border-red-300 bg-red-50 px-4 py-3 text-xs text-red-600" role="alert">
                      <p>{availError.status === 422 ? availError.message : friendlyMessage(availError)}</p>
                      <button
                        type="button"
                        onClick={refetch}
                        className="mt-2 inline-flex items-center gap-1.5 font-medium underline underline-offset-2"
                      >
                        <RefreshCw className="h-3.5 w-3.5" /> Try again
                      </button>
                    </div>
                  ) : noneAvailable ? (
                    <p className="rounded-md border border-dashed border-plum/25 px-4 py-3 text-xs text-royal/60">
                      No times available, please pick another day.
                    </p>
                  ) : (
                    <div className="grid grid-cols-3 gap-2 sm:grid-cols-4" role="group" aria-label="Available time slots">
                      {slots.map((s) => {
                        const selected = time === s.time;
                        return (
                          <button
                            key={s.time}
                            type="button"
                            disabled={!s.available}
                            aria-pressed={selected}
                            onClick={() => {
                              setTime(s.time);
                              setErrors((p) => ({ ...p, time: undefined }));
                            }}
                            className={`rounded-md border px-1 py-2 text-xs transition ${
                              selected
                                ? "border-plum bg-plum text-ivory shadow-md"
                                : "border-plum/25 bg-card text-royal hover:border-plum"
                            } ${!s.available ? "cursor-not-allowed opacity-35 line-through hover:border-plum/25" : ""}`}
                          >
                            {formatTime12(s.time)}
                          </button>
                        );
                      })}
                    </div>
                  )}
                  {errors.time && <p className="mt-1 text-xs text-red-500">{errors.time}</p>}
                </div>

                {/* name */}
                <div>
                  <label htmlFor="bm-name" className="mb-1.5 block text-[0.7rem] font-medium uppercase tracking-[0.12em] text-royal">
                    Full Name
                  </label>
                  <div className="relative">
                    <User className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-gold" strokeWidth={1.5} />
                    <input
                      id="bm-name"
                      ref={firstFieldRef}
                      type="text"
                      autoComplete="name"
                      value={name}
                      maxLength={100}
                      aria-invalid={!!errors.name}
                      onChange={(e) => {
                        setName(e.target.value);
                        setErrors((p) => ({ ...p, name: undefined }));
                      }}
                      placeholder="Your name"
                      className={`${inputBase} ${errors.name ? "border-red-400" : "border-plum/25"}`}
                    />
                  </div>
                  {errors.name && <p className="mt-1 text-xs text-red-500">{errors.name}</p>}
                </div>

                {/* phone */}
                <div>
                  <label htmlFor="bm-phone" className="mb-1.5 block text-[0.7rem] font-medium uppercase tracking-[0.12em] text-royal">
                    Contact Number
                  </label>
                  <div className="relative">
                    <Phone className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-gold" strokeWidth={1.5} />
                    <input
                      id="bm-phone"
                      type="tel"
                      inputMode="tel"
                      autoComplete="tel"
                      value={phone}
                      aria-invalid={!!errors.phone}
                      onChange={(e) => {
                        setPhone(e.target.value);
                        setErrors((p) => ({ ...p, phone: undefined }));
                      }}
                      placeholder="07X XXX XXXX"
                      className={`${inputBase} ${errors.phone ? "border-red-400" : "border-plum/25"}`}
                    />
                  </div>
                  {errors.phone && <p className="mt-1 text-xs text-red-500">{errors.phone}</p>}
                </div>
              </div>
            </div>

            {/* sticky footer */}
            <div className="border-t border-plum/10 bg-cream px-6 py-4 sm:px-10">
              {submitError && (
                <p role="alert" className="mb-3 rounded-md border border-red-300 bg-red-50 px-3 py-2 text-xs text-red-600">
                  {submitError}
                </p>
              )}
              <button type="submit" disabled={status === "sending"} className="btn btn-plum w-full !rounded-md disabled:opacity-80">
                {status === "sending" ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {slowSubmit ? "Waking up the system..." : "Sending..."}
                  </>
                ) : submitError && !errors.name && !errors.phone && !errors.date && !errors.time ? (
                  <>
                    <RefreshCw className="h-4 w-4" /> Try Again
                  </>
                ) : (
                  <>
                    <Check className="h-4 w-4" /> Send
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}