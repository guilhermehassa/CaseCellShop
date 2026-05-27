import { render, screen, waitFor, fireEvent, act } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import type { ProductDTO, CreateOrderAccepted, OrderStatusResponse, ApiErrorBody } from '@cc/contracts'
import StorePage from '../pages/StorePage.tsx'
import { AppCtx } from '../App.tsx'

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('../api/products.ts', () => ({
  getProducts: vi.fn(),
  getProduct: vi.fn()
}))

vi.mock('../api/orders.ts', () => ({
  createOrder: vi.fn(),
  getOrder: vi.fn()
}))

import { getProducts } from '../api/products.ts'
import { createOrder, getOrder } from '../api/orders.ts'

const mockGetProducts = vi.mocked(getProducts)
const mockCreateOrder = vi.mocked(createOrder)
const mockGetOrder = vi.mocked(getOrder)

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const PRODUCT_A: ProductDTO = {
  id: 'prod-a',
  name: 'Capinha iPhone 14',
  description: 'Capinha resistente para iPhone 14',
  priceCents: 4990,
  imageUrl: 'https://picsum.photos/seed/prod-a/600/600',
  availableQuantity: 5
}

const PRODUCT_OUT_OF_STOCK: ProductDTO = {
  id: 'prod-oos',
  name: 'Capinha Moto G84',
  description: 'Capinha para Moto G84',
  priceCents: 2990,
  imageUrl: 'https://picsum.photos/seed/prod-oos/600/600',
  availableQuantity: 0
}

const ORDER_ACCEPTED: CreateOrderAccepted = {
  orderId: 'order-123',
  status: 'PENDING_PROCESSING',
  message: 'Pedido recebido!',
  requestId: 'req-1'
}

