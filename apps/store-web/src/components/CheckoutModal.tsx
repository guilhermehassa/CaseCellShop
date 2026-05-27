import { useState, useEffect, useContext } from 'react'
import type { ProductDTO } from '@cc/contracts'
import { AppCtx } from '../App.tsx'
import type { UseCheckoutResult } from '../hooks/useCheckout.ts'
import OrderStatusBadge from './OrderStatusBadge.tsx'

interface Props {
  product: ProductDTO
  initialQuantity: number
  checkout: UseCheckoutResult
  onClose: () => void
}

export default function CheckoutModal({ product, initialQuantity, checkout, onClose }: Props) {
  const { forceError } = useContext(AppCtx)

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [quantity, setQuantity] = useState(initialQuantity)

  const { state, checkoutError, orderStatus } = checkout

  const isBusy = state === 'submitting' || state === 'polling'
  const isSuccess = state === 'success'
  const isError = state === 'error'

  const is503 =
    isError && checkoutError?.errorCode === 'TEMPORARY_PROCESSING_ERROR'
  const isKeyReused =
    isError && checkoutError?.errorCode === 'IDEMPOTENCY_KEY_REUSED'

  // Field-level validation errors from backend
  const fieldErrors: Record<string, string> = {}
  if (checkoutError?.fieldErrors) {
    for (const fe of checkoutError.fieldErrors) {
      fieldErrors[fe.field] = fe.message
    }
  }

  // Reset form if product changes
  useEffect(() => {
    setQuantity(initialQuantity)
  }, [initialQuantity])

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (isBusy) return
    void checkout.submit({ name, email, quantity }, forceError)
  }

  function handleRetry() {
    void checkout.retry({ name, email, quantity }, forceError)
  }

  function handleClose() {
    checkout.reset()
    onClose()
  }

  const priceFmt = (product.priceCents / 100).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  })
  const totalFmt = ((product.priceCents * quantity) / 100).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  })

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 px-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
    >
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
        {/* Header */}
        <div className="flex items-start justify-between p-5 border-b border-gray-100">
          <div>
            <h2 id="modal-title" className="text-lg font-semibold text-gray-900">
              Finalizar compra
            </h2>
            <p className="text-sm text-gray-500 mt-0.5">{product.name}</p>
          </div>
          <button
            onClick={handleClose}
            disabled={isBusy}
            className="text-gray-400 hover:text-gray-600 disabled:opacity-40 transition-colors p-1 -mr-1"
            aria-label="Fechar"
          >
            <svg className="w-5 h-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
              <path
                fillRule="evenodd"
                d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                clipRule="evenodd"
              />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4">
          {/* Product summary */}
          <div className="flex items-center gap-3 rounded-lg bg-gray-50 p-3">
            <img
              src={product.imageUrl}
              alt={product.name}
              className="w-14 h-14 rounded-lg object-cover shrink-0"
              onError={(e) => {
                ;(e.target as HTMLImageElement).src =
                  'https://picsum.photos/seed/fallback/600/600'
              }}
            />
            <div className="min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">{product.name}</p>
              <p className="text-sm text-gray-500">{priceFmt} / unidade</p>
            </div>
          </div>

          {/* Status badge while polling or success */}
          {(state === 'polling' || state === 'success') && orderStatus && (
            <OrderStatusBadge orderStatus={orderStatus} />
          )}
          {state === 'success' && !orderStatus && (
            <div className="flex items-center gap-2 rounded-lg bg-green-50 border border-green-200 px-4 py-3">
              <span className="text-green-800 text-sm font-medium">Pedido confirmado!</span>
            </div>
          )}

          {/* Error message */}
          {isError && checkoutError && (
            <div
              className="rounded-lg bg-red-50 border border-red-200 px-4 py-3"
              role="alert"
            >
              <p className="text-red-800 text-sm font-medium">{checkoutError.message}</p>
            </div>
          )}

          {/* Form — hide after confirmed */}
          {!isSuccess && (
            <form onSubmit={handleSubmit} noValidate className="space-y-3">
              {/* Name */}
              <div>
                <label
                  htmlFor="checkout-name"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Nome
                </label>
                <input
                  id="checkout-name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  disabled={isBusy}
                  required
                  placeholder="Seu nome completo"
                  className={`w-full rounded-lg border px-3 py-2 text-sm outline-none transition focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-400 ${
                    fieldErrors['customer.name'] || fieldErrors['name']
                      ? 'border-red-400 bg-red-50'
                      : 'border-gray-300'
                  }`}
                />
                {(fieldErrors['customer.name'] ?? fieldErrors['name']) && (
                  <p className="mt-1 text-xs text-red-600">
                    {fieldErrors['customer.name'] ?? fieldErrors['name']}
                  </p>
                )}
              </div>

              {/* Email */}
              <div>
                <label
                  htmlFor="checkout-email"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  E-mail
                </label>
                <input
                  id="checkout-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={isBusy}
                  required
                  placeholder="seu@email.com"
                  className={`w-full rounded-lg border px-3 py-2 text-sm outline-none transition focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-400 ${
                    fieldErrors['customer.email'] || fieldErrors['email']
                      ? 'border-red-400 bg-red-50'
                      : 'border-gray-300'
                  }`}
                />
                {(fieldErrors['customer.email'] ?? fieldErrors['email']) && (
                  <p className="mt-1 text-xs text-red-600">
                    {fieldErrors['customer.email'] ?? fieldErrors['email']}
                  </p>
                )}
              </div>

              {/* Quantity */}
              <div>
                <label
                  htmlFor="checkout-quantity"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Quantidade
                </label>
                <input
                  id="checkout-quantity"
                  type="number"
                  min={1}
                  max={product.availableQuantity}
                  value={quantity}
                  onChange={(e) => setQuantity(Number(e.target.value))}
                  disabled={isBusy}
                  required
                  className={`w-full rounded-lg border px-3 py-2 text-sm outline-none transition focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-400 ${
                    fieldErrors['quantity']
                      ? 'border-red-400 bg-red-50'
                      : 'border-gray-300'
                  }`}
                />
                {fieldErrors['quantity'] && (
                  <p className="mt-1 text-xs text-red-600">{fieldErrors['quantity']}</p>
                )}
              </div>

              {/* Total */}
              <div className="flex items-center justify-between rounded-lg bg-blue-50 px-3 py-2">
                <span className="text-sm text-gray-600">Total</span>
                <span className="text-sm font-semibold text-blue-700">{totalFmt}</span>
              </div>

              {/* Action buttons */}
              <div className="flex gap-2 pt-1">
                {/* 503 retry button — reuses same key */}
                {is503 && (
                  <button
                    type="button"
                    onClick={handleRetry}
                    className="flex-1 rounded-lg bg-yellow-500 hover:bg-yellow-600 text-white font-medium py-2.5 text-sm transition"
                  >
                    Tentar novamente
                  </button>
                )}

                {/* Primary submit */}
                {!is503 && !isKeyReused && (
                  <button
                    type="submit"
                    disabled={isBusy}
                    className="flex-1 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white font-medium py-2.5 text-sm transition flex items-center justify-center gap-2"
                  >
                    {isBusy && (
                      <svg
                        className="animate-spin h-4 w-4 text-white"
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
                    )}
                    {isBusy ? 'Processando...' : 'Confirmar compra'}
                  </button>
                )}

                {/* Cancel / close */}
                {!isBusy && (
                  <button
                    type="button"
                    onClick={handleClose}
                    className="rounded-lg border border-gray-300 hover:bg-gray-50 text-gray-700 font-medium py-2.5 px-4 text-sm transition"
                  >
                    Cancelar
                  </button>
                )}
              </div>
            </form>
          )}

          {/* Success actions */}
          {isSuccess && (
            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={handleClose}
                className="flex-1 rounded-lg bg-green-600 hover:bg-green-700 text-white font-medium py-2.5 text-sm transition"
              >
                Fechar
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
