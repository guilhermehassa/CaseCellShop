import { useState, useEffect, useCallback } from 'react'
import type { ProductDTO } from '@cc/contracts'
import { getProducts } from '../api/products.ts'

export interface UseProductsResult {
  products: ProductDTO[]
  loading: boolean
  error: string | null
  refetch: () => void
}

export function useProducts(): UseProductsResult {
  const [products, setProducts] = useState<ProductDTO[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetch = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await getProducts()
      setProducts(data)
    } catch {
      setError('Não foi possível carregar os produtos. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void fetch()
  }, [fetch])

  return { products, loading, error, refetch: fetch }
}
