-- Add audit logs table for tracking changes to companies, parks, and lots

CREATE TABLE IF NOT EXISTS audit_logs (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type VARCHAR(50) NOT NULL,
  entity_id VARCHAR NOT NULL,
  entity_name VARCHAR,
  action VARCHAR(50) NOT NULL,
  field_name VARCHAR,
  old_value TEXT,
  new_value TEXT,
  user_id VARCHAR REFERENCES users(id) NOT NULL,
  user_name VARCHAR NOT NULL,
  user_role VARCHAR NOT NULL,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS audit_logs_entity_idx ON audit_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS audit_logs_created_at_idx ON audit_logs(created_at);
CREATE INDEX IF NOT EXISTS audit_logs_user_idx ON audit_logs(user_id);


