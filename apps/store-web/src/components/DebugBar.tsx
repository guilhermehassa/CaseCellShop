interface Props {
  forceError: boolean
  onToggle: (v: boolean) => void
}

export default function DebugBar({ forceError, onToggle }: Props) {
  if (!import.meta.env.DEV) return null

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-gray-900 text-white px-4 py-2 flex items-center gap-3 text-sm z-50">
      <span className="font-mono text-yellow-400 font-bold">[DEV]</span>
      <label className="flex items-center gap-2 cursor-pointer select-none">
        <input
          type="checkbox"
          checked={forceError}
          onChange={(e) => onToggle(e.target.checked)}
          className="w-4 h-4 accent-yellow-400"
        />
        <span>Simular instabilidade da loja</span>
      </label>
      {forceError && (
        <span className="text-yellow-300 text-xs">
          (X-Debug-Force-Error: temporary ativo)
        </span>
      )}
    </div>
  )
}
