import type { OrderStatusResponse } from '@cc/contracts'

interface Props {
  orderStatus: OrderStatusResponse | null
  overrideMessage?: string
}

export default function OrderStatusBadge({ orderStatus, overrideMessage }: Props) {
  if (!orderStatus) return null

  const status = orderStatus.status

  const isPending =
    status === 'PENDING_PROCESSING' || status === 'PROCESSING' || status === 'RETRYING'
  const isConfirmed = status === 'CONFIRMED'
  const isFailed = status === 'FAILED' || status === 'EXPIRED' || status === 'CANCELED'

  const label = overrideMessage ?? orderStatus.message ?? status

  if (isPending) {
    return (
      <div className="flex items-center gap-2 rounded-lg bg-yellow-50 border border-yellow-200 px-4 py-3">
        <svg
          className="animate-spin h-5 w-5 text-yellow-500 shrink-0"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
          />
        </svg>
        <span className="text-yellow-800 text-sm font-medium">{label}</span>
      </div>
    )
  }

  if (isConfirmed) {
    return (
      <div className="flex items-center gap-2 rounded-lg bg-green-50 border border-green-200 px-4 py-3">
        <svg
          className="h-5 w-5 text-green-600 shrink-0"
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 20 20"
          fill="currentColor"
          aria-hidden="true"
        >
          <path
            fillRule="evenodd"
            d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
            clipRule="evenodd"
          />
        </svg>
        <span className="text-green-800 text-sm font-medium">Pedido confirmado!</span>
      </div>
    )
  }

  if (isFailed) {
    return (
      <div className="flex items-center gap-2 rounded-lg bg-red-50 border border-red-200 px-4 py-3">
        <svg
          className="h-5 w-5 text-red-600 shrink-0"
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 20 20"
          fill="currentColor"
          aria-hidden="true"
        >
          <path
            fillRule="evenodd"
            d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
            clipRule="evenodd"
          />
        </svg>
        <span className="text-red-800 text-sm font-medium">{label}</span>
      </div>
    )
  }

  return null
}
