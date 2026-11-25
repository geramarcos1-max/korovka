import { createClient } from '@supabase/supabase-js'

const _client = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
)

// Child tables / shared tables that don't have a negocio column
const NO_FILTER = new Set([
  'profiles',
  'venta_items',
  'odc_interna_items',
  'pv_entrega_items',
  'pv_devolucion_items',
  'consignacion_entregas',
  'consignacion_entrega_items',
  'consignacion_liquidaciones',
  'consignacion_liquidacion_items',
  'costos_lote_items',
])

let _biz = localStorage.getItem('activeBusiness') || 'korovka'

export function setActiveBusiness(biz) { _biz = biz }
export function getActiveBusiness() { return _biz }

// Proxy that auto-injects negocio filter on SELECT and negocio field on INSERT
// for all business-specific tables. No changes required in page files.
export const supabase = new Proxy(_client, {
  get(target, prop) {
    if (prop !== 'from') {
      const val = Reflect.get(target, prop)
      return typeof val === 'function' ? val.bind(target) : val
    }
    return (table) => {
      const qb = target.from(table)
      if (NO_FILTER.has(table)) return qb

      return new Proxy(qb, {
        get(t, p) {
          if (p === 'select') {
            return (...args) => t.select(...args).eq('negocio', _biz)
          }
          if (p === 'insert') {
            return (values, opts) => {
              const stamp = (v) => ({ negocio: _biz, ...v })
              const stamped = Array.isArray(values) ? values.map(stamp) : stamp(values)
              return t.insert(stamped, opts)
            }
          }
          const val = Reflect.get(t, p)
          return typeof val === 'function' ? val.bind(t) : val
        }
      })
    }
  }
})
