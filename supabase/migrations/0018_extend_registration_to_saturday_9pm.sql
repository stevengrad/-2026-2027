-- 0018: extend team registration deadline to Saturday 14 Nov 2026 21:00 (9:00 PM Africa/Cairo, UTC+2).
-- Only ever moves the deadline LATER than what is stored. The countdown on the site reads this row.
update tournaments set registration_deadline = timestamptz '2026-11-14 21:00:00+02'
where registration_deadline < timestamptz '2026-11-14 21:00:00+02';
