type Page<T> = PromiseLike<{ data: T[] | null; error: unknown }>

/** The API returns at most 1000 rows per request, so long lists are read page by page. Null when any page fails. */
export async function fetchPaged<T>(page: (from: number, to: number) => Page<T>, size = 1000): Promise<T[] | null> {
  const all: T[] = []
  for (let from = 0; ; from += size) {
    const { data, error } = await page(from, from + size - 1)
    if (error || !data) return null
    all.push(...data)
    if (data.length < size) return all
  }
}
