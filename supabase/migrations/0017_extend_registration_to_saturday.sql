-- 0017: reopen team registration until Saturday 14 Nov 2026 00:00 (Africa/Cairo, UTC+2) = Friday night midnight.
-- Only ever moves the deadline LATER than what is stored. The countdown on the site reads this row.
update tournaments set registration_deadline = timestamptz '2026-11-14 00:00:00+02'
where registration_deadline < timestamptz '2026-11-14 00:00:00+02';
