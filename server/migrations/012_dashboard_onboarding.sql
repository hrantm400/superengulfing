-- First-time onboarding: certificate flow completed flag
ALTER TABLE dashboard_users ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN DEFAULT false;
