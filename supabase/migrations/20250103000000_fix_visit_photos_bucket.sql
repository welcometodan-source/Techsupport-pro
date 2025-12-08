-- Fix visit-photos storage bucket
-- This migration ensures the visit-photos bucket exists and is configured correctly

-- Create or update the visit-photos bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'visit-photos',
  'visit-photos',
  true, -- Make it public so getPublicUrl() works
  10485760, -- 10 MB limit
  ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'video/mp4', 'video/mov', 'video/webm']
)
ON CONFLICT (id) DO UPDATE
SET
  public = true,
  file_size_limit = 10485760,
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'video/mp4', 'video/mov', 'video/webm'];

-- Ensure storage policies exist for visit photos
-- Drop existing policies if they exist to avoid conflicts
DROP POLICY IF EXISTS "Authenticated users can upload visit photos" ON storage.objects;
DROP POLICY IF EXISTS "Users can view visit photos they have access to" ON storage.objects;
DROP POLICY IF EXISTS "Technicians and admins can upload visit photos" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view visit photos" ON storage.objects;

-- Policy for uploading visit photos (technicians and admins)
CREATE POLICY "Technicians and admins can upload visit photos"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'visit-photos'
    AND (
      EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.id = auth.uid()
        AND profiles.role IN ('technician', 'admin')
      )
    )
  );

-- Policy for viewing visit photos (all authenticated users can view)
-- Since bucket is public, this allows authenticated users to view
CREATE POLICY "Anyone can view visit photos"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (bucket_id = 'visit-photos');

-- Policy for deleting visit photos (technicians and admins)
CREATE POLICY "Technicians and admins can delete visit photos"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'visit-photos'
    AND (
      EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.id = auth.uid()
        AND profiles.role IN ('technician', 'admin')
      )
    )
  );

