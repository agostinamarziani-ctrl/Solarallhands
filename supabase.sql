-- Haunted Hall of Fame database setup. Run once in Supabase: SQL Editor -> paste -> Run.

create table game (
  id int primary key default 1 check (id = 1),
  award_index int not null default -1,
  status text not null default 'lobby',
  updated_at timestamptz not null default now()
);
insert into game default values;

-- One row per phone. `name` is the teammate-list spelling when we recognised the person.
create table players (
  id text primary key,
  name text not null check (char_length(name) between 2 and 70),
  joined_at timestamptz not null default now()
);

create table votes (
  award_id int not null,
  voter text not null, -- the phone's ID, so a typed name can't vote twice
  nominee text not null,
  nominee text not null,
  created_at timestamptz not null default now(),
  primary key (award_id, voter) -- one vote per person per award
);

alter table game enable row level security;
alter table players enable row level security;
alter table votes enable row level security;

create policy "Anyone can read the game" on game for select using (true);
create policy "Anyone can read players" on players for select using (true);
create policy "Anyone can join" on players for insert with check (true);
create policy "Anyone can change their name" on players for update using (true) with check (true);
create policy "Anyone can read votes" on votes for select using (true);
create policy "Votes only while that award is open" on votes for insert with check (
  exists (select 1 from game where status = 'voting' and award_index = votes.award_id)
);

-- The presenter screen moves the game forward through these two functions.
create or replace function set_game(new_index int, new_status text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if new_status not in ('lobby', 'voting', 'closed', 'revealed', 'finished') then
    raise exception 'unknown status %', new_status;
  end if;
  update game set award_index = new_index, status = new_status, updated_at = now() where id = 1;
end $$;

create or replace function reset_game()
returns void language plpgsql security definer set search_path = public as $$
begin
  delete from votes where true;
  delete from players where true;
  update game set award_index = -1, status = 'lobby', updated_at = now() where id = 1;
end $$;

-- Lets phones hear "next award" instantly.
alter publication supabase_realtime add table game;
