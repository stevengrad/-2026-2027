-- Run ONCE after the migrations (SQL editor). Safe to re-run: it only inserts when no tournament exists.
insert into tournaments (name_ar, description_ar, bible_verse_text, bible_verse_reference)
select 'دوري كرة القدم لأسرة أنبياء 2026/2027',
       'دوري كرة القدم لأسرة أنبياء يجمع الشباب في أجواء من الروح الرياضية والمحبة. كل فريق يحمل اسم قدّيس، ونلعب لنتعلم الجهاد الحسن ونفرح معاً.',
       'قَدْ جَاهَدْتُ الْجِهَادَ الْحَسَنَ، أَكْمَلْتُ السَّعْيَ، حَفِظْتُ الإِيمَانَ.', '٢ تيموثاوس ٤: ٧'
where not exists (select 1 from tournaments);
-- If a tournament row already exists, just rename it:
update tournaments set name_ar = 'دوري كرة القدم لأسرة أنبياء 2026/2027';
