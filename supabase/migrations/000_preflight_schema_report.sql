-- Run first. This does not modify data.
select 'app_users' as table_name, count(*) from app_users union all
select 'songs', count(*) from songs union all
select 'projects', count(*) from projects union all
select 'purchases', count(*) from purchases union all
select 'user_project_access', count(*) from user_project_access union all
select 'user_access_passes', count(*) from user_access_passes union all
select 'user_favorite_songs', count(*) from user_favorite_songs union all
select 'event_logs', count(*) from event_logs;

select 'duplicate_app_user_email' as check_name, email, count(*) from app_users group by email having count(*) > 1;
select 'duplicate_song_slug' as check_name, slug, count(*) from songs group by slug having count(*) > 1;
select 'duplicate_project_slug' as check_name, slug, count(*) from projects group by slug having count(*) > 1;
