-- Seed data for the function-arrangements tracker.
--
-- Generated from the two planning documents the temple already keeps:
--   Temple_Annathanam_14-16.docx   -> function 'annathanam-14-16'
--   kumbabhishekam_2026.docx       -> function 'kumbabhishekam-2026'
--
-- Safe to re-run: each function is deleted by slug first, and sections and
-- items cascade from it. Re-running therefore DISCARDS edits made in the
-- app for those two functions -- run it once at setup, not on every deploy.

begin;

delete from public.event_functions where slug in ('kumbabhishekam-2026', 'annathanam-14-16');

insert into public.event_functions (slug, title, subtitle, description, starts_on, ends_on, status, order_no)
values (
  'kumbabhishekam-2026',
  'மகா கும்பாபிஷேக விழா 2026',
  'அருள்மிகு ஸ்ரீ சர்வ சக்தி விநாயகர் ஆலயம்',
  'தேவையான பொருட்கள் & செலவு பட்டியல் — 11/09/2026 முதல் 16/09/2026 வரை. Requirements, expected cost, actual spend and ubhayam for the Maha Kumbabhishekam.',
  '2026-08-29',
  '2026-09-16',
  'planning',
  1
);

insert into public.function_sections (function_id, order_no, code, title, kind, sponsor, notes)
select id, 1, '1', '29/08/2026 — கல்லூரி சாலை பகுதி பக்தர்களுக்கு (திருவிழா தினத்திற்கு முன் தேவையானவை)', 'items', null, null from public.event_functions where slug = 'kumbabhishekam-2026';
insert into public.function_items (section_id, order_no, name, time_label, qty, expected_amount, actual_amount, sponsor, status)
select s.id, v.order_no, v.name, v.time_label, v.qty, v.expected_amount::numeric, v.actual_amount::numeric, v.sponsor, v.status
from public.function_sections s
join public.event_functions f on f.id = s.function_id
cross join (values
  (1, 'வாழைமரம்', null, '2 ஜோடி', null, null, null, 'pending'),
  (2, 'தென்னைதோரணம்', null, null, null, null, null, 'pending'),
  (3, 'மா தோரணம்', null, null, null, null, null, 'pending'),
  (4, 'வாழைகன்று அலங்காரம்', null, '20', null, null, null, 'pending'),
  (5, 'குத்து விளக்கு', null, '6 எண் (ஆலயத்தில் 4 உள்ளது)', null, null, null, 'pending'),
  (6, 'மண பலகை (Abco Furnitures)', null, '12 எண்', null, null, 'திரு. தேவநாதன்', 'committed'),
  (7, 'யாக சாலை அமைப்பு', null, null, null, null, null, 'pending'),
  (8, 'பூஜை சாமான்கள் வைக்க இடம்', null, null, null, null, null, 'pending')
) as v(order_no, name, time_label, qty, expected_amount, actual_amount, sponsor, status)
where f.slug = 'kumbabhishekam-2026' and s.code = '1';

insert into public.function_sections (function_id, order_no, code, title, kind, sponsor, notes)
select id, 2, '2', '11/09/2026, வெள்ளிக்கிழமை காலை 7:00 — திருவிழா பந்தக் கால் பூஜை', 'items', null, null from public.event_functions where slug = 'kumbabhishekam-2026';
insert into public.function_items (section_id, order_no, name, time_label, qty, expected_amount, actual_amount, sponsor, status)
select s.id, v.order_no, v.name, v.time_label, v.qty, v.expected_amount::numeric, v.actual_amount::numeric, v.sponsor, v.status
from public.function_sections s
join public.event_functions f on f.id = s.function_id
cross join (values
  (1, 'மூங்கில் கொம்பு', null, null, null, null, null, 'pending'),
  (2, 'பூஜைக்கு உரிய பொருட்கள் (ஆலயத்தில் உள்ளது)', null, null, null, null, null, 'pending'),
  (3, 'பூ சரம்', null, null, null, null, null, 'pending'),
  (4, 'உதிரி பூ', null, null, null, null, null, 'pending'),
  (5, 'தேங்காய்', null, '2', null, null, null, 'pending')
) as v(order_no, name, time_label, qty, expected_amount, actual_amount, sponsor, status)
where f.slug = 'kumbabhishekam-2026' and s.code = '2';

