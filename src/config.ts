export interface McConfig {
  baseUrl: string
  apiKey: string
}

export function loadConfig(): McConfig {
  const baseUrl = process.env.MC_BASE_URL
  const apiKey = process.env.MC_API_KEY

  if (!baseUrl) throw new Error('MC_BASE_URL environment variable is required')
  if (!apiKey) throw new Error('MC_API_KEY environment variable is required')

  return {
    baseUrl: baseUrl.replace(/\/$/, ''),
    apiKey,
  }
}
