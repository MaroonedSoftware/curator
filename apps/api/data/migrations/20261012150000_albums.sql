-- migrate:up

-- A named set of pieces on one TV ("Halloween", "Christmas"). Per TV, because a piece's content id
-- is only meaningful on the TV that issued it.
create table albums (
    id uuid primary key default gen_random_uuid(),
    tv_id uuid not null references tvs (id) on delete cascade,
    name text not null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint albums_name_not_blank check (length(trim(name)) > 0)
);

-- Names are unique per TV, ignoring case, so "Halloween" and "halloween" are the same album.
create unique index albums_tv_name_unique on albums (tv_id, lower(name));

-- The pieces in each album, in the order they were added. A piece can be in many albums.
-- `content_id` is stored with `_` as `-` (MY_F0019 and MY-F0019 are the same piece).
create table album_pieces (
    album_id uuid not null references albums (id) on delete cascade,
    content_id text not null,
    position integer not null,
    added_at timestamptz not null default now(),
    primary key (album_id, content_id)
);

-- migrate:down

drop table album_pieces;
drop table albums;
