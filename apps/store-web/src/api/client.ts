import type { ApiErrorBody } from '@cc/contracts'

const baseURL = import.meta.env.VITE_API_URL as string

export async function apiFetch(path: string, init?: RequestInit): Promise<Response> {
  const url = `${baseURL}${path}`
  const res = await fetch(url, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {})
    }
  })

  if (!res.ok) {
    let body: ApiErrorBody
    try {
      body = (await res.json()) as ApiErrorBody
    } catch {
      body = {
        errorCode: 'INTERNAL_ERROR',
        message: `HTTP ${res.status}`,
        requestId: ''
      }
    }
    throw body
  }

  return res
}
