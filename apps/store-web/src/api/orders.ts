import type { CreateOrderRequest, CreateOrderAccepted, OrderStatusResponse } from '@cc/contracts'
import { apiFetch } from './client.ts'

export interface CreateOrderOpts {
  forceError?: boolean
}

export async function createOrder(
  payload: CreateOrderRequest,
  idempotencyKey: string,
  opts?: CreateOrderOpts
): Promise<{ status: number; data: CreateOrderAccepted }> {
  const headers: Record<string, string> = {
    'Idempotency-Key': idempotencyKey
  }
  if (opts?.forceError) {
    headers['X-Debug-Force-Error'] = 'temporary'
  }

  const res = await apiFetch('/api/orders', {
    method: 'POST',
    headers,
    body: JSON.stringify(payload)
  })

  const data = (await res.json()) as CreateOrderAccepted
  return { status: res.status, data }
}

export async function getOrder(id: string): Promise<OrderStatusResponse> {
  const res = await apiFetch(`/api/orders/${id}`)
  return res.json() as Promise<OrderStatusResponse>
}
