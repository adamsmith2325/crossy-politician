-- Function to get achievement leaderboard (top users by number of achievements)
create or replace function get_achievement_leaderboard(limit_count int default 10)
returns table (
  username text,
  achievement_count bigint
) as $$
begin
  return query
  select
    p.username,
    count(a.achievement_id) as achievement_count
  from public.user_profiles p
  left join public.user_achievements a on p.id = a.user_id
  group by p.id, p.username
  order by count(a.achievement_id) desc, p.username asc
  limit limit_count;
end;
$$ language plpgsql security definer;

-- Grant execute permission to anonymous users
grant execute on function get_achievement_leaderboard(int) to anon;
