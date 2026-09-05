import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import fs from "fs";
import path from "path";

const doc = new jsPDF({
  orientation: "portrait",
  unit: "pt",
  format: "a4",
});

const pageWidth = doc.internal.pageSize.getWidth(); // 595.28 pt
const pageHeight = doc.internal.pageSize.getHeight(); // 841.89 pt
const margin = 40;
const contentWidth = pageWidth - margin * 2; // 515.28 pt

// Colors
const NAVY = [18, 34, 64];       // Deep judicial navy
const GOLD = [175, 125, 30];     // Muted brass/gold
const CHARCOAL = [30, 35, 45];   // Body text
const MUTED = [95, 105, 120];    // Secondary text
const LIGHT_BG = [247, 249, 252];// Box background
const LINE_COLOR = [215, 222, 230];
const ACCENT_RED = [160, 40, 40];

let currentY = margin;

function checkPage(neededHeight = 40) {
  if (currentY + neededHeight > pageHeight - margin - 25) {
    doc.addPage();
    currentY = margin + 20;
    drawRunningHeader();
  }
}

function drawRunningHeader() {
  const pageNum = doc.getNumberOfPages();
  if (pageNum === 1) return;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(...MUTED);
  doc.text("NYAYASETU - Internal Team Meeting Hinglish Spoken Script & Training Guide", margin, margin - 10);
  doc.text(`Page ${pageNum}`, pageWidth - margin, margin - 10, { align: "right" });
  doc.setDrawColor(...LINE_COLOR);
  doc.setLineWidth(0.5);
  doc.line(margin, margin - 4, pageWidth - margin, margin - 4);
}

function addSectionTitle(title) {
  checkPage(55);
  currentY += 12;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(...NAVY);
  doc.text(title, margin, currentY);
  currentY += 4;
  doc.setDrawColor(...GOLD);
  doc.setLineWidth(1.5);
  doc.line(margin, currentY, margin + 70, currentY);
  currentY += 12;
}

function addSubTitle(title) {
  checkPage(28);
  currentY += 6;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9.5);
  doc.setTextColor(...NAVY);
  doc.text(title, margin, currentY);
  currentY += 9;
}

function addDialogue(speaker, speechText, tip = "") {
  checkPage(50);
  const fullText = `"${speechText}"`;
  const lines = doc.splitTextToSize(fullText, contentWidth - 20);
  const tipHeight = tip ? 16 : 0;
  const boxHeight = lines.length * 10.5 + 24 + tipHeight;

  doc.setFillColor(...LIGHT_BG);
  doc.roundedRect(margin, currentY, contentWidth, boxHeight, 3, 3, "F");
  doc.setDrawColor(...GOLD);
  doc.setLineWidth(1.5);
  doc.line(margin, currentY, margin, currentY + boxHeight);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(...GOLD);
  doc.text(`[ ${speaker.toUpperCase()} ]`, margin + 10, currentY + 13);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.2);
  doc.setTextColor(...CHARCOAL);
  let textY = currentY + 25;
  for (const line of lines) {
    doc.text(line, margin + 10, textY);
    textY += 10.5;
  }

  if (tip) {
    doc.setFont("helvetica", "italic");
    doc.setFontSize(7.5);
    doc.setTextColor(...MUTED);
    doc.text(`-> Action / Tip: ${tip}`, margin + 10, textY + 4);
  }

  currentY += boxHeight + 8;
}

function addBullet(title, text) {
  checkPage(18);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.2);
  doc.setTextColor(...NAVY);
  const prefix = "*  " + title + ": ";
  doc.text(prefix, margin, currentY);
  const prefixWidth = doc.getTextWidth(prefix);
  
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...CHARCOAL);
  
  const words = text.split(" ");
  let line = "";
  let isFirst = true;
  for (let i = 0; i < words.length; i++) {
    const testLine = line ? line + " " + words[i] : words[i];
    const maxWidth = isFirst ? contentWidth - prefixWidth : contentWidth - 10;
    if (doc.getTextWidth(testLine) <= maxWidth) {
      line = testLine;
    } else {
      checkPage(12);
      doc.text(line, isFirst ? margin + prefixWidth : margin + 10, currentY);
      currentY += 10.5;
      isFirst = false;
      line = words[i];
    }
  }
  if (line) {
    checkPage(12);
    doc.text(line, isFirst ? margin + prefixWidth : margin + 10, currentY);
    currentY += 10.5;
  }
  currentY += 2;
}

