-- First, let's see what duplicates exist
-- This query will show us all duplicate emails and their details
SELECT 
  email,
  COUNT(*) as duplicate_count,
  STRING_AGG(id::text, ', ') as tenant_ids,
  STRING_AGG("firstName" || ' ' || "lastName", ', ') as names,
  STRING_AGG("lotId", ', ') as lot_ids
FROM tenants 
GROUP BY email 
HAVING COUNT(*) > 1
ORDER BY duplicate_count DESC;

-- For now, let's add a temporary unique constraint that allows us to identify the issue
-- We'll need to manually resolve the duplicates first

-- Option 1: Delete the newer duplicate records (keep the oldest)
-- DELETE FROM tenants 
-- WHERE id IN (
--   SELECT id FROM (
--     SELECT id, 
--            ROW_NUMBER() OVER (PARTITION BY email ORDER BY "createdAt" ASC) as rn
--     FROM tenants
--   ) t 
--   WHERE rn > 1
-- );

-- Option 2: Update duplicate emails to be unique by adding a suffix
-- UPDATE tenants 
-- SET email = email || '_duplicate_' || id
-- WHERE id IN (
--   SELECT id FROM (
--     SELECT id, 
--            ROW_NUMBER() OVER (PARTITION BY email ORDER BY "createdAt" ASC) as rn
--     FROM tenants
--   ) t 
--   WHERE rn > 1
-- );
