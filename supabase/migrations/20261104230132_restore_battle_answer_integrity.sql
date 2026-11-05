-- Restore integrity and importer validation retained by the multiple-choice format.
begin;
alter table public.battle_answers
  add constraint battle_answers_option_id_question_version_id_fkey
  foreign key (option_id,question_version_id) references public.question_options(id,question_version_id);
-- NULL option IDs for fill-in-gap answers remain valid under MATCH SIMPLE.
do $migration$
declare definition text; validation text;
begin
  definition := pg_get_functiondef('public.admin_import_questions_v1(jsonb,boolean,uuid)'::regprocedure);
  validation := $validation$
        if coalesce(v_row->>'battle_seconds','') not in ('','5','8','10','12','15') then
          v_errors:=v_errors||jsonb_build_object('row',v_i,'field','battle_seconds','message','Use 5, 8, 10, 12 or 15 seconds');
        end if;
        if coalesce(v_row->>'battle_reading_seconds','')<>'' and (v_row->>'battle_reading_seconds') !~ '^(2|3|4|5|6|7|8|9|10|11|12)$' then
          v_errors:=v_errors||jsonb_build_object('row',v_i,'field','battle_reading_seconds','message','Use 2–12 seconds for reading');
        end if;
        for v_opt in select value from jsonb_array_elements(v_options) loop
          if jsonb_typeof(coalesce(v_opt->'steps','[]'::jsonb))<>'array' then
            v_errors:=v_errors||jsonb_build_object('row',v_i,'field','steps','message','steps must be an array of short strings');
          else
            if jsonb_array_length(coalesce(v_opt->'steps','[]'::jsonb))>6 or exists(
              select 1 from jsonb_array_elements(coalesce(v_opt->'steps','[]'::jsonb)) s
              where jsonb_typeof(s)<>'string' or length(btrim(s#>>'{}')) not between 1 and 240
            ) then v_errors:=v_errors||jsonb_build_object('row',v_i,'field','steps','message','Use at most six nonempty steps of up to 240 characters'); end if;
            if v_format='worked_solution' and jsonb_array_length(coalesce(v_opt->'steps','[]'::jsonb))=0 then
              v_errors:=v_errors||jsonb_build_object('row',v_i,'field','steps','message','Each worked solution needs calculation steps');
            end if;
          end if;
        end loop;
$validation$;
  if position('if v_pass = 1 then' in definition)=0 then raise exception 'Question importer validation anchor missing'; end if;
  definition := replace(definition,'if v_pass = 1 then','if v_pass = 1 then'||validation);
  definition := replace(definition,'''row_count'', jsonb_array_length(p_rows), ''errors'', v_errors, ''created'', v_created',
    '''row_count'', jsonb_array_length(p_rows), ''errors'', v_errors, ''created'', v_created, ''error_count'', jsonb_array_length(v_errors), ''imported'', jsonb_array_length(v_created)>0');
  execute definition;
end $migration$;
commit;
