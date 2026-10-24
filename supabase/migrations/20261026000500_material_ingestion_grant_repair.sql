-- Repair grants if 20261026000100 failed at the GRANT statement (signature typo in original grant).

grant execute on function public.create_material_ingestion_job_v1(uuid,text,text,text,bigint,text,text,text,integer,jsonb,jsonb,boolean,uuid),
  public.get_material_ingestion_job_v1(uuid)
  to authenticated;
