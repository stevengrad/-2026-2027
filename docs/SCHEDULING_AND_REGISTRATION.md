# Group-stage scheduling and registration deadline

Migration required: `supabase/migrations/0016_reopen_registration_and_group_schedule.sql` (run it in the Supabase SQL editor after 0015).

## 1. Automatic group-stage schedule

Admin -> **المجموعات والقرعة** -> panel **الجدولة التلقائية لمباريات المجموعات**.

| Setting | Default |
|---|---|
| First match each day | 4:45 pm |
| Last match must END by | 7:30 pm |
| Match length | 10 minutes |
| Spare time between two matches | 5 minutes |
| Days | Sundays only (or "every day") |

That makes a kick-off every 15 minutes: 4:45, 5:00, ... , 7:15 pm = **11 matches per day** (the 7:15 match ends 7:25).
A 12th match would end after 7:30, so it moves to the next play day.

* **At publish time:** when you confirm the draw, matches are scheduled automatically (the checkbox is on by default; pick the first day first).
* **Later:** use *معاينة الجدولة* then *تطبيق الجدولة* to (re)schedule. By default only matches without a time are touched; tick *إعادة جدولة المباريات التي لها موعد* to move the rest. Finished matches are never changed.
* Matches are ordered so a team does **not** play two slots in a row when that can be avoided, and every team's matches are spread over the days.
* All times are Africa/Cairo (daylight saving handled). You can still edit any single match's time in **إدارة المباريات**.

## 2. Registration deadline

The deadline is one database row (`tournaments.registration_deadline`) enforced with the server clock.
Migration 0016 moves it to **Friday 13 Nov 2026, 12:00 am Cairo** (that is the end of Thursday night; to keep registration open
through all of Friday choose Saturday 12:00 am instead).

To change it later: Admin -> **الإعدادات** -> pick a date/time -> *حفظ الموعد وإعادة فتح التسجيل*.
The change is audit-logged, the homepage countdown/text and the registration page update automatically, and the
database rejects registrations after the new time. Choosing a time in the past closes registration immediately.
