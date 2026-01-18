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
      const tiers = p.tiers.map((t: any, idx: number) => {
        // allow `upto` to be a non-negative integer or null (null means unbounded final tier)
        const uptoRaw = t.upto;
        let upto: number | null;
        if (uptoRaw === null || uptoRaw === undefined) {
          upto = null;
        } else if (typeof uptoRaw === 'number' && Number.isFinite(uptoRaw)) {
          if (uptoRaw < 0) throw new Error('Tier "upto" must be >= 0 or null');
          upto = Math.floor(uptoRaw);
        } else {
          throw new Error('Each tier requires "upto" (non-negative integer or null) and "price"');
        }
        if (typeof t.price === 'undefined') throw new Error('Each tier requires "price"');
        const price = roundTo2(decimalToNumber(t.price, 0));
        if (price < 0) throw new Error('Tier "price" must be >= 0');
        return { upto, price };
      });

      // sort tiers: numeric upto ascending; null (unbounded) goes last
      tiers.sort((a: any, b: any) => {
        if (a.upto === null && b.upto === null) return 0;
        if (a.upto === null) return 1;
        if (b.upto === null) return -1;
        return a.upto - b.upto;
      });

      // validate monotonicity and no overlap: each numeric upto must be strictly greater than previous numeric upto
      for (let i = 1; i < tiers.length; i++) {
        const prev = tiers[i - 1];
        const cur = tiers[i];
        if (prev.upto === null) throw new Error('Invalid tiers: unbounded (null) tier must be the final tier');
        if (cur.upto !== null && cur.upto <= prev.upto) throw new Error('Invalid tiers: "upto" values must be strictly increasing and non-overlapping');
      }

      return { type, config: { tiers } };
    }

    case 'COMPLIMENTARY': {
      return { type, config: {} };
    }

    case 'DISCOUNTED': {
      // STRICT rule: payload must include only `val` and `is_perc`. `base` is NOT allowed here.
      if (typeof p.val === 'undefined' || typeof p.is_perc === 'undefined') {
        throw new Error('DISCOUNTED pricing requires "val" and "is_perc"');
      }
      if (typeof p.base !== 'undefined') {
        throw new Error('DISCOUNTED payload must not include "base"; set base_price on the item instead');
      }

      const val = roundTo2(decimalToNumber(p.val, 0));
      const is_perc = !!p.is_perc;

      if (val < 0) throw new Error('DISCOUNTED "val" must be >= 0');
      if (is_perc && val > 100) throw new Error('DISCOUNTED percentage "val" must be between 0 and 100');

      return { type, config: { val, is_perc } };
    }

    case 'DYNAMIC': {
      if (!Array.isArray(p.windows) || p.windows.length === 0) throw new Error('DYNAMIC pricing requires a non-empty "windows" array');
      const toMinutes = (s: string) => {
        const [hh, mm] = s.split(':').map((n: string) => parseInt(n, 10));
        return hh * 60 + mm;
      };

      const windows = p.windows.map((w: any) => {
        if (!w.start || !w.end || typeof w.price === 'undefined') throw new Error('Each window requires "start","end", and "price"');
        if (!timeRegex.test(w.start) || !timeRegex.test(w.end)) throw new Error('Window times must be in HH:mm');
        if (w.start >= w.end) throw new Error('Window start must be before end');
        const price = roundTo2(decimalToNumber(w.price, 0));
        if (price < 0) throw new Error('Window "price" must be >= 0');
        return { start: w.start, end: w.end, startMin: toMinutes(w.start), endMin: toMinutes(w.end), price };
      });

      // sort by start and make sure windows don't overlap (adjacent allowed)
      windows.sort((a: any, b: any) => a.startMin - b.startMin);
      for (let i = 1; i < windows.length; i++) {
        if (windows[i].startMin < windows[i - 1].endMin) throw new Error('DYNAMIC pricing windows must not overlap');
      }

      const clean = windows.map((w: any) => ({ start: w.start, end: w.end, price: w.price }));
      return { type, config: { windows: clean } };
    }

    default:
      throw new Error('Unsupported pricing type');
  }
}



// Example payloads for price_config()

// STATIC (type 'A') means only base_price matters 
//
// TIERED (type 'B')
//   Payload shape: { tiers: [{ "upto": number, "price": number }, ...] }
//   Example: { tiers: [{ "upto": 1, "price": 300 }, { "upto": 2, "price": 500 }] }
//
// COMPLIMENTARY (type 'C')
//   Payload shape: {} (no fields required)
//   Example: {}
//
// DISCOUNTED (type 'D')
//   Payload shape: { "val": number, "is_perc": boolean }
//   Example: { "val": 10, "is_perc": true }
//
// DYNAMIC (type 'E')
//   Payload shape: { "windows": [{ "start": "HH:mm", "end": "HH:mm", "price": number }, ...] }
//   Example: { "windows": [{ "start": "08:00", "end": "11:00", "price": 199 }] }
