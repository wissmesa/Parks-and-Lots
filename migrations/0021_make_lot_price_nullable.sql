-- Make price nullable in lots table (legacy field, use specific price fields instead)
ALTER TABLE lots ALTER COLUMN price DROP NOT NULL;

