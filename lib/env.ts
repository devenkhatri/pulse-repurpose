const requiredEnvVars = [
  'N8N_SHEET_WEBHOOK_URL',
  'N8N_CONTENT_REPURPOSE_WEBHOOK_URL',
  'N8N_IMAGE_REPURPOSE_WEBHOOK_URL',
  'N8N_PUBLISH_WEBHOOK_URL',
] as const

const optionalEnvVars = [
  'OPENROUTER_API_KEY',
  'OPENROUTER_MODEL',
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

// Warn if OpenRouter key is missing
if (!process.env.OPENROUTER_API_KEY) {
  console.warn('[env] OPENROUTER_API_KEY is not set — chat and hashtag suggestions will fail')
}

export const env = {
  N8N_SHEET_WEBHOOK_URL: process.env.N8N_SHEET_WEBHOOK_URL ?? '',
  N8N_CONTENT_REPURPOSE_WEBHOOK_URL: process.env.N8N_CONTENT_REPURPOSE_WEBHOOK_URL ?? '',
  N8N_IMAGE_REPURPOSE_WEBHOOK_URL: process.env.N8N_IMAGE_REPURPOSE_WEBHOOK_URL ?? '',
  N8N_PUBLISH_WEBHOOK_URL: process.env.N8N_PUBLISH_WEBHOOK_URL ?? '',
  OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY ?? '',
  OPENROUTER_MODEL: process.env.OPENROUTER_MODEL ?? 'openrouter/auto',
  NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000',
  CRON_SECRET: process.env.CRON_SECRET ?? '',
  CRON_SCHEDULE: process.env.CRON_SCHEDULE ?? '0 7 * * *',
} as const

// Re-export for type checking — suppress unused warning
void optionalEnvVars
