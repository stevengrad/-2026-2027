-- Support full 64- and 32-team knockout brackets in addition to the existing
-- round of 16, quarter-final, semi-final and final stages.
alter type match_stage add value if not exists 'round_of_64' before 'round_of_16';
alter type match_stage add value if not exists 'round_of_32' before 'round_of_16';
