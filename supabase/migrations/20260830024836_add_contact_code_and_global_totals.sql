-- Add contact code (کد شخص) column
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS code integer;

-- Add an index for code lookups
CREATE INDEX IF NOT EXISTS contacts_code_idx ON contacts (code);

-- Add global discount/tax fields to invoices for percentage-based totals
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS global_discount_type text DEFAULT 'amount' CHECK (global_discount_type IN ('amount','percent'));
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS global_discount_value numeric(14,2) DEFAULT 0;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS global_tax_type text DEFAULT 'amount' CHECK (global_tax_type IN ('amount','percent'));
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS global_tax_value numeric(14,2) DEFAULT 0;
