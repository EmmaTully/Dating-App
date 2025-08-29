import twilio from 'twilio'

const accountSid = process.env.TWILIO_ACCOUNT_SID!
const authToken = process.env.TWILIO_AUTH_TOKEN!
const fromNumber = process.env.TWILIO_PHONE_NUMBER!

export const twilioClient = twilio(accountSid, authToken)

export async function sendSMS(to: string, message: string) {
  try {
    const result = await twilioClient.messages.create({
      body: message,
      from: fromNumber,
      to: to
    })
    
    console.log(`SMS sent to ${to}: ${result.sid}`)
    return result
  } catch (error) {
    console.error('Error sending SMS:', error)
    throw error
  }
}

export function validateTwilioSignature(signature: string, url: string, params: any): boolean {
  const webhookSecret = process.env.TWILIO_WEBHOOK_SECRET
  if (!webhookSecret) return true // Skip validation in dev if no secret set
  
  return twilio.validateRequest(webhookSecret, signature, url, params)
}

// Create a proxy service for masked conversations
export async function createProxyService(friendlyName: string) {
  try {
    const service = await twilioClient.proxy.v1.services.create({
      uniqueName: `blindmatch-${Date.now()}`,
      friendlyName
    })
    return service
  } catch (error) {
    console.error('Error creating proxy service:', error)
    throw error
  }
}

// Create a proxy session for a match
export async function createProxySession(serviceSid: string, user1Phone: string, user2Phone: string) {
  try {
    const session = await twilioClient.proxy.v1.services(serviceSid)
      .sessions.create({
        uniqueName: `match-${Date.now()}`
      })
    
    // Add participants
    await twilioClient.proxy.v1.services(serviceSid)
      .sessions(session.sid)
      .participants.create({
        identifier: user1Phone,
        friendlyName: 'User 1'
      })
    
    await twilioClient.proxy.v1.services(serviceSid)
      .sessions(session.sid)
      .participants.create({
        identifier: user2Phone,
        friendlyName: 'User 2'
      })
    
    return session
  } catch (error) {
    console.error('Error creating proxy session:', error)
    throw error
  }
}
