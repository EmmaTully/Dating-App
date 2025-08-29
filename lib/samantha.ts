import OpenAI from 'openai'
import { supabase } from './supabase'
import { sendSMS } from './twilio'
import { setConversationState, getConversationState } from './redis'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!
})

export interface ConversationState {
  current_state: 'new' | 'onboarding' | 'gathering_preferences' | 'active' | 'available_tonight'
  context: {
    onboarding_step?: number
    questions_asked?: string[]
    pending_questions?: string[]
    last_summary?: string
    availability_asked_today?: boolean
  }
}

const SAMANTHA_PERSONA = `You are Samantha, a warm and proactive SMS matchmaker. Your goal is to learn about users through natural conversation and create meaningful same-day connections.

Key traits:
- Warm, friendly, and conversational (like texting a close friend)
- Concise - keep messages under 160 characters when possible
- Proactive - don't just respond, guide the conversation
- Curious about values, lifestyle, and what makes someone tick
- Never ask for sensitive info like full names, addresses, or financial details

Your process:
1. Welcome new users warmly and explain what you do
2. Gather basic info: age, city/area, orientation, what they're looking for
3. Ask 6-10 open-ended questions about values, interests, lifestyle, dealbreakers
4. Summarize what you learned every 3-4 exchanges
5. Around 4-6pm, ask if they're free for a date tonight
6. If they say yes, find matches and propose specific plans

Conversation style:
- Use casual language and occasional emojis
- Ask one question at a time
- Build on their previous answers
- Show genuine interest in their responses
- Keep it light and fun, not like an interview

Remember: You're creating real connections, not just collecting data.`

export async function processSamanthaMessage(userId: string, incomingMessage: string) {
  try {
    // Get current conversation state
    let state = await getConversationState(userId)
    
    if (!state) {
      // Load from database
      const { data: dbState } = await supabase
        .from('conversation_states')
        .select('*')
        .eq('user_id', userId)
        .single()
      
      state = dbState || {
        current_state: 'new',
        context: {}
      }
    }

    // Get user info for context
    const { data: user } = await supabase
      .from('users')
      .select(`
        *,
        profiles(*),
        preferences(*),
        answers(*)
      `)
      .eq('id', userId)
      .single()

    if (!user) {
      throw new Error('User not found')
    }

    // Generate Samantha's response
    const response = await generateSamanthaResponse(user, state, incomingMessage)
    
    // Send SMS response
    await sendSMS(user.phone, response.message)
    
    // Store outbound message
    await supabase
      .from('messages')
      .insert({
        user_id: userId,
        direction: 'outbound',
        content: response.message
      })

    // Update conversation state
    const newState = {
      ...state,
      current_state: response.newState,
      context: response.newContext,
      last_interaction: new Date().toISOString()
    }

    await setConversationState(userId, newState)
    
    // Update database state
    await supabase
      .from('conversation_states')
      .upsert({
        user_id: userId,
        current_state: response.newState,
        context: response.newContext,
        last_interaction: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })

    // Handle any additional actions (like creating embeddings)
    if (response.actions) {
      await handleSamanthaActions(userId, response.actions)
    }

  } catch (error) {
    console.error('Error processing Samantha message:', error)
    
    // Send fallback message
    const { data: user } = await supabase
      .from('users')
      .select('phone')
      .eq('id', userId)
      .single()
    
    if (user) {
      await sendSMS(user.phone, "Sorry, I'm having a moment! Can you try texting me again? 😅")
    }
  }
}

