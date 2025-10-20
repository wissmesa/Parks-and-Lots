-- Add imageData column to photos table to store images as BLOB
ALTER TABLE photos ADD COLUMN image_data BYTEA;
ALTER TABLE photos ADD COLUMN mime_type VARCHAR(50);
