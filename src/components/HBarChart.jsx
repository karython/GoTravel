import React, { useState } from 'react';
import { formatBRL } from '../lib/finance.js';

// Gráfico de barras horizontais (série única, magnitude em R$).
// rows: [{ key, label, value, detail }] | reference: valor opcional para linha de referência
export default function HBarChart({ rows, reference, referenceLabel, ariaLabel }) {
  const [hovered, setHovered] = useState(null);
  const max = Math.max(...rows.map((r) => r.value), reference || 0, 0.01);
  const refPct = reference ? (reference / max) * 100 : null;

  return (
    <div role="img" aria-label={ariaLabel} className="flex flex-col gap-3">
      {rows.map((row) => {
        const pct = (row.value / max) * 100;
        const isHovered = hovered === row.key;
        return (
          <div
            key={row.key}
            className="relative grid grid-cols-[minmax(0,7rem)_1fr] items-center gap-3 py-1 outline-none"
            onMouseEnter={() => setHovered(row.key)}
            onMouseLeave={() => setHovered(null)}
            onFocus={() => setHovered(row.key)}
            onBlur={() => setHovered(null)}
            tabIndex={0}
          >
            <span className="text-xs font-semibold text-slate-700 truncate" title={row.label}>{row.label}</span>
            <div className="relative h-6 flex items-center">
              {refPct !== null && (
                <div
                  className="absolute top-0 bottom-0 w-px bg-slate-400"
                  style={{ left: `${refPct}%` }}
                  aria-hidden="true"
                />
              )}
              <div
                className="h-4 rounded-r transition-all"
                style={{
                  width: `${Math.max(pct, row.value > 0 ? 1 : 0)}%`,
                  backgroundColor: isHovered ? '#256abf' : '#2a78d6',
                }}
              />
              <span className="ml-2 text-[11px] font-bold text-slate-900 whitespace-nowrap">{formatBRL(row.value)}</span>
            </div>
            {isHovered && row.detail && (
              <div className="absolute z-10 left-28 -top-9 bg-slate-900 text-white text-[11px] px-2.5 py-1.5 rounded-lg shadow-lg whitespace-nowrap pointer-events-none">
                {row.detail}
              </div>
            )}
          </div>
        );
      })}
      {refPct !== null && referenceLabel && (
        <p className="text-[10px] text-slate-500 flex items-center gap-1.5">
          <span className="inline-block w-3 h-px bg-slate-400" aria-hidden="true" /> {referenceLabel}
        </p>
      )}
    </div>
  );
}
