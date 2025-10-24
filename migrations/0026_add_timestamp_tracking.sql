-- Add timestamp tracking columns to companies, parks, and lots tables

-- Add updated_at to companies table
ALTER TABLE companies ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW() NOT NULL;

-- Add updated_at to parks table
ALTER TABLE parks ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW() NOT NULL;

-- Add created_at to lots table
ALTER TABLE lots ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW() NOT NULL;

-- Add updated_at to lots table
ALTER TABLE lots ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW() NOT NULL;

