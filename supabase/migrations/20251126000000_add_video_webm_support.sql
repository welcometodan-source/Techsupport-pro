/*
  # Add video/webm Support to Storage Bucket

  ## Overview
  This migration adds support for video/webm MIME type to the ticket-attachments storage bucket.
  This is needed for instant video recording functionality which uses WebM format.

  ## Changes
  - Add 'video/webm' to allowed_mime_types array in storage bucket
*/

-- Update the storage bucket to include video/webm
UPDATE storage.buckets
SET allowed_mime_types = array_append(
  COALESCE(allowed_mime_types, ARRAY[]::text[]),
  'video/webm'
)
WHERE id = 'ticket-attachments'
AND NOT ('video/webm' = ANY(COALESCE(allowed_mime_types, ARRAY[]::text[])));

