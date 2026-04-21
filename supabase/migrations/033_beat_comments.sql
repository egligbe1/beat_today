-- 033_beat_comments.sql
-- Adds social commenting to beats for the discovery feed.

CREATE TABLE public.beat_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  beat_id UUID NOT NULL REFERENCES public.beats(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users_profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indices for performance
CREATE INDEX idx_beat_comments_beat_id ON public.beat_comments(beat_id, created_at DESC);
CREATE INDEX idx_beat_comments_user_id ON public.beat_comments(user_id);

-- Enable RLS
ALTER TABLE public.beat_comments ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Anyone can view comments"
  ON public.beat_comments FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can post comments"
  ON public.beat_comments FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own comments"
  ON public.beat_comments FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own comments"
  ON public.beat_comments FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Function to handle updated_at
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add updated_at trigger
CREATE TRIGGER handle_beat_comments_updated_at
  BEFORE UPDATE ON public.beat_comments
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();
