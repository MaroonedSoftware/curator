-- migrate:up

-- The Frame TVs curator manages. A TV is added once it is paired, so `token` is set on every row
-- the API writes; it is nullable only so a TV whose token the TV revoked can be kept and re-paired.
create table tvs (
    id uuid primary key default gen_random_uuid(),
    -- What people call it ("Living Room"). Starts as the name the TV reports.
    name text not null,
    host text not null,
    -- 8002 is the TLS port modern Frames want.
    port integer not null default 8002,
    model text,
    token text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint tvs_host_port_unique unique (host, port),
    constraint tvs_name_not_blank check (length(trim(name)) > 0),
    constraint tvs_port_range check (port between 1 and 65535)
);

-- migrate:down

drop table tvs;
