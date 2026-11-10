begin;

-- Original lesson IDs, reviews, and progress remain the source of truth.
do $bank$
declare
  v_course uuid;
  v_admin uuid;
  v_question record;
  v_items jsonb := $questions$[
    {"key":"ent211-study-01","lesson":"value","prompt":"A market trader notices that workers cannot buy lunch during a short break. Which action best tests whether the gap is a business opportunity?","answer":"Offer a small preorder pilot and measure repeat purchases","options":["Offer a small preorder pilot and measure repeat purchases","Rent a large restaurant before testing demand","Wait for every nearby competitor to close","Estimate demand using only friends' opinions"],"aliases":null,"explanation":"A limited pilot tests whether customers actually buy the proposed solution."},
    {"key":"ent211-study-02","lesson":"value","prompt":"A reliable customer problem becomes an entrepreneurial opportunity when a venture can solve it and create ___.","answer":"value","options":null,"aliases":["value"],"explanation":"Entrepreneurship connects an unmet need with a solution that creates value."},
    {"key":"ent211-study-03","lesson":"intra","prompt":"An employee pilots a new delivery service using the employer's budget and facilities. How should the activity be classified?","answer":"Intrapreneurship","options":["Intrapreneurship","Independent entrepreneurship","A cooperative","Consumer-to-consumer commerce"],"aliases":null,"explanation":"The employee innovates inside an established organization."},
    {"key":"ent211-study-04","lesson":"intra","prompt":"What distinguishes a founder from an intrapreneur when both introduce the same idea?","answer":"Whether they develop it independently or inside an existing organization","options":["Whether they develop it independently or inside an existing organization","Whether the idea uses digital tools","Whether either of them works on a team","Whether the idea improves a process"],"aliases":null,"explanation":"The setting and organizational ownership distinguish the roles."},
    {"key":"ent211-study-05","lesson":"theory","prompt":"A low-cost technology replaces an older industry practice and makes some existing firms obsolete. What concept explains this pattern?","answer":"Creative destruction","options":["Creative destruction","Market segmentation","Social entrepreneurship","A strategic alliance"],"aliases":null,"explanation":"Schumpeter described how innovation can displace established products and industries."},
    {"key":"ent211-study-06","lesson":"theory","prompt":"A researcher explains venture formation mainly through family expectations and community support. Which perspective fits?","answer":"Sociological theory","options":["Sociological theory","Innovation theory","Psychological theory","A financial projection"],"aliases":null,"explanation":"The sociological perspective emphasizes culture, families and networks."},
    {"key":"ent211-study-07","lesson":"why","prompt":"A worker starts a repair business because paid employment is unavailable. This is ___ entrepreneurship.","answer":"necessity-based","options":null,"aliases":["necessity-based","necessity based","necessity"],"explanation":"The motive is limited alternatives rather than a newly identified market gap."},
    {"key":"ent211-study-08","lesson":"why","prompt":"Which effect is an example of a venture contributing to its wider economy?","answer":"Training and hiring local workers as orders grow","options":["Training and hiring local workers as orders grow","Increasing the owner's private savings only","Reclassifying old stock on a balance sheet","Changing a logo without changing its operations"],"aliases":null,"explanation":"Employment and skills development extend the venture's impact beyond the owner."},
    {"key":"ent211-study-09","lesson":"traits","prompt":"A founder has three expansion options. Which action shows calculated risk-taking?","answer":"Compare losses and benefits, then run the smallest informative pilot","options":["Compare losses and benefits, then run the smallest informative pilot","Commit the full budget to the fastest option","Pick the option a friend prefers","Postpone any decision until uncertainty disappears"],"aliases":null,"explanation":"Calculated risk balances possible outcomes and limits exposure while testing."},
    {"key":"ent211-study-10","lesson":"traits","prompt":"Which skill is most directly developed through practice rather than treated as an innate trait in the notes?","answer":"Preparing and interpreting a cash-flow forecast","options":["Preparing and interpreting a cash-flow forecast","An intuitive first impression","A spontaneous burst of curiosity","A natural preference for novelty"],"aliases":null,"explanation":"Financial literacy can be deliberately acquired and improved."},
    {"key":"ent211-study-11","lesson":"traits","prompt":"A team discovers a defect before dispatch. Which response best demonstrates ethical leadership?","answer":"Tell customers about the delay and fix the defect","options":["Tell customers about the delay and fix the defect","Dispatch the order and address it only if someone complains","Change the product description after delivery","Ask staff to keep the problem from customers"],"aliases":null,"explanation":"Ethical leadership protects customers through honest communication and corrective action."},
    {"key":"ent211-study-12","lesson":"thinking","prompt":"After a failed launch, the founder compares predicted and actual sales before redesigning the offer. This is ___ thinking.","answer":"reflective","options":null,"aliases":["reflective"],"explanation":"Reflective thinking draws lessons from prior outcomes."},
    {"key":"ent211-study-13","lesson":"thinking","prompt":"Which action most clearly demonstrates critical thinking before a new launch?","answer":"Check whether evidence supports the estimated market size","options":["Check whether evidence supports the estimated market size","List as many product names as possible","Copy a successful competitor's packaging","Recall the founder's last success without examining the data"],"aliases":null,"explanation":"Critical thinking questions assumptions and checks evidence."},
    {"key":"ent211-study-14","lesson":"thinking","prompt":"A team temporarily suspends judgment while generating many possible solutions. Which technique is it using?","answer":"Brainstorming","options":["Brainstorming","Cash-flow forecasting","Competitor benchmarking","Risk transfer"],"aliases":null,"explanation":"Brainstorming separates the creation of ideas from their later evaluation."},
    {"key":"ent211-study-15","lesson":"innovation","prompt":"A maker keeps the product unchanged but automates quality checks. Which innovation is this?","answer":"Process innovation","options":["Process innovation","Product innovation","Marketing innovation","Business model innovation"],"aliases":null,"explanation":"The method of production changes while the product stays the same."},
    {"key":"ent211-study-16","lesson":"innovation","prompt":"A retailer replaces one-off sales with a subscription for the same service. Which dimension primarily changes?","answer":"Business model innovation","options":["Business model innovation","Product innovation","Organizational innovation","Process innovation"],"aliases":null,"explanation":"A subscription changes how the business captures value."},
    {"key":"ent211-study-17","lesson":"innovation","prompt":"Cross-functional teams replace a rigid hierarchy to speed up decisions. This is ___ innovation.","answer":"organizational","options":null,"aliases":["organizational","organisational"],"explanation":"The change concerns management structure and work practices."},
    {"key":"ent211-study-18","lesson":"innovation","prompt":"An employee uses findings from customer research to redesign a service. What knowledge activity is this?","answer":"Knowledge application","options":["Knowledge application","Knowledge creation only","Knowledge storage only","Knowledge acquisition only"],"aliases":null,"explanation":"The employee turns existing insights into a practical change."},
    {"key":"ent211-study-19","lesson":"plan","prompt":"Which section should explain how a bakery will choose suppliers and schedule production?","answer":"Operational plan","options":["Operational plan","Executive summary","Market analysis","Financial plan"],"aliases":null,"explanation":"The operational plan describes how day-to-day production and sourcing will work."},
    {"key":"ent211-study-20","lesson":"plan","prompt":"A lender asks when the venture might run short of cash despite making a profit. Which projection answers that question?","answer":"Cash-flow forecast","options":["Cash-flow forecast","Target customer profile","Ownership chart","Competitor map"],"aliases":null,"explanation":"A cash-flow forecast tracks when money is actually received and paid."},
    {"key":"ent211-study-21","lesson":"plan","prompt":"The one-page overview of a venture's purpose, proposal and goals is its ___.","answer":"executive summary","options":null,"aliases":["executive summary"],"explanation":"The executive summary gives readers a concise overview of the full plan."},
    {"key":"ent211-study-22","lesson":"plan","prompt":"Surveying competing products and customers' willingness to pay primarily belongs in ___.","answer":"market analysis","options":null,"aliases":["market analysis","the market analysis"],"explanation":"Market analysis examines customers, competition and demand."},
    {"key":"ent211-study-23","lesson":"ownership","prompt":"Farmers jointly own a storage facility and operate it for their shared benefit. Which structure fits?","answer":"Cooperative","options":["Cooperative","Sole proprietorship","Public limited company","A supplier agreement"],"aliases":null,"explanation":"A cooperative is owned and operated for the mutual benefit of its members."},
    {"key":"ent211-study-24","lesson":"ownership","prompt":"What trade-off does a sole proprietor typically make compared with a limited liability company?","answer":"Simpler control in exchange for greater personal liability","options":["Simpler control in exchange for greater personal liability","More external owners in exchange for fewer decisions","Public share trading in exchange for lower disclosure","Shared voting rights in exchange for less responsibility"],"aliases":null,"explanation":"A sole proprietorship provides direct control but generally does not separate business liabilities from the owner."},
    {"key":"ent211-study-25","lesson":"ownership","prompt":"In the registration process described in the notes, what should the founder check before submitting the proposed name?","answer":"Whether the name is available","options":["Whether the name is available","Whether the name appears in the cash-flow forecast","Whether every competitor approves it","Whether the name already has foreign customers"],"aliases":null,"explanation":"The name search tests whether the proposed name is available for registration."},
    {"key":"ent211-study-26","lesson":"network","prompt":"Two firms share distribution channels but remain separate businesses. What arrangement best fits?","answer":"Strategic alliance","options":["Strategic alliance","Sole proprietorship","A new joint-venture entity","A public offering"],"aliases":null,"explanation":"The firms cooperate without establishing a separate project entity."},
    {"key":"ent211-study-27","lesson":"network","prompt":"Two firms establish a new entity to deliver one shared project. This arrangement is a ___.","answer":"joint venture","options":null,"aliases":["joint venture"],"explanation":"A joint venture pools resources for a specified project or objective."},
    {"key":"ent211-study-28","lesson":"network","prompt":"A founder joins a chamber of commerce to meet suppliers. What type of network is this?","answer":"Formal network","options":["Formal network","Informal family network","Direct ownership structure","A sales contract"],"aliases":null,"explanation":"A chamber is an organized professional association."},
    {"key":"ent211-study-29","lesson":"nigeria","prompt":"A food processor needs longer-term financing for industrial equipment. Which institution from the notes is the closest fit?","answer":"Bank of Industry","options":["Bank of Industry","National Directorate of Employment","Fate Foundation","Nigerian Young Professionals Forum"],"aliases":null,"explanation":"The notes identify BOI as a source of finance for industrial and SME projects."},
    {"key":"ent211-study-30","lesson":"nigeria","prompt":"Which organization in the notes focuses on vocational and entrepreneurial training for unemployed Nigerians?","answer":"National Directorate of Employment","options":["National Directorate of Employment","Corporate Affairs Commission","Bank of Industry","Co-Creation Hub"],"aliases":null,"explanation":"The NDE's role in the course notes is training and employment support."},
    {"key":"ent211-study-31","lesson":"nigeria","prompt":"Which agency is associated with capacity building for Nigerian small and medium enterprises?","answer":"SMEDAN","options":["SMEDAN","NDE","CAC","BOI"],"aliases":null,"explanation":"The Small and Medium Enterprises Development Agency of Nigeria supports SME development."},
    {"key":"ent211-study-32","lesson":"nigeria","prompt":"The Nigerian SME development agency abbreviated as ___ provides capacity-building support.","answer":"SMEDAN","options":null,"aliases":["SMEDAN","Small and Medium Enterprises Development Agency of Nigeria"],"explanation":"SMEDAN is the agency identified in the notes for SME development."},
    {"key":"ent211-study-33","lesson":"nigeria","prompt":"What sets the Tony Elumelu Foundation support model in the notes apart from a standard equipment loan?","answer":"It combines startup support with mentorship and networking","options":["It combines startup support with mentorship and networking","It only registers proposed business names","It concentrates on the physical distribution of films","It provides power generation facilities for factories"],"aliases":null,"explanation":"The case describes a broader mix of capital, mentoring and connections."},
    {"key":"ent211-study-34","lesson":"nigeria","prompt":"The iROKOtv case illustrates the use of digital distribution to reach audiences for ___.","answer":"Nollywood","options":null,"aliases":["Nollywood","Nollywood films","Nigerian films"],"explanation":"The platform widened access to Nigerian film through online streaming."},
    {"key":"ent211-study-35","lesson":"nigeria","prompt":"Which entrepreneurial decision best captures the lesson from the iROKOtv case?","answer":"Use a new distribution channel to reach an existing audience","options":["Use a new distribution channel to reach an existing audience","Increase retail premises before testing online demand","Replace local content with unrelated imports","Avoid technology where distribution is already difficult"],"aliases":null,"explanation":"The opportunity was to deliver existing creative products through a different channel."},
    {"key":"ent211-study-36","lesson":"nigeria","prompt":"The House of Tara case belongs to which industry?","answer":"Beauty and cosmetics","options":["Beauty and cosmetics","Industrial cement","Oil refining","Retail banking"],"aliases":null,"explanation":"The notes use House of Tara as a case of entrepreneurship in makeup and beauty."},
    {"key":"ent211-study-37","lesson":"nigeria","prompt":"Which opportunity is illustrated by investing in domestic production where customers rely heavily on imported cement?","answer":"Import substitution","options":["Import substitution","Consumer-to-consumer resale","Financial intermediation","Licensing a film catalogue"],"aliases":null,"explanation":"Domestic production can meet an existing demand previously served by imports."},
    {"key":"ent211-study-38","lesson":"nigeria","prompt":"A manufacturer loses output during frequent power cuts. Which barrier does this exemplify?","answer":"Infrastructure constraints","options":["Infrastructure constraints","Weak product differentiation","An unsuitable ownership structure","A cultural preference for salaried work"],"aliases":null,"explanation":"Unreliable electricity is a physical infrastructure barrier."},
    {"key":"ent211-study-39","lesson":"nigeria","prompt":"A small firm delays an investment because operating rules keep changing. Which barrier is most directly involved?","answer":"Policy inconsistency","options":["Policy inconsistency","Low digital literacy","High customer churn","An unreliable supplier"],"aliases":null,"explanation":"Changing rules make future compliance costs and returns harder to predict."},
    {"key":"ent211-study-40","lesson":"nigeria","prompt":"When a viable venture cannot secure a loan on workable terms, it faces a barrier in access to ___.","answer":"finance","options":null,"aliases":["finance","financing","capital"],"explanation":"Credit cost and availability can prevent otherwise viable ventures from launching or growing."},
    {"key":"ent211-study-41","lesson":"nigeria","prompt":"Which intervention most directly tackles limited access to credit for women-led ventures?","answer":"Offer finance alongside application support through trusted local networks","options":["Offer finance alongside application support through trusted local networks","Publish generic adverts with no route to finance","Require applicants to own costly premises before applying","Replace loan counselling with a change in product packaging"],"aliases":null,"explanation":"Access can improve when funding is paired with help navigating the application process."},
    {"key":"ent211-study-42","lesson":"nigeria","prompt":"A young founder needs feedback and contacts from others building technology ventures. Which support option fits best?","answer":"A technology hub or peer enterprise network","options":["A technology hub or peer enterprise network","A business name search","An industrial equipment invoice","A general tax filing deadline"],"aliases":null,"explanation":"A peer network can offer feedback, mentoring and introductions."},
    {"key":"ent211-study-43","lesson":"nigeria","prompt":"A student receives introductions to potential partners through a youth enterprise association. Which resource did the association provide?","answer":"Professional networks","options":["Professional networks","A statutory licence","A guaranteed market share","A production patent"],"aliases":null,"explanation":"Networks connect founders to opportunities and people they may not know directly."},
    {"key":"ent211-study-44","lesson":"nigeria","prompt":"If a community discourages uncertain ventures in favour of salaried jobs, the main barrier in the notes is ___.","answer":"cultural attitudes","options":null,"aliases":["cultural attitudes","cultural attitude","culture"],"explanation":"Social expectations can discourage entrepreneurial risk-taking."},
    {"key":"ent211-study-45","lesson":"nigeria","prompt":"Which response addresses unreliable delivery routes for a young business?","answer":"Pilot a smaller delivery zone with reliable partners","options":["Pilot a smaller delivery zone with reliable partners","Spend the entire budget on brand redesign","Remove delivery costs from the forecast","Expand nationally before assessing missed deliveries"],"aliases":null,"explanation":"A focused pilot addresses logistics risk before scaling."},
    {"key":"ent211-study-46","lesson":"nigeria","prompt":"A local entrepreneur begins selling digital services after finding few employment options. Which factor best explains the initial decision?","answer":"Limited employment alternatives","options":["Limited employment alternatives","A confirmed monopoly","A statutory reporting requirement","The founder's ownership of a stock exchange listing"],"aliases":null,"explanation":"Necessity can motivate a new venture when conventional work is scarce."},
    {"key":"ent211-study-47","lesson":"tech","prompt":"Which tool most directly helps a digital retailer understand when customers abandon checkout?","answer":"Analytics that track steps in the purchase funnel","options":["Analytics that track steps in the purchase funnel","A patent register","An employee rota","A company name search"],"aliases":null,"explanation":"Funnel data reveals where visitors stop progressing toward a purchase."},
    {"key":"ent211-study-48","lesson":"tech","prompt":"A founder wants to protect a brand symbol used to distinguish a business. The relevant IP protection is a ___.","answer":"trademark","options":null,"aliases":["trademark","trade mark"],"explanation":"A trademark identifies the source of goods or services."},
    {"key":"ent211-study-49","lesson":"tech","prompt":"Which type of intellectual property primarily protects an original written training guide?","answer":"Copyright","options":["Copyright","Trademark","A patent","A business registration certificate"],"aliases":null,"explanation":"Copyright protects original expression such as written material."},
    {"key":"ent211-study-50","lesson":"tech","prompt":"An online shop automates repetitive stock updates. Which benefit follows most directly?","answer":"Fewer manual stock-entry errors and faster updates","options":["Fewer manual stock-entry errors and faster updates","Automatic protection of the brand name","Elimination of every delivery delay","Guaranteed approval of business financing"],"aliases":null,"explanation":"Automation can improve accuracy and speed in repetitive operations."},
    {"key":"ent211-study-51","lesson":"ecommerce","prompt":"A wholesaler supplies retailers through an online portal. This is ___ e-commerce.","answer":"B2B","options":null,"aliases":["B2B","business-to-business","business to business"],"explanation":"Both sides of the transaction are businesses."},
    {"key":"ent211-study-52","lesson":"ecommerce","prompt":"A designer sells a logo service to a company through a freelance platform. Which model applies?","answer":"Consumer-to-business","options":["Consumer-to-business","Business-to-business","Business-to-consumer","Consumer-to-consumer"],"aliases":null,"explanation":"The individual supplies a service to an organization."},
    {"key":"ent211-study-53","lesson":"ecommerce","prompt":"An individual sells a used phone to another individual via a marketplace. This is ___ e-commerce.","answer":"C2C","options":null,"aliases":["C2C","consumer-to-consumer","consumer to consumer"],"explanation":"Both parties are consumers, even if a platform intermediates the sale."},
    {"key":"ent211-study-54","lesson":"ecommerce","prompt":"Which combination most directly reduces first-time buyers' uncertainty?","answer":"Verified reviews and a clear return policy","options":["Verified reviews and a clear return policy","A larger product catalogue with no support contact","More checkout fields with no delivery information","An anonymous seller profile and non-refundable orders"],"aliases":null,"explanation":"Reviews and clear returns help customers judge credibility and their options if something goes wrong."},
    {"key":"ent211-study-55","lesson":"ecommerce","prompt":"In an online order, storing stock, packing it and getting it to a customer are part of ___.","answer":"logistics","options":null,"aliases":["logistics","fulfilment","fulfillment"],"explanation":"Logistics or fulfilment covers movement of goods from storage to delivery."},
    {"key":"ent211-study-56","lesson":"ecommerce","prompt":"A store gets many orders but cannot deliver outside the city on time. Which e-commerce component is the bottleneck?","answer":"Logistics and delivery","options":["Logistics and delivery","Digital payments","Online storefront","Customer segmentation"],"aliases":null,"explanation":"The store can take orders, but getting the products to customers remains the constraint."},
    {"key":"ent211-study-57","lesson":"ecommerce","prompt":"When connectivity and digital literacy restrict who can use online services, the barrier is called the ___.","answer":"digital divide","options":null,"aliases":["digital divide"],"explanation":"The digital divide describes unequal access to technology or the skills required to use it."},
    {"key":"ent211-study-58","lesson":"ecommerce","prompt":"Why might an online shop still need a strong physical distribution plan?","answer":"A website expands reach, but physical goods still need reliable fulfilment","options":["A website expands reach, but physical goods still need reliable fulfilment","Online sales always require an in-person payment","More web traffic automatically decreases demand","Digital product catalogues remove the need for inventory"],"aliases":null,"explanation":"Digital access widens the market without solving warehousing or delivery."},
    {"key":"ent211-study-59","lesson":"ecommerce","prompt":"A business designs its checkout primarily for purchases made on smartphones. Which term describes this channel?","answer":"Mobile commerce","options":["Mobile commerce","Consumer-to-consumer trade","Public procurement","Wholesale distribution"],"aliases":null,"explanation":"Mobile commerce is e-commerce through mobile devices."}
  ]$questions$::jsonb;
