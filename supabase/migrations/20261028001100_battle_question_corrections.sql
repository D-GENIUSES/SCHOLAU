-- Participant-only corrections for finalized battle questions.
create function public.get_battle_correction_v1(p_battle_id uuid,p_position integer)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare viewer uuid:=private.require_user(); battle_state text; result jsonb;
begin
 perform private.assert_client_supported();
 select b.state into battle_state from public.battles b join public.battle_participants p on p.battle_id=b.id and p.user_id=viewer where b.id=p_battle_id;
 if not found then perform private.raise_error('NOT_FOUND'); end if;
 if battle_state not in ('finished','voided') then perform private.raise_error('INVALID_STATE','Corrections are available after the battle ends.'); end if;
 select jsonb_build_object('position',bq.position,'answer_format',qv.answer_format,
 'my_answer',coalesce(mine.text_answer,selected.body),
 'correct_answer',case when qv.answer_format='fill_in_gap' then
   (select string_agg(g.value->'accepted_answers'->>0,'; ' order by g.n) from jsonb_array_elements(k.gap_answers) with ordinality g(value,n))
   else correct.body end,
 'steps',coalesce(to_jsonb(correct.steps),'[]'::jsonb),'explanation',k.explanation)
 into result from public.battle_questions bq join public.question_versions qv on qv.id=bq.question_version_id
 join private.question_answer_keys k on k.question_version_id=qv.id
 left join public.question_options correct on correct.id=k.correct_option_id and correct.question_version_id=qv.id
 left join public.battle_answers mine on mine.battle_id=bq.battle_id and mine.position=bq.position and mine.user_id=viewer
 left join public.question_options selected on selected.id=mine.option_id and selected.question_version_id=qv.id
 where bq.battle_id=p_battle_id and bq.position=p_position;
 if result is null then perform private.raise_error('CONTENT_UNAVAILABLE'); end if;
 return private.envelope(result);
end $$;
revoke all on function public.get_battle_correction_v1(uuid,integer) from public,anon,authenticated,service_role;
grant execute on function public.get_battle_correction_v1(uuid,integer) to authenticated;

-- Distinguish submitted text answers from unanswered rounds in the existing result payload.
do $$ declare body text; begin
 body:=pg_get_functiondef('private.battle_payload(uuid,uuid)'::regprocedure);
 if position('''my_text_answer''' in body)=0 then
  if position('''my_option_id'', mine.option_id,' in body)=0 then raise exception 'Battle round payload marker missing'; end if;
  body:=replace(body,'''my_option_id'', mine.option_id,','''my_option_id'', mine.option_id, ''my_text_answer'', mine.text_answer,');
  execute body;
 end if;
end $$;
