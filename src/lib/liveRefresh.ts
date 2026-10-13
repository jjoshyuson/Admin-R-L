/** Coalesce change notifications while ensuring a later fetch observes changes during an earlier fetch. */
export function createLiveRefresh(load: () => Promise<void>) {
  let disposed = false
  let pending = false
  let inFlight: Promise<void> | null = null
  return {
    request(): Promise<void> {
      if (disposed) return Promise.resolve()
      pending = true
      if (inFlight) return inFlight
      inFlight = (async () => {
        while (pending && !disposed) {
          pending = false
          await load()
        }
      })().finally(() => { inFlight = null })
      return inFlight
    },
    dispose() { disposed = true; pending = false },
  }
}
