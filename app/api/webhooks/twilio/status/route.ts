import { NextRequest, NextResponse } from 'next/server'
import { validateTwilioSignature } from '@/lib/twilio'
import { supabase } from '@/lib/supabase'

export async function POST(request: NextRequest) {
  try {
    // Get request data
    const formData = await request.formData()
    const body = Object.fromEntries(formData.entries())
    
    const {
      MessageSid: messageSid,
      MessageStatus: messageStatus,
      ErrorCode: errorCode,
      ErrorMessage: errorMessage
    } = body as Record<string, string>

    // Validate Twilio signature
    const signature = request.headers.get('x-twilio-signature') || ''
    const url = request.url
    
    if (!validateTwilioSignature(signature, url, body)) {
      console.error('Invalid Twilio signature for status webhook')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Update message status in database
    const { error } = await supabase
      .from('messages')
      .update({ 
        status: messageStatus,
        updated_at: new Date().toISOString()
      })
      .eq('twilio_message_sid', messageSid)

    if (error) {
      console.error('Error updating message status:', error)
    }

    // Log delivery failures
    if (messageStatus === 'failed' || messageStatus === 'undelivered') {
      console.error(`Message delivery failed: ${messageSid}`, {
        status: messageStatus,
        errorCode,
        errorMessage
      })

      // Log audit event for failed delivery
      const { data: message } = await supabase
        .from('messages')
        .select('user_id')
        .eq('twilio_message_sid', messageSid)
        .single()

      if (message) {
        await supabase
          .from('audit_events')
          .insert({
            user_id: message.user_id,
            event_type: 'message_delivery_failed',
            event_data: {
              message_sid: messageSid,
              status: messageStatus,
              error_code: errorCode,
              error_message: errorMessage
            }
          })
      }
    }

    return NextResponse.json({ message: 'Status updated' })

  } catch (error) {
    console.error('Error processing status webhook:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
