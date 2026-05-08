-- Enable pg_cron for scheduling
create extension if not exists pg_cron;

-- 1. Profiles Table (Extends Auth)
create table lic_profiles (
  id uuid references auth.users on delete cascade primary key,
  full_name text,
  tenant_id uuid default auth.uid(),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 2. Leads Table
create table lic_leads (
  id uuid default gen_random_uuid() primary key,
  tenant_id uuid default auth.uid(),
  name text not null,
  email text,
  phone text,
  source text,
  status text check (status in ('new', 'contacted', 'converted', 'lost')) default 'new',
  notes text,
  reminder_date timestamp with time zone,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 3. Policies Table
create table lic_policies (
  id uuid default gen_random_uuid() primary key,
  tenant_id uuid default auth.uid(),
  lead_id uuid references lic_leads(id) on delete set null,
  policy_name text not null,
  premium_amount decimal(12,2) not null,
  start_date date not null,
  maturity_date date not null,
  renewal_cycle text default 'annual',
  reminder_offset_days int default 30,
  status text check (status in ('active', 'closed')) default 'active',
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 4. Reminders Table
create table lic_reminders (
  id uuid default gen_random_uuid() primary key,
  tenant_id uuid default auth.uid(),
  policy_id uuid references lic_policies(id) on delete cascade,
  reminder_date date not null,
  status text check (status in ('pending', 'sent', 'failed', 'closed')) default 'pending',
  retry_count int default 0,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 5. Notifications Log
create table lic_notifications (
  id uuid default gen_random_uuid() primary key,
  tenant_id uuid default auth.uid(),
  lead_id uuid references lic_leads(id),
  type text default 'email',
  message text,
  status text,
  error_log text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 6. Row Level Security (RLS) - Multi-tenancy
alter table lic_leads disable row level security;
alter table lic_policies disable row level security;
alter table lic_reminders disable row level security;
alter table lic_notifications disable row level security;

-- 7. Indexes
create index idx_lic_leads_tenant on lic_leads(tenant_id);
create index idx_lic_policies_maturity on lic_policies(maturity_date);
create index idx_lic_reminders_status_date on lic_reminders(status, reminder_date);

-- 8. Automated Logic: Create reminder when policy is created
create or replace function fn_handle_policy_reminder_sync()
returns trigger as $$
begin
  if (TG_OP = 'INSERT') then
    insert into lic_reminders (tenant_id, policy_id, reminder_date, status)
    values (
      new.tenant_id,
      new.id,
      (new.maturity_date - (new.reminder_offset_days || ' days')::interval)::date,
      'pending'
    );
  elsif (TG_OP = 'UPDATE') then
    -- Synchronize the reminder date if the maturity_date or offset changes, 
    -- but only for reminders that haven't been sent yet (status = 'pending').
    update lic_reminders
    set reminder_date = (new.maturity_date - (new.reminder_offset_days || ' days')::interval)::date
    where policy_id = new.id and status = 'pending';
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists tr_after_policy_insert on lic_policies;
drop trigger if exists tr_policy_reminder_sync on lic_policies;
create trigger tr_policy_reminder_sync
after insert or update on lic_policies
for each row execute function fn_handle_policy_reminder_sync();

-- 9. Cron Job Setup
-- Replace <PROJECT_REF> and <SERVICE_ROLE_KEY> in the dashboard or via CLI env vars
select cron.schedule(
  'daily-reminder-job',
  '0 7 * * *', -- 7 AM daily
  $$ select net.http_post(
      url:='https://<PROJECT_REF>.functions.supabase.co/send-reminders',
      headers:='{"Content-Type": "application/json", "Authorization": "Bearer <SERVICE_ROLE_KEY>"}'::jsonb
  ) $$
);