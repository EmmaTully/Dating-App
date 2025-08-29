-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "vector";

-- Users table - core user information
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  phone VARCHAR(20) UNIQUE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  is_active BOOLEAN DEFAULT true,
  is_onboarded BOOLEAN DEFAULT false,
  consent_timestamp TIMESTAMP WITH TIME ZONE,
  quiet_hours_start TIME DEFAULT '21:00',
  quiet_hours_end TIME DEFAULT '08:00',
  timezone VARCHAR(50) DEFAULT 'America/New_York'
);

-- User profiles - demographic and preference data
CREATE TABLE profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  first_name VARCHAR(50),
  date_of_birth DATE,
  city VARCHAR(100),
  zip_code VARCHAR(10),
  bio TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- User preferences for matching
CREATE TABLE preferences (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  orientation VARCHAR(20) CHECK (orientation IN ('straight', 'gay', 'lesbian', 'bisexual', 'pansexual', 'other')),
  preferred_genders TEXT[], -- array of preferred genders
  min_age INTEGER DEFAULT 18,
  max_age INTEGER DEFAULT 100,
  max_distance_miles INTEGER DEFAULT 25,
  dealbreakers TEXT[],
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Conversation answers and insights
CREATE TABLE answers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  category VARCHAR(50), -- 'values', 'lifestyle', 'interests', etc.
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Vector embeddings for semantic matching
CREATE TABLE user_vectors (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  embedding vector(1536), -- OpenAI ada-002 embedding size
  summary TEXT, -- human-readable summary of the user
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Availability windows for same-day matching
CREATE TABLE availability_windows (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  is_available BOOLEAN DEFAULT false,
  preferred_time_start TIME,
  preferred_time_end TIME,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Matches between users
CREATE TABLE matches (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user1_id UUID REFERENCES users(id) ON DELETE CASCADE,
  user2_id UUID REFERENCES users(id) ON DELETE CASCADE,
  status VARCHAR(20) DEFAULT 'proposed' CHECK (status IN ('proposed', 'invited', 'accepted', 'declined', 'expired', 'completed')),
  match_score DECIMAL(3,2),
  proposed_date DATE,
  proposed_time TIME,
  proposed_location_area VARCHAR(100),
  proposed_activity VARCHAR(200),
  user1_response VARCHAR(20) CHECK (user1_response IN ('pending', 'accepted', 'declined')),
  user2_response VARCHAR(20) CHECK (user2_response IN ('pending', 'accepted', 'declined')),
  expires_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user1_id, user2_id, proposed_date)
);

-- Date threads for masked conversations
CREATE TABLE date_threads (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  match_id UUID REFERENCES matches(id) ON DELETE CASCADE,
  twilio_conversation_sid VARCHAR(100),
  proxy_phone_number VARCHAR(20),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  ended_at TIMESTAMP WITH TIME ZONE
);

-- All messages (both to/from Samantha and between matched users)
CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  thread_id UUID REFERENCES date_threads(id) ON DELETE SET NULL,
  direction VARCHAR(10) CHECK (direction IN ('inbound', 'outbound')),
  content TEXT NOT NULL,
  twilio_message_sid VARCHAR(100),
  status VARCHAR(20) DEFAULT 'sent',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- User conversation state for Samantha
CREATE TABLE conversation_states (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  current_state VARCHAR(50) DEFAULT 'new', -- 'new', 'onboarding', 'gathering_preferences', 'active', 'available_tonight'
  context JSONB DEFAULT '{}',
  last_interaction TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Blocks and reports for safety
CREATE TABLE blocks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  blocker_id UUID REFERENCES users(id) ON DELETE CASCADE,
  blocked_id UUID REFERENCES users(id) ON DELETE CASCADE,
  reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(blocker_id, blocked_id)
);

CREATE TABLE reports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  reporter_id UUID REFERENCES users(id) ON DELETE CASCADE,
  reported_id UUID REFERENCES users(id) ON DELETE CASCADE,
  match_id UUID REFERENCES matches(id) ON DELETE SET NULL,
  reason VARCHAR(50),
  description TEXT,
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'resolved')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Audit events for compliance
CREATE TABLE audit_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  event_type VARCHAR(50) NOT NULL,
  event_data JSONB DEFAULT '{}',
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_users_phone ON users(phone);
CREATE INDEX idx_users_active ON users(is_active) WHERE is_active = true;
CREATE INDEX idx_profiles_user_id ON profiles(user_id);
CREATE INDEX idx_preferences_user_id ON preferences(user_id);
CREATE INDEX idx_answers_user_id ON answers(user_id);
CREATE INDEX idx_user_vectors_user_id ON user_vectors(user_id);
CREATE INDEX idx_availability_windows_date ON availability_windows(date, is_available);
CREATE INDEX idx_matches_users ON matches(user1_id, user2_id);
CREATE INDEX idx_matches_status ON matches(status);
CREATE INDEX idx_messages_user_id ON messages(user_id);
CREATE INDEX idx_messages_created_at ON messages(created_at);
CREATE INDEX idx_conversation_states_user_id ON conversation_states(user_id);
CREATE INDEX idx_audit_events_user_id ON audit_events(user_id);
CREATE INDEX idx_audit_events_created_at ON audit_events(created_at);

-- Vector similarity search index
CREATE INDEX idx_user_vectors_embedding ON user_vectors USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- Row Level Security (RLS) policies
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_vectors ENABLE ROW LEVEL SECURITY;
ALTER TABLE availability_windows ENABLE ROW LEVEL SECURITY;
ALTER TABLE matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE date_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversation_states ENABLE ROW LEVEL SECURITY;
ALTER TABLE blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_events ENABLE ROW LEVEL SECURITY;

-- RLS Policies (service role can access all, users can only access their own data)
CREATE POLICY "Service role can access all users" ON users FOR ALL TO service_role USING (true);
CREATE POLICY "Service role can access all profiles" ON profiles FOR ALL TO service_role USING (true);
CREATE POLICY "Service role can access all preferences" ON preferences FOR ALL TO service_role USING (true);
CREATE POLICY "Service role can access all answers" ON answers FOR ALL TO service_role USING (true);
CREATE POLICY "Service role can access all user_vectors" ON user_vectors FOR ALL TO service_role USING (true);
CREATE POLICY "Service role can access all availability_windows" ON availability_windows FOR ALL TO service_role USING (true);
CREATE POLICY "Service role can access all matches" ON matches FOR ALL TO service_role USING (true);
CREATE POLICY "Service role can access all date_threads" ON date_threads FOR ALL TO service_role USING (true);
CREATE POLICY "Service role can access all messages" ON messages FOR ALL TO service_role USING (true);
CREATE POLICY "Service role can access all conversation_states" ON conversation_states FOR ALL TO service_role USING (true);
CREATE POLICY "Service role can access all blocks" ON blocks FOR ALL TO service_role USING (true);
CREATE POLICY "Service role can access all reports" ON reports FOR ALL TO service_role USING (true);
CREATE POLICY "Service role can access all audit_events" ON audit_events FOR ALL TO service_role USING (true);