insert into public.function_sections (function_id, order_no, code, title, kind, sponsor, notes)
select id, 3, '3', '14/09/2026, திங்கட்கிழமை காலை 7:00 — ஸ்ரீ விநாயகர் சதுர்த்தி பூஜை (சிறப்பு அபிஷேகம், அலங்காரம், ஆராதனை)', 'items', null, null from public.event_functions where slug = 'kumbabhishekam-2026';
insert into public.function_items (section_id, order_no, name, time_label, qty, expected_amount, actual_amount, sponsor, status)
select s.id, v.order_no, v.name, v.time_label, v.qty, v.expected_amount::numeric, v.actual_amount::numeric, v.sponsor, v.status
from public.function_sections s
join public.event_functions f on f.id = s.function_id
cross join (values
  (1, 'அபிஷேக பொருட்கள் மற்றும் பூஜை பொருட்கள்', null, null, null, null, null, 'pending'),
  (2, 'சுவாமிகளுக்கு வஸ்திரங்கள்', null, null, null, null, 'திரு. லஷ்மணன் சசிகலா', 'committed'),
  (3, 'மலர் மாலைகள், உதிரி பூ', null, null, null, null, 'திரு. லஷ்மணன் சசிகலா', 'committed'),
  (4, 'நெய்வேதியம்', null, null, null, null, null, 'pending'),
  (5, 'அன்னதானம் பிரசாதம் (பாக்கு தட்டு உட்பட)', null, null, null, null, 'திரு. சரவணன் அமுதா', 'committed')
) as v(order_no, name, time_label, qty, expected_amount, actual_amount, sponsor, status)
where f.slug = 'kumbabhishekam-2026' and s.code = '3';

insert into public.function_sections (function_id, order_no, code, title, kind, sponsor, notes)
select id, 4, '4', '15/09/2026 & 16/09/2026 — ஹோம பூஜைக்குத் தேவையான பொருட்கள்', 'items', null, null from public.event_functions where slug = 'kumbabhishekam-2026';
insert into public.function_items (section_id, order_no, name, time_label, qty, expected_amount, actual_amount, sponsor, status)
select s.id, v.order_no, v.name, v.time_label, v.qty, v.expected_amount::numeric, v.actual_amount::numeric, v.sponsor, v.status
from public.function_sections s
join public.event_functions f on f.id = s.function_id
cross join (values
  (1, 'மஞ்சள்தூள்', null, '2 கிலோ', null, null, null, 'pending'),
  (2, 'குங்குமம்', null, '2 கிலோ', null, null, null, 'pending'),
  (3, 'விபூதி', null, '2 கிலோ', null, null, null, 'pending'),
  (4, 'சந்தனம்', null, '2 கிலோ', null, null, null, 'pending'),
  (5, 'கற்பூரம்', null, '2 கிலோ', null, null, null, 'pending'),
  (6, 'ஊதுபத்தி', null, '12 பாக்கெட்', null, null, null, 'pending'),
  (7, 'பச்சை அரிசி', null, '25 கிலோ', null, null, null, 'pending'),
  (8, 'தேன்', null, '500 கிராம்', null, null, null, 'pending'),
  (9, 'நெய்', null, '15 கிலோ', null, null, null, 'pending'),
  (10, 'நல்லெண்ணெய்', null, '3 லி', null, null, null, 'pending'),
  (11, 'தீப எண்ணெய்', null, '5', null, null, null, 'pending'),
  (12, 'பன்னீர்', null, '12 லிட்', null, null, null, 'pending'),
  (13, 'ஏலக்காய்', null, '250 கி.', null, null, null, 'pending'),
  (14, 'கிராம்பு', null, '100 கி.', null, null, null, 'pending'),
  (15, 'ஜாதிக்காய்', null, '100 கி.', null, null, null, 'pending'),
  (16, 'ஜாதிபத்திரி', null, '100 கி.', null, null, null, 'pending'),
  (17, 'பச்சை கற்பூரம்', null, '25 கி.', null, null, null, 'pending'),
  (18, 'ரோஸ் எசன்ஸ்', null, '4 பாட்டில்', null, null, null, 'pending'),
  (19, 'கலச நூல் (முப்பிரி)', null, '5 டஜன்', null, null, null, 'pending'),
  (20, 'கலச நூல் விளக்கு (சிகப்பு, மஞ்சள், நீலம், வெள்ளை, ரோஸ்)', null, '5 எண்', null, null, null, 'pending'),
  (21, 'பெரிய தர்பை கட்டு', null, '5', null, null, null, 'pending'),
  (22, 'தர்பை கயிறு', null, '50 மீட்டர்', null, null, null, 'pending'),
  (23, 'யந்திரம்', null, null, null, null, null, 'pending'),
  (24, 'அஷ்டபந்தன மருந்து', null, '7 கி.', null, null, null, 'pending'),
  (25, 'மட்டை தேங்காய்', null, '5', null, null, null, 'pending'),
  (26, 'தேங்காய்', null, '50', null, null, null, 'pending'),
  (27, 'கொப்பரை தேங்காய்', null, '12', null, null, null, 'pending'),
  (28, 'கொட்டைபாக்கு', null, '500 கி.', null, null, null, 'pending'),
  (29, 'வெட்டிவேர்', null, '500 கி.', null, null, null, 'pending'),
  (30, 'ஹோம திரவியம் (108 வகை)', null, null, null, null, null, 'pending'),
  (31, 'கோலமாவு', null, '1 பாக்கெட்', null, null, null, 'pending'),
  (32, 'கலர் கோலமாவு', null, '1 பாக்கெட்', null, null, null, 'pending'),
  (33, 'பாக்கு தட்டு', null, '20 எண்', null, null, null, 'pending'),
  (34, 'பாக்கு தென்னை', null, '15 எண்', null, null, null, 'pending'),
  (35, 'சாதாரண தென்னை', null, '1 மூட்டை', null, null, null, 'pending'),
  (36, 'நெல் பொரி', null, 'சின்ன மூட்டை', null, null, null, 'pending'),
  (37, 'அவல்', null, '1 கிலோ', null, null, null, 'pending'),
  (38, 'காஞ்ச திராட்சை', null, '1 கிலோ', null, null, null, 'pending'),
  (39, 'பேரிச்சம் பழம்', null, '1 கிலோ', null, null, null, 'pending'),
  (40, 'கற்கண்டு', null, '1 கிலோ', null, null, null, 'pending'),
  (41, 'நாட்டு சர்க்கரை', null, '1 கிலோ', null, null, null, 'pending'),
  (42, 'சத்து மாவு', null, '1 கிலோ', null, null, null, 'pending'),
  (43, 'ஹோம திரவியம் (108)', null, 'கலசத்திற்கு 250 கிராம் வீதம்', null, null, null, 'pending'),
  (44, 'பஞ்சலோகம் (தங்கம், வெள்ளி, பாதரசம்)', null, '2 செட்', null, null, null, 'pending'),
  (45, 'நவதானியங்கள்', null, '1 கிலோ (9 வகை)', null, null, null, 'pending'),
  (46, 'மண் மடக்கு', null, '5 எண்', null, null, null, 'pending'),
  (47, 'பாலிகை', null, '12', null, null, null, 'pending'),
  (48, '15 லிட்டர் குடம்', null, '3', null, null, null, 'pending'),
  (49, '1 லிட்டர் சொம்பு', null, '35', null, null, null, 'pending'),
  (50, 'வெற்றிலை', null, '10 கவுளி', null, null, null, 'pending')
) as v(order_no, name, time_label, qty, expected_amount, actual_amount, sponsor, status)
where f.slug = 'kumbabhishekam-2026' and s.code = '4';

