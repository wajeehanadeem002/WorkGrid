alter type public.attachment_status add value if not exists 'verifying';
alter type public.attachment_status add value if not exists 'deleting';
alter type public.attachment_status add value if not exists 'discarding';