function addTable(headers, rows) {
  checkPage(50);
  autoTable(doc, {
    startY: currentY,
    head: [headers],
    body: rows,
    theme: "grid",
    styles: {
      font: "helvetica",
      fontSize: 7.5,
      cellPadding: 3.5,
      textColor: CHARCOAL,
      lineColor: LINE_COLOR,
      lineWidth: 0.5,
    },
    headStyles: {
      fillColor: NAVY,
      textColor: [255, 255, 255],
      fontStyle: "bold",
    },
    alternateRowStyles: {
      fillColor: [250, 251, 253],
    },
    margin: { left: margin, right: margin },
  });
  currentY = doc.lastAutoTable.finalY + 10;
}

// -------------------------------------------------------------
// COVER BANNER
// -------------------------------------------------------------
doc.setFillColor(...NAVY);
doc.rect(0, 0, pageWidth, 200, "F");

doc.setFont("helvetica", "bold");
doc.setFontSize(22);
doc.setTextColor(255, 255, 255);
doc.text("NYAYASETU (Court Scheduler Pro)", margin, 65);

doc.setFont("helvetica", "normal");
doc.setFontSize(11);
doc.setTextColor(220, 230, 245);
doc.text("Team Training Meeting - Exact Hinglish Word-for-Word Speaking Script", margin, 87);

doc.setFontSize(8.5);
doc.setTextColor(...GOLD);
doc.text("INTERNAL TEAM BRIEFING DOSSIER | TOMORROW'S REHEARSAL & KNOWLEDGE TRANSFER", margin, 110);

doc.setDrawColor(...GOLD);
doc.setLineWidth(1.5);
doc.line(margin, 122, pageWidth - margin, 122);

doc.setFont("helvetica", "normal");
doc.setFontSize(8);
doc.setTextColor(205, 220, 240);
doc.text("Target Audience: Your 3-5 College Teammates who currently know zero about the codebase", margin, 138);
doc.text("Tone: 100% Authentic, Direct, Indian College Peer-to-Peer Hinglish (Word-for-Word spoken dialogue)", margin, 152);
doc.text("Goal: Zero hesitation, total clarity, live demo mastery, and bulletproof judge defense", margin, 166);

currentY = 215;

addDialogue(
  "Team Leader Directive",
  "Bhai suno, ye document koi generic project report nahi hai. Ye tumhara exact speaking script hai jo tumhe kal meeting me bolna hai. Isko samne rakh ke line-by-line bolte jao. Kal meeting ke baad team ka ek bhi banda confuse nahi rahega."
);

addSectionTitle("MODULE 1: MEETING OPENING SPEECH (SEEDHI BAAT)");

addDialogue(
  "Exact Word-for-Word Opening Dialogue",
  "Hey guys, sab log please dhyan se suno. Maine ye meeting isliye rakhi hai kyunki kal hamari official presentation aur evaluation hai. Seedhi aur sacchi baat ye hai ki abhi tak project ke code, PPT aur report pe majorly maine deep kaam kiya hai. But kal jab judges ya professors hum sabse questions puchenge, toh hum waha chup-chap khade nahi reh sakte, aur na hi sab log meri taraf dekh sakte ho.\n\nEvaluators ko ek cohesive, solid engineering team dekhni hai jisme har ek bande ko pata ho ki humne kya banaya hai. Mujhe tumse overnight pura code likhwana nahi hai, na hi tumhe 5000 lines ka code ratna hai. But tumhe project ka concept, problem, live demo, architecture aur judges ke sawal itne acche se aane chahiye ki agar judge randomly tum me se kisi ko bhi ungli karke puche, toh tum confidence ke sath 1 minute me answer de sako. Agle 60 minutes me hum zero se lekar pro tak pura project lock karenge. Let's start!",
  "Sabko eye-contact do, serious but encouraging tone rakho."
);

addSectionTitle("MODULE 2: PROJECT KO ZERO SE SAMJHANA (REAL LIFE EXAMPLE)");

