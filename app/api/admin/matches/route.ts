import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET() {
  try {
    const { data: matches, error } = await supabase
      .from('matches')
      .select(`
        id,
        status,
        match_score,
        proposed_date,
        proposed_time,
        proposed_activity,
        user1_response,
        user2_response,
        created_at,
        user1:user1_id(
          profiles(first_name)
        ),
        user2:user2_id(
          profiles(first_name)
        )
      `)
      .order('created_at', { ascending: false })
      .limit(50)

    if (error) {
      console.error('Error fetching matches:', error)
      return NextResponse.json({ error: 'Database error' }, { status: 500 })
    }

    return NextResponse.json({ matches })
  } catch (error) {
    console.error('Error in admin matches endpoint:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
