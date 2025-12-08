/*
  # Add Payment Method Details for Customers

  1. Changes
    - Add payment method details to admin_settings table
    - These details will be displayed to customers when they select a payment method
    - Each payment method will have its own set of instructions/account details

  2. Payment Methods Covered
    - Bank Transfer (account number, bank name, account holder)
    - Credit/Debit Card (instructions to contact admin)
    - Mobile Money (mobile money number, provider)
    - Cash (instructions for in-person payment)

  3. Security
    - Uses existing RLS policies (anyone authenticated can read)
*/

-- Insert payment method details
INSERT INTO admin_settings (setting_key, setting_value, description)
VALUES 
  (
    'payment_bank_transfer_details',
    '{"bank_name": "Emirates NBD", "account_holder": "AutoSupport Pro LLC", "account_number": "1234567890", "iban": "AE070331234567890123456", "swift_code": "EBILAEAD"}',
    'Bank transfer payment details shown to customers'
  ),
  (
    'payment_credit_card_details',
    '{"message": "Please contact admin to process credit card payment", "contact_phone": "+971525277492", "contact_email": "payments@autosupportpro.com"}',
    'Credit card payment instructions'
  ),
  (
    'payment_debit_card_details',
    '{"message": "Please contact admin to process debit card payment", "contact_phone": "+971525277492", "contact_email": "payments@autosupportpro.com"}',
    'Debit card payment instructions'
  ),
  (
    'payment_mobile_money_details',
    '{"provider": "Du Mobile Money", "mobile_number": "+971525277492", "account_name": "AutoSupport Pro"}',
    'Mobile money payment details'
  ),
  (
    'payment_cash_details',
    '{"message": "Cash payments can be made at our office or to the technician during service visit", "office_address": "Dubai, UAE", "contact_phone": "+971525277492"}',
    'Cash payment instructions'
  )
ON CONFLICT (setting_key) DO NOTHING;