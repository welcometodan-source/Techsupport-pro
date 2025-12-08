/*
  # Add Ratings & Reviews System

  1. New Tables
    - `reviews`
      - `id` (uuid, primary key)
      - `ticket_id` (uuid, foreign key to support_tickets)
      - `reviewer_id` (uuid, foreign key to profiles) - person giving review
      - `reviewee_id` (uuid, foreign key to profiles) - person being reviewed
      - `rating` (integer, 1-5)
      - `comment` (text, optional)
      - `review_type` (text) - customer_to_technician or technician_to_customer
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
    
    - `rating_stats`
      - `id` (uuid, primary key)
      - `user_id` (uuid, foreign key to profiles)
      - `average_rating` (numeric)
      - `total_reviews` (integer)
      - `five_star_count` (integer)
      - `four_star_count` (integer)
      - `three_star_count` (integer)
      - `two_star_count` (integer)
      - `one_star_count` (integer)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS on all tables
    - Users can create reviews for their completed tickets
    - Users can view reviews they gave or received
    - Everyone can view rating stats (public profiles)
*/

-- Create reviews table
CREATE TABLE IF NOT EXISTS reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid REFERENCES support_tickets(id) ON DELETE CASCADE NOT NULL,
  reviewer_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  reviewee_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  rating integer NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment text,
  review_type text NOT NULL CHECK (review_type IN ('customer_to_technician', 'technician_to_customer')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(ticket_id, reviewer_id, review_type)
);

-- Create rating stats table
CREATE TABLE IF NOT EXISTS rating_stats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL UNIQUE,
  average_rating numeric DEFAULT 0,
  total_reviews integer DEFAULT 0,
  five_star_count integer DEFAULT 0,
  four_star_count integer DEFAULT 0,
  three_star_count integer DEFAULT 0,
  two_star_count integer DEFAULT 0,
  one_star_count integer DEFAULT 0,
  updated_at timestamptz DEFAULT now()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_reviews_ticket ON reviews(ticket_id);
CREATE INDEX IF NOT EXISTS idx_reviews_reviewee ON reviews(reviewee_id);
CREATE INDEX IF NOT EXISTS idx_reviews_reviewer ON reviews(reviewer_id);
CREATE INDEX IF NOT EXISTS idx_rating_stats_user ON rating_stats(user_id);

-- Enable RLS
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE rating_stats ENABLE ROW LEVEL SECURITY;

-- Reviews policies
CREATE POLICY "Users can view reviews they gave or received"
  ON reviews FOR SELECT
  TO authenticated
  USING (
    reviewer_id = auth.uid() 
    OR reviewee_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Users can create reviews for their tickets"
  ON reviews FOR INSERT
  TO authenticated
  WITH CHECK (
    reviewer_id = auth.uid()
    AND
    EXISTS (
      SELECT 1 FROM support_tickets
      WHERE support_tickets.id = reviews.ticket_id
      AND support_tickets.status IN ('resolved', 'closed')
      AND (
        (support_tickets.customer_id = auth.uid() AND reviews.review_type = 'customer_to_technician')
        OR
        (support_tickets.assigned_technician_id = auth.uid() AND reviews.review_type = 'technician_to_customer')
      )
    )
  );

CREATE POLICY "Users can update their own reviews"
  ON reviews FOR UPDATE
  TO authenticated
  USING (reviewer_id = auth.uid())
  WITH CHECK (reviewer_id = auth.uid());

-- Rating stats policies
CREATE POLICY "Everyone can view rating stats"
  ON rating_stats FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "System can manage rating stats"
  ON rating_stats FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "System can update rating stats"
  ON rating_stats FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Function to update rating stats
CREATE OR REPLACE FUNCTION update_rating_stats()
RETURNS TRIGGER AS $$
DECLARE
  target_user_id uuid;
BEGIN
  IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
    target_user_id := NEW.reviewee_id;
  ELSE
    target_user_id := OLD.reviewee_id;
  END IF;

  INSERT INTO rating_stats (user_id, average_rating, total_reviews, five_star_count, four_star_count, three_star_count, two_star_count, one_star_count, updated_at)
  SELECT 
    target_user_id,
    ROUND(AVG(rating)::numeric, 2),
    COUNT(*),
    COUNT(*) FILTER (WHERE rating = 5),
    COUNT(*) FILTER (WHERE rating = 4),
    COUNT(*) FILTER (WHERE rating = 3),
    COUNT(*) FILTER (WHERE rating = 2),
    COUNT(*) FILTER (WHERE rating = 1),
    now()
  FROM reviews
  WHERE reviewee_id = target_user_id
  ON CONFLICT (user_id) DO UPDATE SET
    average_rating = EXCLUDED.average_rating,
    total_reviews = EXCLUDED.total_reviews,
    five_star_count = EXCLUDED.five_star_count,
    four_star_count = EXCLUDED.four_star_count,
    three_star_count = EXCLUDED.three_star_count,
    two_star_count = EXCLUDED.two_star_count,
    one_star_count = EXCLUDED.one_star_count,
    updated_at = EXCLUDED.updated_at;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update rating stats on review changes
DROP TRIGGER IF EXISTS update_rating_stats_on_review ON reviews;
CREATE TRIGGER update_rating_stats_on_review
  AFTER INSERT OR UPDATE OR DELETE ON reviews
  FOR EACH ROW
  EXECUTE FUNCTION update_rating_stats();