addDialogue(
  "Project Concept in Simple Hinglish",
  "Pehle code aur technology ko 5 minute ke liye bhul jao. Samajhte hai ki problem kya hai aur humne banaya kya hai.\n\nIndia ke courts me aaj 50 million yaani 5 CRORE se zyada cases pending hai! Log sochte hai ki judges aalsi hai ya kaam nahi karte. Ye bilkul galat baat hai. Main reason hai: Court ka listing aur scheduling system purane zamaane ka hai.\n\nDistrict court me kya hota hai? Ek clerk hota hai jise 'Peshkar' bolte hai. Wo subah ek physical register leke baithta hai aur apne mann se 120-130 cases ki list bana deta hai ki aaj ye sab sune jayenge. Lekin Courtroom 1 ko pata hi nahi hota ki Courtroom 3 me kya chal raha hai!\n\nAb hota ye hai: Ek advocate hai, Advocate Sharma. Wo Courtroom 1 me ek property case ke liye listed hai 11 baje. Aur wahi Advocate Sharma Courtroom 3 me bail argue karne ke liye bhi listed hai 11 baje! Jab Courtroom 1 me case call hota hai, advocate gayab! Judge bolta hai: 'Lawyer absent hai, agle 3 mahine baad ki date le lo.' India me 40% delays sirf is lawyer clashing aur double-booking ki wajah se hote hai!",
  "Teammates ke chehre pe nod aana chahiye - confirm karo unhe samjha ya nahi."
);

doc.addPage();
currentY = margin + 20;
drawRunningHeader();

addDialogue(
  "The Real Human Tragedy (Emotional Connection for Judges)",
  "Aur socho aam aadmi ke sath kya hota hai: Ek 70 saal ke dada ji Satara ya kisi gaon se 50 km bus se aate hai, pension ke 200 rupaye kharch karte hai, dhoop me court ke bahar 4:30 baje tak baithte hai, aur 4:30 baje clerk bolta hai: 'Aaj number nahi aaya, agle saal aana.' Ye kitna bada harassment hai!\n\nAb hamara NyayaSetu kya karta hai?\nNyayaSetu basically courtroom ka AIR TRAFFIC CONTROL hai. Jaise airport pe do flight ek hi runway pe land nahi ho sakti, waise hi NyayaSetu ensure karta hai ki koi judge, koi courtroom aur koi lead advocate kabhi double-book na ho!\n\nYe register ko replace karta hai ek smart mathematical engine se jo 7 hard rules check karta hai aur cases ko statutory urgency (jaise POCSO child abuse cases ya senior citizen disputes) ke hisab se order karta hai. Result kya hai? Zero clashes, daily 25 cases ki balanced cause-list, aur gaon ka banda apne mobile pe Hindi aur Marathi me queue status dekh sakta hai bina kisi dalal ke!",
  "Ye 'Air Traffic Control' wali line judges ko sabse zyada impress karti hai."
);

addSectionTitle("MODULE 3: THE 'ONE STORY' (HAR BANDE KO YE YAAD HONA CHAHIYE)");

addDialogue(
  "The 60-Second Team Master Pitch",
  "Agar judge puche: 'What is your project?', toh hum sabka answer ek hi hoga:\n\n'Sir, India has 50 million pending court cases, and over 40% of daily trial delays happen because of archaic manual scheduling that causes lawyer double-bookings and overcrowded courtrooms. Existing tools like eCourts CIS act as passive digital ledgers - they record yesterday's order, but do not optimize tomorrow's hearing.\n\nNyayaSetu is the intelligent scheduling brain that courts lack. We use deterministic mathematical constraint satisfaction to test 7 hard rules like holidays, judge availability, and lawyer clashes, and rank open slots using statutory urgency like POCSO and Senior Citizen laws. Clerks get an explainable Decision Receipt to confirm hearings with 1 click, while citizens track their queue on mobile in Hindi and Marathi with zero hassle.'",
  "Sab teammates se ye pitch ek baar bulwao."
);

addSectionTitle("MODULE 4: LIVE WEB APP WALKTHROUGH (SCREEN SHARE SCRIPT)");

