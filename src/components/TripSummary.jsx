import React from 'react';
import { Flag, TrendingUp, TrendingDown, Check } from 'lucide-react';
import HBarChart from './HBarChart.jsx';
import { formatBRL } from '../lib/finance.js';

// Resumo final de uma viagem finalizada (dados congelados em trip.finalSummary)
export default function TripSummary({ summary, finishedAt, currentUid }) {
  if (!summary) return null;

  const memberRows = summary.perMember.map((m) => ({
    key: m.uid,
    label: m.uid === currentUid ? `${m.name} (Você)` : m.name,
    value: m.paid,
    detail: `Pagou ${formatBRL(m.paid)} · parte ${formatBRL(m.share)}`,
  }));

  const categoryRows = summary.byCategory.map((c) => ({
    key: c.category,
    label: c.label,
    value: c.total,
    detail: `${c.count} lançamento(s) · ${summary.total > 0 ? ((c.total / summary.total) * 100).toFixed(0) : 0}% do total`,
  }));

  return (
    <div className="bg-white rounded-3xl border border-slate-200 p-6 flex flex-col gap-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-bold text-slate-950 uppercase tracking-wide flex items-center gap-2">
            <Flag className="w-4 h-4 text-blue-600" /> Resumo final da viagem
          </h3>
          {finishedAt && (
            <p className="text-xs text-slate-500 mt-1">
              Finalizada em {new Date(finishedAt).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}
            </p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatTile label="Total gasto" value={formatBRL(summary.total)} />
        <StatTile label="Por pessoa" value={formatBRL(summary.perPerson)} />
        <StatTile label="Participantes" value={summary.memberCount} />
        <StatTile label="Lançamentos" value={summary.expenseCount} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="flex flex-col gap-3">
          <div>
            <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Quanto cada um pagou</h4>
            <p className="text-[11px] text-slate-500">Comparado à parte de cada um no rateio.</p>
          </div>
          <HBarChart
            rows={memberRows}
            reference={summary.perPerson}
            referenceLabel={`Parte de cada um: ${formatBRL(summary.perPerson)}`}
            ariaLabel="Valor pago por participante"
          />
        </div>
        <div className="flex flex-col gap-3">
          <div>
            <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Gastos por categoria</h4>
            <p className="text-[11px] text-slate-500">Total lançado em cada tipo de gasto.</p>
          </div>
          {categoryRows.length === 0 ? (
            <p className="text-xs text-slate-400">Nenhum gasto lançado.</p>
          ) : (
            <HBarChart rows={categoryRows} ariaLabel="Gastos por categoria" />
          )}
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-left text-[10px] uppercase tracking-wider text-slate-500 border-b border-slate-200">
              <th className="py-2 pr-3 font-bold">Participante</th>
              <th className="py-2 pr-3 font-bold text-right">Pagou</th>
              <th className="py-2 pr-3 font-bold text-right">Parte</th>
              <th className="py-2 font-bold text-right">Saldo</th>
            </tr>
          </thead>
          <tbody>
            {summary.perMember.map((m) => (
              <tr key={m.uid} className="border-b border-slate-100 last:border-0">
                <td className="py-2 pr-3 font-semibold text-slate-900">{m.name}{m.uid === currentUid ? ' (Você)' : ''}</td>
                <td className="py-2 pr-3 text-right text-slate-700">{formatBRL(m.paid)}</td>
                <td className="py-2 pr-3 text-right text-slate-700">{formatBRL(m.share)}</td>
                <td className="py-2 text-right">
                  <BalanceLabel balance={m.balance} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function StatTile({ label, value }) {
  return (
    <div className="p-3 bg-slate-50 border border-slate-100 rounded-2xl">
      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">{label}</span>
      <span className="text-lg font-black text-slate-950 mt-1 block">{value}</span>
    </div>
  );
}

function BalanceLabel({ balance }) {
  if (balance > 0.01) {
    return (
      <span className="inline-flex items-center gap-1 font-bold text-emerald-700">
        <TrendingUp className="w-3.5 h-3.5" /> recebe {formatBRL(balance)}
      </span>
    );
  }
  if (balance < -0.01) {
    return (
      <span className="inline-flex items-center gap-1 font-bold text-rose-700">
        <TrendingDown className="w-3.5 h-3.5" /> paga {formatBRL(Math.abs(balance))}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 font-bold text-slate-500">
      <Check className="w-3.5 h-3.5" /> quitado
    </span>
  );
}
