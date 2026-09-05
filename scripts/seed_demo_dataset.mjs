import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const STANDARD_TIMES = [
  { start_time: "09:30:00", end_time: "10:30:00" },
  { start_time: "10:30:00", end_time: "11:30:00" },
  { start_time: "11:30:00", end_time: "12:30:00" },
  { start_time: "14:00:00", end_time: "15:00:00" },
  { start_time: "15:00:00", end_time: "16:00:00" },
  { start_time: "16:00:00", end_time: "17:00:00" },
];

const ADVOCATES = [
  "Adv. Rajesh Sharma (D/1420/2012)",
  "Adv. Harish Salve (D/045/1986)",
  "Adv. Meenakshi Lekhi (D/312/1990)",
  "Adv. Vikramjit Banerjee (D/982/2004)",
  "Adv. Sunita Agarwal (D/541/2015)",
  "Adv. Sanjay Hegde (D/419/1991)",
  "Adv. Vrinda Grover (D/720/1995)",
  "Adv. Abhishek Manu Singhvi (D/102/1982)",
  "Adv. Indira Jaising (D/067/1975)",
  "Adv. Mukul Rohatgi (D/023/1979)",
  "Adv. Prashant Bhushan (D/214/1984)",
  "Adv. Siddharth Luthra (D/456/1993)",
  "Adv. Rebecca John (D/389/1992)",
  "Adv. Gopal Sankaranarayanan (D/890/2001)",
  "Adv. Menaka Guruswamy (D/678/1997)",
];

const LITIGANTS_SAMPLE = [
  { p: "Rameshwar Prasad & Ors.", r: "State of NCT of Delhi", cat: "BNS Criminal Trial (Bharatiya Nyaya Sanhita)" },
  { p: "Meenakshi Devi", r: "Rajesh Kumar & In-laws", cat: "Family & Matrimonial" },
  { p: "ICICI Lombard General Insurance Co.", r: "Sunil Sharma & Ors.", cat: "Motor Accident Claims" },
  { p: "Ananya Infrastructure Ltd.", r: "Delhi Development Authority", cat: "Commercial Dispute" },
  { p: "Dr. Arvind Swaminathan", r: "Medical Council of India & Anr.", cat: "Writ / Constitutional Matter" },
  { p: "Sunita Bai & 3 Ors.", r: "Collector & Land Acquisition Officer", cat: "Property & Land" },
  { p: "M/s Apex Logistics LLP", r: "State Bank of India", cat: "Cheque / Financial Offence" },
  { p: "Mohan Lal Gupta (Senior Citizen)", r: "DDA & Municipal Corp.", cat: "Property & Land" },
  { p: "Victim 'X' (FTSC-POCSO)", r: "Accused Kamal & State", cat: "Criminal Case" },
  { p: "Suraj Bhan & Sons", r: "Godrej Consumer Products Ltd.", cat: "Consumer Dispute" },
  { p: "Virendra Singh (Worker Union)", r: "Tata Motors Pantnagar Plant", cat: "Labour & Employment" },
  { p: "Kavita Singhal", r: "Vivek Singhal & Ors.", cat: "Family & Matrimonial" },
  { p: "State (through Crime Branch)", r: "Gurmeet Singh @ Billa", cat: "BNS Criminal Trial (Bharatiya Nyaya Sanhita)" },
  { p: "Deepak Chawla", r: "HDFC Bank Ltd. Credit Div.", cat: "Consumer Dispute" },
  { p: "M/s Radiant Solar Energy", r: "BSES Yamuna Power Ltd.", cat: "Commercial Dispute" },
];

function generateDateList(startDateStr, endDateStr) {
  const dates = [];
  const curr = new Date(`${startDateStr}T00:00:00Z`);
  const end = new Date(`${endDateStr}T00:00:00Z`);
  while (curr <= end) {
    dates.push(curr.toISOString().slice(0, 10));
    curr.setUTCDate(curr.getUTCDate() + 1);
  }
  return dates;
}

