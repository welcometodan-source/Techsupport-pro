/*
  # Add Unread Messages Tracking System

  1. New Columns
    - Add `unread_messages_count` to support_tickets table
    - Add `last_message_at` to support_tickets table
    - Add `last_message_by` to support_tickets table
    - Add `read` flag to ticket_messages table

  2. Functions
    - Create function to update unread count when new message is inserted
    - Create trigger to automatically update ticket metadata on new message

  3. Purpose
    - Track unread messages per ticket
    - Show notification badge on tickets with unread messages
    - Help technicians and customers know which tickets need attention
*/

-- Add tracking columns to support_tickets
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'support_tickets' AND column_name = 'unread_by_customer'
  ) THEN
    ALTER TABLE support_tickets ADD COLUMN unread_by_customer integer DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'support_tickets' AND column_name = 'unread_by_technician'
  ) THEN
    ALTER TABLE support_tickets ADD COLUMN unread_by_technician integer DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'support_tickets' AND column_name = 'last_message_at'
  ) THEN
    ALTER TABLE support_tickets ADD COLUMN last_message_at timestamptz;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'support_tickets' AND column_name = 'last_message_by'
  ) THEN
    ALTER TABLE support_tickets ADD COLUMN last_message_by uuid REFERENCES profiles(id);
  END IF;
END $$;

-- Function to update unread message counts
CREATE OR REPLACE FUNCTION update_ticket_unread_counts()
RETURNS TRIGGER AS $$
DECLARE
  ticket_customer_id uuid;
  ticket_technician_id uuid;
BEGIN
  -- Get the ticket's customer and technician
  SELECT customer_id, assigned_technician_id
  INTO ticket_customer_id, ticket_technician_id
  FROM support_tickets
  WHERE id = NEW.ticket_id;

  -- Update last message metadata
  UPDATE support_tickets
  SET 
    last_message_at = NEW.created_at,
    last_message_by = NEW.sender_id,
    -- Increment unread count for the recipient(s)
    unread_by_customer = CASE 
      WHEN NEW.sender_id != ticket_customer_id THEN unread_by_customer + 1
      ELSE unread_by_customer
    END,
    unread_by_technician = CASE 
      WHEN NEW.sender_id != ticket_technician_id THEN unread_by_technician + 1
      ELSE unread_by_technician
    END
  WHERE id = NEW.ticket_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for new messages
DROP TRIGGER IF EXISTS trigger_update_ticket_unread_counts ON ticket_messages;
CREATE TRIGGER trigger_update_ticket_unread_counts
  AFTER INSERT ON ticket_messages
  FOR EACH ROW
  EXECUTE FUNCTION update_ticket_unread_counts();

-- Function to mark messages as read
CREATE OR REPLACE FUNCTION mark_ticket_messages_read(ticket_id_param uuid, user_id_param uuid)
RETURNS void AS $$
DECLARE
  is_customer boolean;
  is_technician boolean;
BEGIN
  -- Check if user is customer or technician for this ticket
  SELECT 
    customer_id = user_id_param,
    assigned_technician_id = user_id_param
  INTO is_customer, is_technician
  FROM support_tickets
  WHERE id = ticket_id_param;

  -- Reset the appropriate unread counter
  UPDATE support_tickets
  SET 
    unread_by_customer = CASE WHEN is_customer THEN 0 ELSE unread_by_customer END,
    unread_by_technician = CASE WHEN is_technician THEN 0 ELSE unread_by_technician END
  WHERE id = ticket_id_param;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION mark_ticket_messages_read TO authenticated;
