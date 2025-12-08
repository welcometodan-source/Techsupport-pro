/*
  # Fix Ticket Attachments Upload Policy

  1. Changes
    - Update the INSERT policy for ticket_attachments to allow both customers and technicians to upload files
    - Customers can upload to their own tickets
    - Technicians can upload to tickets assigned to them
    - Admins can upload to any ticket

  2. Security
    - Users can only upload attachments with their own user_id
    - Access is verified through ticket ownership or assignment
*/

-- Drop the existing restrictive policy
DROP POLICY IF EXISTS "Users can upload attachments to their tickets" ON ticket_attachments;

-- Create new policy that allows customers, technicians, and admins to upload
CREATE POLICY "Users can upload attachments to tickets they have access to"
  ON ticket_attachments FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND (
      -- Customer can upload to their own tickets
      EXISTS (
        SELECT 1 FROM support_tickets
        WHERE support_tickets.id = ticket_attachments.ticket_id
        AND support_tickets.customer_id = auth.uid()
      )
      OR
      -- Technician can upload to tickets assigned to them
      EXISTS (
        SELECT 1 FROM support_tickets
        WHERE support_tickets.id = ticket_attachments.ticket_id
        AND support_tickets.assigned_technician_id = auth.uid()
      )
      OR
      -- Admin can upload to any ticket
      EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.id = auth.uid()
        AND profiles.role = 'admin'
      )
    )
  );
