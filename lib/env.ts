const requiredEnvVars = [
  'N8N_SHEET_WEBHOOK_URL',
  'N8N_CONTENT_REPURPOSE_WEBHOOK_URL',
  'N8N_IMAGE_REPURPOSE_WEBHOOK_URL',
  'N8N_PUBLISH_WEBHOOK_URL',
] as const

const optionalEnvVars = [
  'ANTHROPIC_API_KEY',
  'NEXT_PUBLIC_APP_URL',
  'CRON_SECRET',
  'CRON_SCHEDULE',
] as const

// Validate required N8N URLs
for (const key of requiredEnvVars) {
  if (!process.env[key]) {
    console.warn(`[env] Missing required env var: ${key}`)
  }
}

// Warn on placeholder values
if (process.env.ANTHROPIC_API_KEY === 'your_key_here') {
  console.warn('[env] ANTHROPIC_API_KEY is still set to placeholder value "your_key_here"')
}

export const env = {
  N8N_SHEET_WEBHOOK_URL: process.env.N8N_SHEET_WEBHOOK_URL ?? '',
  N8N_CONTENT_REPURPOSE_WEBHOOK_URL: process.env.N8N_CONTENT_REPURPOSE_WEBHOOK_URL ?? '',
  N8N_IMAGE_REPURPOSE_WEBHOOK_URL: process.env.N8N_IMAGE_REPURPOSE_WEBHOOK_URL ?? '',
  N8N_PUBLISH_WEBHOOK_URL: process.env.N8N_PUBLISH_WEBHOOK_URL ?? '',
  ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY ?? '',
  NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000',
  CRON_SECRET: process.env.CRON_SECRET ?? '',
  CRON_SCHEDULE: process.env.CRON_SCHEDULE ?? '0 7 * * *',
} as const

// Re-export for type checking — suppress unused warning
void optionalEnvVars
