import { useState, useRef, useCallback } from 'react'
import type { ProductDTO, ApiErrorBody, OrderStatusResponse } from '@cc/contracts'
import { createOrder } from '../api/orders.ts'
import { getOrder } from '../api/orders.ts'

export type CheckoutState = 'idle' | 'submitting' | 'polling' | 'success' | 'error'

export interface FieldError {
  field: string
  message: string
}

export interface CheckoutError {
  errorCode: string
  message: string
  fieldErrors?: FieldError[]
  availableQuantity?: number
}

export interface CheckoutForm {
  name: string
  email: string
  quantity: number
}

export interface UseCheckoutResult {
  state: CheckoutState
  selectedProduct: ProductDTO | null
  idempotencyKey: string | null
  orderStatus: OrderStatusResponse | null
  checkoutError: CheckoutError | null
  open: (product: ProductDTO) => void
  submit: (form: CheckoutForm, forceError?: boolean) => Promise<void>
  retry: (form: CheckoutForm, forceError?: boolean) => Promise<void>
  reset: () => void
}

const POLL_INTERVAL_MS = 1500
const POLL_TIMEOUT_MS = 30000

export function useCheckout(): UseCheckoutResult {
  const [state, setState] = useState<CheckoutState>('idle')
  const [selectedProduct, setSelectedProduct] = useState<ProductDTO | null>(null)
  const [idempotencyKey, setIdempotencyKey] = useState<string | null>(null)
  const [orderStatus, setOrderStatus] = useState<OrderStatusResponse | null>(null)
  const [checkoutError, setCheckoutError] = useState<CheckoutError | null>(null)

  const pollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pollStartRef = useRef<number>(0)

  const stopPolling = useCallback(() => {
    if (pollTimerRef.current !== null) {
      clearTimeout(pollTimerRef.current)
      pollTimerRef.current = null
    }
  }, [])

  const startPolling = useCallback(
    (orderId: string) => {
      pollStartRef.current = Date.now()
      stopPolling()

      const poll = async () => {
        if (Date.now() - pollStartRef.current > POLL_TIMEOUT_MS) {
          setState('error')
          setCheckoutError({
            errorCode: 'POLL_TIMEOUT',
            message: 'Tempo esgotado aguardando confirmação do pedido. Verifique seu e-mail.'
          })
          return
        }

        try {
          const status = await getOrder(orderId)
          setOrderStatus(status)

          if (
            status.status === 'CONFIRMED'
          ) {
            setState('success')
            return
          }

          if (
            status.status === 'FAILED' ||
            status.status === 'EXPIRED' ||
            status.status === 'CANCELED'
          ) {
            setState('error')
            setCheckoutError({
              errorCode: status.status,
              message: 'Não foi possível concluir o pedido. Nenhuma cobrança foi feita.'
            })
            return
          }

          // Still in progress — schedule next poll
          pollTimerRef.current = setTimeout(() => {
            void poll()
          }, POLL_INTERVAL_MS)
        } catch {
          // Network error during polling — try again
          pollTimerRef.current = setTimeout(() => {
            void poll()
          }, POLL_INTERVAL_MS)
        }
      }

      pollTimerRef.current = setTimeout(() => {
        void poll()
      }, POLL_INTERVAL_MS)
    },
    [stopPolling]
  )

  const open = useCallback((product: ProductDTO) => {
    setSelectedProduct(product)
    setIdempotencyKey(crypto.randomUUID())
    setState('idle')
    setOrderStatus(null)
    setCheckoutError(null)
  }, [])

  const submit = useCallback(
    async (form: CheckoutForm, forceError = false) => {
      if (!selectedProduct || !idempotencyKey) return

      setState('submitting')
      setCheckoutError(null)

      try {
        const result = await createOrder(
          {
            productId: selectedProduct.id,
            quantity: form.quantity,
            customer: { name: form.name, email: form.email }
          },
          idempotencyKey,
          { forceError }
        )

        setState('polling')
        startPolling(result.data.orderId)
      } catch (err) {
        const apiErr = err as ApiErrorBody
        setState('error')

        switch (apiErr.errorCode) {
          case 'VALIDATION_ERROR':
            setCheckoutError({
              errorCode: apiErr.errorCode,
              message: 'Verifique os dados.',
              fieldErrors: apiErr.details ?? []
            })
            break
          case 'PRODUCT_NOT_FOUND':
            setCheckoutError({
              errorCode: apiErr.errorCode,
              message: 'Produto indisponível.'
            })
            break
          case 'INSUFFICIENT_STOCK':
            setCheckoutError({
              errorCode: apiErr.errorCode,
              message: `Estoque insuficiente. Disponível: ${apiErr.availableQuantity ?? 0}`,
              availableQuantity: apiErr.availableQuantity
            })
            break
          case 'IDEMPOTENCY_KEY_REUSED':
            setCheckoutError({
              errorCode: apiErr.errorCode,
              message: 'Não foi possível repetir esta operação. Inicie uma nova compra.'
            })
            // Generate a new key for next attempt
            setIdempotencyKey(crypto.randomUUID())
            break
          case 'TEMPORARY_PROCESSING_ERROR':
            setCheckoutError({
              errorCode: apiErr.errorCode,
              message: 'Instabilidade temporária. Tente novamente.'
            })
            break
          default:
            setCheckoutError({
              errorCode: apiErr.errorCode ?? 'UNKNOWN',
              message: apiErr.message ?? 'Erro inesperado.'
            })
        }
      }
    },
    [selectedProduct, idempotencyKey, startPolling]
  )

  // retry reuses the SAME idempotency key (only for 503)
  const retry = useCallback(
    async (form: CheckoutForm, forceError = false) => {
      await submit(form, forceError)
    },
    [submit]
  )

  const reset = useCallback(() => {
    stopPolling()
    setState('idle')
    setSelectedProduct(null)
    setIdempotencyKey(null)
    setOrderStatus(null)
    setCheckoutError(null)
  }, [stopPolling])

  return {
    state,
    selectedProduct,
    idempotencyKey,
    orderStatus,
    checkoutError,
    open,
    submit,
    retry,
    reset
  }
}
