select 'users' as table_name, count(*) from app_users union all
select 'songs', count(*) from songs union all
select 'purchases', count(*) from purchases union all
select 'project_access', count(*) from user_project_access union all
select 'passes', count(*) from user_access_passes union all
select 'library', count(*) from user_favorite_songs union all
select 'kiiku', count(*) from kiiku_transactions union all
select 'shares', count(*) from nearby_share_sessions union all
select 'contributions', count(*) from project_contributions;
