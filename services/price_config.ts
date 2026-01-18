import { PRICING_TYPE_BY_KEY } from './price_engine';
import { decimalToNumber, roundTo2 } from '../utils/decimal';
import { PricingTypeKey } from './price_engine';

const timeRegex = /^([01]\d|2[0-3]):[0-5]\d$/;

export function normalizePriceConfig(typeKey: PricingTypeKey, payload: any, basePrice?: number) {
  const type = PRICING_TYPE_BY_KEY[typeKey];
  if (!type) throw new Error('Unknown pricing type key');

  const p = payload ?? {};

  switch (type) {
    case 'STATIC': {
      // base_price is authoritative; accept optional amount but ignore it
      const amount = p.amount !== undefined ? roundTo2(decimalToNumber(p.amount, 0)) : undefined;
      return { type, config: { amount } };
    }

    case 'TIERED': {
      if (!Array.isArray(p.tiers) || p.tiers.length === 0) throw new Error('TIERED pricing requires a non-empty "tiers" array');
      const tiers = p.tiers.map((t: any) => {
        if (typeof t.upto !== 'number' || typeof t.price === 'undefined') throw new Error('Each tier requires "upto" (number) and "price"');
        return { upto: Math.max(0, Math.floor(t.upto)), price: roundTo2(decimalToNumber(t.price, 0)) };
      });
      // ensure tiers are sorted
      tiers.sort((a: any, b: any) => a.upto - b.upto);
      return { type, config: { tiers } };
    }

    case 'COMPLIMENTARY': {
      return { type, config: {} };
    }

    case 'DISCOUNTED': {
      if (typeof p.base === 'undefined' || typeof p.val === 'undefined' || typeof p.is_perc === 'undefined') {
        throw new Error('DISCOUNTED pricing requires "base", "val" and "is_perc"');
      }
      const base = roundTo2(decimalToNumber(p.base, 0));
      const val = roundTo2(decimalToNumber(p.val, 0));
      const is_perc = !!p.is_perc;
      return { type, config: { base, val, is_perc } };
    }

    case 'DYNAMIC': {
      if (!Array.isArray(p.windows) || p.windows.length === 0) throw new Error('DYNAMIC pricing requires a non-empty "windows" array');
      const windows = p.windows.map((w: any) => {
        if (!w.start || !w.end || typeof w.price === 'undefined') throw new Error('Each window requires "start","end", and "price"');
        if (!timeRegex.test(w.start) || !timeRegex.test(w.end)) throw new Error('Window times must be in HH:mm');
        if (w.start >= w.end) throw new Error('Window start must be before end');
        return { start: w.start, end: w.end, price: roundTo2(decimalToNumber(w.price, 0)) };
      });
      return { type, config: { windows } };
    }

    default:
      throw new Error('Unsupported pricing type');
  }
}
