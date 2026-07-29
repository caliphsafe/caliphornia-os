-- Optional safe seeds. Edit amounts in Admin after install. Uses slugs only to find canonical IDs.
insert into projects (slug, name, description, status)
values
  ('fartherhood', 'FarTHErHOOD', 'A notes-based music and story experience.', 'active'),
  ('friends', 'fri.ends', 'A message-based music experience.', 'active'),
  ('milia', 'Milia', 'A weather-based music experience.', 'active'),
  ('music', 'Music', 'The Caliphornia OS listening hub.', 'active'),
  ('stats', 'Stats', 'Activity and ecosystem insights.', 'active')
on conflict (slug) do update set name = excluded.name, description = excluded.description;

insert into kiiku_rules (rule_key, rule_type, action_type, credit_amount, status, metadata)
values
  ('guest-account-claim-default', 'earn', 'guest_account_claim', 5, 'active', '{"editable_in_admin":true}'),
  ('qualified-share-default', 'earn', 'qualified_share', 10, 'active', '{"editable_in_admin":true}'),
  ('project-unlock-spend-default', 'spend', 'project_unlock', 0, 'draft', '{"editable_in_admin":true}')
on conflict (rule_key) do nothing;

insert into sharing_rules (rule_key, product_type, shares_included, consumption_point, status, metadata)
values
  ('project-purchase-shares-default', 'project_unlock', 2, 'qualified_listen', 'active', '{"editable_in_admin":true}'),
  ('song-purchase-shares-default', 'song_unlock', 1, 'qualified_listen', 'active', '{"editable_in_admin":true}')
on conflict (rule_key) do nothing;
