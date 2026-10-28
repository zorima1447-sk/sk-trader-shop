-- ============================================================================
-- SK TRADER v27 - blog readers report (platform, link, city) + 10 new blog articles
-- Run once in Supabase > SQL Editor (safe to run again; existing articles are never overwritten).
-- Needs supabase_v23.sql first.
-- ============================================================================

-- Blog readers: where they came from (platform, website / link) and their city - per article and for the whole blog
create or replace function public.admin_blog_traffic(p_days int default 30)
returns json
language plpgsql stable security definer
set search_path = public
as $$
declare
  since timestamptz := now() - make_interval(days => greatest(1, least(coalesce(p_days, 30), 3650)));
begin
  if not public.is_admin() then raise exception 'Admin login required.'; end if;
  return (
    with ev as (
      select e.*, substring(e.path from '^/blog/([a-z0-9-]+)') as slug,
             nullif(lower(substring(coalesce(e.referrer, '') from '^https?://(?:www\.|m\.|l\.|lm\.)?([^/:?#]+)')), '') as ref_site
      from public.site_events e
      where e.event = 'post_view' and e.created_at >= since
    ),
    ev2 as (
      select ev.*,
        case when ref_site is null then null
             when ref_site like '%sktraderpk.com%' or ref_site like '%vercel.app%' then '(inside the website)'
             else ref_site end as ref_name
      from ev where slug is not null
    )
    select json_build_object(
      'all', json_build_object(
        'sources', (select coalesce(json_agg(x order by x.n desc), '[]'::json) from (select coalesce(source, 'direct') as name, count(distinct visitor_id) as n from ev2 group by 1) x),
        'cities', (select coalesce(json_agg(x order by x.n desc), '[]'::json) from (select coalesce(city, 'Unknown') as name, count(distinct visitor_id) as n from ev2 group by 1 order by 2 desc limit 15) x),
        'referrers', (select coalesce(json_agg(x order by x.n desc), '[]'::json) from (select ref_name as name, count(*) as n from ev2 where ref_name is not null group by 1 order by 2 desc limit 15) x),
        'devices', (select coalesce(json_agg(x order by x.n desc), '[]'::json) from (select coalesce(device, 'unknown') as name, count(distinct visitor_id) as n from ev2 group by 1) x)
      ),
      'posts', (select coalesce(json_agg(y), '[]'::json) from (
        select s.slug,
          (select json_agg(x order by x.n desc) from (select coalesce(source, 'direct') as name, count(*) as n from ev2 where ev2.slug = s.slug group by 1) x) as sources,
          (select json_agg(x order by x.n desc) from (select coalesce(city, 'Unknown') as name, count(*) as n from ev2 where ev2.slug = s.slug group by 1 order by 2 desc limit 8) x) as cities,
          (select json_agg(x order by x.n desc) from (select ref_name as name, count(*) as n from ev2 where ev2.slug = s.slug and ref_name is not null group by 1 order by 2 desc limit 8) x) as referrers,
          (select json_agg(x order by x.at desc) from (select created_at as at, coalesce(city, '') as city, coalesce(source, 'direct') as source, coalesce(ref_name, '') as ref, left(coalesce(referrer, ''), 300) as link, coalesce(device, '') as device, coalesce(user_name, user_email, '') as who
                                                        from ev2 where ev2.slug = s.slug order by created_at desc limit 15) x) as recent
        from (select distinct slug from ev2) s) y)
    )
  );
end $$;
grant execute on function public.admin_blog_traffic(int) to anon, authenticated;


