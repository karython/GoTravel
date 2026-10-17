// Categorias de despesa. Lançamentos antigos sem categoria caem em 'outros'.
export const EXPENSE_CATEGORIES = [
  { key: 'hospedagem', label: 'Hospedagem', badge: 'bg-violet-100 text-violet-800' },
  { key: 'alimentacao', label: 'Alimentação', badge: 'bg-amber-100 text-amber-800' },
  { key: 'transporte', label: 'Transporte', badge: 'bg-sky-100 text-sky-800' },
  { key: 'passeios', label: 'Passeios', badge: 'bg-emerald-100 text-emerald-800' },
  { key: 'compras', label: 'Compras', badge: 'bg-pink-100 text-pink-800' },
  { key: 'outros', label: 'Outros', badge: 'bg-slate-100 text-slate-700' },
];

export const DEFAULT_CATEGORY = 'outros';

export const getCategory = (key) =>
  EXPENSE_CATEGORIES.find((c) => c.key === key) || EXPENSE_CATEGORIES.find((c) => c.key === DEFAULT_CATEGORY);
