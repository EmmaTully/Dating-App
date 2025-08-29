import { createClient } from '@supabase/supabase-js'
import OpenAI from 'openai'

// Initialize clients
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!
})

const cities = ['Austin', 'San Francisco', 'New York']

const firstNames = [
  'Alex', 'Jordan', 'Taylor', 'Casey', 'Morgan', 'Riley', 'Avery', 'Quinn',
  'Sage', 'River', 'Phoenix', 'Skyler', 'Cameron', 'Drew', 'Emery', 'Finley',
  'Harper', 'Hayden', 'Indigo', 'Kai', 'Logan', 'Marley', 'Nova', 'Ocean',
  'Parker', 'Reese', 'Rowan', 'Sam', 'Tatum', 'Wren', 'Zion', 'Blake',
  'Charlie', 'Dakota', 'Ellis', 'Frankie', 'Gray', 'Harlow', 'Jamie', 'Kennedy'
]

const orientations = ['straight', 'gay', 'lesbian', 'bisexual']
const genders = ['man', 'woman', 'non-binary']

const sampleAnswers = [
  {
    question: "What's most important to you in a relationship?",
    answers: [
      "Trust and communication - without those, nothing else matters",
      "Having fun together and laughing at the same things",
      "Supporting each other's dreams and goals",
      "Being able to be completely myself with someone",
      "Building a life together with shared values"
    ]
  },
  {
    question: "How do you like to spend your free time?",
    answers: [
      "Exploring new restaurants and trying different cuisines",
      "Hiking, rock climbing, or other outdoor adventures",
      "Reading books, watching movies, or binge-watching series",
      "Going to concerts, art galleries, or cultural events",
      "Hanging out with friends, playing games, or hosting dinners"
    ]
  },
  {
    question: "What's a dealbreaker for you in dating?",
    answers: [
      "Dishonesty or playing games",
      "Being rude to service workers",
      "Not having any ambition or goals",
      "Poor hygiene or not taking care of themselves",
      "Being closed-minded or judgmental"
    ]
  },
  {
    question: "What are you passionate about?",
    answers: [
      "My career in tech/design/marketing",
      "Environmental sustainability and making a difference",
      "Fitness, health, and living an active lifestyle",
      "Travel and experiencing different cultures",
      "Art, music, or creative expression"
    ]
  },
  {
    question: "What's your ideal first date?",
    answers: [
      "Coffee or drinks somewhere we can actually talk",
      "A fun activity like mini golf or a cooking class",
      "A casual walk in a park or around the city",
      "Trying a new restaurant neither of us has been to",
      "Something creative like a museum or art exhibit"
    ]
  },
  {
    question: "What do you value most in life?",
    answers: [
      "Family and close friendships",
      "Personal growth and learning new things",
      "Making a positive impact on the world",
      "Freedom and independence",
      "Authenticity and being true to myself"
    ]
  }
]

async function createFakeUser(index: number) {
  const city = cities[index % cities.length]
  const phone = `+1555${String(1000 + index).padStart(4, '0')}${String(Math.floor(Math.random() * 100)).padStart(2, '0')}`
  const firstName = firstNames[index % firstNames.length]
  const age = 22 + Math.floor(Math.random() * 15) // Ages 22-36
  const dateOfBirth = new Date()
  dateOfBirth.setFullYear(dateOfBirth.getFullYear() - age)
  
  const orientation = orientations[Math.floor(Math.random() * orientations.length)]
  const preferredGenders = getPreferredGenders(orientation)
  
  // Create user
  const { data: user, error: userError } = await supabase
    .from('users')
    .insert({
      phone,
      is_active: true,
      is_onboarded: true,
      consent_timestamp: new Date().toISOString()
    })
    .select()
    .single()

  if (userError) {
    console.error('Error creating user:', userError)
    return null
  }

  // Create profile
  await supabase
    .from('profiles')
    .insert({
      user_id: user.id,
      first_name: firstName,
      date_of_birth: dateOfBirth.toISOString().split('T')[0],
      city,
      bio: generateBio(firstName, age, city)
    })

  // Create preferences
  await supabase
    .from('preferences')
    .insert({
      user_id: user.id,
      orientation,
      preferred_genders: preferredGenders,
      min_age: Math.max(18, age - 8),
      max_age: age + 10,
      max_distance_miles: 25,
      dealbreakers: getRandomDealbreakers()
    })

  // Create answers
  const userAnswers = []
  const selectedQuestions = sampleAnswers.sort(() => 0.5 - Math.random()).slice(0, 6)
  
  for (const q of selectedQuestions) {
    const answer = q.answers[Math.floor(Math.random() * q.answers.length)]
    userAnswers.push({
      user_id: user.id,
      question: q.question,
      answer,
      category: 'values'
    })
  }

  await supabase
    .from('answers')
    .insert(userAnswers)

  // Create conversation state
  await supabase
    .from('conversation_states')
    .insert({
      user_id: user.id,
      current_state: 'active',
      context: { onboarding_complete: true }
    })

  // Create user embedding
  await createEmbeddingForUser(user.id, firstName, age, city, userAnswers)

  console.log(`Created user: ${firstName} (${phone}) in ${city}`)
  return user
}

