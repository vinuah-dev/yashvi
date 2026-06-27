-- Allow bank transfer payment mode for payments
ALTER TYPE payment_mode ADD VALUE IF NOT EXISTS 'bank';
