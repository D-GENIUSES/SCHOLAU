begin;

create or replace function private.quiz_build_shuffle(p_questions jsonb, p_seed text)
returns table(question_order integer[], option_orders jsonb)
language plpgsql
immutable
set search_path = ''
as $$
declare
  n integer := jsonb_array_length(p_questions);
  qo integer[];
  oo jsonb := '[]'::jsonb;
  i integer;
  opts integer[];
  option_count integer;
begin
  if n < 1 then
    question_order := array[]::integer[];
    option_orders := '[]'::jsonb;
    return next;
    return;
  end if;

  qo := array(
    select s - 1
    from generate_series(1, n) s
    order by md5(p_seed || ':q:' || (s - 1)::text)
  );

  for i in 0..(n - 1) loop
    option_count := case
      when jsonb_typeof(p_questions->i->'options') = 'array'
        then jsonb_array_length(p_questions->i->'options')
      else 0
    end;
    opts := array(
      select s - 1
      from generate_series(1, option_count) s
      order by md5(p_seed || ':o:' || i::text || ':' || (s - 1)::text)
    );
    oo := oo || jsonb_build_array(to_jsonb(opts));
  end loop;

  question_order := qo;
  option_orders := oo;
  return next;
end;
$$;

revoke all on function private.quiz_build_shuffle(jsonb, text) from public, anon, authenticated;

commit;
