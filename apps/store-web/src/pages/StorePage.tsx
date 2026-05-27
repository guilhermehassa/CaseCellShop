import { useState } from 'react'
import type { ProductDTO } from '@cc/contracts'
import { useProducts } from '../hooks/useProducts.ts'
import { useCheckout } from '../hooks/useCheckout.ts'
import ProductCard from '../components/ProductCard.tsx'
import CheckoutModal from '../components/CheckoutModal.tsx'

function ProductSkeleton() {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden animate-pulse">
      <div className="aspect-square bg-gray-200" />
      <div className="p-4 space-y-3">
        <div className="h-4 bg-gray-200 rounded w-3/4" />
        <div className="h-3 bg-gray-200 rounded w-full" />
        <div className="h-3 bg-gray-200 rounded w-2/3" />
        <div className="flex justify-between items-center pt-1">
          <div className="h-6 bg-gray-200 rounded w-20" />
          <div className="h-5 bg-gray-200 rounded w-24" />
        </div>
        <div className="h-10 bg-gray-200 rounded-xl mt-2" />
      </div>
    </div>
  )
}

export default function StorePage() {
  const { products, loading, error, refetch } = useProducts()
  const checkout = useCheckout()
  const [modalOpen, setModalOpen] = useState(false)
  const [selectedQty, setSelectedQty] = useState(1)

  function handleBuy(product: ProductDTO, quantity: number) {
    checkout.open(product)
    setSelectedQty(quantity)
    setModalOpen(true)
  }

  function handleClose() {
    setModalOpen(false)
    checkout.reset()
  }

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-gray-800">Nossos produtos</h2>
        <p className="text-sm text-gray-500 mt-1">
          Escolha a capinha ideal para o seu celular
        </p>
      </div>

      {/* Error state */}
      {error && !loading && (
        <div className="flex flex-col items-center justify-center py-16 gap-4">
          <div className="text-center">
            <p className="text-gray-700 font-medium">{error}</p>
          </div>
          <button
            onClick={refetch}
            className="rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium px-6 py-2.5 text-sm transition"
          >
            Tentar novamente
          </button>
        </div>
      )}

      {/* Loading skeletons */}
      {loading && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <ProductSkeleton key={i} />
          ))}
        </div>
      )}

      {/* Product grid */}
      {!loading && !error && products.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16">
          <p className="text-gray-500">Nenhum produto disponível no momento.</p>
        </div>
      )}

      {!loading && !error && products.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {products.map((product) => (
            <ProductCard key={product.id} product={product} onBuy={handleBuy} />
          ))}
        </div>
      )}

      {/* Checkout modal */}
      {modalOpen && checkout.selectedProduct && (
        <CheckoutModal
          product={checkout.selectedProduct}
          initialQuantity={selectedQty}
          checkout={checkout}
          onClose={handleClose}
        />
      )}
    </div>
  )
}
