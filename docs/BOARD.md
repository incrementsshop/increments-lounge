# The shared notice board

Visitors can pin "the next small step I'm taking" to the notice board in the Lounge. By default
those notes stay on the visitor's own device. Switch on the **shared board** and notes can go up
for everyone — after someone from Increments has read them.

- **Pre-moderated.** Every note arrives as *pending*. Nothing appears in the Lounge until it's
  marked *approved*.
- **Minimal data.** The note, plus a first name and city if the visitor adds them. For rate
  limiting, the database also keeps a one-way hash of the sender's IP address — never the
  address itself. No accounts, emails or cookies.
- **Locked down on the server.** The key in `config.js` is public by design. The database only
  lets it add pending notes and read approved ones: it can't approve, edit, delete or list
  pending notes. Links, emails and handles are refused, and each visitor can send 3 notes an hour.
- **Fails quietly.** If the board can't be reached, the Lounge shows visitors their own notes
  and carries on.

Preview it before setting anything up: add `?boardDemo` to the Lounge URL. The board fills with
notes labelled "Sample", and nothing is sent.

**Starter notes.** So the board isn't empty on day one, `board.starterNotes` in `config.js` holds a
few of the team's own next steps, signed "— the Increments team". They fill the spaces visitors'
notes haven't taken and step aside as approved notes arrive. The ones there now are drafts:
swap in the team's real ones before launch.

## Set it up (about 10 minutes)

1. **Create a Supabase account** at [supabase.com](https://supabase.com). Use the Increments
   business email so the client owns it. The free plan is plenty.
2. **New project.**
   - Name: `increments-lounge`.
   - Region: **Canada (Central)**.
   - Generate a database password and store it in the password manager. You won't need it
     for the board.
3. **Create the table.** Go to *SQL Editor → New query*, paste the whole of
   [`board-setup.sql`](board-setup.sql) and press **Run**. You should see "Success. No rows
   returned".
4. **Copy the keys.**
   - Go to *Project Settings → API Keys*.
   - Copy the **Project URL** and the **publishable** key (`sb_publishable_…`). On older
     projects, copy the **anon public** key instead.
   - Never use the *secret* or *service_role* key here.
5. **Paste them into `assets/js/config.js`:**
   ```js
   board: {
     supabaseUrl: 'https://YOUR-PROJECT.supabase.co',
     anonKey: 'sb_publishable_…',
     table: 'increments',
   },
   ```
   Commit and push. GitHub Pages redeploys in about a minute.
6. **Test it end to end.**
   1. Open the Lounge, go to the Notice Board and pin a note with "Also put it up on the
      Lounge board" ticked.
   2. In Supabase, open *Table Editor → increments*. Your note should be there with status
      `pending`.
   3. Double-click the status, change it to `approved` and save.
   4. Reload the Lounge. Your note is on the board, and in *Read the board*.

If step 6 fails with a "permission denied" or 404 in the browser console, check *Project
Settings → Data API* and make sure the `public` schema is exposed.

## Moderating

Check the table once or twice a day while the Lounge is running.

- *Table Editor → increments*. Filter where `status` is `pending`.
- To publish a note, set `status` to `approved`.
- To reject one, set `status` to `hidden`. Hidden notes are kept, but never shown.

In bulk, from the SQL Editor:

```sql
select id, created_at, text, name, city from increments where status = 'pending' order by created_at;
update increments set status = 'approved' where id in (12, 13, 15);
update increments set status = 'hidden'   where id = 14;
```

The Lounge shows the 24 newest approved notes: 10 on the board itself, and all of them in
*Read the board*.

A good rule of thumb for approving: publish anything that's a genuine next step, and hide
anything with names of other people, contact details, ads, or anything you wouldn't put in the
shop window.

## Good to know

- **The free plan pauses a project after about a week with no activity.** A Lounge with daily
  visitors stays awake. If it does pause, the board quietly falls back to "your notes only";
  press *Restore* in the Supabase dashboard.
- **Limits** live in `board-setup.sql`:
  - 3 notes per visitor per hour
  - 300 pending notes a day in total
  - 80 characters per note

  The Lounge also asks each device to stop at 3 notes a day.
- **When the run ends:**
  - Export the notes if the team wants to keep them (*Table Editor → Export → CSV*).
  - Then run `delete from increments;`, or pause the project.
  - Blank the two keys in `config.js` to switch sharing off.
- **Switching it off** at any time: empty `supabaseUrl` and `anonKey` in `config.js`. Everything
  else keeps working.