addDialogue(
  "Step 1: Landing Page (http://localhost:3000/)",
  "Screen share karo aur bolo: 'Dekho guys, ye hamara public landing page hai. Notice karo 3 cards: Judge Bench Portal, Court Staff Portal, aur Citizen Case Status Lookup. Saath me upar live impact banner dekho jo dikha raha hai kitne conflicts prevent hue aur kitne Tier 1 cases schedule hue.'",
  "Landing page kholo, mouse hover karke teeno cards dikhao."
);

addDialogue(
  "Step 2: Staff Login (/auth) -> Dashboard (/dashboard)",
  "Staff login karo aur bolo: 'Ab hum Court Registrar ban kar login kar rahe hai. Ye hamara main Dashboard hai. Point karo is Courtroom Utilization Heatmap pe: ye dikhata hai ki har courtroom ghante ke hisab se kitna occupied hai. Amber ka matlab room overload hai, blue ka matlab room free hai. Clerk ko turant pata chal jata hai kaun sa courtroom khali pada hai.'",
  "Heatmap ke cells pe mouse le jao."
);

addDialogue(
  "Step 3: Smart Scheduling Workbench (/smart-scheduling) [HERO FEATURE]",
  "Smart scheduling pe click karo aur bolo: 'Dhyan se dekho, ye hamare pure project ka sabse bada hero feature hai. Left side me unscheduled cases hai. Maine select kiya ek POCSO case: State vs. Verma. Red badge dekho: Tier 1 Urgent, Priority Score 94!\n\nAb right side dekho: hamare engine ne 5 millisecond ke andar 96 combinations test kiye aur hume Candidate #1 slot diya.\n\nAur ye dekho: DECISION RECEIPT! Is receipt me green checks dekho: Court holiday nahi hai, Judge available hai, Room available hai, Advocate clash nahi hai. Ye koi black-box AI ka guess nahi hai, ye pure mathematical proof hai!'\n\nAb 'Confirm Listing' pe click karo aur bolo: 'Ek click me case schedule ho gaya, database me update ho gaya, aur immutable audit log me entry ho gayi!'",
  "Decision receipt pe green checks clearly point out karo."
);

doc.addPage();
currentY = margin + 20;
drawRunningHeader();

addDialogue(
  "Step 4: Daily Cause List (/cause-list)",
  "Cause list pe jao aur bolo: 'Ye dekho aaj ki cause list. Normal courts me 150 cases ka ek khichdi board hota hai. NyayaSetu me ye 3 procedural stages me divided hai: Morning Urgent Motions, Midday Evidence Trials, aur Afternoon Final Arguments. Ab 'Export Official PDF' pe click karo: dekho, instantly High Court gazette format me official branded PDF download ho gaya!'",
  "PDF download karke screen pe 2 second ke liye dikhao."
);

addDialogue(
  "Step 5: Digital Twin What-If Sandbox (/what-if-simulation)",
  "What-If page pe jao aur bolo: 'Agar kal subah 9 baje koi judge achanak bimar pad jaye, toh normal court me kya hota hai? 30 hearings cancel, public pareshan! NyayaSetu me hum 'Run Simulation' dabate hai: ye memory me pure court ka digital clone banata hai, us judge ke 3 cases ko doosre available rooms me 60 seconds me reassign kar deta hai bina database ko corrupt kiye!'",
  "Run simulation dabao aur reallocated list dikhao."
);

addDialogue(
  "Step 6: Citizen Portal on Mobile View (/case-status)",
  "Browser me Inspect element karke mobile view karo. Case status kholo aur bolo: 'Gaon ka banda mobile pe kholta hai. Case number daalta hai 'BNS/2026/0014'. Usko seedha judge ka naam, courtroom number aur queue position #3 dikh jata hai. Aur jaise hi wo 'Hindi' ya 'Marathi' pill dabata hai, pura card vernacular me translate ho jata hai!'",
  "Language switch karke card transition dikhao."
);

addSectionTitle("MODULE 5: TECH STACK EXPLAINED IN HINGLISH (TEACHER STYLE)");

