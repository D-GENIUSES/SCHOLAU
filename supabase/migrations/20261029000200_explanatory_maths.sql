-- Additive maths content support. Existing content remains valid.
-- Structured teaching and private source synchronization.
create or replace function private.validate_lesson_blocks(p_blocks jsonb)
returns text[]
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_errors text[] := '{}';
  v_block jsonb;
  v_i integer := 0;
  v_type text;
  v_step jsonb;
begin
  if p_blocks is null or jsonb_typeof(p_blocks) <> 'array' then
    return array['blocks must be a JSON array'];
  end if;
  if jsonb_array_length(p_blocks) = 0 then
    return array['blocks must not be empty'];
  end if;
  for v_block in select value from jsonb_array_elements(p_blocks) loop
    v_i := v_i + 1;
    if jsonb_typeof(v_block) <> 'object' then
      v_errors := v_errors || format('block %s: must be an object', v_i);
      continue;
    end if;
    v_type := v_block ->> 'type';
    case v_type
      when 'equation' then
        if jsonb_typeof(v_block->'expression') is distinct from 'string' or coalesce(length(btrim(v_block->>'expression')),0) not between 1 and 4000 then
          v_errors := v_errors || format('block %s: equation.expression must be a nonempty string (max 4000)',v_i);
        end if;
        if v_block ? 'reading' and (jsonb_typeof(v_block->'reading') is distinct from 'string' or coalesce(length(btrim(v_block->>'reading')),0) not between 1 and 4000) then
          v_errors := v_errors || format('block %s: equation.reading must be a nonempty string (max 4000)',v_i);
        end if;
      when 'worked_example' then
        if exists(select 1 from unnest(array['title','problem','answer']) k where jsonb_typeof(v_block->k) is distinct from 'string' or coalesce(length(btrim(v_block->>k)),0) not between 1 and 4000) then
          v_errors := v_errors || format('block %s: worked example title, problem and answer required (max 4000 each)',v_i);
        end if;
        if v_block ? 'answer_reading' and (jsonb_typeof(v_block->'answer_reading') is distinct from 'string' or coalesce(length(btrim(v_block->>'answer_reading')),0) not between 1 and 4000) then
          v_errors := v_errors || format('block %s: invalid answer reading',v_i);
        end if;
        if jsonb_typeof(v_block->'steps') is distinct from 'array' then
          v_errors := v_errors || format('block %s: worked example steps must be an array',v_i);
        elsif jsonb_array_length(v_block->'steps') not between 1 and 30 then
          v_errors := v_errors || format('block %s: worked example needs 1 to 30 steps',v_i);
        else
          for v_step in select value from jsonb_array_elements(v_block->'steps') loop
            if jsonb_typeof(v_step) is distinct from 'object' or exists(select 1 from unnest(array['calculation','explanation']) k where jsonb_typeof(v_step->k) is distinct from 'string' or coalesce(length(btrim(v_step->>k)),0) not between 1 and 4000) then
              v_errors := v_errors || format('block %s: each step needs calculation and explanation (max 4000 each)',v_i);
            end if;
            if v_step ? 'reading' and (jsonb_typeof(v_step->'reading') is distinct from 'string' or coalesce(length(btrim(v_step->>'reading')),0) not between 1 and 4000) then
              v_errors := v_errors || format('block %s: invalid step reading',v_i);
            end if;
          end loop;
        end if;
        if v_block ? 'check' then
          v_step := v_block->'check';
          if jsonb_typeof(v_step) is distinct from 'object' or exists(select 1 from unnest(array['calculation','explanation']) k where jsonb_typeof(v_step->k) is distinct from 'string' or coalesce(length(btrim(v_step->>k)),0) not between 1 and 4000) then
            v_errors := v_errors || format('block %s: check needs calculation and explanation (max 4000 each)',v_i);
          end if;
          if v_step ? 'reading' and (jsonb_typeof(v_step->'reading') is distinct from 'string' or coalesce(length(btrim(v_step->>'reading')),0) not between 1 and 4000) then
            v_errors := v_errors || format('block %s: invalid check reading',v_i);
          end if;
        end if;
      when 'paragraph' then
        if coalesce(length(v_block ->> 'text'), 0) = 0 then
          v_errors := v_errors || format('block %s: paragraph.text required', v_i);
        end if;
      when 'heading' then
        if coalesce(length(v_block ->> 'text'), 0) = 0 then
          v_errors := v_errors || format('block %s: heading.text required', v_i);
        end if;
        if v_block ? 'level' and (jsonb_typeof(v_block -> 'level') <> 'number'
           or (v_block ->> 'level')::numeric not in (2, 3, 4)) then
          v_errors := v_errors || format('block %s: heading.level must be 2, 3 or 4', v_i);
        end if;
      when 'list' then
        if jsonb_typeof(v_block -> 'items') is distinct from 'array' or jsonb_array_length(v_block -> 'items') = 0 then
          v_errors := v_errors || format('block %s: list.items must be a non-empty array', v_i);
        elsif exists (select 1 from jsonb_array_elements(v_block -> 'items') i where jsonb_typeof(i) <> 'string') then
          v_errors := v_errors || format('block %s: list.items must be strings', v_i);
        end if;
      when 'image' then
        if coalesce(length(v_block ->> 'path'), 0) = 0 or coalesce(length(v_block ->> 'alt'), 0) = 0 then
          v_errors := v_errors || format('block %s: image.path and image.alt required', v_i);
        elsif (v_block ->> 'path') ~ '^[a-z]+://' then
          v_errors := v_errors || format('block %s: image.path must be a lesson-assets storage path, not a URL', v_i);
        end if;
      when 'callout' then
        if coalesce(length(v_block ->> 'text'), 0) = 0 then
          v_errors := v_errors || format('block %s: callout.text required', v_i);
        end if;
        if v_block ? 'tone' and (v_block ->> 'tone') not in ('info', 'tip', 'warning', 'example') then
          v_errors := v_errors || format('block %s: callout.tone must be info, tip, warning or example', v_i);
        end if;
      when 'checkpoint' then
        if coalesce(length(v_block->>'question'),0) not between 1 and 2000
          or coalesce(length(v_block->>'explanation'),0) not between 1 and 4000 then
          v_errors := v_errors || format('block %s: checkpoint question and explanation required',v_i);
        end if;
        if jsonb_typeof(v_block->'options') is distinct from 'array' then
          v_errors := v_errors || format('block %s: checkpoint options required',v_i);
        elsif jsonb_array_length(v_block->'options') not between 2 and 6
          or exists(select 1 from jsonb_array_elements(v_block->'options') x where jsonb_typeof(x)<>'string' or length(x #>> '{}')=0)
          or jsonb_typeof(v_block->'correct_index') is distinct from 'number'
          or coalesce(v_block->>'correct_index','') !~ '^[0-5]$' then
          v_errors := v_errors || format('block %s: invalid checkpoint options or answer',v_i);
        elsif (v_block->>'correct_index')::integer >= jsonb_array_length(v_block->'options') then
          v_errors := v_errors || format('block %s: checkpoint answer out of range',v_i);
        end if;
      when 'code' then
        if coalesce(length(v_block ->> 'code'), 0) = 0 then
          v_errors := v_errors || format('block %s: code.code required', v_i);
        end if;
      else
        v_errors := v_errors || format('block %s: unsupported type %s', v_i, coalesce(v_type, '(missing)'));
    end case;
    if v_block::text ~* '<\s*(script|iframe|object|embed|style)' then
      v_errors := v_errors || format('block %s: raw HTML is not allowed', v_i);
    end if;
  end loop;
  return v_errors;
end;
$$;


-- Preserve the existing administrator RPC, grants and transaction behavior, changing only
-- its teaching-example predicate to accept the new structured worked-example block.
do $maths$
declare
  v_definition text;
  v_before text := $predicate$b->>'type'='callout' and b->>'tone'='example'$predicate$;
  v_after text := $predicate$(b->>'type'='worked_example' or (b->>'type'='callout' and b->>'tone'='example'))$predicate$;
begin
  v_definition := pg_get_functiondef('public.admin_sync_course_materials_v1(jsonb,boolean,boolean)'::regprocedure);
  if position(v_before in v_definition) = 0 then
    raise exception 'Maths migration: expected teaching-example predicate was not found';
  end if;
  execute replace(v_definition, v_before, v_after);
end;
$maths$;