const ORDER_CONFIRMED: OrderStatusResponse = {
  orderId: 'order-123',
  status: 'CONFIRMED',
  productId: 'prod-a',
  quantity: 1,
  totalCents: 4990,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  message: 'Pedido confirmado!',
  requestId: 'req-1'
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function renderStorePage(forceError = false) {
  return render(
    <AppCtx.Provider value={{ forceError }}>
      <StorePage />
    </AppCtx.Provider>
  )
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('StorePage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('renders product list from mocked getProducts', async () => {
    mockGetProducts.mockResolvedValue([PRODUCT_A, PRODUCT_OUT_OF_STOCK])
    renderStorePage()

    await waitFor(() => {
      expect(screen.getByText('Capinha iPhone 14')).toBeInTheDocument()
    })
    expect(screen.getByText('Capinha Moto G84')).toBeInTheDocument()
  })

  it('shows loading skeletons while fetching', () => {
    // Never resolves during this test
    mockGetProducts.mockReturnValue(new Promise(() => {}))
    renderStorePage()
    const skeletons = document.querySelectorAll('.animate-pulse')
    expect(skeletons.length).toBeGreaterThan(0)
  })

  it('shows error message when getProducts fails', async () => {
    mockGetProducts.mockRejectedValue(new Error('Network error'))
    renderStorePage()

    await waitFor(() => {
      expect(
        screen.getByText(/Não foi possível carregar os produtos/i)
      ).toBeInTheDocument()
    })
    expect(screen.getByText('Tentar novamente')).toBeInTheDocument()
  })

  it('disables buy button for out-of-stock products', async () => {
    mockGetProducts.mockResolvedValue([PRODUCT_OUT_OF_STOCK])
    renderStorePage()

    await waitFor(() => {
      expect(screen.getByText('Capinha Moto G84')).toBeInTheDocument()
    })

    const button = screen.getByRole('button', { name: /Esgotado/i })
    expect(button).toBeDisabled()
  })

  it('opens checkout modal when buy is clicked', async () => {
    mockGetProducts.mockResolvedValue([PRODUCT_A])
    renderStorePage()

    await waitFor(() => {
      expect(screen.getByText('Capinha iPhone 14')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: /Comprar Capinha iPhone 14/i }))

    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByText('Finalizar compra')).toBeInTheDocument()
  })

  it('submit button is disabled while submitting (prevents double-click)', async () => {
    mockGetProducts.mockResolvedValue([PRODUCT_A])
    // createOrder never resolves — keeps state in submitting
    mockCreateOrder.mockReturnValue(new Promise(() => {}))

    renderStorePage()

    await waitFor(() => {
      expect(screen.getByText('Capinha iPhone 14')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: /Comprar Capinha iPhone 14/i }))

    const dialog = screen.getByRole('dialog')
    fireEvent.change(dialog.querySelector('#checkout-name')!, { target: { value: 'João' } })
    fireEvent.change(dialog.querySelector('#checkout-email')!, {
      target: { value: 'joao@email.com' }
    })

    fireEvent.submit(dialog.querySelector('form')!)

    await waitFor(() => {
      expect(screen.getByText('Processando...')).toBeInTheDocument()
    })

    const submitBtn = screen.getByRole('button', { name: /Processando/i })
    expect(submitBtn).toBeDisabled()

    // Clicking the disabled button should not call createOrder a second time
    fireEvent.click(submitBtn)
    expect(mockCreateOrder).toHaveBeenCalledTimes(1)
  })

  it('shows success message after 202 + CONFIRMED polling', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })

    mockGetProducts.mockResolvedValue([PRODUCT_A])
    mockCreateOrder.mockResolvedValue({ status: 202, data: ORDER_ACCEPTED })
    mockGetOrder.mockResolvedValue(ORDER_CONFIRMED)

    renderStorePage()

    await waitFor(() => {
      expect(screen.getByText('Capinha iPhone 14')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: /Comprar Capinha iPhone 14/i }))

    const dialog = screen.getByRole('dialog')
    fireEvent.change(dialog.querySelector('#checkout-name')!, { target: { value: 'Maria' } })
    fireEvent.change(dialog.querySelector('#checkout-email')!, {
      target: { value: 'maria@email.com' }
    })

    fireEvent.submit(dialog.querySelector('form')!)

    await act(async () => {
      vi.advanceTimersByTime(2000)
      await Promise.resolve()
    })

    await waitFor(
      () => {
        expect(screen.getByText('Pedido confirmado!')).toBeInTheDocument()
      },
      { timeout: 10000 }
    )
  }, 15000)

  it('shows INSUFFICIENT_STOCK message on 409', async () => {
    mockGetProducts.mockResolvedValue([PRODUCT_A])

    const stockError: ApiErrorBody = {
      errorCode: 'INSUFFICIENT_STOCK',
      message: 'Estoque insuficiente.',
      availableQuantity: 2,
      requestId: 'req-409'
    }
    mockCreateOrder.mockRejectedValue(stockError)

    renderStorePage()

    await waitFor(() => {
      expect(screen.getByText('Capinha iPhone 14')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: /Comprar Capinha iPhone 14/i }))

    const dialog = screen.getByRole('dialog')
    fireEvent.change(dialog.querySelector('#checkout-name')!, { target: { value: 'Pedro' } })
    fireEvent.change(dialog.querySelector('#checkout-email')!, {
      target: { value: 'pedro@email.com' }
    })

    fireEvent.submit(dialog.querySelector('form')!)

    await waitFor(() => {
      expect(screen.getByText(/Estoque insuficiente\. Disponível: 2/i)).toBeInTheDocument()
    })
  })

  it('shows validation error with field highlighting on 400', async () => {
    mockGetProducts.mockResolvedValue([PRODUCT_A])

    const validationError: ApiErrorBody = {
      errorCode: 'VALIDATION_ERROR',
      message: 'Verifique os dados.',
      details: [{ field: 'customer.email', message: 'E-mail inválido' }],
      requestId: 'req-400'
    }
    mockCreateOrder.mockRejectedValue(validationError)

    renderStorePage()

    await waitFor(() => {
      expect(screen.getByText('Capinha iPhone 14')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: /Comprar Capinha iPhone 14/i }))

    const dialog = screen.getByRole('dialog')
    fireEvent.change(dialog.querySelector('#checkout-name')!, { target: { value: 'Ana' } })
    fireEvent.change(dialog.querySelector('#checkout-email')!, { target: { value: 'invalid' } })

    fireEvent.submit(dialog.querySelector('form')!)

    await waitFor(() => {
      expect(screen.getByText('E-mail inválido')).toBeInTheDocument()
      expect(screen.getByText('Verifique os dados.')).toBeInTheDocument()
    })
  })

  it('shows temporary error with retry button on 503 and reuses the same key', async () => {
    mockGetProducts.mockResolvedValue([PRODUCT_A])

    const tempError: ApiErrorBody = {
      errorCode: 'TEMPORARY_PROCESSING_ERROR',
      message: 'Instabilidade temporária. Tente novamente.',
      requestId: 'req-503'
    }
    mockCreateOrder.mockRejectedValue(tempError)

    renderStorePage()

    await waitFor(() => {
      expect(screen.getByText('Capinha iPhone 14')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: /Comprar Capinha iPhone 14/i }))

    const dialog = screen.getByRole('dialog')
    fireEvent.change(dialog.querySelector('#checkout-name')!, { target: { value: 'Carlos' } })
    fireEvent.change(dialog.querySelector('#checkout-email')!, {
      target: { value: 'carlos@email.com' }
    })

    fireEvent.submit(dialog.querySelector('form')!)

    await waitFor(() => {
      expect(screen.getByText(/Instabilidade temporária/i)).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /Tentar novamente/i })).toBeInTheDocument()
    })

    // Capture the key used in the first call
    const firstCallKey = mockCreateOrder.mock.calls[0]?.[1]

    // Retry — same idempotency key must be reused
    fireEvent.click(screen.getByRole('button', { name: /Tentar novamente/i }))

    await waitFor(() => {
      expect(mockCreateOrder).toHaveBeenCalledTimes(2)
    })

    const secondCallKey = mockCreateOrder.mock.calls[1]?.[1]
    expect(secondCallKey).toBe(firstCallKey)
  })
})
