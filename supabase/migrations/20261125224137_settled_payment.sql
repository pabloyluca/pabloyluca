-- Only the payment that fulfilled the order can update its sales ledger.
alter table orders add column settled_payment_id text unique references payments(id);
update orders o set settled_payment_id=(
  select p.id from payments p
  join payment_events e on e.payment_id=p.id and e.order_id=o.id and e.status='approved'
  where p.order_id=o.id and p.amount=o.total and p.currency='MXN'
  order by e.received_at, e.id limit 1
) where paid_at is not null;
