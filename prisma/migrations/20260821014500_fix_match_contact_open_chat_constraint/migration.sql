ALTER TABLE "matches"
  DROP CONSTRAINT "matches_contact_open_chat_url_check";

ALTER TABLE "matches"
  ADD CONSTRAINT "matches_contact_open_chat_url_check"
  CHECK ("contact_open_chat_url" ~ '^https://open[.]kakao[.]com/');
