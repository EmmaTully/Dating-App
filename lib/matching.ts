import { supabase } from './supabase'
import { sendSMS } from './twilio'

export interface MatchScore {
  userId: string
  score: number
  vectorSimilarity: number
  preferenceMatch: number
  valuesOverlap: number
}

export async function findMatches(userId: string, limit = 5): Promise<MatchScore[]> {
  try {
    // Get the user's data
    const { data: user } = await supabase
      .from('users')
      .select(`
        *,
        profiles(*),
        preferences(*),
        user_vectors(*)
      `)
      .eq('id', userId)
      .single()

    if (!user || !user.user_vectors?.[0]) {
      console.log('User or user vector not found')
      return []
    }

    const userProfile = user.profiles?.[0]
    const userPrefs = user.preferences?.[0]
    const userVector = user.user_vectors[0]

    if (!userProfile || !userPrefs) {
      console.log('User profile or preferences not found')
      return []
    }

    // Get potential matches based on basic filters
    const potentialMatches = await getPotentialMatches(user, userProfile, userPrefs)
    
    if (potentialMatches.length === 0) {
      console.log('No potential matches found')
      return []
    }

    // Calculate match scores
    const matchScores: MatchScore[] = []

    for (const match of potentialMatches) {
      const score = await calculateMatchScore(
        user,
        match,
        userVector.embedding,
        match.user_vectors[0]?.embedding
      )
      
      if (score.score > 0.3) { // Minimum threshold
        matchScores.push(score)
      }
    }

    // Sort by score and return top matches
    return matchScores
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)

  } catch (error) {
    console.error('Error finding matches:', error)
    return []
  }
}

async function getPotentialMatches(user: any, userProfile: any, userPrefs: any) {
  const userAge = calculateAge(userProfile.date_of_birth)
  
  // Build the query with filters
  let query = supabase
    .from('users')
    .select(`
      *,
      profiles(*),
      preferences(*),
      user_vectors(*),
      availability_windows!inner(*)
    `)
    .neq('id', user.id)
    .eq('is_active', true)
    .eq('is_onboarded', true)
    .eq('availability_windows.date', new Date().toISOString().split('T')[0])
    .eq('availability_windows.is_available', true)

  const { data: matches, error } = await query

  if (error) {
    console.error('Error getting potential matches:', error)
    return []
  }

  // Filter matches based on mutual preferences
  const filteredMatches = matches?.filter(match => {
    const matchProfile = match.profiles?.[0]
    const matchPrefs = match.preferences?.[0]
    
    if (!matchProfile || !matchPrefs) return false

    const matchAge = calculateAge(matchProfile.date_of_birth)
    
    // Check if user meets match's criteria
    const userMeetsMatchCriteria = (
      matchAge >= userPrefs.min_age &&
      matchAge <= userPrefs.max_age &&
      userPrefs.preferred_genders?.includes(getGenderFromOrientation(matchPrefs.orientation)) &&
      matchPrefs.preferred_genders?.includes(getGenderFromOrientation(userPrefs.orientation))
    )
    
    // Check if match meets user's criteria  
    const matchMeetsUserCriteria = (
      userAge >= matchPrefs.min_age &&
      userAge <= matchPrefs.max_age
    )

    return userMeetsMatchCriteria && matchMeetsUserCriteria
  }) || []

  return filteredMatches
}

async function calculateMatchScore(
  user1: any,
  user2: any,
  embedding1: number[],
  embedding2: number[]
): Promise<MatchScore> {
  
  // 1. Vector similarity (60% weight)
  const vectorSimilarity = embedding2 ? cosineSimilarity(embedding1, embedding2) : 0

  // 2. Explicit preference match (20% weight)
  const preferenceMatch = calculatePreferenceMatch(
    user1.preferences?.[0],
    user2.preferences?.[0],
    user1.profiles?.[0],
    user2.profiles?.[0]
  )

  // 3. Values overlap (20% weight)
  const valuesOverlap = await calculateValuesOverlap(user1.id, user2.id)

  // Calculate weighted score
  const score = (
    0.6 * vectorSimilarity +
    0.2 * preferenceMatch +
    0.2 * valuesOverlap
  )

  return {
    userId: user2.id,
    score,
    vectorSimilarity,
    preferenceMatch,
    valuesOverlap
  }
}

function cosineSimilarity(a: number[], b: number[]): number {
  if (!a || !b || a.length !== b.length) return 0
  
  let dotProduct = 0
  let normA = 0
  let normB = 0
  
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i]
    normA += a[i] * a[i]
    normB += b[i] * b[i]
  }
  
  const magnitude = Math.sqrt(normA) * Math.sqrt(normB)
  return magnitude ? dotProduct / magnitude : 0
}