insert into public.function_sections (function_id, order_no, code, title, kind, sponsor, notes)
select id, 5, '4.1', 'தேவையான பழவகைகள்', 'items', null, null from public.event_functions where slug = 'kumbabhishekam-2026';
insert into public.function_items (section_id, order_no, name, time_label, qty, expected_amount, actual_amount, sponsor, status)
select s.id, v.order_no, v.name, v.time_label, v.qty, v.expected_amount::numeric, v.actual_amount::numeric, v.sponsor, v.status
from public.function_sections s
join public.event_functions f on f.id = s.function_id
cross join (values
  (1, 'பூவம் வாழைப்பழம்', null, '10 சீப்பு', null, null, null, 'pending'),
  (2, 'கற்பூரம் வாழைப்பழம்', null, '10 சீப்பு', null, null, null, 'pending'),
  (3, 'செவ்வாழை', null, '5 சீப்பு', null, null, null, 'pending'),
  (4, 'மலைவாழை', null, '5 சீப்பு', null, null, null, 'pending'),
  (5, 'ஆப்பிள் பழம்', null, '24', null, null, null, 'pending'),
  (6, 'ஆரஞ்சு பழம்', null, '24', null, null, null, 'pending'),
  (7, 'மாதுளை பழம்', null, '24', null, null, null, 'pending'),
  (8, 'எழும்பிச்சை பழம்', null, '50', null, null, null, 'pending'),
  (9, 'பூசணிக்காய்', null, '5', null, null, null, 'pending'),
  (10, 'வாழை இலை', null, '50', null, null, null, 'pending'),
  (11, 'மாங்கொத்து', null, '100', null, null, null, 'pending')
) as v(order_no, name, time_label, qty, expected_amount, actual_amount, sponsor, status)
where f.slug = 'kumbabhishekam-2026' and s.code = '4.1';

insert into public.function_sections (function_id, order_no, code, title, kind, sponsor, notes)
select id, 6, '5', '15/09/2026, காலை 7:00 — கணபதி ஹோமம் (மாலை மலர்கள்)', 'items', null, null from public.event_functions where slug = 'kumbabhishekam-2026';
insert into public.function_items (section_id, order_no, name, time_label, qty, expected_amount, actual_amount, sponsor, status)
select s.id, v.order_no, v.name, v.time_label, v.qty, v.expected_amount::numeric, v.actual_amount::numeric, v.sponsor, v.status
from public.function_sections s
join public.event_functions f on f.id = s.function_id
cross join (values
  (1, 'மீடியம் மாலை', null, '1', null, null, null, 'pending'),
  (2, 'அருகம்புல் மாலை', null, '1', null, null, null, 'pending'),
  (3, 'பூ சரம்', null, '10 முழம்', null, null, null, 'pending'),
  (4, 'உதிரி பூ', null, '2 கிலோ', null, null, null, 'pending'),
  (5, 'அருகம்புல் கட்டு', null, '1 பெரியது', null, null, null, 'pending'),
  (6, 'தாமரை பூ', null, '15', null, null, null, 'pending')
) as v(order_no, name, time_label, qty, expected_amount, actual_amount, sponsor, status)
where f.slug = 'kumbabhishekam-2026' and s.code = '5';

