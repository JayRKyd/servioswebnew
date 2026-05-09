import { supabase } from './auth'

export async function apiClient<T = any>(
  path: string,
  options: RequestInit = {}
): Promise<{ data: T | null; error: string | null }> {
  try {
    const { data: { session } } = await supabase.auth.getSession()
    const token = session?.access_token

    const res = await fetch(path, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(options.headers ?? {}),
      },
    })

    const json = await res.json().catch(() => ({}))

    if (!res.ok) {
      return { data: null, error: json?.message ?? `Request failed (${res.status})` }
    }

    return { data: json as T, error: null }
  } catch (err: any) {
    return { data: null, error: err?.message ?? 'Network error' }
  }
}
