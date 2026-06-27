"use client";

import { Calendar, CheckCircle, ChevronLeft, ChevronRight, Sparkles } from "lucide-react";

const toDateInputValue = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const formatDate = (dateString) => {
  if (!dateString) return "Not set";
  return new Date(`${dateString}T00:00:00`).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

export function NumberScaleInput({
  label,
  value,
  onChange,
  min = 1,
  max = 120,
  step = 1,
  unit = "",
  helper,
}) {
  const numericValue = Number(value || min);
  const safeValue = Math.min(max, Math.max(min, numericValue));
  const percent = ((safeValue - min) / (max - min)) * 100;
  const ticks = [min, Math.round((min + max) / 4), Math.round((min + max) / 2), Math.round((min + max) * 0.75), max];

  const updateValue = (nextValue) => {
    const cleanValue = Math.min(max, Math.max(min, Number(nextValue)));
    onChange(String(cleanValue));
  };

  return (
    <div className="rounded-2xl border border-orange-100 bg-gradient-to-br from-orange-50 via-white to-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <label className="text-sm font-black text-gray-900">{label}</label>
          {helper && <p className="mt-0.5 text-xs text-gray-500">{helper}</p>}
        </div>
        <div className="rounded-2xl bg-[#1a1c1c] px-4 py-2 text-right text-white shadow-lg">
          <span className="text-2xl font-black leading-none">{safeValue}</span>
          {unit && <span className="ml-1 text-xs font-bold text-white/60">{unit}</span>}
        </div>
      </div>

      <div className="relative px-1 pb-1 pt-5">
        <div className="absolute left-1 right-1 top-7 h-2 rounded-full bg-gray-200" />
        <div
          className="absolute left-1 top-7 h-2 rounded-full bg-gradient-to-r from-[#f0813d] to-[#9c4400]"
          style={{ width: `calc(${percent}% - 0.25rem)` }}
        />
        <div
          className="absolute top-4 h-8 w-8 -translate-x-1/2 rounded-2xl border-4 border-white bg-[#f0813d] shadow-[0_8px_22px_rgba(240,129,61,0.35)]"
          style={{ left: `${percent}%` }}
        />
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={safeValue}
          onChange={(event) => updateValue(event.target.value)}
          className="relative z-10 h-10 w-full cursor-pointer opacity-0"
        />
        <div className="mt-1 flex justify-between text-[9px] font-black uppercase tracking-wide text-gray-400">
          {ticks.map((tick) => (
            <span key={tick}>{tick}</span>
          ))}
        </div>
      </div>

      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={() => updateValue(safeValue - step)}
          className="flex h-10 w-10 items-center justify-center rounded-xl bg-gray-100 text-gray-700 active:scale-95"
          aria-label={`Decrease ${label}`}
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <input
          type="number"
          min={min}
          max={max}
          value={value}
          onChange={(event) => {
            const nextValue = event.target.value;
            if (nextValue === "" || (!Number.isNaN(Number(nextValue)) && Number(nextValue) >= 0)) {
              onChange(nextValue);
            }
          }}
          className="min-w-0 flex-1 rounded-xl border border-gray-200 bg-white px-3 py-2 text-center text-sm font-black text-gray-900"
        />
        <button
          type="button"
          onClick={() => updateValue(safeValue + step)}
          className="flex h-10 w-10 items-center justify-center rounded-xl bg-gray-100 text-gray-700 active:scale-95"
          aria-label={`Increase ${label}`}
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

export function DateBandInput({ label, value, onChange, helper, presets = [] }) {
  const selectedDate = value ? new Date(`${value}T00:00:00`) : new Date();

  const shiftDate = (days) => {
    const nextDate = new Date(selectedDate);
    nextDate.setDate(nextDate.getDate() + days);
    onChange(toDateInputValue(nextDate));
  };

  const defaultPresets = [
    { label: "Today", getValue: () => toDateInputValue(new Date()) },
    {
      label: "7 days",
      getValue: () => {
        const date = new Date();
        date.setDate(date.getDate() - 7);
        return toDateInputValue(date);
      },
    },
    {
      label: "1 month",
      getValue: () => {
        const date = new Date();
        date.setMonth(date.getMonth() - 1);
        return toDateInputValue(date);
      },
    },
  ];

  const activePresets = presets.length > 0 ? presets : defaultPresets;

  return (
    <div className="rounded-2xl border border-orange-100 bg-gradient-to-br from-white via-orange-50 to-white p-4 shadow-sm">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <label className="text-sm font-black text-gray-900">{label}</label>
          {helper && <p className="mt-0.5 text-xs text-gray-500">{helper}</p>}
        </div>
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#1a1c1c] text-white">
          <Calendar className="h-5 w-5" />
        </div>
      </div>

      <div className="flex items-center gap-2 rounded-[1.25rem] bg-[#1a1c1c] p-2 text-white shadow-[0_12px_28px_rgba(26,28,28,0.18)]">
        <button
          type="button"
          onClick={() => shiftDate(-1)}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/10 active:scale-95"
          aria-label={`Previous ${label}`}
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <div className="min-w-0 flex-1 text-center">
          <p className="text-[9px] font-black uppercase tracking-[0.2em] text-[#f0813d]">Selected date</p>
          <p className="truncate text-lg font-black">{formatDate(value)}</p>
        </div>
        <button
          type="button"
          onClick={() => shiftDate(1)}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/10 active:scale-95"
          aria-label={`Next ${label}`}
        >
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2">
        {activePresets.map((preset) => (
          <button
            key={preset.label}
            type="button"
            onClick={() => onChange(preset.getValue())}
            className="rounded-xl border border-gray-200 bg-white px-2 py-2 text-[10px] font-black uppercase text-gray-700 active:scale-95"
          >
            {preset.label}
          </button>
        ))}
      </div>

      <input
        type="date"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-3 w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-bold text-gray-900"
      />
    </div>
  );
}

export function SavingReviewOverlay({ open, title = "Reviewing data", items = [] }) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/75 p-5 backdrop-blur-xl">
      <div className="relative w-full max-w-sm overflow-hidden rounded-[2rem] border border-white/10 bg-[#1a1c1c] p-6 text-white shadow-[0_30px_80px_rgba(0,0,0,0.45)]">
        <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[#f0813d] via-white to-[#9c4400]" />
        <div className="mx-auto mb-5 flex h-28 w-28 items-center justify-center rounded-[2rem] bg-[#f0813d]/15">
          <div className="saving-mascot">
            <div className="saving-mascot-head" />
            <div className="saving-mascot-body" />
            <div className="saving-mascot-spark saving-mascot-spark-one" />
            <div className="saving-mascot-spark saving-mascot-spark-two" />
          </div>
        </div>
        <div className="text-center">
          <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#f0813d]">
            Saving member
          </p>
          <h3 className="mt-2 text-2xl font-black tracking-tight">{title}</h3>
          <p className="mt-2 text-xs leading-relaxed text-white/55">
            Checking profile, plan dates, payment details and login access before saving.
          </p>
        </div>

        <div className="mt-5 space-y-2">
          {items.map((item) => (
            <div key={item} className="flex items-center gap-3 rounded-2xl border border-white/8 bg-white/5 px-3 py-2.5">
              <CheckCircle className="h-4 w-4 shrink-0 text-[#f0813d]" />
              <span className="text-xs font-bold text-white/80">{item}</span>
            </div>
          ))}
        </div>

        <div className="mt-5 flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-[0.18em] text-white/45">
          <Sparkles className="h-4 w-4 animate-pulse text-[#f0813d]" />
          Preparing records
        </div>
      </div>
    </div>
  );
}
