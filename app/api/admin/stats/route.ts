import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET() {
  try {
    const today = new Date().toISOString().split('T')[0]

    // Get total users
    const { count: totalUsers } = await supabase
      .from('users')
      .select('*', { count: 'exact', head: true })

    // Get active users
    const { count: activeUsers } = await supabase
      .from('users')
      .select('*', { count: 'exact', head: true })
      .eq('is_active', true)

    // Get onboarded users
    const { count: onboardedUsers } = await supabase
      .from('users')
      .select('*', { count: 'exact', head: true })
      .eq('is_onboarded', true)

    // Get users available tonight
    const { count: availableTonight } = await supabase
      .from('availability_windows')
      .select('*', { count: 'exact', head: true })
      .eq('date', today)
      .eq('is_available', true)

    // Get active matches
    const { count: activeMatches } = await supabase
      .from('matches')
      .select('*', { count: 'exact', head: true })
      .in('status', ['proposed', 'invited', 'accepted'])

    const stats = {
      totalUsers: totalUsers || 0,
      activeUsers: activeUsers || 0,
      onboardedUsers: onboardedUsers || 0,
      availableTonight: availableTonight || 0,
      activeMatches: activeMatches || 0
    }

    return NextResponse.json({ stats })
  } catch (error) {
    console.error('Error in admin stats endpoint:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
