# BlindMatch SMS - SMS-Native Dating App

BlindMatch is an SMS-first dating platform where "Samantha" (an AI matchmaker) learns about users through natural conversation and proactively creates same-day matches.

## 🎯 How It Works

1. **Users text a number** → Samantha responds and starts learning about them
2. **Samantha gathers preferences** → Through natural conversation, not forms
3. **Daily availability check** → "Are you free for a date tonight?"
4. **Smart matching** → AI finds compatible people who are both available
5. **Masked conversations** → If both accept, they can text through a relay number

## 🏗️ Architecture

- **Frontend**: Next.js 14 (App Router, TypeScript)
- **Database**: Supabase (Postgres + RLS + pgvector for embeddings)
- **SMS**: Twilio Programmable Messaging + Proxy for masked relay
- **AI**: OpenAI GPT-4 for Samantha's personality + embeddings for matching
- **Cache/Queue**: Redis for conversation state and rate limiting
- **Deployment**: Vercel or Google Cloud Run

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- Supabase account
- Twilio account
- OpenAI API key
- Redis instance (local or cloud)

### 1. Clone and Install

```bash
git clone <your-repo>
cd Dating-App
npm install
```

### 2. Environment Setup

Copy `env.example` to `.env.local`:

```bash
cp env.example .env.local
```

Fill in your credentials:

```env
# Twilio
TWILIO_ACCOUNT_SID=your_account_sid
TWILIO_AUTH_TOKEN=your_auth_token
TWILIO_PHONE_NUMBER=+1234567890
TWILIO_WEBHOOK_SECRET=your_webhook_secret

# Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# OpenAI
OPENAI_API_KEY=your_openai_key

# Redis
REDIS_URL=redis://localhost:6379

# For cron jobs
CRON_SECRET=your_cron_secret
```

### 3. Database Setup

```bash
# Run migrations
npx supabase db push

# Seed with fake data (40 users across 3 cities)
npm run seed
```

### 4. Twilio Configuration

1. **Buy a phone number** in Twilio Console
2. **Configure webhooks** for your phone number:
   - SMS: `https://your-domain.com/api/webhooks/twilio/sms`
   - Status: `https://your-domain.com/api/webhooks/twilio/status`
3. **Enable signature validation** (recommended for production)

### 5. Run the App

```bash
npm run dev
```

Visit:
- **Admin Dashboard**: http://localhost:3000/admin
- **API Health**: http://localhost:3000/api/health

### 6. Test SMS Flow

1. Text your Twilio number from your phone
2. Samantha should respond and start the onboarding flow
3. Check the admin dashboard to see users and matches

## 📱 SMS Commands

Users can text these commands anytime:

- **STOP** - Unsubscribe from all messages
- **START** - Resubscribe after stopping
- **HELP** - Get help information

## 🤖 Samantha's Personality

Samantha is designed to be:
- **Warm and conversational** (like texting a friend)
- **Concise** (respects SMS character limits)
- **Proactive** (guides conversations toward matching)
- **Values-focused** (learns what matters, not just demographics)
- **Privacy-conscious** (never asks for sensitive info)

## 🔄 Automated Jobs

### Daily Availability Check (4-6 PM)
```bash
curl -X POST https://your-domain.com/api/invite/run \
  -H "Authorization: Bearer your_cron_secret"
```

### Nightly Matching (7-9 PM)
```bash
curl -X POST https://your-domain.com/api/match/run \
  -H "Authorization: Bearer your_cron_secret"
```

Set these up as cron jobs or use Vercel Cron, GitHub Actions, etc.

## 🛡️ Compliance & Safety

### TCPA Compliance
- ✅ Explicit opt-in required (consent_timestamp)
- ✅ STOP/START handling
- ✅ Quiet hours (8 AM - 9 PM local time)
- ✅ Rate limiting (10 messages/minute per user)
- ✅ Audit logging for all SMS events

### 10DLC Registration (Required for US)
1. Register your brand with Twilio
2. Register your campaign (dating/social)
3. Wait for approval (can take 1-2 weeks)
4. Update phone number to use registered campaign

### Data Protection
- All user data encrypted at rest (Supabase)
- Phone numbers never exposed between users
- GDPR/CCPA compliant data handling
- Row Level Security (RLS) enabled

## 🎛️ Admin Features

The admin dashboard (`/admin`) provides:

- **User management** - View all users, activity status
- **Match monitoring** - See active matches and success rates  
- **Manual job triggers** - Run matching/invite jobs manually
- **System stats** - Active users, matches, availability
- **Audit logs** - Full event history for compliance

## 🔧 API Endpoints

### Webhooks
- `POST /api/webhooks/twilio/sms` - Inbound SMS processing
- `POST /api/webhooks/twilio/status` - Delivery status updates

### Cron Jobs  
- `POST /api/invite/run` - Daily availability check
- `POST /api/match/run` - Nightly matching algorithm

### Admin
- `GET /api/admin/users` - List users
- `GET /api/admin/matches` - List matches
- `GET /api/admin/stats` - System statistics

## 🧪 Testing

### Unit Tests
```bash
npm test
```

### Manual Testing
1. Use Twilio's SMS simulator
2. Create test users with the seed script
3. Use admin dashboard to trigger jobs manually

## 🚀 Deployment

### Vercel (Recommended)
```bash
vercel --prod
```

### Google Cloud Run
```bash
gcloud run deploy blindmatch-sms --source .
```

### Environment Variables
Make sure to set all environment variables in your deployment platform.

## 📊 Monitoring

### Key Metrics to Track
- **User acquisition rate** (new signups per day)
- **Onboarding completion** (% who complete profile)
- **Daily active users** (users who respond to availability)
- **Match acceptance rate** (% who say yes to proposed matches)
- **Conversation success** (matches that lead to actual dates)

### Alerts to Set Up
- SMS delivery failures
- OpenAI API errors
- Database connection issues
- Unusual user activity (spam detection)

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📄 License

MIT License - see LICENSE file for details

## 🆘 Support

For issues or questions:
1. Check the admin dashboard for system status
2. Review Twilio webhook logs
3. Check Supabase logs for database issues
4. Monitor OpenAI usage for rate limits

---

**Built with ❤️ for meaningful connections**
