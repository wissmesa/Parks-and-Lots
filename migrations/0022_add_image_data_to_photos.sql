-- Add imageData column to photos table to store images as base64 text
ALTER TABLE photos ADD COLUMN IF NOT EXISTS image_data TEXT;
ALTER TABLE photos ADD COLUMN IF NOT EXISTS mime_type VARCHAR(50);
