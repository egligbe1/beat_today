-- Rename reviews table to beat_reviews
ALTER TABLE IF EXISTS reviews RENAME TO beat_reviews;

-- Rename buyer_id to reviewer_id if it exists
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'beat_reviews' AND column_name = 'buyer_id') THEN
    ALTER TABLE beat_reviews RENAME COLUMN buyer_id TO reviewer_id;
  END IF;
END $$;

-- Drop old policies if they exist (they might have been renamed with the table or contain old references)
DROP POLICY IF EXISTS "Public can view reviews" ON beat_reviews;
DROP POLICY IF EXISTS "Buyers can create reviews" ON beat_reviews;
DROP POLICY IF EXISTS "Reviewers can update their own reviews" ON beat_reviews;

-- Create updated policies
CREATE POLICY "Public can view beat reviews"
  ON beat_reviews FOR SELECT
  USING (true);

CREATE POLICY "Buyers can create reviews"
  ON beat_reviews FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM order_items oi
      JOIN orders o ON o.id = oi.order_id
      WHERE oi.beat_id = beat_reviews.beat_id
      AND o.buyer_id = auth.uid()
      AND o.status = 'completed'
    )
  );

CREATE POLICY "Reviewers can update their own reviews"
  ON beat_reviews FOR UPDATE
  TO authenticated
  USING (reviewer_id = auth.uid());

CREATE POLICY "Reviewers can delete their own reviews"
  ON beat_reviews FOR DELETE
  TO authenticated
  USING (reviewer_id = auth.uid());
