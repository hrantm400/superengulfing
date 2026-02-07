-- Subscribers table
CREATE TABLE subscribers (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  first_name VARCHAR(100),
  last_name VARCHAR(100),
  source VARCHAR(100),
  status VARCHAR(20) DEFAULT 'active',
  custom_fields JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Tags table
CREATE TABLE tags (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) UNIQUE NOT NULL,
  color VARCHAR(7) DEFAULT '#39FF14',
  created_at TIMESTAMP DEFAULT NOW()
);

-- Subscriber-Tag relationship
CREATE TABLE subscriber_tags (
  subscriber_id INTEGER REFERENCES subscribers(id) ON DELETE CASCADE,
  tag_id INTEGER REFERENCES tags(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT NOW(),
  PRIMARY KEY (subscriber_id, tag_id)
);

-- Email Templates
CREATE TABLE templates (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  subject VARCHAR(500),
  body TEXT,
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Broadcasts (one-time emails)
CREATE TABLE broadcasts (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255),
  subject VARCHAR(500) NOT NULL,
  body TEXT NOT NULL,
  status VARCHAR(20) DEFAULT 'draft',
  scheduled_at TIMESTAMP,
  sent_at TIMESTAMP,
  sent_count INTEGER DEFAULT 0,
  failed_count INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Sequences (automated email chains)
CREATE TABLE sequences (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  status VARCHAR(20) DEFAULT 'draft',
  created_at TIMESTAMP DEFAULT NOW()
);

-- Sequence Emails (emails in a sequence)
CREATE TABLE sequence_emails (
  id SERIAL PRIMARY KEY,
  sequence_id INTEGER REFERENCES sequences(id) ON DELETE CASCADE,
  position INTEGER NOT NULL,
  subject VARCHAR(500) NOT NULL,
  body TEXT NOT NULL,
  delay_days INTEGER DEFAULT 0,
  delay_hours INTEGER DEFAULT 0,
  send_on_weekends BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Subscriber Sequences (track who is in which sequence)
CREATE TABLE subscriber_sequences (
  id SERIAL PRIMARY KEY,
  subscriber_id INTEGER REFERENCES subscribers(id) ON DELETE CASCADE,
  sequence_id INTEGER REFERENCES sequences(id) ON DELETE CASCADE,
  current_step INTEGER DEFAULT 0,
  status VARCHAR(20) DEFAULT 'active',
  next_email_at TIMESTAMP,
  started_at TIMESTAMP DEFAULT NOW()
);

-- Email Log (track all sent emails)
CREATE TABLE email_log (
  id SERIAL PRIMARY KEY,
  subscriber_id INTEGER REFERENCES subscribers(id),
  email_type VARCHAR(20),
  reference_id INTEGER,
  subject VARCHAR(500),
  status VARCHAR(20),
  sent_at TIMESTAMP DEFAULT NOW()
);

-- Insert default welcome email template
INSERT INTO templates (name, subject, body, is_default) VALUES (
  'Welcome Email',
  '🎯 Your Liquidity Sweep Cheatsheet is Ready!',
  '<h1>Welcome to the Smart Money Club! 🚀</h1><p>Thank you for joining SuperEngulfing.</p><p><a href="{{pdf_link}}">📥 Download Your PDF</a></p>',
  true
);
