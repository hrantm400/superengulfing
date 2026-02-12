-- Job queue for broadcast (and optionally sequence) sends. Processed by background worker; no Redis required.
CREATE TABLE IF NOT EXISTS email_send_jobs (
    id SERIAL PRIMARY KEY,
    job_type VARCHAR(20) NOT NULL DEFAULT 'broadcast',
    reference_id INTEGER NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    retry_count INTEGER DEFAULT 0,
    max_retries INTEGER DEFAULT 3,
    error_message TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    payload JSONB
);
CREATE INDEX IF NOT EXISTS idx_email_send_jobs_status ON email_send_jobs(status);
CREATE INDEX IF NOT EXISTS idx_email_send_jobs_created ON email_send_jobs(created_at);