insert into public.function_sections (function_id, order_no, code, title, kind, sponsor, notes)
select id, 7, '6', '15/09/2026, மாலை 5:00 — முதல் காலம் பூஜை (மலர்கள்)', 'items', null, null from public.event_functions where slug = 'kumbabhishekam-2026';
insert into public.function_items (section_id, order_no, name, time_label, qty, expected_amount, actual_amount, sponsor, status)
select s.id, v.order_no, v.name, v.time_label, v.qty, v.expected_amount::numeric, v.actual_amount::numeric, v.sponsor, v.status
from public.function_sections s
join public.event_functions f on f.id = s.function_id
cross join (values
  (1, 'மீடியம் மாலை', null, '1', null, null, null, 'pending'),
  (2, 'கலச மாலை', null, '5', null, null, null, 'pending'),
  (3, 'திண்டு மாலை', null, '1', null, null, null, 'pending'),
  (4, 'கலர் மாலை', null, '3', null, null, null, 'pending'),
  (5, 'பூ சரம்', null, '30 முழம்', null, null, null, 'pending'),
  (6, 'உதிரி பூ', null, '5 கிலோ', null, null, null, 'pending'),
  (7, 'தம்பதி மாலை (மரியாதை மாலை)', null, '1 ஜோடி', null, null, null, 'pending')
) as v(order_no, name, time_label, qty, expected_amount, actual_amount, sponsor, status)
where f.slug = 'kumbabhishekam-2026' and s.code = '6';

insert into public.function_sections (function_id, order_no, code, title, kind, sponsor, notes)
select id, 8, '7', '16/09/2026, காலை 6:00 — கும்பாபிஷேகம் (மலர்கள்)', 'items', null, null from public.event_functions where slug = 'kumbabhishekam-2026';
insert into public.function_items (section_id, order_no, name, time_label, qty, expected_amount, actual_amount, sponsor, status)
select s.id, v.order_no, v.name, v.time_label, v.qty, v.expected_amount::numeric, v.actual_amount::numeric, v.sponsor, v.status
from public.function_sections s
join public.event_functions f on f.id = s.function_id
cross join (values
  (1, 'கோ பூஜை மாலை', null, '1', null, null, null, 'pending'),
  (2, 'பூ சரம்', null, '30 முழம்', null, null, null, 'pending'),
  (3, 'உதிரி பூ', null, '5 கிலோ', null, null, null, 'pending'),
  (4, 'விமான கோபுர மாலை', null, '1', null, null, null, 'pending'),
  (5, 'வாசல் மாலை', null, '1', null, null, null, 'pending'),
  (6, 'கஜலட்சுமி மாலை', null, '1', null, null, null, 'pending'),
  (7, 'மூலவர் அருள்மிகு ஸ்ரீ சர்வ சக்தி விநாயகருக்கு மாலை', null, null, null, null, null, 'pending'),
  (8, 'பரிவார தெய்வங்களுக்கு மாலைகள்', null, null, null, null, null, 'pending'),
  (9, 'முக்கியஸ்தர்கள் / உபயதாரர்களுக்கு மாலைகள் (அனைத்து சுவாமிகளுக்கும் மாட்டும் மாலைகள், உதிரி பூ)', null, null, null, null, 'திரு. லஷ்மணன் சசிகலா', 'committed')
) as v(order_no, name, time_label, qty, expected_amount, actual_amount, sponsor, status)
where f.slug = 'kumbabhishekam-2026' and s.code = '7';

insert into public.function_sections (function_id, order_no, code, title, kind, sponsor, notes)
select id, 9, '8', 'வஸ்திரங்கள்', 'items', null, null from public.event_functions where slug = 'kumbabhishekam-2026';
insert into public.function_items (section_id, order_no, name, time_label, qty, expected_amount, actual_amount, sponsor, status)
select s.id, v.order_no, v.name, v.time_label, v.qty, v.expected_amount::numeric, v.actual_amount::numeric, v.sponsor, v.status
from public.function_sections s
join public.event_functions f on f.id = s.function_id
cross join (values
  (1, 'ஸ்ரீ விநாயகர்க்கு வஸ்திரம்', null, null, null, null, null, 'pending'),
  (2, 'அம்மனுக்கு, தட்சிணாமூர்த்திக்கு, பெருமாளுக்கு வஸ்திரம்', null, null, null, null, null, 'pending'),
  (3, 'நவகிரகங்களுக்கு வஸ்திரம்', null, null, null, null, null, 'pending'),
  (4, 'ஸ்ரீ முருகனுக்கு வஸ்திரம்', null, null, null, null, null, 'pending'),
  (5, 'ஐயப்பனுக்கு வஸ்திரம்', null, null, null, null, null, 'pending'),
  (6, 'வேதியருக்கான வஸ்திரம் (6 கஜம் புடவை)', null, '3 எண்', null, null, null, 'pending'),
  (7, '4 முழம் வேஷ்டி துண்டு', null, '5 எண்', null, null, null, 'pending'),
  (8, '9×5 குருக்கள் வேஷ்டி', null, '6 எண்', null, null, null, 'pending'),
  (9, 'காசி துண்டு', null, '30 எண்', null, null, null, 'pending'),
  (10, 'பிளவுஸ் பிட்', null, '15 எண்', null, null, null, 'pending'),
  (11, 'பூர்ணாதி பட்டு (சுவாமிகளுக்கு மாட்டும் வஸ்திரங்கள்)', null, '5 மீட்டர்', null, null, 'திரு. லஷ்மணன் சசிகலா', 'committed')
) as v(order_no, name, time_label, qty, expected_amount, actual_amount, sponsor, status)
where f.slug = 'kumbabhishekam-2026' and s.code = '8';

