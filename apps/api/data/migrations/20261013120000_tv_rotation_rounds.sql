-- migrate:up

-- A shuffled rotation deals the album out in rounds: every piece once before any comes up again.
-- These are the pieces already shown this round, stored with `_` as `-`, in the order they came up.
alter table tv_rotations add column shown_this_round text[] not null default '{}';

-- migrate:down

alter table tv_rotations drop column shown_this_round;
