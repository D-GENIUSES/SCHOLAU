-- Repair grants after scoped ingestion (keep older create_material_ingestion_job overload callable).

grant execute on function public.create_material_ingestion_job_v1(uuid,text,text,text,bigint,text,text,text,integer,jsonb,jsonb,boolean,uuid)
  to authenticated;

grant execute on function public.submit_student_material_v1(uuid,text,text,text,text,bigint,text)
  to authenticated;

grant execute on function public.finish_material_ingestion_job_v1(uuid,text,jsonb,text)
  to service_role;