insert into public.function_sections (function_id, order_no, code, title, kind, sponsor, notes)
select id, 10, '9', 'புதிய விக்கிரகங்கள் — கண்திறப்பு தரிசன வழிபாடு', 'items', null, 'குறிப்பு: ஆலய முக்கியஸ்தர்கள் மரியாதை செய்வது தங்கள் விருப்பம்.' from public.event_functions where slug = 'kumbabhishekam-2026';
insert into public.function_items (section_id, order_no, name, time_label, qty, expected_amount, actual_amount, sponsor, status)
select s.id, v.order_no, v.name, v.time_label, v.qty, v.expected_amount::numeric, v.actual_amount::numeric, v.sponsor, v.status
from public.function_sections s
join public.event_functions f on f.id = s.function_id
cross join (values
  (1, 'தங்க ஊசி', null, '1', null, null, null, 'pending'),
  (2, 'வெள்ளி ஊசி', null, '1', null, null, null, 'pending'),
  (3, 'தர்பணம் (முகம் பார்க்கும் கண்ணாடி)', null, '2', null, null, null, 'pending'),
  (4, 'கோமாதா (பசு மாட்டுக்கு புடவை, பிளவுஸ் பிட்)', null, null, null, null, null, 'pending'),
  (5, 'தீபம் (குத்து விளக்கு)', null, null, null, null, null, 'pending'),
  (6, 'சுமங்கலி', null, '6 கஜம் புடவை + பிளவுஸ் பிட்', null, null, null, 'pending'),
  (7, 'சுவாசினி', null, '9 கஜம் புடவை + பிளவுஸ் பிட்', null, null, null, 'pending'),
  (8, 'கன்னியர்', null, 'பாவாடை செட்', null, null, null, 'pending'),
  (9, 'பிரம்மச்சாரி', null, '4 முழம் வேஷ்டி', null, null, null, 'pending'),
  (10, 'தம்பதி', null, '9×5 வேஷ்டி, புடவை', null, null, null, 'pending'),
  (11, 'ஆலய அர்ச்சகர்', null, '9×5 வேஷ்டி துண்டு', null, null, null, 'pending')
) as v(order_no, name, time_label, qty, expected_amount, actual_amount, sponsor, status)
where f.slug = 'kumbabhishekam-2026' and s.code = '9';

insert into public.function_sections (function_id, order_no, code, title, kind, sponsor, notes)
select id, 11, '10.1', 'பிரசாதம் — கணபதி ஹோமம் (காலை 7:00)', 'items', null, null from public.event_functions where slug = 'kumbabhishekam-2026';
insert into public.function_items (section_id, order_no, name, time_label, qty, expected_amount, actual_amount, sponsor, status)
select s.id, v.order_no, v.name, v.time_label, v.qty, v.expected_amount::numeric, v.actual_amount::numeric, v.sponsor, v.status
from public.function_sections s
join public.event_functions f on f.id = s.function_id
cross join (values
  (1, 'கொழுக்கட்டை (மோதகம்)', null, '108', null, null, null, 'pending'),
  (2, 'அப்பம்', null, '108', null, null, null, 'pending'),
  (3, 'எள்ளு உருண்டை', null, '108', null, null, null, 'pending'),
  (4, 'சர்க்கரை பொங்கல்', null, '2 கிலோ', null, null, null, 'pending'),
  (5, 'புளியோதரை', null, '2 கிலோ', null, null, null, 'pending'),
  (6, 'அவில்', null, 'அரை கிலோ', null, null, null, 'pending')
) as v(order_no, name, time_label, qty, expected_amount, actual_amount, sponsor, status)
where f.slug = 'kumbabhishekam-2026' and s.code = '10.1';

