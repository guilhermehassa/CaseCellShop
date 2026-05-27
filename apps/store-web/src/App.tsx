import React, { useState } from 'react'
import StorePage from './pages/StorePage.tsx'
import DebugBar from './components/DebugBar.tsx'

export interface AppContext {
  forceError: boolean
}

export const AppCtx = React.createContext<AppContext>({ forceError: false })

export default function App() {
  const [forceError, setForceError] = useState(false)

  return (
    <AppCtx.Provider value={{ forceError }}>
      <div className="min-h-screen bg-gray-50">
        <header className="bg-white border-b border-gray-200 shadow-sm">
          <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">CaseCellShop</h1>
              <p className="text-sm text-gray-500">Capinhas para celular</p>
            </div>
          </div>
        </header>

        <main className="max-w-6xl mx-auto px-4 py-8">
          <StorePage />
        </main>

        <DebugBar forceError={forceError} onToggle={setForceError} />
      </div>
    </AppCtx.Provider>
  )
}
