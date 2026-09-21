-- Revised quantities and ubhayams from
-- 'VINAYAGAR CHATURTHI 2026 MURUGARIYYAPAN.docx'.
--
-- Each statement targets one row by id rather than by name: the revised
-- sheet spells several items differently from the stored list, so matching
-- on text would silently update nothing.

begin;

-- Section 4: quantities revised down.
update public.function_items set qty = '1 கிலோ' where id = '99c805c9-25e6-413d-8691-9485700a0553';
update public.function_items set qty = '1 கிலோ' where id = '9b05f614-1740-4fde-96cc-f36ccf9cfc92';
update public.function_items set qty = '1 கிலோ' where id = 'b736c2c4-162e-42a9-a65b-ec02abded63a';
update public.function_items set qty = '10 லிட்' where id = '0396dc08-3a4d-4f34-b367-6e5a764b4f21';
update public.function_items set qty = '100 கி.' where id = 'ff58ac70-c4b9-4e3b-b7d9-3a615c412c7d';
update public.function_items set qty = '6 கி.' where id = '2c0853bd-18af-4794-87d6-c02facd1ddbc';
update public.function_items set qty = '2 கி.' where id = 'b6242543-c05b-4046-9c9d-781a2d5d1916';
update public.function_items set qty = '300 கி.' where id = '60353c41-4025-4122-86d7-1fdf2567f848';
update public.function_items set qty = 'அரை கிலோ' where id = 'e56d849c-7800-4ccf-9d53-fd02f3fa9bce';

-- Section 4.1: banana quantities revised.
update public.function_items set qty = '8 சீப்பு' where id = '44a51204-291e-4a1c-bc6c-88cd507d9973';
update public.function_items set qty = '1 சீப்பு' where id = '81a8391c-879f-444f-8dc2-40710dac6709';
update public.function_items set qty = '4 சீப்பு' where id = '5b6bd8ea-5a59-4d60-8d2f-167b42c232d6';

-- Section 7: garland count for the honoured guests.
update public.function_items set qty = '30 கதர் துண்டு' where id = 'ff899129-d9ab-4b62-a13a-cbab2f58c5e6';

-- Section 8: Mr Lakshmanan Sasikala's ubhayam covers every deity's
-- vastram; items 6-11 are the ones still needing a sponsor.
update public.function_items set sponsor = 'திரு. லஷ்மணன் சசிகலா', status = 'committed' where id = '880848d9-e47a-4d63-a411-c36fdc25a848';
update public.function_items set sponsor = 'திரு. லஷ்மணன் சசிகலா', status = 'committed' where id = '4dc9c862-a0d2-4ec8-a641-5c21c5694b97';
update public.function_items set sponsor = 'திரு. லஷ்மணன் சசிகலா', status = 'committed' where id = 'ca719a00-5f0a-4b5d-b2e0-72cc16348471';
update public.function_items set sponsor = 'திரு. லஷ்மணன் சசிகலா', status = 'committed' where id = '3a3df560-d45f-466f-8517-4648feb50cdb';
update public.function_items set sponsor = 'திரு. லஷ்மணன் சசிகலா', status = 'committed' where id = '82a00958-1d33-45ee-b31d-7760d197ec16';

-- Section 9: the revised sheet specifies small mirrors.
update public.function_items set qty = '2 (small)' where id = 'fcf11ab3-2154-4ac6-8f45-3d574f3b1983';

-- Section 10.1: prasadam ubhayams.
update public.function_items set sponsor = 'குமாரி அம்மா, மஞ்சுளா அம்மா', status = 'committed' where id = 'e013f9cb-1d69-430c-99b0-b79258d611a9';
update public.function_items set sponsor = 'சீமா (கலைஞர் நகர்)', status = 'committed' where id = '6684c3ac-429b-48bd-a53f-42c145e7f9c5';
update public.function_items set sponsor = 'புஷ்பவதி', status = 'committed' where id = '1db9e835-1634-4e89-8275-4a0a3e501d18';
update public.function_items set sponsor = 'அபிராமி (கலைஞர் நகர்)', status = 'committed' where id = '698dd32d-0a54-4bcc-a508-0eac4cb80f2c';
update public.function_items set sponsor = 'மணிமேகலை', status = 'committed' where id = '6dfd67b5-8958-4438-abfa-f93aac6b2266';
update public.function_items set sponsor = 'சுகன்யா', status = 'committed' where id = '80aaf7f5-56d3-47ec-9c95-6d30e0ae9d78';

-- Section 10.2: prasadam ubhayams.
update public.function_items set sponsor = 'அன்புச்செல்வி (ராமையா நகர்)', status = 'committed' where id = '32d362e8-a751-4336-876e-9857776d7fc3';
update public.function_items set sponsor = 'வினோதினி (ராமையா நகர்)', status = 'committed' where id = '8ff92266-cf40-4886-8c96-c35e8a34a60a';
update public.function_items set sponsor = 'பிரமோதினி (கலைஞர் நகர்)', status = 'committed' where id = 'c25f615e-7f35-43dd-9674-3550ceed238d';
update public.function_items set sponsor = 'சுகன்யா', status = 'committed' where id = '462d8aad-aa8f-4d58-87f4-2e8bf7b2830f';

-- Section 10.3: prasadam ubhayams.
update public.function_items set sponsor = 'கல்யாணி அம்மா', status = 'committed' where id = '0f4d1ecf-7424-4abc-b584-e1eca4039170';
update public.function_items set sponsor = 'ஆர்த்தி', status = 'committed' where id = '1f842958-85b9-4b16-a068-bbc11458b92e';
update public.function_items set sponsor = 'சுகன்யா', status = 'committed' where id = '9ac8d696-a636-41fa-85e2-75e7f06c828c';

-- Section 10.3: 'வடை, பாயசம்' is two items in the revised sheet, with a
-- different ubhayam each, so the combined row becomes the first of them
-- and the second is added after it.
update public.function_items set name = 'வடை (முடிந்தால்)', sponsor = 'ஸ்ரீதேவி & லட்சுமி', status = 'committed' where id = '2f2d4008-d621-4b77-8c4c-2b854c6c1aba';
insert into public.function_items (section_id, order_no, name, sponsor, status)
select id, 6, 'பாயசம் (முடிந்தால்)', 'உஷா', 'committed'
from public.function_sections s
where s.code = '10.3'
  and s.function_id = (select id from public.event_functions where slug = 'kumbabhishekam-2026')
  and not exists (
    select 1 from public.function_items i
    where i.section_id = s.id and i.name = 'பாயசம் (முடிந்தால்)'
  );

-- Section 12: the sheet's cost estimates.
update public.function_items set expected_amount = 60000 where id = '8b9f2c58-1dc5-4797-a4fd-e757fe07124b';
update public.function_items set expected_amount = 14000, qty = 'செங்கல் 1000' where id = '9210042a-f846-4243-bc73-d703b7ef659e';
update public.function_items set expected_amount = 30000, qty = 'சீரியல் விளக்கு, கொடி கம்பம் உள்பட' where id = '0be37f6e-0896-4189-914d-06b5f7ad4580';
update public.function_items set expected_amount = 25000, qty = 'யாகசாலை பந்தல் உள்பட' where id = 'd8c9df08-397f-45d9-9fed-e80f0176f165';

commit;
