-- Add print settings columns to settings table
ALTER TABLE settings ADD COLUMN IF NOT EXISTS print_paper_size text DEFAULT 'A4' CHECK (print_paper_size IN ('A4','A5'));
ALTER TABLE settings ADD COLUMN IF NOT EXISTS print_show_logo boolean DEFAULT true;
ALTER TABLE settings ADD COLUMN IF NOT EXISTS print_show_seller_contact boolean DEFAULT true;
ALTER TABLE settings ADD COLUMN IF NOT EXISTS print_show_buyer_national_id boolean DEFAULT true;
ALTER TABLE settings ADD COLUMN IF NOT EXISTS print_show_product_code boolean DEFAULT true;
ALTER TABLE settings ADD COLUMN IF NOT EXISTS print_show_tax_column boolean DEFAULT true;
ALTER TABLE settings ADD COLUMN IF NOT EXISTS print_show_discount_column boolean DEFAULT true;
ALTER TABLE settings ADD COLUMN IF NOT EXISTS print_show_previous_balance boolean DEFAULT false;
ALTER TABLE settings ADD COLUMN IF NOT EXISTS print_show_signatures boolean DEFAULT true;
ALTER TABLE settings ADD COLUMN IF NOT EXISTS print_default_notes text[] DEFAULT ARRAY[]::text[];
