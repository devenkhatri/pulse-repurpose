const requiredEnvVars = [
  'N8N_SHEET_WEBHOOK_URL',
  'N8N_CONTENT_REPURPOSE_WEBHOOK_URL',
  'N8N_IMAGE_REPURPOSE_WEBHOOK_URL',
  'N8N_PUBLISH_WEBHOOK_URL',
  'N8N_LLM_WEBHOOK_URL',
] as const

const optionalEnvVars = [
  'NEXT_PUBLIC_APP_URL',
  'CRON_SECRET',
  'CRON_SCHEDULE',
  'N8N_ANALYTICS_WEBHOOK_URL',
] as const

// Validate required N8N URLs
for (const key of requiredEnvVars) {
  if (!process.env[key]) {
    console.warn(`[env] Missing required env var: ${key}`)
  }
}

// Warn if NEXT_PUBLIC_APP_URL is missing while n8n webhooks are configured.
// Without it, n8n callback URLs default to localhost:3000 which is unreachable
// from cloud n8n instances — generation will silently time out.
if (
  !process.env.NEXT_PUBLIC_APP_URL &&
  (process.env.N8N_CONTENT_REPURPOSE_WEBHOOK_URL || process.env.N8N_IMAGE_REPURPOSE_WEBHOOK_URL)
) {
  console.warn(
    '[env] NEXT_PUBLIC_APP_URL is not set — n8n callbacks will target http://localhost:3000, ' +
    'which is unreachable from cloud n8n instances. Set NEXT_PUBLIC_APP_URL to your public URL.'
  )
}

export const env = {
  N8N_SHEET_WEBHOOK_URL: process.env.N8N_SHEET_WEBHOOK_URL ?? '',
  N8N_CONTENT_REPURPOSE_WEBHOOK_URL: process.env.N8N_CONTENT_REPURPOSE_WEBHOOK_URL ?? '',
  N8N_IMAGE_REPURPOSE_WEBHOOK_URL: process.env.N8N_IMAGE_REPURPOSE_WEBHOOK_URL ?? '',
  N8N_PUBLISH_WEBHOOK_URL: process.env.N8N_PUBLISH_WEBHOOK_URL ?? '',
  N8N_LLM_WEBHOOK_URL: process.env.N8N_LLM_WEBHOOK_URL ?? '',
  NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000',
  CRON_SECRET: process.env.CRON_SECRET ?? '',
  CRON_SCHEDULE: process.env.CRON_SCHEDULE ?? '0 7 * * *',
  N8N_ANALYTICS_WEBHOOK_URL: process.env.N8N_ANALYTICS_WEBHOOK_URL ?? '',
} as const

// Re-export for type checking — suppress unused warning
void optionalEnvVars
