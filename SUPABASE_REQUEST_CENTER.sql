-- Request Center upgrade for queued POS approvals.
-- Run this after the original order_edit_requests table has been created.

alter table public.order_edit_requests
  add column if not exists request_type text;

update public.order_edit_requests
set request_type = case
  when lower(coalesce(requested_by, '')) like '%cancel order%' then 'cancel'
  else 'edit'
end
where request_type is null;

alter table public.order_edit_requests
  alter column request_type set default 'edit';

alter table public.order_edit_requests
  alter column request_type set not null;

alter table public.order_edit_requests
  drop constraint if exists order_edit_requests_request_type_check;

alter table public.order_edit_requests
  add constraint order_edit_requests_request_type_check
  check (request_type in ('edit', 'cancel'));

alter table public.order_edit_requests
  drop constraint if exists order_edit_requests_status_check;

alter table public.order_edit_requests
  add constraint order_edit_requests_status_check
  check (status in ('pending', 'approved', 'rejected', 'cancelled', 'expired'));