function calculatePreferenceMatch(prefs1: any, prefs2: any, profile1: any, profile2: any): number {
  if (!prefs1 || !prefs2 || !profile1 || !profile2) return 0
  
  let score = 0
  let factors = 0
  
  // Age preference match
  const age1 = calculateAge(profile1.date_of_birth)
  const age2 = calculateAge(profile2.date_of_birth)
  
  const age1InRange = age1 >= prefs2.min_age && age1 <= prefs2.max_age
  const age2InRange = age2 >= prefs1.min_age && age2 <= prefs1.max_age
  
  if (age1InRange && age2InRange) {
    score += 1
  } else if (age1InRange || age2InRange) {
    score += 0.5
  }
  factors += 1
  
  // Distance preference (if we had location data)
  // For now, assume same city = good match
  if (profile1.city && profile2.city && profile1.city === profile2.city) {
    score += 1
  }
  factors += 1
  
  return factors > 0 ? score / factors : 0
}

async function calculateValuesOverlap(userId1: string, userId2: string): number {
  // Get answers from both users
  const { data: answers1 } = await supabase
    .from('answers')
    .select('*')
    .eq('user_id', userId1)
    .eq('category', 'values')

  const { data: answers2 } = await supabase
    .from('answers')
    .select('*')
    .eq('user_id', userId2)
    .eq('category', 'values')

  if (!answers1?.length || !answers2?.length) return 0

  // Simple keyword overlap for now
  // In production, you'd want more sophisticated NLP analysis
  const keywords1 = extractKeywords(answers1.map(a => a.answer).join(' '))
  const keywords2 = extractKeywords(answers2.map(a => a.answer).join(' '))
  
  const overlap = keywords1.filter(k => keywords2.includes(k)).length
  const total = new Set([...keywords1, ...keywords2]).size
  
  return total > 0 ? overlap / total : 0
}

function extractKeywords(text: string): string[] {
  // Simple keyword extraction - in production use proper NLP
  const words = text.toLowerCase()
    .replace(/[^\w\s]/g, '')
    .split(/\s+/)
    .filter(word => word.length > 3)
  
  // Remove common words
  const stopWords = ['that', 'with', 'have', 'this', 'will', 'your', 'from', 'they', 'know', 'want', 'been', 'good', 'much', 'some', 'time']
  
  return [...new Set(words.filter(word => !stopWords.includes(word)))]
}

function getGenderFromOrientation(orientation: string): string {
  // Simplified mapping - in production, handle this more carefully
  const mapping: Record<string, string> = {
    'straight': 'man', // assuming straight men
    'gay': 'man',
    'lesbian': 'woman',
    'bisexual': 'any',
    'pansexual': 'any'
  }
  
  return mapping[orientation] || 'any'
}

function calculateAge(dateOfBirth: string): number {
  const today = new Date()
  const birth = new Date(dateOfBirth)
  let age = today.getFullYear() - birth.getFullYear()
  const monthDiff = today.getMonth() - birth.getMonth()
  
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age--
  }
  
  return age
}

// Propose matches to users
export async function proposeMatches(userId: string) {
  try {
    const matches = await findMatches(userId, 3)
    
    if (matches.length === 0) {
      // No matches found
      const { data: user } = await supabase
        .from('users')
        .select('phone')
        .eq('id', userId)
        .single()
      
      if (user) {
        await sendSMS(user.phone, "I'm still looking for great matches for you tonight! I'll keep searching and let you know when I find someone special 💕")
      }
      return
    }

    // Create match proposals
    for (const match of matches) {
      await createMatchProposal(userId, match.userId, match.score)
    }

  } catch (error) {
    console.error('Error proposing matches:', error)
  }
}

async function createMatchProposal(user1Id: string, user2Id: string, score: number) {
  const today = new Date().toISOString().split('T')[0]
  
  // Create match record
  const { data: matchRecord } = await supabase
    .from('matches')
    .insert({
      user1_id: user1Id,
      user2_id: user2Id,
      status: 'proposed',
      match_score: score,
      proposed_date: today,
      proposed_time: '19:00', // 7 PM default
      proposed_location_area: 'Downtown', // Would be more specific in production
      proposed_activity: 'Coffee or drinks',
      user1_response: 'pending',
      user2_response: 'pending',
      expires_at: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString() // 2 hours
    })
    .select()
    .single()

  if (matchRecord) {
    // Send proposal messages to both users
    await sendMatchProposal(user1Id, matchRecord)
    await sendMatchProposal(user2Id, matchRecord)
  }
}

async function sendMatchProposal(userId: string, match: any) {
  const { data: user } = await supabase
    .from('users')
    .select('phone, profiles(*)')
    .eq('id', userId)
    .single()

  if (!user) return

  const firstName = user.profiles?.[0]?.first_name || 'there'
  
  const message = `Hey ${firstName}! 💕 I found someone special who might be perfect for you tonight! 

Interested in ${match.proposed_activity} around ${match.proposed_location_area} at ${match.proposed_time}?

Reply YES if you're interested, or NO if not tonight. You have 2 hours to decide! ⏰`

  await sendSMS(user.phone, message)
}
