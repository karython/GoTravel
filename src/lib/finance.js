import { EXPENSE_CATEGORIES, DEFAULT_CATEGORY } from './categories.js';

export const formatBRL = (value) =>
  (value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

// Calcula o rateio igualitário entre os membros da viagem.
// memberIds: uids da viagem | profiles: perfis carregados | expenses: lançamentos
export function computeTripSummary(memberIds, profiles, expenses) {
  const memberCount = memberIds.length;
  const total = expenses.reduce((acc, e) => acc + e.value, 0);
  const perPerson = memberCount > 0 ? total / memberCount : 0;

  const paidMap = {};
  memberIds.forEach((id) => { paidMap[id] = 0; });
  expenses.forEach((exp) => { paidMap[exp.uid] = (paidMap[exp.uid] ?? 0) + exp.value; });

  const perMember = memberIds.map((id) => {
    const profile = profiles.find((m) => m.uid === id);
    const fallbackName = expenses.find((e) => e.uid === id)?.userName;
    const paid = paidMap[id] ?? 0;
    return {
      uid: id,
      name: profile?.name || fallbackName || 'Membro',
      paid,
      share: perPerson,
      balance: paid - perPerson,
    };
  });

  const debtors = [];
  const creditors = [];
  perMember.forEach((m) => {
    if (m.balance < -0.01) debtors.push({ ...m, amount: Math.abs(m.balance) });
    else if (m.balance > 0.01) creditors.push({ ...m, amount: m.balance });
  });

  const transfers = [];
  let di = 0;
  let ci = 0;
  while (di < debtors.length && ci < creditors.length) {
    const min = Math.min(debtors[di].amount, creditors[ci].amount);
    transfers.push({
      fromUid: debtors[di].uid,
      from: debtors[di].name,
      toUid: creditors[ci].uid,
      to: creditors[ci].name,
      amount: min,
    });
    debtors[di].amount -= min;
    creditors[ci].amount -= min;
    if (debtors[di].amount < 0.01) di++;
    if (creditors[ci].amount < 0.01) ci++;
  }

  const categoryTotals = {};
  expenses.forEach((exp) => {
    const key = exp.category || DEFAULT_CATEGORY;
    if (!categoryTotals[key]) categoryTotals[key] = { total: 0, count: 0 };
    categoryTotals[key].total += exp.value;
    categoryTotals[key].count += 1;
  });
  const byCategory = EXPENSE_CATEGORIES
    .filter((c) => categoryTotals[c.key])
    .map((c) => ({ category: c.key, label: c.label, ...categoryTotals[c.key] }))
    .sort((a, b) => b.total - a.total);

  return { total, perPerson, memberCount, expenseCount: expenses.length, perMember, transfers, byCategory };
}
