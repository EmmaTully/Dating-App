import Redis from 'redis'

let redis: ReturnType<typeof Redis.createClient> | null = null

export async function getRedisClient() {
  if (!redis) {
    redis = Redis.createClient({
      url: process.env.REDIS_URL || 'redis://localhost:6379'
    })
    
    redis.on('error', (err) => {
      console.error('Redis error:', err)
    })
    
    await redis.connect()
  }
  
  return redis
}

// Rate limiting helpers
export async function checkRateLimit(key: string, limit: number, windowSeconds: number): Promise<boolean> {
  const client = await getRedisClient()
  const current = await client.incr(key)
  
  if (current === 1) {
    await client.expire(key, windowSeconds)
  }
  
  return current <= limit
}

// Conversation state caching
export async function setConversationState(userId: string, state: any, ttlSeconds = 3600) {
  const client = await getRedisClient()
  await client.setEx(`conversation:${userId}`, ttlSeconds, JSON.stringify(state))
}

export async function getConversationState(userId: string) {
  const client = await getRedisClient()
  const state = await client.get(`conversation:${userId}`)
  return state ? JSON.parse(state) : null
}
