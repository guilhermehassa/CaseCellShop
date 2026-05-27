import type { ProductDTO } from '@cc/contracts'
import { apiFetch } from './client.ts'

export async function getProducts(): Promise<ProductDTO[]> {
  const res = await apiFetch('/api/products')
  return res.json() as Promise<ProductDTO[]>
}

export async function getProduct(id: string): Promise<ProductDTO> {
  const res = await apiFetch(`/api/products/${id}`)
  return res.json() as Promise<ProductDTO>
}
