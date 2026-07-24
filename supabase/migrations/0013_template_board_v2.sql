-- ============================================================
-- TFP OS — 0013: rebuild the template board from the Monday export
-- Wipes ONLY the template (new locations get this). Existing
-- location boards are untouched unless you run Part B below.
-- ============================================================

delete from public.phases where location_id is null;

insert into public.phases (location_id, name, tag, sort_order) values (null, 'Phase 1 — Agreement Signed', null, 1);
insert into public.phases (location_id, name, tag, sort_order) values (null, 'Phase 2.0 — More Than 6 Months from Grand Opening', null, 2);
insert into public.phases (location_id, name, tag, sort_order) values (null, 'Phase 2.1 — 6 Months from Grand Opening', null, 3);
insert into public.phases (location_id, name, tag, sort_order) values (null, 'Phase 2.2 — 90 Days from Grand Opening', null, 4);
insert into public.phases (location_id, name, tag, sort_order) values (null, 'Phase 3 — Ongoing Support', null, 5);
insert into public.phases (location_id, name, tag, sort_order) values (null, 'Month 1 — Kickoff and Awareness', 'marketing', 6);
insert into public.phases (location_id, name, tag, sort_order) values (null, 'Month 2 — First Community Event', 'marketing', 7);
insert into public.phases (location_id, name, tag, sort_order) values (null, 'Month 3 — Build Momentum', 'marketing', 8);
insert into public.phases (location_id, name, tag, sort_order) values (null, 'Month 4 — Second Event and Membership Push', 'marketing', 9);
insert into public.phases (location_id, name, tag, sort_order) values (null, 'Month 5 — Grand Opening Prep', 'marketing', 10);
insert into public.phases (location_id, name, tag, sort_order) values (null, 'Month 6 — Launch Hype', 'marketing', 11);

insert into public.tasks (phase_id, title, sort_order)
select p.id, v.title, v.sort_order
from public.phases p, (values
  ('Welcome Emails', 1),
  ('Email Creation', 2),
  ('Traction', 3),
  ('Social Handles Creation', 4),
  ('↳ TikTok', 5),
  ('↳ Instagram', 6),
  ('↳ Facebook', 7),
  ('Website - Location Page', 8),
  ('Site Selection', 9),
  ('Weekly Call with RE Team Set up', 10),
  ('Personal Financials Statements Sent and Filled Out', 11),
  ('Business License', 12),
  ('Set Up Business Entity', 13),
  ('Secure Funding', 14),
  ('Create EIN', 15),
  ('Lease Negotiated and Signed', 16)
) as v(title, sort_order)
where p.location_id is null and p.name = 'Phase 1 — Agreement Signed';

insert into public.tasks (phase_id, title, sort_order)
select p.id, v.title, v.sort_order
from public.phases p, (values
  ('Phase 2 Launch Call', 1),
  ('Set up weekly call with Makayla', 2),
  ('Location Specific Logo', 3),
  ('Patch Landing Page Set Up', 4),
  ('Marketing Starter Kit', 5),
  ('Insurance', 6),
  ('Play Sight', 7),
  ('Kitchen Equipment & Menu Selection', 8),
  ('Finalize Floor Plans', 9),
  ('Interiors, Finishes, Furniture, Low Voltage Selection', 10),
  ('Kitchen Design', 11),
  ('Obtain Permits for Resale and Alcohol', 12),
  ('Food Permits and Inspections', 13),
  ('TFP Wholesale Account Set Up', 14),
  ('Add to franchise Discord', 15),
  ('HR/Employee Handbook/Waivers/Membership Agreement', 16),
  ('Start Internal Systems Fee Where Applicable', 17),
  ('Get Set Up Employment for your state', 18)
) as v(title, sort_order)
where p.location_id is null and p.name = 'Phase 2.0 — More Than 6 Months from Grand Opening';

