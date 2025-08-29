import { NextRequest, NextResponse } from 'next/server'
import { validateTwilioSignature } from '@/lib/twilio'
import { supabase } from '@/lib/supabase'
import { checkRateLimit } from '@/lib/redis'
import { processSamanthaMessage } from '@/lib/samantha'

export async function POST(request: NextRequest) {
  try {
    // Get request data
    const formData = await request.formData()
    const body = Object.fromEntries(formData.entries())
    
    const {
      From: fromPhone,
      To: toPhone,
      Body: messageBody,
      MessageSid: messageSid
    } = body as Record<string, string>

    // Validate Twilio signature
    const signature = request.headers.get('x-twilio-signature') || ''
    const url = request.url
    
    if (!validateTwilioSignature(signature, url, body)) {
      console.error('Invalid Twilio signature')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Rate limiting - 10 messages per minute per phone number
    const rateLimitKey = `sms_rate:${fromPhone}`
    const withinLimit = await checkRateLimit(rateLimitKey, 10, 60)
    
    if (!withinLimit) {
      console.log(`Rate limit exceeded for ${fromPhone}`)
      return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 })
    }

    // Clean the phone number
    const cleanPhone = fromPhone.replace(/\D/g, '')
    
    // Check for STOP/START/HELP commands first
    const upperBody = messageBody.toUpperCase().trim()
    
    if (upperBody === 'STOP') {
      await handleStopCommand(cleanPhone)
      return NextResponse.json({ message: 'Unsubscribed' })
    }
    
    if (upperBody === 'START') {
      await handleStartCommand(cleanPhone)
      return NextResponse.json({ message: 'Resubscribed' })
    }
    
    if (upperBody === 'HELP') {
      await handleHelpCommand(cleanPhone)
      return NextResponse.json({ message: 'Help sent' })
    }

    // Find or create user
    let { data: user } = await supabase
      .from('users')
      .select('*')
      .eq('phone', cleanPhone)
      .single()

    if (!user) {
      // Create new user
      const { data: newUser, error } = await supabase
        .from('users')
        .insert({
          phone: cleanPhone,
          consent_timestamp: new Date().toISOString()
        })
        .select()
        .single()

      if (error) {
        console.error('Error creating user:', error)
        return NextResponse.json({ error: 'Database error' }, { status: 500 })
      }
      
      user = newUser

      // Create initial conversation state
      await supabase
        .from('conversation_states')
        .insert({
          user_id: user.id,
          current_state: 'new',
          context: {}
        })
    }

    // Check if user is active
    if (!user.is_active) {
      console.log(`Message from inactive user: ${cleanPhone}`)
      return NextResponse.json({ message: 'User inactive' })
    }

    // Store the inbound message
    await supabase
      .from('messages')
      .insert({
        user_id: user.id,
        direction: 'inbound',
        content: messageBody,
        twilio_message_sid: messageSid
      })

    // Process with Samantha AI
    await processSamanthaMessage(user.id, messageBody)

    // Log audit event
    await supabase
      .from('audit_events')
      .insert({
        user_id: user.id,
        event_type: 'sms_received',
        event_data: {
          message_sid: messageSid,
          content_length: messageBody.length
        }
      })

    return NextResponse.json({ message: 'Message processed' })

  } catch (error) {
    console.error('Error processing SMS webhook:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

async function handleStopCommand(phone: string) {
  await supabase
    .from('users')
    .update({ 
      is_active: false,
      updated_at: new Date().toISOString()
    })
    .eq('phone', phone)

  // Log audit event
  const { data: user } = await supabase
    .from('users')
    .select('id')
    .eq('phone', phone)
    .single()

  if (user) {
    await supabase
      .from('audit_events')
      .insert({
        user_id: user.id,
        event_type: 'opt_out',
        event_data: { method: 'sms_stop' }
      })
  }
}

async function handleStartCommand(phone: string) {
  await supabase
    .from('users')
    .update({ 
      is_active: true,
      consent_timestamp: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    .eq('phone', phone)

  // Log audit event
  const { data: user } = await supabase
    .from('users')
    .select('id')
    .eq('phone', phone)
    .single()

  if (user) {
    await supabase
      .from('audit_events')
      .insert({
        user_id: user.id,
        event_type: 'opt_in',
        event_data: { method: 'sms_start' }
      })
  }
}

async function handleHelpCommand(phone: string) {
  const { sendSMS } = await import('@/lib/twilio')
  
  const helpMessage = `BlindMatch SMS Dating 💕

Text me anytime to chat! I'm Samantha, your AI matchmaker.

Commands:
• STOP - Unsubscribe
• START - Resubscribe  
• HELP - This message

I'll learn about you through conversation and suggest same-day dates with compatible people. All conversations are private and numbers stay masked.

Questions? Just text me!`

  await sendSMS(phone, helpMessage)
}
