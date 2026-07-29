select 'purchases_missing_user_id' as check_name, count(*) from purchases where user_email is not null and user_id is null;
select 'access_missing_user_id' as check_name, count(*) from user_project_access where user_email is not null and user_id is null;
select 'favorites_missing_user_id' as check_name, count(*) from user_favorite_songs where user_email is not null and user_id is null;
select 'favorites_missing_song_id' as check_name, count(*) from user_favorite_songs where song_slug is not null and song_id is null;
select 'event_logs_missing_song_id' as check_name, count(*) from event_logs where song_slug is not null and song_id is null;
select 'duplicate_active_favorites' as check_name, user_id, song_id, count(*) from user_favorite_songs where status = 'active' and user_id is not null and song_id is not null group by user_id, song_id having count(*) > 1;
select 'duplicate_webhook_events' as check_name, id, count(*) from stripe_webhook_events group by id having count(*) > 1;
