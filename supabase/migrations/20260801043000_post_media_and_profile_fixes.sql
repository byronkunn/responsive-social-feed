alter table public.posts
add column media_urls text[] not null default '{}'::text[];

update public.posts
set
  media_urls = coalesce(
    (
      select array_agg(match[1])
      from regexp_matches(body, '!\[Image\]\((.*?)\)', 'g') as match
    ),
    '{}'::text[]
  ),
  body = btrim(
    regexp_replace(
      regexp_replace(body, '!\[Image\]\((.*?)\)', '', 'g'),
      E'\n{3,}',
      E'\n\n',
      'g'
    )
  )
where body like '%![Image](%';

alter table public.posts
drop constraint posts_body_check;

alter table public.posts
add constraint posts_body_check check (
  char_length(body) <= 280
  and coalesce(array_length(media_urls, 1), 0) <= 20
  and (char_length(body) >= 1 or coalesce(array_length(media_urls, 1), 0) > 0)
);