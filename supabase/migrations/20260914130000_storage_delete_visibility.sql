-- Storage delete operations need SELECT visibility before Supabase can remove
-- an object. Keep untrusted/discarding bytes hidden from reads and listings,
-- while exposing their metadata only during the exact Storage delete routes.
drop policy if exists attachment_objects_select on storage.objects;

create policy attachment_objects_select on storage.objects
for select to authenticated
using (
  bucket_id = 'attachments'
  and (
    public.can_read_storage_object(name)
    or (
      storage.allow_any_operation(array[
        'storage.object.delete',
        'storage.object.delete_many'
      ])
      and public.can_delete_storage_object(name)
    )
  )
);