insert into public.function_sections (function_id, order_no, code, title, kind, sponsor, notes)
select id, 12, '10.2', 'பிரசாதம் — முதல்கால பூஜை (மாலை 5:00)', 'items', null, null from public.event_functions where slug = 'kumbabhishekam-2026';
insert into public.function_items (section_id, order_no, name, time_label, qty, expected_amount, actual_amount, sponsor, status)
select s.id, v.order_no, v.name, v.time_label, v.qty, v.expected_amount::numeric, v.actual_amount::numeric, v.sponsor, v.status
from public.function_sections s
join public.event_functions f on f.id = s.function_id
cross join (values
  (1, 'எலுமிச்சை சாதம்', null, '2 கிலோ', null, null, null, 'pending'),
  (2, 'தேங்காய் சாதம்', null, '2 கிலோ', null, null, null, 'pending'),
  (3, 'சுண்டல்', null, '2 கிலோ', null, null, null, 'pending'),
  (4, 'அவில்', null, 'அரை கிலோ', null, null, null, 'pending')
) as v(order_no, name, time_label, qty, expected_amount, actual_amount, sponsor, status)
where f.slug = 'kumbabhishekam-2026' and s.code = '10.2';

insert into public.function_sections (function_id, order_no, code, title, kind, sponsor, notes)
select id, 13, '10.3', 'பிரசாதம் — கும்பாபிஷேகம் (16/09/2026)', 'items', null, null from public.event_functions where slug = 'kumbabhishekam-2026';
insert into public.function_items (section_id, order_no, name, time_label, qty, expected_amount, actual_amount, sponsor, status)
select s.id, v.order_no, v.name, v.time_label, v.qty, v.expected_amount::numeric, v.actual_amount::numeric, v.sponsor, v.status
from public.function_sections s
join public.event_functions f on f.id = s.function_id
cross join (values
  (1, 'பசும்பால் (காய்ச்சியது)', null, '1 லிட்டர்', null, null, null, 'pending'),
  (2, 'கற்கண்டு பாத்', null, '2 கிலோ', null, null, null, 'pending'),
  (3, 'புளியோதரை', null, '2 கிலோ', null, null, null, 'pending'),
  (4, 'அவில்', null, 'அரை கிலோ', null, null, null, 'pending'),
  (5, 'வடை, பாயசம் (முடிந்தால்)', null, null, null, null, null, 'pending')
) as v(order_no, name, time_label, qty, expected_amount, actual_amount, sponsor, status)
where f.slug = 'kumbabhishekam-2026' and s.code = '10.3';

insert into public.function_sections (function_id, order_no, code, title, kind, sponsor, notes)
select id, 14, '11.1', 'நிகழ்ச்சி நிரல் — 15/09/2026, செவ்வாய்க்கிழமை', 'schedule', null, null from public.event_functions where slug = 'kumbabhishekam-2026';
insert into public.function_items (section_id, order_no, name, time_label, qty, expected_amount, actual_amount, sponsor, status)
select s.id, v.order_no, v.name, v.time_label, v.qty, v.expected_amount::numeric, v.actual_amount::numeric, v.sponsor, v.status
from public.function_sections s
join public.event_functions f on f.id = s.function_id
cross join (values
  (1, 'மகா கணபதி ஹோமம், நவகிரக ஹோமம், லஷ்மி ஹோமம்', 'காலை 7:00', null, null, null, null, 'pending'),
  (2, 'மகா பூர்ணாதி, மகா தீபாராதனை, பிரசாதம் வழங்குதல்', 'காலை 9:00', null, null, null, null, 'pending'),
  (3, 'புதிய சிலை கரிகோலம், வாஸ்து சாந்தி, பிரவேச பலி, மிருத்சங்கிரகணம், மண் எடுத்தல், தீர்த்த சங்கிரகணம், விக்கிரகங்கள் கண் திறக்கும் நிகழ்வு, சயநாதிவாசம், யந்திரஸ்தாபனம், பிம்பஸ்தாபனம், அஷ்டபந்தன மருந்து சாற்றுதல்', 'காலை 10:30', null, null, null, null, 'pending'),
  (4, 'மங்கள இசையோடு ஸ்ரீ விக்நேஸ்வர பிரார்த்தனை; முதல் கால யாகசாலை பூஜைகள் ஆரம்பம்; அங்குரார்ப்பணம், ரட்சாபந்தனம் (காப்பு கட்டுதல்), கும்பாலங்கீரணம், யாகசாலையில் கும்ப பிரதிஷ்டை', 'மாலை 5:00', null, null, null, null, 'pending'),
  (5, 'வேதிகார்ச்சனை, அக்னி பிரதிஷ்டை, திரவ்யாஹுதி, மகா பூர்ணாதி, வேதோபசாரம், மந்திரோபசாரம்', 'இரவு 7:00', null, null, null, null, 'pending'),
  (6, 'மகா தீபாராதனை, பிரசாதம் வழங்குதல், அன்னதானம் வழங்குதல்', 'இரவு 8:00', null, null, null, null, 'pending')
) as v(order_no, name, time_label, qty, expected_amount, actual_amount, sponsor, status)
where f.slug = 'kumbabhishekam-2026' and s.code = '11.1';