insert into public.tasks (phase_id, title, sort_order)
select p.id, v.title, v.sort_order
from public.phases p, (values
  ('Hire Club Director', 1),
  ('Hire Marketing Specialist (Part Time)', 2),
  ('Stripe Set Up', 3),
  ('Play by Point Set Up', 4),
  ('↳ memberships should be location pro / basic', 5),
  ('Schedule Training', 6),
  ('Grand Open Marketing Plan', 7),
  ('↳ Create Flyers & Banners', 8),
  ('↳ Create Social Posts', 9),
  ('↳ Get Confirmation from press', 10),
  ('↳ Merch and Products Ordered', 11),
  ('Membership Pre Sale Plan', 12),
  ('↳ Social Event scheduled (Round Robin, Tournament, King of the court, etc)', 13),
  ('↳ Design and Order Founders Members Swag Bag designs', 14),
  ('↳ Weekly Social Posts Creation', 15),
  ('↳ Flyers ( who we are, $20 membership waitlist fee and get a shirt)', 16),
  ('Merch & Products ( giveaways )', 17),
  ('Canva Pro Account', 18),
  ('Begin Secure Sponsors', 19),
  ('Google My Business', 20),
  ('Apple Maps', 21),
  ('Schedule Grand Open', 22)
) as v(title, sort_order)
where p.location_id is null and p.name = 'Phase 2.1 — 6 Months from Grand Opening';

insert into public.tasks (phase_id, title, sort_order)
select p.id, v.title, v.sort_order
from public.phases p, (values
  ('Complete Management Training in Idaho', 1),
  ('Book Flight & Hotel For Travel Team', 2),
  ('Jolt Set Up', 3),
  ('Perfect Venue', 4),
  ('Set up UniFi', 5),
  ('Set Up Kitcast ( Screens )', 6),
  ('Uniforms and Apparel', 7),
  ('Initial Pro Shop Inventory', 8),
  ('Toast Set Up', 9),
  ('Initial Kitchen Inventory', 10),
  ('Create Cash Forecast', 11),
  ('Hire and Train Instructors/Pickleball Director', 12),
  ('Programing Inputed Into Play By Point', 13),
  ('Begin hiring process for kitchen, desk, all other positions', 14),
  ('Set Up Vendor Accounts', 15),
  ('Grand opening plan and execution', 16),
  ('Purchase Card Readers', 17),
  ('Order Ball Machine', 18),
  ('Set Up Phone, TV''s + Internet', 19),
  ('Purchase Court Cleaner', 20),
  ('Janitorial & Maintenance Contracted or hire', 21),
  ('AED & CPR certification for management staff', 22),
  ('Payroll Software', 23),
  ('Utility Set Up', 24),
  ('Set up Towel Service', 25),
  ('Set Up Cintas or equivalent', 26),
  ('Purchase POS computers + 2 Ipads', 27),
  ('Gift Certificate Printed ( In canva)', 28),
  ('Purchase Cash Drawer', 29),
  ('Certificate of Occupancy', 30),
  ('set up dupr plus', 31),
  ('Door alarms if applicable', 32),
  ('buy products on franchisee supplies list', 33),
  ('Purchase Apple tvs', 34),
  ('Misc Items', 35),
  ('↳ Step + Repeat Pop up', 36),
  ('↳ Pro Shop', 37),
  ('↳ Janitors', 38),
  ('↳ Office supplies', 39),
  ('↳ Marketing Material', 40),
  ('↳ Kitchen', 41),
  ('↳ 6 foot clocks from home depot', 42),
  ('↳ Speaker, stand and microphone', 43),
  ('Sound Machine/Music Set Up', 44),
  ('Grand Open Complete', 45)
) as v(title, sort_order)
where p.location_id is null and p.name = 'Phase 2.2 — 90 Days from Grand Opening';

insert into public.tasks (phase_id, title, sort_order)
select p.id, v.title, v.sort_order
from public.phases p, (values
  ('Qvinci', 1),
  ('Ongoing Marketing Assets', 2),
  ('Ongoing Training and Support', 3)
) as v(title, sort_order)
where p.location_id is null and p.name = 'Phase 3 — Ongoing Support';

