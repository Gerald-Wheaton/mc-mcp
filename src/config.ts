export interface ServerConfig {
  port: number
  mcBaseUrl: string
}

export function loadConfig(): ServerConfig {
  const port = parseInt(process.env.PORT ?? '3000', 10)
  const mcBaseUrl = (
    process.env.MC_BASE_URL ?? 'https://api.maintenanceconnection.com/v8'
  ).replace(/\/$/, '')

  return { port, mcBaseUrl }
}