insert into public.function_sections (function_id, order_no, code, title, kind, sponsor, notes)
select id, 15, '11.2', 'நிகழ்ச்சி நிரல் — 16/09/2026, புதன்கிழமை', 'schedule', null, null from public.event_functions where slug = 'kumbabhishekam-2026';
insert into public.function_items (section_id, order_no, name, time_label, qty, expected_amount, actual_amount, sponsor, status)
select s.id, v.order_no, v.name, v.time_label, v.qty, v.expected_amount::numeric, v.actual_amount::numeric, v.sponsor, v.status
from public.function_sections s
join public.event_functions f on f.id = s.function_id
cross join (values
  (1, 'மங்கள இசையோடு ஸ்ரீ விநாயகர் பூஜை; இரண்டாம் கால யாகசாலை பூஜைகள் ஆரம்பம்', 'காலை 7:00', null, null, null, null, 'pending'),
  (2, 'பிம்ப சுத்தி, ரட்சாபந்தனம், நாபிசந்தனம், ஸ்பர்சாஹுதி, நாமகரணம், திரவ்யாஹுதி', 'காலை 8:00', null, null, null, null, 'pending'),
  (3, 'மகா பூர்ணாதி, மகா தீபாராதனை', 'காலை 9:00', null, null, null, null, 'pending'),
  (4, 'யாத்திராதானம் — கடம் புறப்பாடு', 'காலை 10:00', null, null, null, null, 'pending'),
  (5, 'அருள்மிகு ஸ்ரீ முருகன், ஐயப்பன் மகா கும்பாபிஷேகம், விசேஷ அலங்காரம், மகா தீபாராதனை; தொடர்ந்து அருட்பிரசாதம், சிறப்பு அன்னதானம்', 'காலை 11:00', null, null, null, null, 'pending'),
  (6, 'அருள்மிகு ஸ்ரீ சர்வ சக்தி விநாயகருக்கு சந்தன காப்பு சிறப்பு பூஜை; தொடர்ந்து அருட்பிரசாதம், அன்னதானம்', 'மாலை 6:00', null, null, null, null, 'pending')
) as v(order_no, name, time_label, qty, expected_amount, actual_amount, sponsor, status)
where f.slug = 'kumbabhishekam-2026' and s.code = '11.2';

insert into public.function_sections (function_id, order_no, code, title, kind, sponsor, notes)
select id, 16, '12', 'மேலும் தேவையானவை', 'items', null, null from public.event_functions where slug = 'kumbabhishekam-2026';
insert into public.function_items (section_id, order_no, name, time_label, qty, expected_amount, actual_amount, sponsor, status)
select s.id, v.order_no, v.name, v.time_label, v.qty, v.expected_amount::numeric, v.actual_amount::numeric, v.sponsor, v.status
from public.function_sections s
join public.event_functions f on f.id = s.function_id
cross join (values
  (1, 'மங்கள இசை', null, null, null, null, null, 'pending'),
  (2, 'ஐயர் தட்சணை', null, null, null, null, null, 'pending'),
  (3, 'யாகசாலை', null, null, null, null, null, 'pending'),
  (4, 'ஒளி, ஒலி அமைப்பு', null, null, null, null, null, 'pending'),
  (5, 'சாமியானா, டேபுள், சேர், தரை மேட்', null, null, null, null, null, 'pending'),
  (6, 'வாழைமரம், தோரணம்', null, null, null, null, null, 'pending'),
  (7, 'பதாகைகள், அழைப்பிதழ் செலவு', null, null, null, null, null, 'pending')
) as v(order_no, name, time_label, qty, expected_amount, actual_amount, sponsor, status)
where f.slug = 'kumbabhishekam-2026' and s.code = '12';

insert into public.event_functions (slug, title, subtitle, description, starts_on, ends_on, status, order_no)
values (
  'annathanam-14-16',
  'Annathanam — 14th to 16th',
  'Temple Event Food Order Plan',
  'Menu, quantities, vendor and settlement for each annathanam session across the three festival days.',
  null,
  null,
  'planning',
  2
);

insert into public.function_sections (function_id, order_no, code, title, subtitle, kind, sponsor, vendor, estimate_amount, advance_paid, balance_paid)
select id, 1, '1', '14th — Morning', '10:00 AM', 'menu', 'Saravanan Amudha', null, null, null, null from public.event_functions where slug = 'annathanam-14-16';
insert into public.function_items (section_id, order_no, name, qty, unit)
select s.id, v.order_no, v.name, v.qty, v.unit
from public.function_sections s
join public.event_functions f on f.id = s.function_id
cross join (values
  (1, 'Sakkarai Pongal (சர்க்கரை பொங்கல்)', null, 'kg'),
  (2, 'Sundal (சுண்டல்)', '2', 'kg'),
  (3, 'Milagu Pongal (மிளகுப் பொங்கல்)', null, 'kg'),
  (4, 'Medhu Vadai (மெது வடை)', '250', 'Nos'),
  (5, 'Sambar (சாம்பார்)', null, null),
  (6, 'Thengai Chutney (தேங்காய் சட்னி)', null, null),
  (7, 'Pakku Thattu (பாக்கு மட்டைத் தட்டு)', '250', 'Nos')
) as v(order_no, name, qty, unit)
where f.slug = 'annathanam-14-16' and s.code = '1';

