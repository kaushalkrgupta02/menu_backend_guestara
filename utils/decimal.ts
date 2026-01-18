export const decimalToNumber = (v: any, fallback = 0): number => {
  if (v === null || v === undefined) return fallback;
  if (typeof v === 'object' && typeof v.toNumber === 'function') {
    try { return v.toNumber(); } catch (e) { return Number(v.toString()); }
  }
  const n = Number(v);
  return Number.isNaN(n) ? fallback : n;
};

export const roundTo2 = (n: number): number => {
  return Math.round((n + Number.EPSILON) * 100) / 100;
};