async function createEmbeddingForUser(userId: string, firstName: string, age: number, city: string, answers: any[]) {
  const summaryText = `
    ${firstName}, age ${age}, from ${city}.
    Values and interests: ${answers.map(a => `${a.question}: ${a.answer}`).join(' ')}
  `.trim()

  try {
    const embedding = await openai.embeddings.create({
      model: "text-embedding-ada-002",
      input: summaryText
    })

    await supabase
      .from('user_vectors')
      .insert({
        user_id: userId,
        embedding: JSON.stringify(embedding.data[0].embedding),
        summary: summaryText
      })
  } catch (error) {
    console.error('Error creating embedding:', error)
  }
}

function getPreferredGenders(orientation: string): string[] {
  switch (orientation) {
    case 'straight':
      return Math.random() > 0.5 ? ['woman'] : ['man']
    case 'gay':
      return ['man']
    case 'lesbian':
      return ['woman']
    case 'bisexual':
      return ['man', 'woman']
    default:
      return ['man', 'woman', 'non-binary']
  }
}

function generateBio(name: string, age: number, city: string): string {
  const bios = [
    `${name}, ${age}. Love exploring ${city}'s food scene and outdoor adventures.`,
    `${age}-year-old ${city} native who's passionate about art, music, and good conversation.`,
    `${name} here! ${age} and loving life in ${city}. Always up for trying something new.`,
    `${city} local, ${age}. Fitness enthusiast who also loves cozy nights with good books.`,
    `${age} years old, ${city} based. Love traveling, cooking, and meeting interesting people.`
  ]
  return bios[Math.floor(Math.random() * bios.length)]
}

function getRandomDealbreakers(): string[] {
  const all = ['smoking', 'dishonesty', 'rudeness', 'no ambition', 'poor hygiene']
  const count = 1 + Math.floor(Math.random() * 3) // 1-3 dealbreakers
  return all.sort(() => 0.5 - Math.random()).slice(0, count)
}

async function seedDatabase() {
  console.log('Starting database seed...')
  
  try {
    // Create 40 fake users across 3 cities
    const users = []
    for (let i = 0; i < 40; i++) {
      const user = await createFakeUser(i)
      if (user) {
        users.push(user)
      }
      
      // Small delay to avoid rate limits
      await new Promise(resolve => setTimeout(resolve, 100))
    }

    console.log(`Successfully created ${users.length} users`)

    // Create some availability windows for today
    const today = new Date().toISOString().split('T')[0]
    const availableUsers = users.slice(0, 15) // Make 15 users available tonight

    for (const user of availableUsers) {
      await supabase
        .from('availability_windows')
        .insert({
          user_id: user.id,
          date: today,
          is_available: true,
          preferred_time_start: '18:00',
          preferred_time_end: '22:00'
        })
    }

    console.log(`Made ${availableUsers.length} users available tonight`)
    console.log('Database seeding completed!')

  } catch (error) {
    console.error('Error seeding database:', error)
  }
}

// Run the seeding if this script is called directly
if (require.main === module) {
  seedDatabase()
}

export { seedDatabase }
