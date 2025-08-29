import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET() {
  try {
    const { data: users, error } = await supabase
      .from('users')
      .select(`
        id,
        phone,
        is_active,
        is_onboarded,
        created_at,
        profiles(
          first_name,
          city,
          date_of_birth
        )
      `)
      .order('created_at', { ascending: false })
      .limit(50)

    if (error) {
      console.error('Error fetching users:', error)
      return NextResponse.json({ error: 'Database error' }, { status: 500 })
    }

    return NextResponse.json({ users })
  } catch (error) {
    console.error('Error in admin users endpoint:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
