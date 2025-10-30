-- Add Google Sheets ID column to companies table
-- This allows each company to have its own Google Spreadsheet
ALTER TABLE "companies" ADD COLUMN "google_sheet_id" varchar;



