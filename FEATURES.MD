# AI DungeonMaster — Feature Spec (Old Greg’s Tavern–inspired)

> Goal: A web app where players buy credits (or try 5 free rounds), create a character, and play a 200‑round narrative campaign guided by an AI Dungeon Master (DM). Tech: Next.js (App Router), JavaScript, Tailwind CSS, Supabase (Postgres + Auth), and an LLM.

---

## Core Loop (Rounds)

- [ ] Each campaign has **200 rounds** max (one DM turn = one round).
- [ ] **Free trial:** first **5 rounds** per account without credits.
- [ ] Round increments only when the DM posts a “turn resolution” message.
- [ ] Show a **0/200 rounds** indicator; lock input after limit (show upsell).
- [ ] Persist a full **message timeline** (player inputs + DM outputs + meta).

## Campaign Creation (World Pre‑Build)

- [ ] On “Create Campaign”, generate:
  - [ ] **World seed** (region, climate, tone, high‑level conflict).
  - [ ] **Starting location** (town/tavern), 3–5 **named NPCs** with roles, 2–3 **factions**, 2–4 **quest seeds**.
  - [ ] Store world summary + entities in DB.
- [ ] Loading view: “**Building Your World**” with progress bar.

## Character Creation

- [ ] Ask **name** + **appearance** _(0–120 chars)_ + \*\*pronouns*/\_he/she/they/it*.
- [ ] **Class selection** with **starting stats** (IP‑safe; SRD 5.1‑compatible where applicable).
- [ ] **Backstory** (free text) with brief on‑screen guidance (tone, hooks).
- [ ] Save character; show splash: **“Wake up, [Character Name]”**.

## Session UI (Play View)

- Center: chat thread (DM narration + player input box).
- Left tab panel:
  - [ ] **Player Quests** (active + completed, each with goal text).
  - [ ] **Character Stats** (traits/skills, level, HP, modifiers).
  - [ ] **Inventory** (equipped, weapons/armor, items, derived AC/damage).
- Right panel:
  - [ ] **Party** list (joined characters with HP badges, leader tag).
- [ ] Top bar: campaign title, **round counter**, save status.
- [ ] Players can type **anything**; DM responds narratively and rolls/logic.

## Party & Access

- [ ] Host starts a campaign; others **join via invite code/link**.
- [ ] Host’s credits fund the campaign; **5 free rounds** apply once per user.
- [ ] Permissions:
  - Host: pause, export, end campaign, manage invites.
  - Player: chat, view tabs, manage own inventory/backstory notes.

## Credits & Billing (MVP)

- [ ] **Credits** table; 1 credit = 1 new 200‑round campaign.
- [ ] Free trial gate: allow play up to 5 rounds without credits.
- [ ] When trial ends and no credits available → soft lock + upsell CTA.

## Persistence & Safety

- [ ] All entities stored per campaign: world, locations, NPCs, factions, quests, items, characters, inventory, party memberships, message log, round count.
- [ ] Content filter for user input (mild moderation).
- [ ] **Autosave** on each turn; **Export** (JSON or Markdown transcript).

---

## Data Model (Supabase / Postgres – draft)

- Check for existing Supabase DB using Supabase MCP — enforce 5‑round trial.

> Indices on all foreign keys; RLS policies scoped by `auth.uid()`.

---

## API (App Router – sample routes)

- `POST /api/campaigns` → create + worldbuild
- `GET /api/campaigns/:id`
- `POST /api/campaigns/:id/join` → invite code
- `POST /api/campaigns/:id/message` → player message → queues DM turn
- `POST /api/campaigns/:id/resolve` → server‑side DM response + round++ (enforce trial/credits)
- `POST /api/characters` → create/update
- `GET /api/party/:campaignId`
- `GET /api/quests/:campaignId`
- `POST /api/credits/spend` (secure server action)
- `GET /api/export/:campaignId`

---

## AI Prompts (high‑level)

- **Worldbuilder (server‑only):** “Generate world seed: {tone, region, conflicts, 3 NPCs, 2 factions, 3 quest seeds}. Keep IP‑safe, neutral mechanics, SRD‑compatible terminology.”
- **DM/Narrator:** “Continue scene given world state + party + last message; produce **concise turn resolution** with hooks and explicit next options when helpful; write at most 2–4 paragraphs; update suggested quest states and inventory diffs as structured JSON.”
- **Rules Helper:** Validate suggested updates against schema; only apply allowed changes.

---

## Acceptance Criteria (MVP slices)

- [ ] Create campaign → see “Building Your World” → world stored.
- [ ] Character flow (name, appearance, class, backstory) persists.
- [ ] “Wake up, [Name]” splash shows once.
- [ ] Session view has left tabs (quests, stats, inventory) + right party.
- [ ] Free text input accepted; DM responds; rounds increment & display.
- [ ] Trial gating after 5 rounds if no credits.
- [ ] Export transcript works.

---

## Future (Backlog)

- [ ] Rich dice roller `/roll 1d20+5`
- [ ] Encounter generator
- [ ] Map stub with locations
- [ ] Session host tools (soft‑rewind last turn)
- [ ] Cloud saves + shareable recap