insert into public.tasks (phase_id, title, sort_order)
select p.id, v.title, v.sort_order
from public.phases p, (values
  ('1. Get credentials from Corporate for Facebook, Instagram, and TikTok. Brand look and access ready.', 1),
  ('2. Join local and national pickleball Facebook groups to start building awareness.', 2),
  ('3. Contact local press and influencers. Prioritize sports writers, lifestyle blogs, and radio.', 3),
  ('4. Plan your first Pre Launch Series tournament. Lock venue, format, prizes, and vendors. See Section 14.', 4),
  ('5. Order merch and products for the event. Use them for influencer outreach, giveaways, and brand visibility. See Section 4.', 5),
  ('6. Design teaser ads like “Club Coming Soon.”', 6),
  ('7. Set up Patch.io on your webpage to capture leads and Founders payments. See Section 5.', 7)
) as v(title, sort_order)
where p.location_id is null and p.name = 'Month 1 — Kickoff and Awareness';

insert into public.tasks (phase_id, title, sort_order)
select p.id, v.title, v.sort_order
from public.phases p, (values
  ('1. Host your first Pre Launch Series event.', 1),
  ('2. Capture emails through QR codes and tablets at your booth.', 2),
  ('3. Lead with Founders Memberships as the primary offer.', 3),
  ('4. Follow up with email and SMS highlighting Founders benefits and limited availability.', 4),
  ('5. Post real-time stories and behind-the-scenes content to build social proof.', 5)
) as v(title, sort_order)
where p.location_id is null and p.name = 'Month 2 — First Community Event';

insert into public.tasks (phase_id, title, sort_order)
select p.id, v.title, v.sort_order
from public.phases p, (values
  ('1. Maintain weekly content cadence across social media.', 1),
  ('2. Post construction updates, team introductions, and event recaps.', 2),
  ('3. Send regular email updates featuring Founders benefits and testimonials.', 3),
  ('4. Run small geo-targeted paid campaigns focused on enrolling Founders.', 4),
  ('5. Continue engaging in local Facebook groups with updates and progress.', 5)
) as v(title, sort_order)
where p.location_id is null and p.name = 'Month 3 — Build Momentum';

insert into public.tasks (phase_id, title, sort_order)
select p.id, v.title, v.sort_order
from public.phases p, (values
  ('1. Host your second Pre Launch Series event.', 1),
  ('2. Use this event as a major Founders conversion push.', 2),
  ('3. Allow Founders to pick up swag bags if available.', 3),
  ('4. Announce early access days for Founders before Grand Opening.', 4),
  ('5. Capture heavy content for social media and ads.', 5),
  ('6. Continue Founders enrollment until Grand Opening or until capacity is reached.', 6)
) as v(title, sort_order)
where p.location_id is null and p.name = 'Month 4 — Second Event and Membership Push';

insert into public.tasks (phase_id, title, sort_order)
select p.id, v.title, v.sort_order
from public.phases p, (values
  ('1. Finalize signage, banners, and marketing materials.', 1),
  ('2. Launch your Grand Opening RSVP page through PlayByPoint or Patch.io.', 2),
  ('3. Begin countdown content series across social and email.', 3),
  ('4. Increase paid advertising spend leading into opening.', 4),
  ('5. Highlight Founders benefits and early access in final push.', 5)
) as v(title, sort_order)
where p.location_id is null and p.name = 'Month 5 — Grand Opening Prep';

insert into public.tasks (phase_id, title, sort_order)
select p.id, v.title, v.sort_order
from public.phases p, (values
  ('1. Heavy ad push within approved budgets. See Section 7.', 1),
  ('2. Final Founders enrollment push before opening day.', 2),
  ('3. Press release and local media appearances.', 3),
  ('4. Execute Founders early access days before Grand Opening.', 4),
  ('5. Capture recap content and push user-generated content.', 5)
) as v(title, sort_order)
where p.location_id is null and p.name = 'Month 6 — Launch Hype';

