export interface McConfig {
  baseUrl: string
  basicAuth: string
}

export function loadConfig(): McConfig {
  const baseUrl = process.env.MC_BASE_URL
  const basicAuth = process.env.MC_BASIC_AUTH_ENCODED

  if (!baseUrl) throw new Error('MC_BASE_URL environment variable is required')
  if (!basicAuth) throw new Error('MC_BASIC_AUTH_ENCODED environment variable is required')

  return {
    baseUrl: baseUrl.replace(/\/$/, ''),
    basicAuth,
  }
}