async function generateSamanthaResponse(user: any, state: ConversationState, message: string) {
  const context = buildConversationContext(user, state)
  
  const completion = await openai.chat.completions.create({
    model: "gpt-4",
    messages: [
      {
        role: "system",
        content: SAMANTHA_PERSONA
      },
      {
        role: "system", 
        content: `Current context: ${JSON.stringify(context)}`
      },
      {
        role: "user",
        content: message
      }
    ],
    functions: [
      {
        name: "send_response",
        description: "Send a response to the user and update conversation state",
        parameters: {
          type: "object",
          properties: {
            message: {
              type: "string",
              description: "The message to send to the user"
            },
            new_state: {
              type: "string",
              enum: ["new", "onboarding", "gathering_preferences", "active", "available_tonight"],
              description: "The new conversation state"
            },
            context_updates: {
              type: "object",
              description: "Updates to the conversation context"
            },
            actions: {
              type: "array",
              items: {
                type: "string",
                enum: ["create_embedding", "update_profile", "check_availability", "find_matches"]
              },
              description: "Actions to perform after sending the message"
            }
          },
          required: ["message", "new_state"]
        }
      }
    ],
    function_call: { name: "send_response" },
    temperature: 0.7,
    max_tokens: 300
  })

  const functionCall = completion.choices[0].message.function_call
  if (!functionCall || !functionCall.arguments) {
    throw new Error('No function call returned from OpenAI')
  }

  const response = JSON.parse(functionCall.arguments)
  
  return {
    message: response.message,
    newState: response.new_state,
    newContext: { ...state.context, ...response.context_updates },
    actions: response.actions || []
  }
}

function buildConversationContext(user: any, state: ConversationState) {
  const profile = user.profiles?.[0]
  const preferences = user.preferences?.[0]
  const answers = user.answers || []
  
  return {
    user_state: state.current_state,
    context: state.context,
    has_profile: !!profile,
    profile_data: profile ? {
      first_name: profile.first_name,
      age: profile.date_of_birth ? calculateAge(profile.date_of_birth) : null,
      city: profile.city,
      bio: profile.bio
    } : null,
    has_preferences: !!preferences,
    preferences_data: preferences ? {
      orientation: preferences.orientation,
      preferred_genders: preferences.preferred_genders,
      age_range: [preferences.min_age, preferences.max_age],
      max_distance: preferences.max_distance_miles,
      dealbreakers: preferences.dealbreakers
    } : null,
    answers_count: answers.length,
    recent_answers: answers.slice(-3).map((a: any) => ({
      question: a.question,
      answer: a.answer,
      category: a.category
    }))
  }
}

async function handleSamanthaActions(userId: string, actions: string[]) {
  for (const action of actions) {
    switch (action) {
      case 'create_embedding':
        await createUserEmbedding(userId)
        break
      case 'check_availability':
        await checkUserAvailability(userId)
        break
      case 'find_matches':
        await findMatches(userId)
        break
    }
  }
}

async function createUserEmbedding(userId: string) {
  // Get user's answers and profile
  const { data: user } = await supabase
    .from('users')
    .select(`
      profiles(*),
      preferences(*),
      answers(*)
    `)
    .eq('id', userId)
    .single()

  if (!user || !user.answers?.length) return

  // Create a text summary for embedding
  const profile = user.profiles?.[0]
  const preferences = user.preferences?.[0]
  const answers = user.answers

  const summaryText = `
    Profile: ${profile?.first_name || 'User'}, age ${profile?.date_of_birth ? calculateAge(profile.date_of_birth) : 'unknown'}, from ${profile?.city || 'unknown location'}.
    Looking for: ${preferences?.orientation || 'unknown'} relationships with ${preferences?.preferred_genders?.join(', ') || 'unknown'}.
    Age preference: ${preferences?.min_age}-${preferences?.max_age || 'unknown'}.
    
    Values and interests:
    ${answers.map((a: any) => `${a.question}: ${a.answer}`).join('\n')}
    
    Dealbreakers: ${preferences?.dealbreakers?.join(', ') || 'none specified'}
  `.trim()

  // Generate embedding
  const embedding = await openai.embeddings.create({
    model: "text-embedding-ada-002",
    input: summaryText
  })

  // Store embedding
  await supabase
    .from('user_vectors')
    .upsert({
      user_id: userId,
      embedding: JSON.stringify(embedding.data[0].embedding),
      summary: summaryText,
      updated_at: new Date().toISOString()
    })
}

async function checkUserAvailability(userId: string) {
  const today = new Date().toISOString().split('T')[0]
  
  const { data: availability } = await supabase
    .from('availability_windows')
    .select('*')
    .eq('user_id', userId)
    .eq('date', today)
    .single()

  return availability?.is_available || false
}

async function findMatches(userId: string) {
  // This will be implemented in the matching engine
  console.log('Finding matches for user:', userId)
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
