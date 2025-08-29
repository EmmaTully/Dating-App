import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { getRedisClient } from '@/lib/redis'

export async function GET() {
  const health = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    services: {
      database: 'unknown',
      redis: 'unknown',
      twilio: 'configured',
      openai: 'configured'
    }
  }

  // Check database connection
  try {
    const { error } = await supabase.from('users').select('id').limit(1)
    health.services.database = error ? 'error' : 'healthy'
  } catch (error) {
    health.services.database = 'error'
  }

  // Check Redis connection
  try {
    const redis = await getRedisClient()
    await redis.ping()
    health.services.redis = 'healthy'
  } catch (error) {
    health.services.redis = 'error'
  }

  // Check if critical services are configured
  if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN) {
    health.services.twilio = 'not_configured'
  }

  if (!process.env.OPENAI_API_KEY) {
    health.services.openai = 'not_configured'
  }

  // Determine overall health
  const hasErrors = Object.values(health.services).some(status => 
    status === 'error' || status === 'not_configured'
  )
  
  if (hasErrors) {
    health.status = 'degraded'
  }

  return NextResponse.json(health)
}
