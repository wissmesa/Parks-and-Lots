-- Add test users for development
-- Password for both users: "password"
-- Hashed with bcrypt (cost 12)

INSERT INTO "users" ("email", "password_hash", "full_name", "role", "is_active", "created_at") VALUES
('developer@example.com', '$2b$12$ggr7g.S3Ov0B686SrwV1L.L54rHh7RQ8PmuqqCy6HPJzA6nXVzyLW', 'Developer Admin', 'ADMIN', true, now()),
('manager@greenvalley.com', '$2b$12$ggr7g.S3Ov0B686SrwV1L.L54rHh7RQ8PmuqqCy6HPJzA6nXVzyLW', 'Green Valley Manager', 'MANAGER', true, now())
ON CONFLICT ("email") DO NOTHING;