begin
  select id into v_course from public.courses where code = 'ENT 211';
  if not exists (
    select 1 from public.lessons l join public.lesson_versions lv on lv.lesson_id = l.id
    where l.course_id = v_course and lv.status = 'published'
  ) then
    return; -- The content pack can only attach to the published curriculum.
  end if;

  create temporary table ent211_quiz_lessons on commit drop as
  select editorial.*, l.id as lesson_id
  from (values
    ('value', 'Entrepreneurship and value creation', 1, 1, 'Entrepreneurship foundations'),
    ('intra', 'Entrepreneurship and intrapreneurship', 1, 1, 'Entrepreneurship foundations'),
    ('theory', 'Theories of entrepreneurship', 1, 1, 'Entrepreneurship foundations'),
    ('why', 'Why entrepreneurship matters', 1, 1, 'Entrepreneurship foundations'),
    ('traits', 'Characteristics of entrepreneurs', 2, 2, 'Entrepreneurial thinking and innovation'),
    ('thinking', 'Entrepreneurial thinking', 2, 3, 'Entrepreneurial thinking and innovation'),
    ('innovation', 'Innovation and change', 2, 4, 'Entrepreneurial thinking and innovation'),
    ('plan', 'Business plans and market analysis', 3, 5, 'Starting and growing a venture'),
    ('ownership', 'Ownership and business registration', 3, 5, 'Starting and growing a venture'),
    ('network', 'Partnerships and networking', 3, 5, 'Starting and growing a venture'),
    ('nigeria', 'Entrepreneurship in Nigeria', 4, 7, 'Entrepreneurship in Nigeria'),
    ('tech', 'Technology and contemporary issues', 5, 6, 'Digital entrepreneurship and e-commerce'),
    ('ecommerce', 'E-commerce foundations', 5, 8, 'Digital entrepreneurship and e-commerce')
  ) editorial(key, lesson_title, unit_number, source_unit, unit_title)
  join public.lesson_versions lv on lv.title = editorial.lesson_title and lv.status = 'published'
  join public.lessons l on l.id = lv.lesson_id and l.course_id = v_course;
  if (select count(*) from ent211_quiz_lessons) <> 13
    or (select count(distinct key) from ent211_quiz_lessons) <> 13 then
    raise exception 'ENT 211 lesson mapping is incomplete or ambiguous.';
  end if;

  insert into private.topic_quiz_unit_members(lesson_id, unit_id, title)
  select lesson_id, first_value(lesson_id) over (partition by unit_number order by lesson_id), unit_title
  from ent211_quiz_lessons;

  select r.user_id into v_admin from public.user_roles r
  join public.profiles p on p.id = r.user_id and p.deactivated_at is null
  where r.role = 'admin' order by r.user_id limit 1;
  if v_admin is null then raise exception 'ENT 211 publishing requires an active administrator.'; end if;

  create temporary table ent211_quiz_items on commit drop as
  select item.*, l.lesson_id, l.source_unit
  from jsonb_to_recordset(v_items) item(
    key text, lesson text, prompt text, answer text, options text[], aliases text[], explanation text
  )
  join ent211_quiz_lessons l on l.key = item.lesson;
  if (select count(*) from ent211_quiz_items) <> jsonb_array_length(v_items) then
    raise exception 'An ENT 211 question has no lesson mapping.';
  end if;

  insert into public.questions(course_id, lesson_id, pool, logical_key)
  select v_course, lesson_id, 'learning', key from ent211_quiz_items;
  insert into public.question_versions(question_id, version, prompt, difficulty, usage, source_reference, answer_format)
  select q.id, 1, i.prompt, 'intermediate', array['practice'],
    'ENT 211 UPDATED NOTE.docx, Unit ' || i.source_unit,
    case when i.options is null then 'fill_in_gap' else 'standard' end
  from ent211_quiz_items i join public.questions q on q.course_id = v_course and q.logical_key = i.key;
  insert into public.question_options(question_version_id, label, body, position)
  select v.id, chr(64 + option.position::integer), option.body, option.position::integer
  from ent211_quiz_items i
  join public.questions q on q.course_id = v_course and q.logical_key = i.key
  join public.question_versions v on v.question_id = q.id and v.version = 1
  cross join lateral unnest(i.options) with ordinality option(body, position);
  insert into private.question_answer_keys(question_version_id, correct_option_id, explanation, gap_answers)
  select v.id, o.id, i.explanation,
    case when i.aliases is not null then jsonb_build_array(jsonb_build_object('index', 0, 'accepted_answers', i.aliases)) end
  from ent211_quiz_items i
  join public.questions q on q.course_id = v_course and q.logical_key = i.key
  join public.question_versions v on v.question_id = q.id and v.version = 1
  left join public.question_options o on o.question_version_id = v.id and o.position = 1;

  for v_question in
    select v.id from ent211_quiz_items i join public.questions q on q.course_id = v_course and q.logical_key = i.key
    join public.question_versions v on v.question_id = q.id and v.version = 1
  loop
    perform private.publish_question_version(v_question.id, v_admin);
  end loop;

  if exists (
    select 1 from ent211_quiz_lessons l
    left join private.topic_quiz_pool_v2(null, v_course) pool on pool.lesson_id = l.lesson_id
    group by l.unit_number having count(pool.question_version_id) < 20
  ) then
    raise exception 'Every consolidated ENT 211 study unit requires at least 20 eligible questions.';
  end if;
end;
$bank$;

commit;

