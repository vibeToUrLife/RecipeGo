-- Allow an optional photo per cooking step.
alter table public.steps add column image_path text;