const techTable = [
  ["React 19", "Frontend UI", "Screen ke interactive buttons, cards aur forms banata hai. Ultra-fast rendering."],
  ["TanStack Start", "Fullstack SSR", "URL routing aur type-safe server functions. Zero API boilerplate."],
  ["Nitro Engine", "Edge Server", "Cloudflare Workers pe sub-50ms cold starts deta hai."],
  ["Supabase PostgreSQL", "Database & Auth", "Relational tables + Row Level Security (RLS) policies jo unauthorized access rokti hai."],
  ["Google Gemini 3.5 Flash", "AI Assistant", "Registry Assistant me natural language sawalo ke jawab live DB context se deta hai."],
  ["Groq LLaMA 3.3", "AI Failover", "Agar Gemini me rate limit aaye, toh sub-second me Groq backup deta hai."],
  ["Tailwind CSS v4", "Design System", "Judicial color tokens: Ink Navy, Muted Gold aur Parchment."],
];

addTable(["Technology", "Role in Project", "Hinglish Explanation for Teammates"], techTable);

addDialogue(
  "Why No OpenAI? (Important Reminder)",
  "Dhyan rakhna sab log: Hum OpenAI ka API key use nahi kar rahe hai. Hamara AI stack Google Gemini 3.5 Flash hai primary, aur Groq Cloud LLaMA 3.3 hai backup. Agar judge puche toh OpenAI ka naam mat lena, bolna 'Gemini + Groq dual engine'.",
  "Sabko clear karwao."
);

addSectionTitle("MODULE 6: ARCHITECTURE IN 3 LINES (BOARD PE DRAW KARNE KE LIYE)");

addDialogue(
  "Whiteboard Architecture Dialogue",
  "Agar judge bole architecture draw karo, toh ye 3 lines bolna:\n1. 'Tier 1 & 3: Hamara mathematical scheduling solver pure TypeScript me chalta hai without any AI dependencies. 100% deterministic.'\n2. 'Tier 4: Google Gemini aur Groq sirf ek advisory chatbot hai staff ke questions ke liye. Wo schedule decide nahi karta.'\n3. 'Tier 5: Supabase PostgreSQL me Row Level Security aur immutable audit logs hai, jisse koi clerk record fake nahi kar sakta.'",
  "Board pe Tier 1 se Tier 5 ka diagram draw karna seekho."
);

doc.addPage();
currentY = margin + 20;
drawRunningHeader();

addSectionTitle("MODULE 7: TEAM ROLE ALLOCATION (KAUN KYA BOLEGA)");

addBullet("Role 1 (Lead Presenter)", "Opening speech dega, 50M backlog crisis explain karega, aur live web app demo run karega. (Parts 1, 2, 4, 6)");
addBullet("Role 2 (UI / UX Specialist)", "React 19, Decision Receipt visual card, OKLCH judicial colors aur multilingual mobile portal explain karega. (Parts 4, 5)");
addBullet("Role 3 (Algorithm Specialist)", "7 Hard constraints, 4 soft weights, 8-factor POCSO priority formula aur What-If sandbox explain karega. (Parts 2, 4)");
addBullet("Role 4 (Backend & Security)", "Supabase PostgreSQL, Row Level Security (RLS), Cloudflare edge deployment aur Regulation 9 audit logs explain karega. (Parts 5, 6)");

addSectionTitle("MODULE 8: TOP 10 JUDGE QUESTIONS & SOLID HINGLISH ANSWERS");

addDialogue(
  "Q1: Tumne scheduling ke liye AI (LLM) kyu nahi use kiya?",
  "Bolo: 'Sir, judicial administration me hallucinations fatal hote hai. Agar ek LLM galti se do trials ek hi room me ya court holiday ke din schedule kar de, toh physical court thap ho jayegi. Isliye hamara scheduling engine 100% deterministic mathematical constraint programming hai, aur LLM ko humne strictly advisory natural language Q&A tak restrict kiya hai.'",
  "Sabse high-frequency sawal hai!"
);

addDialogue(
  "Q2: Lawyer double-booking kaise prevent karte ho?",
  "Bolo: 'Sir, hamara engine registry-wide har case ke lead advocates ko track karta hai. Jab engine slots evaluate karta hai, toh Hard Constraint #3 check karta hai ki kya wo advocate kisi doosre courtroom me us waqt booked hai. Agar haan, toh wo slot automatically disqualify ho jata hai.'",
  "Confidence ke sath bolo."
);

