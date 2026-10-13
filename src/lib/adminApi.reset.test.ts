import { describe, expect, it, vi } from 'vitest'
const boundary = vi.hoisted(() => ({ rpc: vi.fn(async () => ({ error: null as Error | null })) }))
vi.mock('./supabase/client', () => ({ hasSupabaseConfig: true, requireSupabase: () => ({ rpc: boundary.rpc, from: () => { throw new Error('Unexpected non-atomic table mutation') } }) }))
import { resetOperationalData } from './adminApi'
describe('operational reset', () => {
  it('uses a single transaction boundary and preserves the menu', async () => {
    await resetOperationalData()
    expect(boundary.rpc).toHaveBeenCalledWith('reset_rnl_operational_data')
  })
  it('rejects attempts to erase the protected menu', async () => {
    await expect(resetOperationalData({ clearMenuCatalog: true })).rejects.toThrow('Menu data is protected')
  })
  it('reports a database reset failure instead of claiming success', async () => {
    boundary.rpc.mockResolvedValueOnce({ error: new Error('Reset permission denied') })
    await expect(resetOperationalData()).rejects.toThrow('Reset permission denied')
  })
})
