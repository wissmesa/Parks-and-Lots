-- Add deposit and down payment fields to lots table
ALTER TABLE lots ADD COLUMN deposit_for_rent NUMERIC(10, 2);
ALTER TABLE lots ADD COLUMN deposit_for_sale NUMERIC(10, 2);
ALTER TABLE lots ADD COLUMN deposit_rent_to_own NUMERIC(10, 2);
ALTER TABLE lots ADD COLUMN deposit_contract_for_deed NUMERIC(10, 2);
ALTER TABLE lots ADD COLUMN down_payment_contract_for_deed NUMERIC(10, 2);

