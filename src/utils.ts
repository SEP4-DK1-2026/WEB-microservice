export function range(start: number, stop: number, step: number = 1): number[] {
  const arr = [];
  for (let i: number = start; i < stop; i += step) arr.push(i);
  return arr;
}

export function nowUnixTimestamp(): number {
  return Math.floor(Date.now() / 1000);
}