addDialogue(
  "Q3: Kya ye Supreme Court ke AI rules ko follow karta hai?",
  "Bolo: 'Bilkul sir. Supreme Court e-Committee ki Draft Regulation 9 on Judicial AI ke mutabiq, AI kabhi final decision nahi le sakta. NyayaSetu me algorithm sirf recommend karta hai; final confirmation human registrar aur judge ke hath me hoti hai with an explainable Decision Receipt and immutable audit trail.'",
  "Draft Regulation 9 term bolte hi judges impress hote hai."
);

addDialogue(
  "Q4: Agar judge bole ki mujhe ye case kal hi sunna hai, toh algorithm kya karega?",
  "Bolo: 'Sir, hum judicial discretion ki respect karte hai. Hamare paas Custom Judicial Directive feature hai. Judge ya registrar kisi bhi slot pe manually case place kar sakte hai. System real-time pre-flight clash check karega, warning dega, aur audit log me judge ka directive note record karega.'",
  "Judicial independence ka respect dikhao."
);

addDialogue(
  "Q5: Existing eCourts system ke sath ye kaise fit hoga?",
  "Bolo: 'Sir, NyayaSetu eCourts ko replace nahi karta. eCourts CIS ek passive data store hai. NyayaSetu uska intelligent operational brain hai. Hum CIS se CNR number aur case details ingest karte hai via API, listing optimize karte hai, aur cause list wapas publish kar dete hai.'",
  "Strategic positioning."
);

doc.addPage();
currentY = margin + 20;
drawRunningHeader();

addSectionTitle("MODULE 9: 'DON'T SAY THIS' (YE GALTI SE BHI MAT BOLNA)");

const dontTable = [
  ["'Humne AI se decision dilwaya hai.'", "'Hamara engine deterministic mathematical constraint satisfaction hai; AI sirf copilot hai.'"],
  ["'Hamara model case ka outcome ya verdict predict karta hai.'", "'Hum procedural urgency aur hearing duration estimate karte hai based on statutes.'"],
  ["'Ye part sirf developer ko pata hai, mujhe nahi pata.'", "'Ye hamare backend architecture ka part hai, aur hamara systems specialist isko detail me explain karega.'"],
  ["'Ye already 20,000 courts me chal raha hai.'", "'Ye district aur taluka courts ke liye engineered production-ready pilot hai.'"],
];
addTable(["[X] Galti se bhi ye mat bolna", "[OK] Uski jagah ye bolna"], dontTable);

addSectionTitle("MODULE 10: AGAR KOI SAWAL NA AAYE TOH KYA BOLEIN?");

addDialogue(
  "The Professional Bridge Phrase (Panic hone se bacho)",
  "Agar judge ne aisa technical sawal pucha jiska answer kisi ko nahi pata, toh chup mat rehna aur guess mat marna. Smile karo aur calmly bolo:\n\n'That is a very insightful operational point, sir. In our current architecture, that scenario is handled by our constraint validation layer, and scaling that specific edge case is part of our Phase 2 High Court roadmap.'",
  "Ye bolne se tum confident aur mature dikhoge, unprepared nahi."
);

addSectionTitle("MODULE 11: CLOSING & FINAL PEP TALK");

addDialogue(
  "Final 2-Minute Motivational Closing",
  "Bhai dekho, humne ek genuine, real-world national crisis solve kiya hai. Hamare paas sirf baatein nahi hai, hamare paas ek live working web application hai jo 5 millisecond me mathematically prove karti hai ki zero clashes kaise hote hai. Kal jab hum stage pe khade honge, toh confident rehna. Ek doosre ko support karna. Agar judge kisi se puche toh smoothly pass karna: 'For this logic, my teammate will explain.' Hum ye presentation phod ke aayenge. All the best guys!",
  "Sab teammates ka high-five karwao!"
);

// Save PDF
const outputPath = path.join(process.cwd(), "NyayaSetu_Hinglish_Team_Meeting_Script.pdf");
const buffer = Buffer.from(doc.output("arraybuffer"));
fs.writeFileSync(outputPath, buffer);

console.log(`[OK] Hinglish Meeting Script PDF successfully generated at: ${outputPath}`);
console.log(`Total Pages: ${doc.getNumberOfPages()} pages | File Size: ${buffer.length} bytes`);
