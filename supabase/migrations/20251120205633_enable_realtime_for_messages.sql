/*
  # Enable Realtime for ticket_messages table

  1. Configuration
    - Enable realtime replication for the ticket_messages table
    - This allows real-time subscriptions to work properly
    - Users will see new messages instantly without refreshing
*/

-- Enable realtime for ticket_messages table
ALTER PUBLICATION supabase_realtime ADD TABLE ticket_messages;
