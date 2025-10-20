-- Make park_id nullable in lots table to allow creating lots without park assignment
ALTER TABLE lots ALTER COLUMN park_id DROP NOT NULL;

