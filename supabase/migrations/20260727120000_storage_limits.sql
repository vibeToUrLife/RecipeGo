-- Harden the recipe-images bucket with server-side guards the client cannot
-- bypass. The `accept="image/*"` filter in the upload component is UX only;
-- these limits are enforced by Storage no matter how the upload is issued
-- (JS SDK, curl, a forged multipart request, etc.).
--
--   * allowed_mime_types — only common web image formats may be stored, so a
--     user can't park .html/.svg/executables in a public bucket.
--   * file_size_limit    — cap each object at 5 MiB to prevent storage abuse.
--
-- Idempotent: a plain UPDATE re-applies cleanly and affects 0 rows if the
-- bucket row does not exist yet.
update storage.buckets
set
  allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp'],
  file_size_limit = 5242880  -- 5 MiB
where id = 'recipe-images';
