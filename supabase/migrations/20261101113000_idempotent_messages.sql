-- REVIEW / SPECIFIC APPROVAL REQUIRED. Additive only: no deletes, resets,
-- balance changes, historical message rewrites or replacement of existing tables.
-- The index can briefly block message writes; apply in a quiet traffic window.
BEGIN;
DO $$ BEGIN
 IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid='public.messages'::regclass)
 OR NOT (SELECT relrowsecurity FROM pg_class WHERE oid='public.conversations'::regclass)
 OR NOT (SELECT relrowsecurity FROM pg_class WHERE oid='public.notifications'::regclass) THEN
  RAISE EXCEPTION 'Messaging RLS must remain enabled';
 END IF;
 IF has_table_privilege('authenticated','public.messages','INSERT')
 OR has_table_privilege('authenticated','public.conversations','INSERT') THEN
  RAISE EXCEPTION 'Apply the separately approved realtime access restrictions first';
 END IF;
END $$;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS client_request_id UUID;
CREATE UNIQUE INDEX IF NOT EXISTS messages_sender_request_unique
 ON public.messages(sender_id,client_request_id) WHERE client_request_id IS NOT NULL;

-- Identity comes from auth.uid(), never from a caller-supplied sender ID.
-- One transaction creates the message, its alert and the conversation timestamp.
CREATE OR REPLACE FUNCTION public.send_message_once(
 p_request UUID,p_content TEXT,p_conversation UUID DEFAULT NULL,p_recipient UUID DEFAULT NULL
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE
 v_user UUID := auth.uid(); v_conv public.conversations%ROWTYPE;
 v_message public.messages%ROWTYPE; v_other UUID; v_name TEXT; v_content TEXT := btrim(p_content);
 v_first UUID; v_second UUID;
BEGIN
 IF v_user IS NULL THEN RAISE EXCEPTION 'Sign in to send messages' USING ERRCODE='42501'; END IF;
 IF p_request IS NULL OR v_content IS NULL OR length(v_content)<1 OR length(v_content)>5000
 OR (p_conversation IS NULL AND (p_recipient IS NULL OR p_recipient=v_user)) THEN
  RAISE EXCEPTION 'Invalid message';
 END IF;
 -- Serialize retries for this sender/key, including requests racing before INSERT.
 PERFORM pg_advisory_xact_lock(hashtextextended(v_user::TEXT || ':' || p_request::TEXT,0));
 SELECT * INTO v_message FROM public.messages WHERE sender_id=v_user AND client_request_id=p_request;
 IF FOUND THEN
  SELECT * INTO v_conv FROM public.conversations WHERE id=v_message.conversation_id;
  IF v_message.content<>v_content OR (p_conversation IS NOT NULL AND p_conversation<>v_conv.id)
   OR (p_recipient IS NOT NULL AND p_recipient<>CASE WHEN v_conv.participant_1=v_user THEN v_conv.participant_2 ELSE v_conv.participant_1 END) THEN
   RAISE EXCEPTION 'Request key already used for another message';
  END IF;
  RETURN jsonb_build_object('message',to_jsonb(v_message),'conversation_id',v_conv.id);
 END IF;
 IF NOT public.consume_request_limit('send-message:' || v_user::TEXT,30,60) THEN
  RAISE EXCEPTION 'Please wait before sending another message' USING ERRCODE='P0429';
 END IF;
 IF p_conversation IS NOT NULL THEN
  SELECT * INTO v_conv FROM public.conversations WHERE id=p_conversation FOR UPDATE;
  IF NOT FOUND OR v_user NOT IN(v_conv.participant_1,v_conv.participant_2) THEN
   RAISE EXCEPTION 'Conversation not found' USING ERRCODE='42501';
  END IF;
 ELSE
  v_first:=LEAST(v_user,p_recipient);v_second:=GREATEST(v_user,p_recipient);
  INSERT INTO public.conversations AS c(participant_1,participant_2) VALUES(v_first,v_second)
   ON CONFLICT(participant_1,participant_2) DO UPDATE SET last_message_at=c.last_message_at
   RETURNING * INTO v_conv;
 END IF;
 v_other:=CASE WHEN v_conv.participant_1=v_user THEN v_conv.participant_2 ELSE v_conv.participant_1 END;
 IF p_recipient IS NOT NULL AND p_recipient<>v_other THEN RAISE EXCEPTION 'Recipient does not match conversation'; END IF;
 INSERT INTO public.messages(conversation_id,sender_id,content,client_request_id)
  VALUES(v_conv.id,v_user,v_content,p_request) RETURNING * INTO v_message;
 UPDATE public.conversations SET last_message_at=v_message.created_at WHERE id=v_conv.id;
 SELECT display_name INTO v_name FROM public.users_profiles WHERE id=v_user;
 INSERT INTO public.notifications(user_id,type,title,body,link,metadata) VALUES(
  v_other,'new_message','New Message',coalesce(v_name,'Someone') || ': ' || left(v_content,60) || CASE WHEN length(v_content)>60 THEN '...' ELSE '' END,
  '/messages/' || v_conv.id::TEXT,jsonb_build_object('conversation_id',v_conv.id,'message_id',v_message.id)
 );
 RETURN jsonb_build_object('message',to_jsonb(v_message),'conversation_id',v_conv.id);
END $$;
REVOKE ALL ON FUNCTION public.send_message_once(UUID,TEXT,UUID,UUID) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.send_message_once(UUID,TEXT,UUID,UUID) TO authenticated;
COMMIT;
