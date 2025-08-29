import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { sendSMS } from '@/lib/twilio'
import { setConversationState } from '@/lib/redis'

export async function POST(request: NextRequest) {
  try {
    // Verify this is a cron job or authorized request
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET
    
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    console.log('Starting invite run...')

    // Get current time and check if it's the right time to send invites (4-6 PM local)
    const now = new Date()
    const currentHour = now.getHours()
    
    // For demo purposes, allow running anytime. In production, check time zones.
    // if (currentHour < 16 || currentHour > 18) {
    //   return NextResponse.json({ message: 'Not invite time' })
    // }

    const today = now.toISOString().split('T')[0]

    // Get active users who haven't been asked about availability today
    const { data: users, error } = await supabase
      .from('users')
      .select(`
        id,
        phone,
        timezone,
        profiles(first_name),
        availability_windows(*)
      `)
      .eq('is_active', true)
      .eq('is_onboarded', true)

    if (error) {
      console.error('Error fetching users:', error)
      return NextResponse.json({ error: 'Database error' }, { status: 500 })
    }

    if (!users || users.length === 0) {
      return NextResponse.json({ 
        message: 'No active users found',
        processed: 0 
      })
    }

    // Filter users who haven't been asked today
    const usersToAsk = users.filter(user => {
      const todayAvailability = user.availability_windows?.find(
        (aw: any) => aw.date === today
      )
      return !todayAvailability // Haven't been asked today
    })

    console.log(`Found ${usersToAsk.length} users to ask about availability`)

    let processed = 0
    const results = []

    for (const user of usersToAsk) {
      try {
        await askAvailability(user)
        processed++
        results.push({ userId: user.id, status: 'success' })
      } catch (error) {
        console.error(`Error asking availability for user ${user.id}:`, error)
        results.push({ 
          userId: user.id, 
          status: 'error', 
          error: error instanceof Error ? error.message : 'Unknown error' 
        })
      }
    }

    // Log the batch operation
    await supabase
      .from('audit_events')
      .insert({
        event_type: 'invite_batch_run',
        event_data: {
          users_processed: processed,
          total_eligible: usersToAsk.length,
          results: results
        }
      })

    return NextResponse.json({
      message: 'Invite run completed',
      users_eligible: usersToAsk.length,
      users_processed: processed,
      results: results
    })

  } catch (error) {
    console.error('Error in invite run:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

async function askAvailability(user: any) {
  const firstName = user.profiles?.[0]?.first_name || 'there'
  const today = new Date().toISOString().split('T')[0]
  
  // Create availability window record
  await supabase
    .from('availability_windows')
    .insert({
      user_id: user.id,
      date: today,
      is_available: false // Will be updated when they respond
    })

  // Update conversation state to expect availability response
  await setConversationState(user.id, {
    current_state: 'available_tonight',
    context: {
      availability_asked_today: true,
      expecting_availability_response: true
    }
  })

  // Update database conversation state
  await supabase
    .from('conversation_states')
    .upsert({
      user_id: user.id,
      current_state: 'available_tonight',
      context: {
        availability_asked_today: true,
        expecting_availability_response: true
      },
      last_interaction: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })

  // Send the availability question
  const messages = [
    `Hey ${firstName}! 💕 Hope you're having a great day!`,
    `I'm wondering... are you free for a date tonight? I might have some amazing people to introduce you to! 😊`,
    `Just reply YES if you're available or NO if not tonight. What do you say?`
  ]

  // Send messages with a small delay between them
  for (let i = 0; i < messages.length; i++) {
    await sendSMS(user.phone, messages[i])
    
    // Store outbound message
    await supabase
      .from('messages')
      .insert({
        user_id: user.id,
        direction: 'outbound',
        content: messages[i]
      })
    
    // Small delay between messages to make it feel more natural
    if (i < messages.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 1000))
    }
  }
}
