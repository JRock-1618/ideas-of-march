export function oddsToDecimal(odds) {
  const n = Number(odds);
  if (isNaN(n) || !n) return null;
  return n > 0 ? n / 100 + 1 : 100 / Math.abs(n) + 1;
}

export function decimalToAmerican(dec) {
  if (!dec || dec <= 1) return '—';
  return dec >= 2 ? '+' + Math.round((dec - 1) * 100) : '-' + Math.round(100 / (dec - 1));
}

export function parlayDecimal(legs) {
  return legs.reduce((acc, leg) => {
    const d = oddsToDecimal(leg.odds);
    return d ? acc * d : acc;
  }, 1);
}

export function calcPayout(wager, odds) {
  if (wager == null || !odds) return null;
  const d = oddsToDecimal(odds);
  return d ? Math.round(wager * d * 100) / 100 : null;
}

export function calcOutcome(wager, odds, result) {
  if (!result || wager == null) return null;
  if (result === 'push') return wager;
  if (result === 'loss') return 0;
  return calcPayout(wager, odds);
}

export function getBetOdds(bet) {
  if (bet.legs.length === 1) return bet.legs[0].odds;
  return decimalToAmerican(parlayDecimal(bet.legs));
}

export function fmt$(n) {
  if (n == null) return '—';
  if (n === 0) return '$0';
  return (n < 0 ? '-' : '') + '$' + Math.round(Math.abs(n)).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

export function calcStats(games) {
  const bets = games.flatMap(g => g.bets || []);
  const resolved = bets.filter(b => b.result);
  const wagered = bets.reduce((s, b) => s + (b.wager || 0), 0);
  const returned = resolved.reduce((s, b) => {
    return s + (calcOutcome(b.wager, getBetOdds(b), b.result) || 0);
  }, 0);
  return {
    wagered,
    returned,
    net: returned - wagered,
    wins: resolved.filter(b => b.result === 'win').length,
    losses: resolved.filter(b => b.result === 'loss').length,
    bets: bets.length,
    resolved: resolved.length,
    roi: wagered > 0 ? (returned - wagered) / wagered : 0,
  };
}