-- 10 articles (Roman Urdu) with product boxes and home remedies - edit them any time in Admin > Blog & Pages
insert into public.site_posts (kind, slug, title, description, body, sort_order, created_at, translations) values
  ('blog', 'sar-ki-khushki-dandruff-ka-ilaj', $sk$Sar Ki Khushki (Dandruff) Ka Pakka Hal: Sahi Shampoo Aur Gharelu Totke$sk$, $sk$Dandruff kyun hota hai aur sar ki khushki se hamesha ke liye kaise jaan chhurayein: sahi shampoo, scalp care routine aur asar-daar gharelu totke.$sk$, $sk$<p>Kandhon par girti safed khushki na sirf sharmindagi ka sabab banti hai balki sar mein khujli aur baal girne ki wajah bhi ban jati hai. Pakistan mein sardiyon ki khushk hawa, garam paani se baal dhona aur ghalat shampoo is masle ko aur barha dete hain.</p>
<p>Achhi khabar yeh hai ke thori si samajh aur sahi routine se dandruff ko kaafi had tak control kiya ja sakta hai. Is article mein hum dekhenge ke khushki kyun hoti hai, is ka sahi ilaj kya hai aur kaun se gharelu totke waqai faida dete hain.</p>
<h2>1. Dandruff Kyun Hota Hai?</h2>
<ul>
<li><b>Scalp ka khushk hona:</b> Sardi, garam paani aur kam paani peene se sar ki jild khushk ho kar chhilke banati hai.</li>
<li><b>Tail aur fungus (Malassezia):</b> Chikne scalp par ek qudrati fungus barh jata hai jo khujli aur peeli, chipchipi khushki paida karta hai.</li>
<li><b>Baal kam dhona ya shampoo theek se na dhona:</b> Sar par jama mail aur bacha hua shampoo bhi khushki barhata hai.</li>
<li><b>Tension aur ghalat khuraak:</b> Zyada meetha, tali hui cheezein aur neend ki kami bhi asar dalti hain.</li>
</ul>
<h2>2. Dandruff Khatam Karne Ka Sahi Routine</h2>
<h3>Step 1: Hafte Mein 2-3 Baar Anti-Dandruff Shampoo</h3>
<p>Aisa shampoo istemal karein jo khaas taur par dandruff ke liye bana ho. Shampoo ko sirf baalon par nahi balki <b>scalp par 2-3 minute halki maalish</b> ke saath lagayein aur phir achhi tarah dhoyein. Bilkul garam paani ke bajaye neem garam ya thanda paani istemal karein.</p>
<h3>Step 2: Conditioner Sirf Baalon Par</h3>
<p>Conditioner ya hair mask hamesha baalon ki lambai par lagayein, scalp par nahi. Scalp par conditioner lagane se chikanai barhti hai aur khushki wapas aa sakti hai.</p>
<h3>Step 3: Kanghi Aur Takiya Saaf Rakhein</h3>
<p>Hafte mein ek baar kanghi dhoyein aur takiye ka ghilaaf badlein. Apni kanghi doosron se share na karein.</p>
<p>[[products: dandruff, shampoo | Khushki Se Pareshan? SK Trader ki Anti-Dandruff aur Scalp Care range dekhein]]</p>
<h2>3. Dandruff Ke Liye Gharelu Totke</h2>
<ul>
<li><b>Dahi (Yogurt) ka mask:</b> Saada dahi scalp par laga kar 20 minute chhor dein, phir shampoo se dho lein. Dahi scalp ko thanda aur naram karta hai.</li>
<li><b>Aloe vera gel:</b> Taaza aloe vera ka gel scalp par lagayein, 30 minute baad dho lein. Khujli aur jalan mein aaram deta hai.</li>
<li><b>Methi dana:</b> 2 chamach methi raat bhar bhigo kar subah paste bana lein, scalp par 30 minute lagayein aur dho lein. Hafte mein ek baar.</li>
<li><b>Neem ka paani:</b> Neem ke patte paani mein ubaal kar thanda karein aur shampoo ke baad aakhri rinse ke taur par istemal karein.</li>
<li><b>Nariyal tail ki halki maalish:</b> Khushk scalp par shampoo se ek ghanta pehle neem garam nariyal tail lagayein. Chikne scalp walay is se parhez karein.</li>
</ul>
<h2>4. In Ghaltiyon Se Bachein</h2>
<ul>
<li>Nakhunon se scalp na khurchein, is se zakhm aur infection ho sakta hai.</li>
<li>Raat bhar zyada tail laga kar na sooein agar aap ki khushki chipchipi aur peeli hai.</li>
<li>Seedha lemon ka ras scalp par na lagayein, is se jalan ho sakti hai.</li>
</ul>
<h2>Khulasa (Conclusion)</h2>
<p>Dandruff ek aam masla hai lekin sahi shampoo, saaf scalp aur thore se sabr se is par qaboo paya ja sakta hai. Do se teen hafte routine follow karein aur farq khud dekhein. Agar khushki ke saath laal dhabbe, zakhm ya baal tezi se gir rahe hon to dermatologist se zaroor milein.</p>
<p><i>Zaroori note: Har gharelu totka ya naya product pehle kaan ke peeche ya kalai par thori si jagah laga kar 24 ghante patch test karein. Agar khujli, jalan ya daane hon to istemal band kar dein, aur masla zyada ho to kisi skin specialist (dermatologist) se mashwara karein.</i></p><h2>Yeh Bhi Parhein</h2><ul><li><a href="/blog/baalon-ka-girna-kaise-rokein-hair-fall-control">Baalon Ka Girna Kaise Rokein? Hair Fall Control Ka Sahi Tareeqa</a></li><li><a href="/blog/chikna-sar-oily-scalp-ka-hal">Chikna Sar (Oily Scalp) Ka Asaan Hal</a></li></ul>$sk$, 0, now() - interval '3 hours', '{"_orig": "roman"}'::jsonb),
  ('blog', 'rukhe-bejaan-baal-naram-chamakdar-kaise-banayein', $sk$Rukhe Aur Bejaan Baalon Ko Naram Aur Chamakdar Kaise Banayein?$sk$, $sk$Frizzy, rukhe aur bejaan baalon ki wajah aur ilaj: hair mask, serum, sahi dhulai aur ghar ke asaan totke jo baalon mein chamak wapas layein.$sk$, $sk$<p>Agar aap ke baal choone mein sakht lagte hain, uljhe rehte hain aur un mein chamak nahi rahi to aap akeli nahi. Dhoop, dhool, garam paani, hair dryer aur color ya rebonding jaisay chemical treatments baalon ki qudrati nami cheen lete hain.</p>
<p>Baalon ko dobara naram aur chamakdar banane ke liye unhein <b>nami (moisture)</b> aur <b>protein</b> dono ki zaroorat hoti hai. Aayiye dekhte hain kaise.</p>
<h2>1. Baal Rukhe Kyun Ho Jate Hain?</h2>
<ul>
<li><b>Sulfate wale sakht shampoo:</b> Baalon ka qudrati tail utaar dete hain.</li>
<li><b>Heat styling:</b> Straightener, curler aur garam blow dryer baalon ki upar wali tah (cuticle) ko kharab karte hain.</li>
<li><b>Chemical treatments:</b> Bleach, color, rebonding ke baad agar sahi dekh bhaal na ho.</li>
<li><b>Mausam:</b> Sardiyon ki khushk hawa aur garmiyon ki tez dhoop.</li>
</ul>
<h2>2. Naram Aur Chamakdar Baalon Ka Routine</h2>
<h3>Step 1: Mild Shampoo Aur Har Baar Conditioner</h3>
<p>Narm, moisturizing shampoo istemal karein aur har dhulai ke baad conditioner zaroor lagayein. Conditioner 2-3 minute laga rehne dein phir thande paani se dhoyein, is se cuticle band hota hai aur chamak aati hai.</p>
<h3>Step 2: Hafte Mein Ek Baar Hair Mask</h3>
<p>Hair mask deep conditioning karta hai. Geele baalon par mask laga kar 10-20 minute shower cap se dhaanp dein, phir dho lein. Bohat rukhe baalon ke liye hafte mein do baar bhi kar sakte hain.</p>
<h3>Step 3: Serum Ya Leave-in Se Protect Karein</h3>
<p>Baal halke geele hon to 2-3 boondein serum ya leave-in cream sirf siron par lagayein. Yeh frizz kam karta hai aur dhoop aur garmi se bachata hai.</p>
<p>[[products: mask, serum, conditioner | Rukhe Baalon Ke Liye: SK Trader ke Hair Mask aur Serum]]</p>
<h2>3. Gharelu Totke Jo Nami Wapas Layein</h2>
<ul>
<li><b>Anda aur dahi mask:</b> 1 anda aur 3 chamach dahi mila kar baalon par 20 minute lagayein. Thande ya neem garam paani se dhoyein (garam paani se anda pak jata hai).</li>
<li><b>Kela aur shehad:</b> Ek pakka kela mash kar ke 1 chamach shehad milayein, baalon par 20-30 minute lagayein. Achhi tarah dhoyein taake kele ke tukre na rahein.</li>
<li><b>Garam tail treatment:</b> Nariyal, badaam ya zaitoon ka tail neem garam kar ke baalon mein lagayein aur ek ghante baad shampoo karein.</li>
<li><b>Aloe vera aur nariyal tail:</b> 2 chamach aloe gel mein 1 chamach nariyal tail mila kar lagayein, frizz kam karta hai.</li>
</ul>
<h2>4. Roz Ki Chhoti Aadaten</h2>
<ul>
<li>Geele baalon ko tauliye se ragrein nahi, sirf daba kar paani nikaalein.</li>
<li>Choree daanton wali kanghi istemal karein aur neeche se oopar suljhayein.</li>
<li>Resham (silk) ya satin ka takiya ghilaaf ragar kam karta hai.</li>
<li>Har 6-8 hafte baad siron ki halki trimming karwayein.</li>
</ul>
<h2>Khulasa (Conclusion)</h2>
<p>Rukhe baal ek din mein theek nahi hote, lekin mild shampoo, conditioner, hafte mein ek hair mask aur heat se bachao se 3-4 hafton mein numayan farq aata hai. Apne baalon ke saath narmi karein, woh aap ko chamak se jawab denge.</p>
<p><i>Zaroori note: Har gharelu totka ya naya product pehle kaan ke peeche ya kalai par thori si jagah laga kar 24 ghante patch test karein. Agar khujli, jalan ya daane hon to istemal band kar dein, aur masla zyada ho to kisi skin specialist (dermatologist) se mashwara karein.</i></p><h2>Yeh Bhi Parhein</h2><ul><li><a href="/blog/do-muhe-baal-split-ends-ka-ilaj">Do Muhe Baal (Split Ends) Ka Ilaj</a></li><li><a href="/blog/keratin-treatment-ke-baad-baalon-ki-dekh-bhaal">Keratin Ke Baad Baalon Ki Dekh Bhaal</a></li></ul>$sk$, 0, now() - interval '6 hours', '{"_orig": "roman"}'::jsonb),
  ('blog', 'do-muhe-baal-split-ends-ka-ilaj', $sk$Do Muhe Baal (Split Ends) Kyun Hote Hain Aur Inka Ilaj Kya Hai?$sk$, $sk$Split ends ki wajah, unhein kaise roka jaye aur ghar par baalon ke siron ki hifazat ke asaan tareeqay aur totke.$sk$, $sk$<p>Do muhe baal yaani split ends tab hote hain jab baal ka sira kamzor ho kar do ya zyada hisson mein phat jata hai. Is se baal bejaan, uljhe hue aur chhote nazar aate hain, aur baal lambe karne ki koshish bhi nakaam ho jati hai.</p>
<p>Sach yeh hai ke ek baar phata hua sira dobara jud nahi sakta, magar <b>naye split ends ko roka</b> ja sakta hai aur maujooda siron ko behtar dikhaya ja sakta hai.</p>
<h2>1. Split Ends Ki Wajahein</h2>
<ul>
<li>Baar baar straightener, curler aur garam dryer ka istemal.</li>
<li>Bleach, color aur rebonding jaisay chemical treatments.</li>
<li>Geele baalon ko zor se kanghi karna ya tauliye se ragarna.</li>
<li>Lambe arse tak trimming na karwana.</li>
<li>Tight pony aur rubber band jo baalon ko kheenchte hain.</li>
</ul>
<h2>2. Split Ends Rokne Ke Steps</h2>
<h3>Step 1: Har 6-8 Hafte Trimming</h3>
<p>Phate hue siron ka wahid pakka hal unhein kaatna hai. Sirf aadha inch trimming bhi baalon ko saaf aur ghana dikhati hai aur phatna oopar tak nahi jata.</p>
<h3>Step 2: Deep Conditioning Aur Hair Mask</h3>
<p>Hafte mein ek baar hair mask siron par khaas taur par lagayein. Mask baal ke kamzor hisson ko nami aur protein deta hai.</p>
<h3>Step 3: Heat Se Pehle Protection</h3>
<p>Straightener ya dryer se pehle heat protector ya serum zaroor lagayein aur temperature kam se kam rakhein.</p>
<p>[[products: mask, serum, keratin | Siron Ki Hifazat Ke Liye SK Trader ke Mask aur Serum]]</p>
<h2>3. Gharelu Totke</h2>
<ul>
<li><b>Badaam tail ki maalish:</b> Sone se pehle siron par 2-3 boond badaam tail lagayein.</li>
<li><b>Papita aur dahi mask:</b> Pake papite ka gooda aur 2 chamach dahi mila kar siron par 30 minute lagayein.</li>
<li><b>Anday ki zardi aur zaitoon tail:</b> 1 zardi, 1 chamach zaitoon tail aur 1 chamach shehad mila kar 20 minute lagayein, thande paani se dhoyein.</li>
<li><b>Aloe vera:</b> Raat ko siron par thora sa aloe gel laga kar choti bana lein.</li>
</ul>
<h2>4. Kya Na Karein</h2>
<ul>
<li>Geele baalon mein zor se kanghi na karein.</li>
<li>Har roz baalon ko kas kar na baandhein, naram scrunchie istemal karein.</li>
<li>Bohat garam paani se baal na dhoyein.</li>
</ul>
<h2>Khulasa (Conclusion)</h2>
<p>Split ends ka ilaj trimming hai aur bachao narmi, nami aur heat protection hai. Agar aap baal lambe karna chahti hain to har do mahine halki trimming aur hafte mein ek baar mask apni aadat bana lein.</p>
<p><i>Zaroori note: Har gharelu totka ya naya product pehle kaan ke peeche ya kalai par thori si jagah laga kar 24 ghante patch test karein. Agar khujli, jalan ya daane hon to istemal band kar dein, aur masla zyada ho to kisi skin specialist (dermatologist) se mashwara karein.</i></p><h2>Yeh Bhi Parhein</h2><ul><li><a href="/blog/rukhe-bejaan-baal-naram-chamakdar-kaise-banayein">Rukhe Baalon Ko Naram Kaise Banayein</a></li><li><a href="/blog/baal-lambe-aur-ghane-kaise-karein">Baal Lambe Aur Ghane Kaise Karein</a></li></ul>$sk$, 0, now() - interval '9 hours', '{"_orig": "roman"}'::jsonb),
  ('blog', 'ghar-par-hair-color-kaise-karein', $sk$Ghar Par Hair Color Kaise Karein: Sahi Shade Chunne Se Color Der Tak Rakhne Tak$sk$, $sk$Ghar par hair color lagane ka sahi tareeqa: shade kaise chunein, patch test, developer, lagane ke steps aur color ko der tak chamakdar rakhne ke tips.$sk$, $sk$<p>Salon jaye baghair ghar par khoobsurat hair color karna bilkul mumkin hai, bas sahi shade, sahi tareeqa aur thori si ehtiyaat chahiye. Ghalat shade ya ghalat tareeqay se lagaya gaya color ya to patchy aata hai ya jaldi utar jata hai.</p>
<h2>1. Sahi Shade Kaise Chunein?</h2>
<ul>
<li><b>Number samjhein:</b> Shade ka pehla number gehrai batata hai (1 = kala, 10 = bohat halka blonde). Point ke baad wala number tone batata hai (jaise .3 golden, .4 copper, .6 red).</li>
<li><b>Apne qudrati rang ke qareeb rahein:</b> Pehli baar 1-2 level se zyada farq na rakhein.</li>
<li><b>Safed baal cover karne ke liye:</b> Natural (.0) shades zyada achha cover karte hain.</li>
<li><b>Gehre baalon ko halka karna:</b> Color sirf color par halka nahi karta, is ke liye bleach ya high-lift ki zaroorat hoti hai.</li>
</ul>
<h2>2. Ghar Par Color Lagane Ke Steps</h2>
<h3>Step 1: 48 Ghante Pehle Patch Test</h3>
<p>Thora sa mix kiya hua color kaan ke peeche lagayein aur 48 ghante intezar karein. Jalan, sujan ya khujli ho to color hargiz na lagayein. Yeh qadam har baar zaroori hai.</p>
<h3>Step 2: Tayyari</h3>
<p>Color se ek din pehle baal dhoyein, color wale din nahi. Purane kapre pehnein, dastane (gloves) istemal karein aur maathe aur kaanon par Vaseline laga lein taake jild par daagh na lagein.</p>
<h3>Step 3: Mix Aur Lagayein</h3>
<p>Color aur developer ko box par likhi miqdaar mein milayein (aam taur par 1:1 ya 1:1.5). Baalon ko 4 hisson mein baant kar pehle jarron (roots) par aur phir lambai par lagayein. Safed baal hon to roots se shuru karein.</p>
<h3>Step 4: Waqt Aur Dhulai</h3>
<p>Box par diya gaya waqt (aksar 30-40 minute) poora karein. Phir neem garam paani se tab tak dhoyein jab tak paani saaf na aa jaye, aur color ke saath aane wala conditioner lagayein.</p>
<p>[[products: color, developer | SK Trader ki Professional Hair Color Range - har shade dekhein]]</p>
<h2>3. Color Ko Der Tak Chamakdar Rakhne Ke Tips</h2>
<ul>
<li>Color ke baad 48-72 ghante baal na dhoyein.</li>
<li>Sulfate-free ya "color protect" shampoo istemal karein.</li>
<li>Hafte mein ek baar hair mask lagayein.</li>
<li>Garam paani aur tez dhoop se bachein, dhoop mein dupatta ya scarf istemal karein.</li>
</ul>
<h2>4. Qudrati (Gharelu) Color Ke Totke</h2>
<ul>
<li><b>Mehndi aur coffee:</b> Mehndi ko gehri coffee ke paani mein gholein, is se lal ke bajaye bhoora (brown) rang aata hai.</li>
<li><b>Chai ka paani:</b> Kaali chai ka gaarha thanda paani aakhri rinse mein, halki chamak aur gehrai deta hai.</li>
<li><b>Ehtiyaat:</b> Mehndi lagane ke baad chemical color ya bleach lagane se pehle salon se mashwara karein, dono ka mel kabhi kabhi ajeeb rang de sakta hai.</li>
</ul>
<h2>Khulasa (Conclusion)</h2>
<p>Ghar par hair color ka raaz hai: sahi shade, patch test, sahi miqdaar aur poora waqt. Color ke baad thori si dekh bhaal se aap ka rang hafton tak taaza aur chamakdar rahega.</p>
<p><i>Zaroori note: Har gharelu totka ya naya product pehle kaan ke peeche ya kalai par thori si jagah laga kar 24 ghante patch test karein. Agar khujli, jalan ya daane hon to istemal band kar dein, aur masla zyada ho to kisi skin specialist (dermatologist) se mashwara karein.</i></p><h2>Yeh Bhi Parhein</h2><ul><li><a href="/blog/kam-umar-mein-safed-baal-wajah-aur-totke">Kam Umar Mein Safed Baal: Wajah Aur Totke</a></li><li><a href="/blog/rukhe-bejaan-baal-naram-chamakdar-kaise-banayein">Rukhe Baalon Ko Naram Kaise Banayein</a></li></ul>$sk$, 0, now() - interval '12 hours', '{"_orig": "roman"}'::jsonb),
  ('blog', 'kam-umar-mein-safed-baal-wajah-aur-totke', $sk$Kam Umar Mein Safed Baal: Wajah, Ehtiyaat Aur Gharelu Totke$sk$, $sk$Jawani mein baal safed kyun hote hain, kin vitamins ki kami asar karti hai, aur safed baalon ko chhupane aur sambhalne ke asaan tareeqay.$sk$, $sk$<p>Aaj kal 20-25 saal ki umar mein bhi safed baal nazar aana aam ho gaya hai. Is ki kai wajahein hain, aur kuch par hamara qaboo hai aur kuch par nahi. Is article mein hum samjhenge ke yeh kyun hota hai aur aap kya kar sakte hain.</p>
<h2>1. Kam Umar Mein Baal Safed Hone Ki Wajahein</h2>
<ul>
<li><b>Khandani asar (genetics):</b> Agar maa baap ke baal jaldi safed hue to aap ke bhi ho sakte hain. Is ko roka nahi ja sakta.</li>
<li><b>Vitamins ki kami:</b> Khaas taur par Vitamin B12, iron, copper aur Vitamin D ki kami.</li>
<li><b>Tension aur neend ki kami.</b></li>
<li><b>Thyroid ka masla.</b></li>
<li><b>Cigarette aur ghair-sehatmand khuraak.</b></li>
</ul>
<h2>2. Kya Karein?</h2>
<h3>Step 1: Doctor Se Test Karwayein</h3>
<p>Agar achanak bohat se baal safed ho rahe hain to doctor se B12, iron aur thyroid ka test karwayein. Kami poori karne se kuch logon mein naye safed baal aana kam ho jata hai.</p>
<h3>Step 2: Khuraak Behtar Karein</h3>
<p>Anda, doodh, dahi, gosht, machhli, daalein, hari sabziyan, akhrot aur badaam apni khuraak mein shamil karein. Amla aur kaddu ke beej bhi faidamand hain.</p>
<h3>Step 3: Safed Baal Chhupane Ka Sahi Tareeqa</h3>
<p>Thore safed baal hon to apne qudrati rang ke qareeb natural shade ka hair color sab se achha aur qudrati lagta hai. Har 4-6 hafte sirf roots par touch-up karein.</p>
<p>[[products: color, natural | Safed Baal Chhupane Ke Liye SK Trader ke Natural Shades]]</p>
<h2>3. Gharelu Totke</h2>
<ul>
<li><b>Amla aur nariyal tail:</b> Sookhe amla ke tukre nariyal tail mein paka kar tail kaala ho jaye to chhaan lein. Hafte mein 2 baar maalish karein.</li>
<li><b>Kari patta tail:</b> Mutthi bhar kari patte nariyal tail mein garam karein, thanda kar ke maalish karein.</li>
<li><b>Mehndi, kattha aur coffee:</b> Qudrati rang ke liye mehndi ko coffee ya kaali chai ke paani mein bhigo kar lagayein.</li>
<li><b>Kalonji tail:</b> Kalonji ka tail nariyal tail mein mila kar maalish karein.</li>
</ul>
<p><i>Yaad rahe: Koi tail ya totka safed ho chuke baalon ko dobara kaala nahi karta. Yeh scalp aur baalon ki sehat behtar karte hain aur qudrati color (mehndi) safed baal chhupata hai.</i></p>
<h2>4. Kya Na Karein</h2>
<ul>
<li>Safed baal todein mat, is se jar kharab ho sakti hai.</li>
<li>Har hafte poore baalon par color na karein, sirf roots par touch-up karein.</li>
<li>Sasti, bina naam ki dyes se bachein.</li>
</ul>
<h2>Khulasa (Conclusion)</h2>
<p>Kam umar mein safed baal aksar khandani hote hain, magar sahi khuraak, kam tension aur vitamins ki kami poori karne se in ki raftaar kam ho sakti hai. Jo safed baal aa chuke hain unhein achhe natural shade se khoobsurti se chhupaya ja sakta hai.</p>
<p><i>Zaroori note: Har gharelu totka ya naya product pehle kaan ke peeche ya kalai par thori si jagah laga kar 24 ghante patch test karein. Agar khujli, jalan ya daane hon to istemal band kar dein, aur masla zyada ho to kisi skin specialist (dermatologist) se mashwara karein.</i></p><h2>Yeh Bhi Parhein</h2><ul><li><a href="/blog/ghar-par-hair-color-kaise-karein">Ghar Par Hair Color Kaise Karein</a></li><li><a href="/blog/baalon-ka-girna-kaise-rokein-hair-fall-control">Baalon Ka Girna Kaise Rokein? Hair Fall Control Ka Sahi Tareeqa</a></li></ul>$sk$, 0, now() - interval '15 hours', '{"_orig": "roman"}'::jsonb),
  ('blog', 'chikna-sar-oily-scalp-ka-hal', $sk$Chikna Sar (Oily Scalp) Aur Jaldi Ganday Hone Wale Baal: Asaan Hal$sk$, $sk$Baal ek din mein chikne kyun ho jate hain? Oily scalp ki wajah, sahi shampoo routine aur gharelu totke jo baalon ko taaza rakhein.$sk$, $sk$<p>Subah dhoye hue baal shaam tak chipak jayein aur bejaan lagne lagein to wajah aksar <b>oily scalp</b> hoti hai. Hamare scalp ke ghadood (glands) qudrati tail (sebum) banate hain jo baalon ki hifazat karta hai, lekin jab yeh zarurat se zyada ban jaye to baal jaldi ganday lagte hain.</p>
<h2>1. Scalp Zyada Chikna Kyun Hota Hai?</h2>
<ul>
<li>Garmi, hawa mein nami aur paseena.</li>
<li>Hormones mein tabdeeli (khaas taur par jawani mein).</li>
<li>Baar baar baalon ko haath lagana ya bohat zyada kanghi karna.</li>
<li>Bhaari conditioner ya tail scalp par lagana.</li>
<li>Bohat zyada sakht shampoo: scalp khushk ho kar aur zyada tail banata hai.</li>
</ul>
<h2>2. Oily Scalp Ka Sahi Routine</h2>
<h3>Step 1: Halka (Clarifying) Shampoo</h3>
<p>Oily scalp ke liye bana halka shampoo istemal karein aur scalp par ungliyon ke poron se maalish karein. Zarurat ho to ek din chhor kar baal dhoyein, roz zor dar shampoo zaroori nahi.</p>
<h3>Step 2: Conditioner Sirf Siron Par</h3>
<p>Conditioner ya mask kaan ki lambai se neeche lagayein, scalp se door rakhein.</p>
<h3>Step 3: Thande Paani Se Aakhri Rinse</h3>
<p>Aakhir mein thanda paani daalne se scalp ke pores sikurte hain aur chamak barhti hai.</p>
<p>[[products: shampoo, scalp | Chikne Scalp Ke Liye SK Trader ke Shampoo]]</p>
<h2>3. Gharelu Totke</h2>
<ul>
<li><b>Multani mitti mask:</b> 2 chamach multani mitti ko gulab ke arq ya paani mein mila kar scalp par 15 minute lagayein, phir dho lein. Hafte mein ek baar.</li>
<li><b>Aloe vera:</b> Scalp par aloe gel 20 minute, chikanai kam aur scalp ko thanda karta hai.</li>
<li><b>Seb ka sirka (apple cider vinegar):</b> 2 chamach sirka ek mug paani mein mila kar shampoo ke baad rinse karein.</li>
<li><b>Green tea rinse:</b> Thandi green tea aakhri rinse mein.</li>
</ul>
<h2>4. Roz Ki Aadaten</h2>
<ul>
<li>Baalon ko baar baar haath na lagayein.</li>
<li>Kanghi aur takiya saaf rakhein.</li>
<li>Paani zyada piyein aur tali hui cheezein kam khayein.</li>
<li>Jaldi mein ho to dry shampoo ya thora sa talcum roots par laga kar brush kar sakte hain.</li>
</ul>
<h2>Khulasa (Conclusion)</h2>
<p>Oily scalp ka ilaj zyada shampoo nahi balki <b>sahi</b> shampoo aur sahi tareeqa hai. Halka shampoo, scalp se door conditioner aur hafte mein ek multani mitti mask se aap ke baal zyada der taaza rahenge.</p>
<p><i>Zaroori note: Har gharelu totka ya naya product pehle kaan ke peeche ya kalai par thori si jagah laga kar 24 ghante patch test karein. Agar khujli, jalan ya daane hon to istemal band kar dein, aur masla zyada ho to kisi skin specialist (dermatologist) se mashwara karein.</i></p><h2>Yeh Bhi Parhein</h2><ul><li><a href="/blog/sar-ki-khushki-dandruff-ka-ilaj">Sar Ki Khushki (Dandruff) Ka Hal</a></li><li><a href="/blog/baalon-ka-girna-kaise-rokein-hair-fall-control">Baalon Ka Girna Kaise Rokein? Hair Fall Control Ka Sahi Tareeqa</a></li></ul>$sk$, 0, now() - interval '18 hours', '{"_orig": "roman"}'::jsonb),
  ('blog', 'baal-lambe-aur-ghane-kaise-karein', $sk$Baal Lambe Aur Ghane Kaise Karein: Growth Ke Liye 7 Asaan Aadaten$sk$, $sk$Baalon ki growth tez karne aur unhein ghana dikhane ke 7 asaan tareeqay: maalish, khuraak, sahi products aur gharelu totke.$sk$, $sk$<p>Har koi lambe, ghane aur mazboot baal chahta hai. Baal aam taur par mahine mein taqreeban aadha inch barhte hain. Hum is raftaar ko jaadu se dugna to nahi kar sakte, lekin <b>tootne se bacha kar</b> aur scalp ko sehatmand rakh kar baal zaroor lambe aur ghane bana sakte hain.</p>
<h2>1. Baal Kyun Nahi Barhte?</h2>
<ul>
<li>Baal barhte hain magar siron se toot jate hain (split ends, heat, chemical).</li>
<li>Protein, iron aur vitamins ki kami.</li>
<li>Kamzor ya khushki wala scalp.</li>
<li>Tension, neend ki kami aur hormones.</li>
</ul>
<h2>2. Growth Ke Liye 7 Aadaten</h2>
<h3>1) Hafte Mein 2 Baar Scalp Maalish</h3>
<p>5 minute ungliyon ke poron se goal goal maalish khoon ki gardish barhati hai. Tail ke saath ya baghair dono tarah kar sakte hain.</p>
<h3>2) Protein Wali Khuraak</h3>
<p>Baal protein se bante hain. Anda, daal, chane, doodh, dahi, machhli aur gosht khayein. Palak aur khajoor iron dete hain.</p>
<h3>3) Narm Shampoo Aur Har Baar Conditioner</h3>
<p>Baalon ko tootne se bachane ke liye mild shampoo aur conditioner zaroori hain.</p>
<h3>4) Hafte Mein Ek Hair Mask</h3>
<p>Mask baalon ko lachakdaar banata hai taake woh kanghi karte waqt na tootein.</p>
<h3>5) Heat Kam Karein</h3>
<p>Straightener aur dryer ka istemal kam karein, aur zarurat ho to heat protector lagayein.</p>
<h3>6) Har 8-10 Hafte Halki Trimming</h3>
<p>Phate siron ko kaatne se baal oopar tak nahi phatte aur lambai bachi rehti hai.</p>
<h3>7) Raat Ko Naram Choti</h3>
<p>Satin takiya ya dheeli choti raat ki ragar se bachati hai.</p>
<p>[[products: oil, shampoo, mask | Ghane Aur Mazboot Baalon Ke Liye SK Trader ki Hair Care Range]]</p>
<h2>3. Gharelu Totke</h2>
<ul>
<li><b>Pyaz ka ras:</b> Pyaz ka ras roots par 20-30 minute laga kar halke shampoo se dhoyein. Kuch logon ko faida hota hai; jalan ho to foran dho dein.</li>
<li><b>Methi aur dahi:</b> Bhigoi hui methi ka paste dahi mein mila kar scalp par 30 minute.</li>
<li><b>Kalonji, castor aur nariyal tail:</b> Teeno barabar mila kar hafte mein 2 baar maalish.</li>
<li><b>Chawal ka paani:</b> Chawal bhigo kar bacha hua paani 1 din rakh kar aakhri rinse mein istemal karein, baalon ko mazbooti deta hai.</li>
</ul>
<h2>Khulasa (Conclusion)</h2>
<p>Lambe baalon ka raaz sabr aur mustaqil mizaji hai. Achhi khuraak, scalp maalish aur tootne se bachao ki aadat 3-6 mahine mein numayan farq dikhati hai. Agar baal achanak bohat zyada gir rahe hon to doctor se zaroor mashwara karein.</p>
<p><i>Zaroori note: Har gharelu totka ya naya product pehle kaan ke peeche ya kalai par thori si jagah laga kar 24 ghante patch test karein. Agar khujli, jalan ya daane hon to istemal band kar dein, aur masla zyada ho to kisi skin specialist (dermatologist) se mashwara karein.</i></p><h2>Yeh Bhi Parhein</h2><ul><li><a href="/blog/baalon-ka-girna-kaise-rokein-hair-fall-control">Baalon Ka Girna Kaise Rokein? Hair Fall Control Ka Sahi Tareeqa</a></li><li><a href="/blog/do-muhe-baal-split-ends-ka-ilaj">Do Muhe Baal (Split Ends) Ka Ilaj</a></li></ul>$sk$, 0, now() - interval '21 hours', '{"_orig": "roman"}'::jsonb),
  ('blog', 'keratin-treatment-ke-baad-baalon-ki-dekh-bhaal', $sk$Keratin Treatment Ke Baad Baalon Ki Dekh Bhaal: Kya Karein, Kya Na Karein$sk$, $sk$Keratin ya protein treatment ka asar mahinon tak kaise rakhein: pehle 72 ghante, sahi shampoo, mask aur woh ghaltiyan jo keratin jaldi khatam karti hain.$sk$, $sk$<p>Keratin treatment baalon ko seedha, naram aur frizz-free bana deta hai. Lekin is ka asar kitne din rahega yeh bohat had tak <b>treatment ke baad ki dekh bhaal</b> par munhasir hai. Sahi care se keratin 3-5 mahine tak chal sakta hai.</p>
<h2>1. Pehle 72 Ghante: Sab Se Zaroori</h2>
<ul>
<li>Baal na dhoyein aur un par paani na lagne dein.</li>
<li>Baalon ko na baandhein, na clip lagayein, na kaanon ke peeche karein, warna nishaan pad jate hain.</li>
<li>Paseene aur barish se bachein.</li>
<li>Agar salon ne kaha ho to ek ya do baar straightener phir sakte hain.</li>
</ul>
<h2>2. Keratin Ke Baad Ka Routine</h2>
<h3>Step 1: Sulfate-Free Shampoo</h3>
<p>Sulfate aur namak (sodium chloride) wale shampoo keratin ko jaldi utaar dete hain. Hamesha sulfate-free ya keratin ke liye bana shampoo istemal karein.</p>
<h3>Step 2: Har Dhulai Ke Baad Conditioner, Hafte Mein Mask</h3>
<p>Keratin ke liye bana conditioner aur hafte mein ek baar mask baalon ki smoothness barqarar rakhta hai.</p>
<h3>Step 3: Kam Dhulai</h3>
<p>Hafte mein 2-3 baar se zyada baal na dhoyein aur neem garam paani istemal karein.</p>
<p>[[products: keratin, sulfate, mask | Keratin Ke Baad Ki Care: SK Trader ki Keratin Range]]</p>
<h2>3. In Cheezon Se Bachein</h2>
<ul>
<li>Swimming pool ka chlorine aur samundar ka khara paani.</li>
<li>Pehle 2 hafte hair color ya bleach (pehle color karwana ho to keratin se pehle karwayein).</li>
<li>Raat ko geele baal le kar sona.</li>
<li>Bohat zyada tail lagana, yeh keratin ki tah ko kamzor karta hai.</li>
</ul>
<h2>4. Halke Gharelu Totke (Hafte Mein Ek Baar)</h2>
<ul>
<li><b>Aloe vera gel:</b> Baalon ki lambai par 20 minute, phir sulfate-free shampoo.</li>
<li><b>Dahi aur shehad:</b> Naram aur chamakdar rakhne ke liye 20 minute ka halka mask.</li>
<li><b>Nariyal ka doodh:</b> Siron par 15-20 minute, nami deta hai.</li>
</ul>
<p><i>Note: Bhaari tail ya nimbu jaisi tezabi cheezein keratin ke baad na lagayein.</i></p>
<h2>Khulasa (Conclusion)</h2>
<p>Keratin ka paisa wasool karna hai to pehle 3 din ehtiyaat, sulfate-free shampoo aur hafte mein ek mask ko aadat bana lein. Is se aap ke baal mahinon tak seedhe, naram aur chamakdar rahenge.</p>
<p><i>Zaroori note: Har gharelu totka ya naya product pehle kaan ke peeche ya kalai par thori si jagah laga kar 24 ghante patch test karein. Agar khujli, jalan ya daane hon to istemal band kar dein, aur masla zyada ho to kisi skin specialist (dermatologist) se mashwara karein.</i></p><h2>Yeh Bhi Parhein</h2><ul><li><a href="/blog/rukhe-bejaan-baal-naram-chamakdar-kaise-banayein">Rukhe Baalon Ko Naram Kaise Banayein</a></li><li><a href="/blog/do-muhe-baal-split-ends-ka-ilaj">Do Muhe Baal (Split Ends) Ka Ilaj</a></li></ul>$sk$, 0, now() - interval '24 hours', '{"_orig": "roman"}'::jsonb),
  ('blog', 'ghar-par-wax-kaise-karein', $sk$Ghar Par Wax Kaise Karein: Kam Dard, Saaf Skin Aur Zaroori Ehtiyaat$sk$, $sk$Ghar par waxing ka mukammal tareeqa: wax ki qisam, step by step tareeqa, dard kam karne ke tips, ghar par sugar wax aur wax ke baad skin care.$sk$, $sk$<p>Waxing baal jar se nikaalti hai, is liye skin hafton tak saaf aur mulaayam rehti hai aur dobara aane wale baal patle hote jate hain. Thori si practice aur sahi tareeqay se aap ghar par bhi salon jaisi waxing kar sakti hain.</p>
<h2>1. Wax Ki Qismein</h2>
<ul>
<li><b>Hot wax (hard wax / beans):</b> Garam kar ke lagaya jata hai aur sookhne par baghair patti ke khud utaara jata hai. Chehre, underarms aur hassas jagahon ke liye behtar, dard kam.</li>
<li><b>Warm (strip) wax:</b> Patli tah laga kar kapre ki patti se kheencha jata hai. Bazu aur taangon ke liye tez aur asaan.</li>
<li><b>Cold wax strips:</b> Tayyar pattiyan, safar ke liye asaan.</li>
</ul>
<h2>2. Ghar Par Waxing Ke Steps</h2>
<h3>Step 1: Tayyari</h3>
<p>Baal kam az kam chawal ke daane jitne (taqreeban 0.5 cm) lambe hon. Ek din pehle halka scrub karein. Waxing se pehle skin saaf aur bilkul khushk ho, thora sa talcum powder lagayein.</p>
<h3>Step 2: Wax Ka Sahi Temperature</h3>
<p>Wax ko heater ya double boiler mein garam karein aur pehle kalai ke andar thora sa laga kar check karein. Wax shehad jaisa patla ho, bohat garam nahi.</p>
<h3>Step 3: Baalon Ki Simt Mein Lagayein, Ulti Simt Mein Kheenchein</h3>
<p>Wax ko baal ugne ki simt mein patli tah mein lagayein. Skin ko doosre haath se kas kar pakrein aur patti ya wax ko <b>tezi se, skin ke qareeb rehte hue</b> ulti simt mein kheenchein. Ahista kheenchne se dard zyada hota hai.</p>
<h3>Step 4: Baad Ki Care</h3>
<p>Bacha hua wax baby oil ya wax remover oil se saaf karein. Phir aloe vera gel ya after-wax lotion lagayein.</p>
<p>[[products: wax | Smooth Skin Ke Liye SK Trader ki Wax Range]]</p>
<h2>3. Ghar Par Sugar Wax (Halwa Wax) Ka Totka</h2>
<ul>
<li>1 cup cheeni, 2 chamach nimbu ka ras aur 2 chamach paani dheemi aanch par pakayein.</li>
<li>Jab rang shehad jaisa sunehra ho jaye to aanch band kar dein (gehra bhoora na hone dein).</li>
<li>Thora thanda kar ke kalai par check karein, phir patti ke saath istemal karein.</li>
<li>Sugar wax paani se dhul jata hai aur hassas skin par naram hai.</li>
</ul>
<h2>4. Dard Aur Daane Kam Karne Ke Tips</h2>
<ul>
<li>Periods se pehle ke dinon mein skin zyada hassas hoti hai, mumkin ho to un dinon mein waxing na karein.</li>
<li>Waxing ke baad 24 ghante dhoop, garam paani, swimming aur khushboo wali creams se bachein.</li>
<li>Andar ugne wale baal (ingrown) se bachne ke liye 2-3 din baad hafte mein do baar halka scrub karein.</li>
<li>Barf ka tukda kapre mein lapet kar laal jagah par rakhein, jalan kam hoti hai.</li>
<li>Zakhm, dhoop se jali skin, moles ya retinoid creams wali skin par wax na karein.</li>
</ul>
<h2>Khulasa (Conclusion)</h2>
<p>Sahi wax, sahi temperature aur tez kheenchne ka tareeqa seekh lein to ghar par waxing asaan, sasti aur kam dard wali ho jati hai. Baad mein aloe vera aur thori si ehtiyaat skin ko mulaayam aur saaf rakhti hai.</p>
<p><i>Zaroori note: Har gharelu totka ya naya product pehle kaan ke peeche ya kalai par thori si jagah laga kar 24 ghante patch test karein. Agar khujli, jalan ya daane hon to istemal band kar dein, aur masla zyada ho to kisi skin specialist (dermatologist) se mashwara karein.</i></p><h2>Yeh Bhi Parhein</h2><ul><li><a href="/blog/chehre-par-qudrati-nikhar-ghar-par-facial">Ghar Par Facial Ka Asaan Tareeqa</a></li></ul>$sk$, 0, now() - interval '27 hours', '{"_orig": "roman"}'::jsonb),
  ('blog', 'chehre-par-qudrati-nikhar-ghar-par-facial', $sk$Chehre Par Qudrati Nikhar: Ghar Par Facial Ka Asaan Tareeqa$sk$, $sk$Ghar par salon jaisa facial kaise karein: 6 asaan steps, facial kit ka sahi istemal aur besan, haldi, dahi jaisay gharelu ubtan aur masks.$sk$, $sk$<p>Dhool, dhoop, pollution aur makeup chehre ki chamak cheen lete hain. Har mahine salon jana mumkin na ho to ghar par sirf 30-40 minute mein facial kar ke aap chehre par taazgi aur nikhar la sakti hain.</p>
<h2>1. Chehre Ki Chamak Kyun Kam Hoti Hai?</h2>
<ul>
<li>Murda khaliyon (dead skin) ki tah jo jild ko bejaan dikhati hai.</li>
<li>Band pores, blackheads aur whiteheads.</li>
<li>Paani ki kami, neend ki kami aur dhoop.</li>
<li>Raat ko makeup utaare baghair sona.</li>
</ul>
<h2>2. Ghar Par Facial Ke 6 Steps</h2>
<h3>Step 1: Cleansing</h3>
<p>Cleanser ya face wash se chehra 1 minute halki maalish ke saath saaf karein.</p>
<h3>Step 2: Scrub</h3>
<p>Narm scrub 1-2 minute goal goal ghuma kar lagayein, khaas taur par naak aur thodi par. Zor se na ragrein.</p>
<h3>Step 3: Bhaap (Steam)</h3>
<p>5 minute garam paani ki bhaap lein (chehra paani se 30 cm door rakhein). Pores khulte hain aur blackheads asaani se nikalte hain.</p>
<h3>Step 4: Massage Cream</h3>
<p>Facial kit ki massage cream se 8-10 minute neeche se oopar ki taraf maalish karein. Khoon ki gardish barh kar chehre par gulaabi nikhar aata hai.</p>
<h3>Step 5: Mask</h3>
<p>Pack ya mask 15 minute laga kar neem garam paani se dhoyein.</p>
<h3>Step 6: Toner Aur Moisturizer</h3>
<p>Gulab ka arq ya toner lagayein, phir moisturizer. Din ho to sunscreen zaroor lagayein.</p>
<p>[[products: facial, kit, scrub, cream | Ghar Par Facial: SK Trader ki Facial Kits aur Skin Care]]</p>
<h2>3. Gharelu Ubtan Aur Masks</h2>
<ul>
<li><b>Besan, haldi aur dahi:</b> 2 chamach besan, chutki bhar haldi aur dahi mila kar 15 minute. Chamak aur saaf rangat ke liye.</li>
<li><b>Shehad aur nimbu (sirf chikni skin):</b> 1 chamach shehad mein 3-4 boond nimbu, 10 minute. Hassas skin par nimbu na lagayein, aur lagane ke baad dhoop se bachein.</li>
<li><b>Multani mitti aur gulab ka arq:</b> Chikni aur daanon wali skin ke liye 10-15 minute.</li>
<li><b>Kheera aur aloe vera:</b> Dhoop se jali ya khushk skin ko thandak aur nami deta hai.</li>
<li><b>Oats aur doodh:</b> Naram scrub, khushk aur hassas skin ke liye.</li>
</ul>
<h2>4. Nikhar Barqarar Rakhne Ki Aadaten</h2>
<ul>
<li>Roz 8-10 glass paani piyein.</li>
<li>Raat ko hamesha makeup utaar kar sooein.</li>
<li>Har roz sunscreen lagayein, badal mein bhi.</li>
<li>Facial mahine mein 1-2 baar kaafi hai, zyada scrub skin ko kharab karta hai.</li>
</ul>
<h2>Khulasa (Conclusion)</h2>
<p>Ghar par facial mushkil nahi: saaf karein, scrub, bhaap, maalish, mask aur moisturizer. Achhi facial kit aur ghar ke qudrati ubtan se aap mahine bhar chehre par taazgi aur nikhar rakh sakti hain.</p>
<p><i>Zaroori note: Har gharelu totka ya naya product pehle kaan ke peeche ya kalai par thori si jagah laga kar 24 ghante patch test karein. Agar khujli, jalan ya daane hon to istemal band kar dein, aur masla zyada ho to kisi skin specialist (dermatologist) se mashwara karein.</i></p><h2>Yeh Bhi Parhein</h2><ul><li><a href="/blog/ghar-par-wax-kaise-karein">Ghar Par Wax Kaise Karein</a></li></ul>$sk$, 0, now() - interval '30 hours', '{"_orig": "roman"}'::jsonb)
on conflict (slug) do nothing;

notify pgrst, 'reload schema';
