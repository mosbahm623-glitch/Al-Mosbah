/** Money is added up in cents so sums never show floating-point noise (0.1 + 0.2). */
export const toCents = (n: number) => Math.round(n * 100)

/** Sum of amounts, exact to the cent. */
export const sumMoney = (values: Iterable<number>) => {
  let c = 0
  for (const v of values) c += toCents(v)
  return c / 100
}

/** Sum of the given amounts, exact to the cent. */
export const addMoney = (...values: number[]) => sumMoney(values)

/** a − b, exact to the cent. */
export const subMoney = (a: number, b: number) => (toCents(a) - toCents(b)) / 100
