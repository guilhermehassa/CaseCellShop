import { useState } from 'react'
import type { ProductDTO } from '@cc/contracts'

interface Props {
  product: ProductDTO
  onBuy: (product: ProductDTO, quantity: number) => void
}

export default function ProductCard({ product, onBuy }: Props) {
  const [quantity, setQuantity] = useState(1)

  const isOutOfStock = product.availableQuantity === 0

  const priceFmt = (product.priceCents / 100).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  })

  function handleBuy() {
    if (isOutOfStock) return
    onBuy(product, quantity)
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden flex flex-col">
      {/* Product image */}
      <div className="relative aspect-square overflow-hidden bg-gray-100">
        <img
          src={product.imageUrl}
          alt={product.name}
          loading="lazy"
          className="w-full h-full object-cover transition-transform hover:scale-105 duration-300"
          onError={(e) => {
            ;(e.target as HTMLImageElement).src =
              'https://picsum.photos/seed/fallback/600/600'
          }}
        />
        {isOutOfStock && (
          <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
            <span className="bg-white text-gray-800 font-semibold text-sm px-3 py-1 rounded-full">
              Esgotado
            </span>
          </div>
        )}
      </div>

      {/* Card body */}
      <div className="p-4 flex flex-col gap-3 flex-1">
        <div>
          <h3 className="font-semibold text-gray-900 text-sm leading-snug">{product.name}</h3>
          <p className="text-xs text-gray-500 mt-1 line-clamp-2">{product.description}</p>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-lg font-bold text-blue-600">{priceFmt}</span>
          <span
            className={`text-xs font-medium px-2 py-0.5 rounded-full ${
              isOutOfStock
                ? 'bg-red-100 text-red-700'
                : product.availableQuantity <= 3
                  ? 'bg-yellow-100 text-yellow-700'
                  : 'bg-green-100 text-green-700'
            }`}
          >
            {isOutOfStock ? 'Sem estoque' : `${product.availableQuantity} disponíveis`}
          </span>
        </div>

        {/* Quantity selector */}
        {!isOutOfStock && (
          <div className="flex items-center gap-2">
            <label htmlFor={`qty-${product.id}`} className="text-xs text-gray-600 shrink-0">
              Qtd:
            </label>
            <input
              id={`qty-${product.id}`}
              type="number"
              min={1}
              max={product.availableQuantity}
              value={quantity}
              onChange={(e) => {
                const v = Math.max(1, Math.min(product.availableQuantity, Number(e.target.value)))
                setQuantity(v)
              }}
              className="w-16 rounded-lg border border-gray-300 px-2 py-1 text-sm text-center outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        )}

        {/* Buy button */}
        <button
          type="button"
          onClick={handleBuy}
          disabled={isOutOfStock}
          aria-label={isOutOfStock ? 'Esgotado' : `Comprar ${product.name}`}
          className={`mt-auto w-full rounded-xl py-2.5 text-sm font-semibold transition ${
            isOutOfStock
              ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
              : 'bg-blue-600 hover:bg-blue-700 text-white'
          }`}
        >
          {isOutOfStock ? 'Esgotado' : 'Comprar'}
        </button>
      </div>
    </div>
  )
}