async function main() {
  console.log("=== NyayaSetu 3-Month Multi-Persona Dataset Seeder ===");

  // 1. Fetch categories, judges, courtrooms
  const { data: categories } = await supabase.from("case_categories").select("*");
  const { data: judges } = await supabase.from("judges").select("*");
  const { data: courtrooms } = await supabase.from("courtrooms").select("*");

  if (!categories?.length || !judges?.length || !courtrooms?.length) {
    console.error("Missing baseline categories, judges, or courtrooms");
    process.exit(1);
  }
  console.log(`Loaded ${categories.length} categories, ${judges.length} judges, ${courtrooms.length} courtrooms.`);

  const catMap = new Map();
  categories.forEach((c) => catMap.set(c.name, c));

  // 2. Generate Hearing Slots for July 1, 2026 to December 31, 2026
  console.log("Generating hearing slots from 2026-07-01 to 2026-12-31...");
  const allDates = generateDateList("2026-07-01", "2026-12-31");
  console.log(`Total calendar dates in window: ${allDates.length} days`);

  const slotsToInsert = [];
  for (const d of allDates) {
    for (const t of STANDARD_TIMES) {
      slotsToInsert.push({
        date: d,
        start_time: t.start_time,
        end_time: t.end_time,
      });
    }
  }

  // Insert slots in batches with ON CONFLICT DO NOTHING
  const BATCH_SIZE = 200;
  for (let i = 0; i < slotsToInsert.length; i += BATCH_SIZE) {
    const chunk = slotsToInsert.slice(i, i + BATCH_SIZE);
    const { error } = await supabase.from("hearing_slots").upsert(chunk, {
      onConflict: "date,start_time,end_time",
      ignoreDuplicates: true,
    });
    if (error) {
      console.warn(`Error inserting slots batch at ${i}:`, error.message);
    }
  }

  // Fetch all slots in our date range
  const { data: allSlots } = await supabase
    .from("hearing_slots")
    .select("id, date, start_time, end_time")
    .gte("date", "2026-07-01")
    .lte("date", "2026-12-31")
    .order("date")
    .order("start_time");

  console.log(`Total registered hearing slots in DB for 3-month window: ${allSlots?.length}`);

  // Group slots by date
  const slotsByDate = new Map();
  for (const s of allSlots || []) {
    if (!slotsByDate.has(s.date)) slotsByDate.set(s.date, []);
    slotsByDate.get(s.date).push(s);
  }

  // 3. Seed Scheduled Cases for EVERY Single Day from 2026-07-01 to 2026-12-15
  console.log("Ensuring every single day has scheduled cases...");
  const scheduledDays = generateDateList("2026-07-01", "2026-12-15");
  const TODAY = "2026-09-05";

  let caseCounter = 200;
  const newCases = [];
  const newSchedules = [];

  for (let dayIdx = 0; dayIdx < scheduledDays.length; dayIdx++) {
    const dateStr = scheduledDays[dayIdx];
    const daySlots = slotsByDate.get(dateStr) || [];
    if (!daySlots.length) continue;

    const isPast = dateStr < TODAY;
    const isToday = dateStr === TODAY;
    const isFuture = dateStr > TODAY;

    // Determine how many hearings on this day:
    // Today gets 6-8 hearings across multiple rooms
    // Past gets 2-3 hearings
    // Future gets 2-3 hearings
    const countOnDay = isToday ? 8 : (dayIdx % 3 === 0 ? 3 : 2);

    for (let cIdx = 0; cIdx < countOnDay; cIdx++) {
      caseCounter++;
      const slot = daySlots[cIdx % daySlots.length];
      const judge = judges[(dayIdx + cIdx) % judges.length];
      const courtroom = courtrooms[(dayIdx + cIdx) % courtrooms.length];
      const sample = LITIGANTS_SAMPLE[(caseCounter) % LITIGANTS_SAMPLE.length];
      const filingAdv = ADVOCATES[caseCounter % ADVOCATES.length];
      const oppAdv = ADVOCATES[(caseCounter + 3) % ADVOCATES.length];

      const catRecord = catMap.get(sample.cat) || categories[0];
      const caseNum = `CASE-2026-${String(caseCounter).padStart(4, "0")}`;
      const cnrNum = `DLCT01-${String(caseCounter + 5000).padStart(6, "0")}-2026`;

      const isTier1 = sample.cat.includes("BNS") || sample.cat.includes("Bail") || sample.p.includes("POCSO");
      const isTier2 = sample.cat.includes("Commercial") || sample.p.includes("Senior") || sample.cat.includes("Property");
      const priorityTier = isTier1 ? "Tier 1" : isTier2 ? "Tier 2" : "Tier 3";
      const priorityScore = isTier1 ? 88.5 : isTier2 ? 64.0 : 38.0;

      const caseStatus = isPast ? "disposed" : "scheduled";
      const scheduleStatus = isPast ? "completed" : "confirmed";

      const caseId = crypto.randomUUID();
      const schedId = crypto.randomUUID();

      newCases.push({
        id: caseId,
        case_number: caseNum,
        cnr_number: cnrNum,
        category_id: catRecord.id,
        filing_date: isPast ? "2026-06-15" : "2026-08-01",
        status: caseStatus,
        parties: `${sample.p} v. ${sample.r} [Filing: ${filingAdv} | Opposing: ${oppAdv}]`,
        estimated_duration_minutes: 60,
        predicted_duration_minutes: 55,
        adjournment_risk_score: isTier1 ? 22 : 45,
        pending_duration_days: 45,
        previous_adjournments: isPast ? 1 : 0,
        priority_score: priorityScore,
        priority_tier: priorityTier,
        legal_priority_flag: isTier1,
        is_ftsc_pocso: sample.p.includes("POCSO"),
        senior_citizen_litigant: sample.p.includes("Senior"),
        property_dispute_5yr_plus: isTier2 && sample.cat.includes("Property"),
      });

      newSchedules.push({
        id: schedId,
        case_id: caseId,
        judge_id: judge.id,
        courtroom_id: courtroom.id,
        slot_id: slot.id,
        status: scheduleStatus,
        cause_list_position: cIdx + 1,
      });
    }
  }

  // 4. Generate ~45 UNSCHEDULED Pending Cases for Smart Scheduling & Demonstration
  console.log("Generating unscheduled pending cases for Smart Scheduling queue...");
  const UNSCHEDULED_SPECS = [
    // Tier 1 Critical
    { p: "State (Cyber Cell)", r: "Amitabh Sen (Sec 480 Regular Bail)", cat: "Bail Application", t: "Tier 1", score: 94.0, pocso: false, sc: false, lim: "2026-09-15" },
    { p: "Victim Child 'M' (POCSO Special Court)", r: "Accused Dharmesh Yadav", cat: "Criminal Case", t: "Tier 1", score: 96.5, pocso: true, sc: false, lim: null },
    { p: "Shanti Devi (82 Yrs - Senior Citizen)", r: "SDM & Sub-Registrar", cat: "Property & Land", t: "Tier 1", score: 89.0, pocso: false, sc: true, lim: "2026-09-20" },
    { p: "State (Special Cell Anti-Terror)", r: "Nadeem Akhtar (Interim Bail)", cat: "Bail Application", t: "Tier 1", score: 92.0, pocso: false, sc: false, lim: null },
    { p: "Minor Victim 'K' through Guardian", r: "Accused Vikram & Ors.", cat: "BNS Criminal Trial (Bharatiya Nyaya Sanhita)", t: "Tier 1", score: 95.0, pocso: true, sc: false, lim: null },
    { p: "Ram Dulari (79 Yrs) Maintenance Petition", r: "Son Naresh Kumar & Ors.", cat: "Family & Matrimonial", t: "Tier 1", score: 87.5, pocso: false, sc: true, lim: null },
    { p: "State (Anti-Corruption Branch)", r: "Ex-Executive Engineer Sharma", cat: "Criminal Case", t: "Tier 1", score: 88.0, pocso: false, sc: false, lim: "2026-09-18" },
    { p: "Victim 'R' (FTSC Urgent Hearing)", r: "Accused Ramesh", cat: "Criminal Case", t: "Tier 1", score: 96.0, pocso: true, sc: false, lim: null },
    { p: "Dharampal Vohra (Senior Citizen)", r: "Punjab National Bank", cat: "Cheque / Financial Offence", t: "Tier 1", score: 84.5, pocso: false, sc: true, lim: null },
    { p: "State (Economic Offences Wing)", r: "Director Rajat Verma (Bail)", cat: "Bail Application", t: "Tier 1", score: 91.0, pocso: false, sc: false, lim: "2026-09-16" },

    // Tier 2 High
    { p: "Tata Consultancy Services Ltd.", r: "TechZone Infotech (Injunction)", cat: "Commercial Dispute", t: "Tier 2", score: 72.0, pocso: false, sc: false, lim: null },
    { p: "Balwant Rai (7 yr Title Dispute)", r: "Delhi Cantonment Board", cat: "Property & Land", t: "Tier 2", score: 68.5, pocso: false, sc: false, lim: null },
    { p: "M/s Jindal Steel & Power Ltd.", r: "Northern Railway Construction", cat: "Commercial Dispute", t: "Tier 2", score: 74.0, pocso: false, sc: false, lim: null },
    { p: "Anil Goel (Partition Suit - 6 yrs)", r: "Suresh Goel & 4 Others", cat: "Property & Land", t: "Tier 2", score: 66.0, pocso: false, sc: false, lim: null },
    { p: "M/s Fortis Healthcare Division", r: "National Pharma Suppliers", cat: "Commercial Dispute", t: "Tier 2", score: 71.5, pocso: false, sc: false, lim: null },
    { p: "Pooja Malhotra", r: "Gaurav Malhotra (Custody)", cat: "Family & Matrimonial", t: "Tier 2", score: 69.0, pocso: false, sc: false, lim: null },
    { p: "State (Crime Branch Narcotics)", r: "Sikandar Khan (Trial)", cat: "BNS Criminal Trial (Bharatiya Nyaya Sanhita)", t: "Tier 2", score: 75.0, pocso: false, sc: false, lim: null },
    { p: "Goyal Builders Pvt. Ltd.", r: "Real Estate Regulatory Authority", cat: "Writ / Constitutional Matter", t: "Tier 2", score: 63.5, pocso: false, sc: false, lim: null },
    { p: "M/s Reliance Retail Logistics", r: "Express Cargo Transport Ltd.", cat: "Commercial Dispute", t: "Tier 2", score: 70.0, pocso: false, sc: false, lim: null },
    { p: "Jagdish Chander", r: "Land Acquisition Collector Rohini", cat: "Property & Land", t: "Tier 2", score: 67.0, pocso: false, sc: false, lim: null },
    { p: "Deepika Sen", r: "Rahul Sen (Restitution of Rights)", cat: "Family & Matrimonial", t: "Tier 2", score: 62.0, pocso: false, sc: false, lim: null },
    { p: "State (BSA Expert Evidence)", r: "Dr. K. L. Mehra (Forensic)", cat: "BSA Evidentiary Matter (Bharatiya Sakshya Adhiniyam)", t: "Tier 2", score: 65.0, pocso: false, sc: false, lim: null },
    { p: "Sanjay Narang", r: "Municipal Corporation Delhi", cat: "Public / Administrative Matter", t: "Tier 2", score: 61.0, pocso: false, sc: false, lim: null },
    { p: "M/s Flipkart Internet Pvt. Ltd.", r: "Trade Tax Officer Ward 4", cat: "Commercial Dispute", t: "Tier 2", score: 73.0, pocso: false, sc: false, lim: null },
    { p: "Kusum Lata", r: "Hemant Rawat (Divorce & Alimony)", cat: "Family & Matrimonial", t: "Tier 2", score: 64.0, pocso: false, sc: false, lim: null },

    // Tier 3 Routine Civil / Financial / Consumer
    { p: "Rajeev Bansal (Cheque Dishonour 138 NI)", r: "Sunil Chopra & Co.", cat: "Cheque / Financial Offence", t: "Tier 3", score: 42.0, pocso: false, sc: false, lim: null },
    { p: "Sangeeta Arora", r: "Samsung Electronics India Ltd.", cat: "Consumer Dispute", t: "Tier 3", score: 36.0, pocso: false, sc: false, lim: null },
    { p: "M/s Universal Hardware Traders", r: "Gupta Engineering Works", cat: "Civil Suit", t: "Tier 3", score: 39.5, pocso: false, sc: false, lim: null },
    { p: "Rakesh Verma", r: "New India Assurance Co. Ltd.", cat: "Motor Accident Claims", t: "Tier 3", score: 44.0, pocso: false, sc: false, lim: null },
    { p: "Alok Srivastava", r: "Airtel Telecommunications Ltd.", cat: "Consumer Dispute", t: "Tier 3", score: 32.0, pocso: false, sc: false, lim: null },
    { p: "M/s Aggarwal Timber Merchants", r: "Sharma Modular Kitchens", cat: "Civil Suit", t: "Tier 3", score: 38.0, pocso: false, sc: false, lim: null },
    { p: "Vinay Pathak", r: "Bajaj Allianz Life Insurance", cat: "Consumer Dispute", t: "Tier 3", score: 34.0, pocso: false, sc: false, lim: null },
    { p: "Kamal Kishor (Money Recovery)", r: "Praveen Saini", cat: "Civil Suit", t: "Tier 3", score: 41.0, pocso: false, sc: false, lim: null },
    { p: "Dinesh Rawat (Claimant)", r: "Delhi Transport Corporation", cat: "Motor Accident Claims", t: "Tier 3", score: 43.5, pocso: false, sc: false, lim: null },
    { p: "M/s Metro Electricals", r: "Singhal Housing Projects", cat: "Civil Suit", t: "Tier 3", score: 37.0, pocso: false, sc: false, lim: null },
    { p: "Priya Sundaram", r: "Amazon India Seller Services", cat: "Consumer Dispute", t: "Tier 3", score: 31.0, pocso: false, sc: false, lim: null },
    { p: "Surender Pal Singh", r: "United India Insurance Co.", cat: "Motor Accident Claims", t: "Tier 3", score: 40.0, pocso: false, sc: false, lim: null },
    { p: "M/s Shiva Polyesters", r: "Vardhman Textiles Ltd.", cat: "Civil Suit", t: "Tier 3", score: 39.0, pocso: false, sc: false, lim: null },
    { p: "Mukesh Chand (Cheque Bounce)", r: "Girish Khandelwal", cat: "Cheque / Financial Offence", t: "Tier 3", score: 42.5, pocso: false, sc: false, lim: null },
    { p: "Savitri Devi", r: "BSES Rajdhani Power Ltd.", cat: "Consumer Dispute", t: "Tier 3", score: 33.0, pocso: false, sc: false, lim: null },
  ];

  for (let i = 0; i < UNSCHEDULED_SPECS.length; i++) {
    caseCounter++;
    const spec = UNSCHEDULED_SPECS[i];
    const catRecord = catMap.get(spec.cat) || categories[0];
    const caseNum = `CASE-2026-${String(caseCounter).padStart(4, "0")}`;
    const cnrNum = `DLCT01-${String(caseCounter + 5000).padStart(6, "0")}-2026`;
    const filingAdv = ADVOCATES[caseCounter % ADVOCATES.length];
    const oppAdv = ADVOCATES[(caseCounter + 4) % ADVOCATES.length];

    newCases.push({
      id: crypto.randomUUID(),
      case_number: caseNum,
      cnr_number: cnrNum,
      category_id: catRecord.id,
      filing_date: "2026-08-20",
      status: i % 4 === 0 ? "adjourned" : "filed",
      parties: `${spec.p} v. ${spec.r} [Filing: ${filingAdv} | Opposing: ${oppAdv}]`,
      estimated_duration_minutes: 60,
      predicted_duration_minutes: spec.t === "Tier 1" ? 45 : 60,
      adjournment_risk_score: spec.t === "Tier 1" ? 18 : spec.t === "Tier 2" ? 40 : 55,
      pending_duration_days: 16,
      previous_adjournments: i % 4 === 0 ? 1 : 0,
      priority_score: spec.score,
      priority_tier: spec.t,
      legal_priority_flag: spec.t === "Tier 1",
      is_ftsc_pocso: spec.pocso,
      senior_citizen_litigant: spec.sc,
      property_dispute_5yr_plus: spec.cat.includes("Property"),
      statutory_limitation_deadline: spec.lim,
    });
  }

  // 5. Insert Cases in batches
  console.log(`Inserting ${newCases.length} new cases...`);
  for (let i = 0; i < newCases.length; i += BATCH_SIZE) {
    const chunk = newCases.slice(i, i + BATCH_SIZE);
    const { error } = await supabase.from("cases").upsert(chunk, { onConflict: "case_number" });
    if (error) {
      console.warn(`Error inserting cases chunk at ${i}:`, error.message);
    }
  }

  // 6. Insert Schedules in batches
  console.log(`Inserting ${newSchedules.length} new schedules...`);
  for (let i = 0; i < newSchedules.length; i += BATCH_SIZE) {
    const chunk = newSchedules.slice(i, i + BATCH_SIZE);
    const { error } = await supabase.from("schedules").insert(chunk);
    if (error) {
      console.warn(`Error inserting schedules chunk at ${i}:`, error.message);
    }
  }

  // 7. Inject 2 Controlled Demo Conflicts on a future date (2026-09-12)
  console.log("Setting up 2 controlled demo conflicts for Conflict Detection showcase...");
  const conflictDate = "2026-09-12";
  const conflictSlots = slotsByDate.get(conflictDate) || [];
  if (conflictSlots.length >= 2 && judges.length >= 2 && courtrooms.length >= 2) {
    const doubleBookSlot = conflictSlots[0];
    const demoJudge = judges[0];

    const conflictCaseAId = crypto.randomUUID();
    const conflictCaseBId = crypto.randomUUID();

    await supabase.from("cases").insert([
      {
        id: conflictCaseAId,
        case_number: `CASE-2026-9901`,
        cnr_number: `DLCT01-099901-2026`,
        category_id: categories[0].id,
        filing_date: "2026-08-10",
        status: "scheduled",
        parties: "Delhi Metro Rail Corp. v. Continental Engineering [Adv. Harish Salve]",
        estimated_duration_minutes: 60,
        priority_score: 75.0,
        priority_tier: "Tier 2",
      },
      {
        id: conflictCaseBId,
        case_number: `CASE-2026-9902`,
        cnr_number: `DLCT01-099902-2026`,
        category_id: categories[1].id,
        filing_date: "2026-08-12",
        status: "scheduled",
        parties: "State v. Rameshwar & Anr. (Double Booking Demo) [Adv. Rajesh Sharma]",
        estimated_duration_minutes: 60,
        priority_score: 82.0,
        priority_tier: "Tier 1",
      },
    ]);

    await supabase.from("schedules").insert([
      {
        id: crypto.randomUUID(),
        case_id: conflictCaseAId,
        judge_id: demoJudge.id,
        courtroom_id: courtrooms[0].id,
        slot_id: doubleBookSlot.id,
        status: "confirmed",
      },
      {
        id: crypto.randomUUID(),
        case_id: conflictCaseBId,
        judge_id: demoJudge.id,
        courtroom_id: courtrooms[1].id,
        slot_id: doubleBookSlot.id,
        status: "confirmed",
      },
    ]);

    const unavailSlot = conflictSlots[1];
    const conflictCaseCId = crypto.randomUUID();
    await supabase.from("cases").insert({
      id: conflictCaseCId,
      case_number: `CASE-2026-9903`,
      cnr_number: `DLCT01-099903-2026`,
      category_id: categories[0].id,
      filing_date: "2026-08-15",
      status: "scheduled",
      parties: "Sunita Builders v. Municipal Corp. (Room Closed Demo)",
      estimated_duration_minutes: 60,
      priority_score: 65.0,
      priority_tier: "Tier 2",
    });

    await supabase.from("schedules").insert({
      id: crypto.randomUUID(),
      case_id: conflictCaseCId,
      judge_id: judges[1].id,
      courtroom_id: courtrooms[2].id,
      slot_id: unavailSlot.id,
      status: "confirmed",
    });

    await supabase.from("availability").upsert(
      {
        entity_type: "courtroom",
        entity_id: courtrooms[2].id,
        date: conflictDate,
        slot_id: unavailSlot.id,
        status: "unavailable",
      },
      { onConflict: "entity_type,entity_id,slot_id" },
    );
    console.log("Demo conflicts created successfully for 2026-09-12!");
  }

  // 8. Summary Verification
  const { count: totalCases } = await supabase.from("cases").select("*", { count: "exact", head: true });
  const { count: totalSchedules } = await supabase.from("schedules").select("*", { count: "exact", head: true });
  const { data: unscheduledCases } = await supabase.from("cases").select("id, status").in("status", ["filed", "adjourned"]);

  console.log("\n================ SEEDING COMPLETE ================");
  console.log(`Total Cases in Registry: ${totalCases}`);
  console.log(`Total Schedules in Registry: ${totalSchedules}`);
  console.log(`Unscheduled Cases ready for Smart Scheduling: ${unscheduledCases?.length}`);
  console.log("Dataset spans July 2026 through December 2026 with daily cases!");
}

main().catch((err) => {
  console.error("Seeding failed:", err);
  process.exit(1);
});
