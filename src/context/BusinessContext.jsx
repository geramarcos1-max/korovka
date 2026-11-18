import { createContext, useContext, useState } from 'react'
import { setActiveBusiness, getActiveBusiness } from '../lib/supabase'

const BusinessContext = createContext(null)

export function BusinessProvider({ children }) {
  const [business, setBusiness] = useState(() => getActiveBusiness())

  function selectBusiness(biz) {
    setActiveBusiness(biz)
    localStorage.setItem('activeBusiness', biz)
    setBusiness(biz)
  }

  return (
    <BusinessContext.Provider value={{ business, selectBusiness }}>
      {children}
    </BusinessContext.Provider>
  )
}

export const useBusiness = () => useContext(BusinessContext)
