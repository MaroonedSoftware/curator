-- migrate:up

-- The album a TV cycles through, if any: one rotation per TV. Deleting the album, or the TV, stops it.
create table tv_rotations (
    tv_id uuid primary key references tvs (id) on delete cascade,
    album_id uuid not null references albums (id) on delete cascade,
    interval_minutes integer not null default 30,
    -- A random piece each time (never the same twice running), or the album's order.
    shuffle boolean not null default true,
    -- What the rotation last put on screen, and when. Unset until it first rotates.
    last_content_id text,
    last_rotated_at timestamptz,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint tv_rotations_interval_range check (interval_minutes between 1 and 1440)
);

-- migrate:down

drop table tv_rotations;
