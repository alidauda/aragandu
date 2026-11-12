# The staff phone app

A phone app for the people who record on the farm: the hall attendant, the
egg sorter, the sales person at the gate. It lives in `mobile/` and uses this
website as its backend — the same logins, roles, rules and Activity log.

## What it does

| Screen | Who sees it | What it records |
| --- | --- | --- |
| Layers daily entry | Layers staff | Crates, pieces, rejects, feed and its type, water, mortality and culls — one card per flock in each house |
| Sort eggs | Layers staff | Good crates into the store, and what cracked on the way |
| Record an egg sale | Whoever sells eggs | Crates or cracked eggs, to a walk-in or a registered buyer |
| Add a receipt | Whoever sells | A photo of a buyer's payment receipt, attached to their unpaid sale for an admin to check |
| Broilers daily entry | Broilers staff | Feed and its type, water, mortality, culls and sample weights — one card per batch |
| Brooding daily entry | Brooding staff | The same, for brooding batches |
| Home | Everyone | What they can record, and their part of the farm at a glance |
| Waiting to send | Everyone | Entries made without signal |

A page set to **View only** or **Hidden** for someone on the Team page is the
same in the app: the entry isn't offered, and the website refuses it anyway.

Everything else — reports, finance, payments, the team, corrections — stays
on the website.

## Working without signal

Every entry is kept on the phone first, then sent.

- With signal it's sent at once and the page says **saved ✓**.
- Without, the page says it's **kept on this phone**. It's sent by itself when
  signal returns, when the app is opened, or with **Send now**; entries go in
  the order they were made.
- An entry carries the day it was made for, so one entered on Tuesday and sent
  on Wednesday is still Tuesday's.
- Each entry has its own key. If the signal drops halfway and the phone sends
  it again, the website saves it once.
- If the website refuses an entry when it arrives (not enough feed in store,
  say), it shows on **Waiting to send** with the reason, to try again or remove.
- Figures on the phone are the last ones loaded; the banner says how old they
  are. Checks that depend on them (feed on hand, crates in store) are left to
  the website while there's no signal.

A receipt is the one thing that needs signal: the photo is uploaded there and
then, not kept to send later.

Staff can record up to 7 days back, as on the website, so an entry kept on a
phone for longer than that is refused when it arrives.

## How it's built

- `mobile/` is an Expo app (Expo Router, TypeScript). Its figures and role
  checks are the website's own files, imported from `src/lib` (`@farm/...`),
  so the two can't disagree.
- The website's endpoints for it are under `src/app/api/mobile`:
  - `sign-in` — email and password for a token (Better Auth's bearer plugin).
    Staff only.
  - `data` — everything the person may see, cut by role as the pages are.
  - `act` — one entry: the website's own action of that name, run once per key
    (`mobile_writes`).
  - `proofs` — a receipt's photo: the website's own upload, by token.
  - `sign-out`.
- The token is kept in the phone's keychain; the figures and waiting entries
  in the app's own storage.

To let the app make another kind of entry: add the action to `ACTIONS` in
`src/app/api/mobile/act/route.ts`, its name to `EntryName` in
`mobile/src/farm/store.ts`, and a screen that calls `send(...)`.

## Running and building

See `mobile/README.md`. To try it against a test copy of the site, set
`EXPO_PUBLIC_API_URL` (the browser build needs the site running in
development, which is the only time it answers another address).

## Not in the app yet

- Ruminants (weights, treatments), feed requests, hens and manure sales.
- Editing or deleting an entry — that's done on the website.
