import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { proposeMatches } from '@/lib/matching'

export async function POST(request: NextRequest) {
  try {
    // Verify this is a cron job or authorized request
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET
    
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    console.log('Starting match run...')

    // Get all users who are available tonight
    const today = new Date().toISOString().split('T')[0]
    
    const { data: availableUsers, error } = await supabase
      .from('users')
      .select(`
        id,
        phone,
        profiles(first_name),
        availability_windows!inner(*)
      `)
      .eq('is_active', true)
      .eq('is_onboarded', true)
      .eq('availability_windows.date', today)
      .eq('availability_windows.is_available', true)

    if (error) {
      console.error('Error fetching available users:', error)
      return NextResponse.json({ error: 'Database error' }, { status: 500 })
    }

    if (!availableUsers || availableUsers.length === 0) {
      console.log('No available users found')
      return NextResponse.json({ 
        message: 'No available users found',
        processed: 0 
      })
    }

    console.log(`Found ${availableUsers.length} available users`)

    // Process matches for each available user
    let processed = 0
    const results = []

    for (const user of availableUsers) {
      try {
        await proposeMatches(user.id)
        processed++
        results.push({ userId: user.id, status: 'success' })
      } catch (error) {
        console.error(`Error processing matches for user ${user.id}:`, error)
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
        event_type: 'match_batch_run',
        event_data: {
          users_processed: processed,
          total_available: availableUsers.length,
          results: results
        }
      })

    return NextResponse.json({
      message: 'Match run completed',
      users_available: availableUsers.length,
      users_processed: processed,
      results: results
    })

  } catch (error) {
    console.error('Error in match run:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