insert into public.function_sections (function_id, order_no, code, title, subtitle, kind, sponsor, vendor, estimate_amount, advance_paid, balance_paid)
select id, 2, '2', '14th — Evening', '7:00 PM', 'menu', 'Rajesh Lakshmi', null, null, null, null from public.event_functions where slug = 'annathanam-14-16';
insert into public.function_items (section_id, order_no, name, qty, unit)
select s.id, v.order_no, v.name, v.qty, v.unit
from public.function_sections s
join public.event_functions f on f.id = s.function_id
cross join (values
  (1, 'Brinji Sadam (பிரிஞ்சி சாதம்)', '10', 'kg'),
  (2, 'Potato chips (உருளைக்கிழங்கு சிப்ஸ்)', '2', 'packet')
) as v(order_no, name, qty, unit)
where f.slug = 'annathanam-14-16' and s.code = '2';

insert into public.function_sections (function_id, order_no, code, title, subtitle, kind, sponsor, vendor, estimate_amount, advance_paid, balance_paid)
select id, 3, '3', '15th — Morning', '11:00 AM', 'menu', 'Abirami Karthickram', 'Self', null, null, null from public.event_functions where slug = 'annathanam-14-16';
insert into public.function_items (section_id, order_no, name, qty, unit)
select s.id, v.order_no, v.name, v.qty, v.unit
from public.function_sections s
join public.event_functions f on f.id = s.function_id
cross join (values
  (1, 'Ven Pongal (வெண் பொங்கல்)', '4', 'kg'),
  (2, 'Sambar (சாம்பார்)', null, null),
  (3, 'Karuppu Sundal (கருப்புச் சுண்டல்)', '3', 'kg')
) as v(order_no, name, qty, unit)
where f.slug = 'annathanam-14-16' and s.code = '3';

insert into public.function_sections (function_id, order_no, code, title, subtitle, kind, sponsor, vendor, estimate_amount, advance_paid, balance_paid)
select id, 4, '4', '15th — Evening', '7:00 PM', 'menu', null, null, null, null, null from public.event_functions where slug = 'annathanam-14-16';
insert into public.function_items (section_id, order_no, name, qty, unit)
select s.id, v.order_no, v.name, v.qty, v.unit
from public.function_sections s
join public.event_functions f on f.id = s.function_id
cross join (values
  (1, 'Idli (இட்லி)', '600', 'nos'),
  (2, 'Sambar, Chutney (சாம்பார், சட்னி)', null, null),
  (3, 'Medhu Vadai (மெது வடை)', '200', 'nos')
) as v(order_no, name, qty, unit)
where f.slug = 'annathanam-14-16' and s.code = '4';

insert into public.function_sections (function_id, order_no, code, title, subtitle, kind, sponsor, vendor, estimate_amount, advance_paid, balance_paid)
select id, 5, '5', '16th — Lunch', '11:00 AM · 300 meals', 'menu', 'Venkatesh Suganya', null, null, null, null from public.event_functions where slug = 'annathanam-14-16';
insert into public.function_items (section_id, order_no, name, qty, unit)
select s.id, v.order_no, v.name, v.qty, v.unit
from public.function_sections s
join public.event_functions f on f.id = s.function_id
cross join (values
  (1, 'Rice (சாதம்)', '300', 'meals'),
  (2, 'Sambar (சாம்பார்)', null, null),
  (3, 'Paaysam (பாயாசம்)', null, null),
  (4, 'Masal Vadai (மசால் வடை)', null, null),
  (5, 'Appalam (அப்பளம்)', null, null),
  (6, 'Vatha Kuzhambu (வத்தல் குழம்பு )', null, null),
  (7, 'Rasam (ரசம்)', null, null),
  (8, 'More Kuzhambu (மோர் குழம்பு)', null, null)
) as v(order_no, name, qty, unit)
where f.slug = 'annathanam-14-16' and s.code = '5';

insert into public.function_sections (function_id, order_no, code, title, subtitle, kind, sponsor, vendor, estimate_amount, advance_paid, balance_paid)
select id, 6, '6', '16th — Evening', '7:00 PM · 300 meals', 'menu', 'Dineshkumar Pavithra - Rainbow Apartments', null, null, null, null from public.event_functions where slug = 'annathanam-14-16';
insert into public.function_items (section_id, order_no, name, qty, unit)
select s.id, v.order_no, v.name, v.qty, v.unit
from public.function_sections s
join public.event_functions f on f.id = s.function_id
cross join (values
  (1, 'Idli (இட்லி)', '300', 'meals'),
  (2, 'Sambar, Chutney (சாம்பார், சட்னி)', null, null),
  (3, 'Chappathi (சப்பாத்தி)', null, null),
  (4, 'Kurma (குர்மா)', null, null)
) as v(order_no, name, qty, unit)
where f.slug = 'annathanam-14-16' and s.code = '6';

commit;
