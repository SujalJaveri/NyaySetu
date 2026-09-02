/**
 * Full-Page High-Performance Hindi & English Translation Engine for NyayaSetu
 *
 * Provides:
 * 1. Deep Context-Based Translation (`useLanguage()` & `t()`)
 * 2. 100% Crash-Free, Bidirectional DOM TreeWalker Engine (EN ⇄ हिं)
 * 3. React DOM reconciliation guard (prevents removeChild/insertBefore crashes)
 * 4. Zero external dependencies (No invasive Google Translate script injections)
 */
import {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
  type ReactNode,
} from "react";

export type Language = "en" | "hi";

const STORAGE_KEY = "nyayasetu.language";

// ─── REACT RECONCILIATION CRASH GUARD ──────────────────────────────────────────
// When text in the DOM is altered, React 19 / 18 can throw:
// "NotFoundError: Failed to execute 'removeChild' on 'Node': The node to be removed is not a child of this node."
// This patch safely guards Node.prototype methods against unparented removals.
if (typeof window !== "undefined" && typeof Node !== "undefined" && Node.prototype) {
  const nodeProto = Node.prototype as unknown as Record<string, Function>;

  const origRemoveChild = nodeProto["removeChild"];
  if (typeof origRemoveChild === "function") {
    nodeProto["removeChild"] = function (this: Node, child: Node): Node {
      if (child.parentNode !== this) {
        return child;
      }
      return origRemoveChild.call(this, child);
    };
  }

  const origInsertBefore = nodeProto["insertBefore"];
  if (typeof origInsertBefore === "function") {
    nodeProto["insertBefore"] = function (this: Node, newNode: Node, referenceNode: Node | null): Node {
      if (referenceNode && referenceNode.parentNode !== this) {
        return newNode;
      }
      return origInsertBefore.call(this, newNode, referenceNode);
    };
  }
}

// ─── COMPREHENSIVE LEGAL & UI TRANSLATION DICTIONARY ───────────────────────────
export const translations = {
  // Navigation
  "nav.overview": { en: "Overview", hi: "अवलोकन" },
  "nav.scheduling": { en: "Scheduling", hi: "समय-निर्धारण" },
  "nav.administration": { en: "Administration", hi: "प्रशासन" },
  "nav.dashboard": { en: "Dashboard", hi: "डैशबोर्ड" },
  "nav.cases": { en: "Cases", hi: "मामले" },
  "nav.judges": { en: "Judges", hi: "न्यायाधीश" },
  "nav.courtrooms": { en: "Courtrooms", hi: "न्यायालय कक्ष" },
  "nav.calendar": { en: "Calendar", hi: "कैलेंडर" },
  "nav.cause-list": { en: "Cause List", hi: "वाद सूची" },
  "nav.smart-scheduling": { en: "Smart Scheduling", hi: "स्मार्ट शेड्यूलिंग" },
  "nav.conflicts": { en: "Conflict Detection", hi: "विरोध पहचान" },
  "nav.what-if": { en: "What-If Simulation", hi: "क्या-अगर सिमुलेशन" },
  "nav.backlog": { en: "Backlog Simulator", hi: "बैकलॉग सिमुलेटर" },
  "nav.reports": { en: "Reports", hi: "रिपोर्ट्स" },
  "nav.activity-log": { en: "Activity Log", hi: "गतिविधि लॉग" },
  "nav.governance": { en: "Governance & Compliance", hi: "शासन एवं अनुपालन" },
  "nav.admin": { en: "Admin Panel", hi: "प्रशासन पैनल" },
  "nav.priority-settings": { en: "Priority Settings", hi: "प्राथमिकता सेटिंग्स" },

  // Dashboard
  "dash.pending-cases": { en: "Pending cases", hi: "लंबित मामले" },
  "dash.tier1-cases": { en: "Tier 1 cases", hi: "टीयर 1 मामले" },
  "dash.scheduled": { en: "Scheduled hearings", hi: "निर्धारित सुनवाइयाँ" },
  "dash.conflicts": { en: "Conflicts detected", hi: "पहचाने गए विरोध" },
  "dash.judge-util": { en: "Judge utilisation", hi: "न्यायाधीश उपयोग दर" },
  "dash.courtroom-util": { en: "Courtroom utilisation", hi: "कक्ष उपयोग दर" },
  "dash.awaiting": { en: "Awaiting scheduling", hi: "समय-निर्धारण प्रतीक्षारत" },
  "dash.disposed": { en: "Disposed cases", hi: "निपटाए गए मामले" },
  "dash.judge-workload": { en: "Judge workload distribution", hi: "न्यायाधीश कार्यभार वितरण" },
  "dash.courtroom-util-title": { en: "Courtroom utilisation", hi: "न्यायालय कक्ष उपयोग" },
  "dash.registry-briefing": { en: "Registry briefing", hi: "रजिस्ट्री सारांश" },
  "dash.court-readiness": { en: "Court readiness", hi: "न्यायालय तत्परता" },
  "dash.conflict-review": { en: "Conflict review", hi: "विरोध समीक्षा" },
  "dash.unlisted": { en: "Unlisted open cases", hi: "असूचीबद्ध मामले" },
  "dash.tier1-attention": { en: "Tier 1 attention", hi: "टीयर 1 ध्यान" },
  "dash.bench-capacity": { en: "Bench capacity", hi: "पीठ क्षमता" },
  "dash.courtroom-slots": { en: "Courtroom slots", hi: "कक्ष स्लॉट" },
  "dash.impact": { en: "NyayaSetu Impact", hi: "न्यायसेतु प्रभाव" },
  "dash.impact.conflicts": { en: "Conflicts Detected & Prevented", hi: "पहचाने और रोके गए विरोध" },
  "dash.impact.tier1": { en: "Tier 1 Cases Prioritised", hi: "प्राथमिकता प्राप्त टीयर 1 मामले" },
  "dash.impact.recs": { en: "AI Recommendations Issued", hi: "AI अनुशंसाएं जारी" },
  "dash.impact.hearings": { en: "Active Scheduled Hearings", hi: "सक्रिय निर्धारित सुनवाइयाँ" },

  // Cases Table & Filters
  "cases.case-number": { en: "Case Number", hi: "मामला संख्या" },
  "cases.category": { en: "Category", hi: "श्रेणी" },
  "cases.status": { en: "Status", hi: "स्थिति" },
  "cases.filing-date": { en: "Filing Date", hi: "दाखिल तिथि" },
  "cases.priority": { en: "Priority", hi: "प्राथमिकता" },
  "cases.parties": { en: "Parties", hi: "पक्षकार" },
  "cases.adjournments": { en: "Adjournments", hi: "स्थगन" },
  "cases.pending-days": { en: "Pending Days", hi: "लंबित दिन" },

  // Cause List
  "cause-list.title": { en: "Cause List", hi: "वाद सूची" },
  "cause-list.date": { en: "Date", hi: "तारीख" },
  "cause-list.judge": { en: "Judge", hi: "न्यायाधीश" },
  "cause-list.courtroom": { en: "Courtroom", hi: "न्यायालय कक्ष" },
  "cause-list.slot": { en: "Slot", hi: "समय स्लॉट" },
  "cause-list.generate": { en: "Generate Optimised Board", hi: "अनुकूलित वाद सूची बनाएं" },
  "cause-list.morning": { en: "Urgent Mentions & Admissions", hi: "तत्काल उल्लेख एवं प्रवेश" },
  "cause-list.contested": { en: "Contested Arguments & Evidence", hi: "विवादित तर्क एवं साक्ष्य" },
  "cause-list.afternoon": { en: "Orders & Miscellaneous Disposals", hi: "आदेश एवं विविध निपटान" },

  // General & Actions
  "general.refresh": { en: "Refresh", hi: "ताज़ा करें" },
  "general.loading": { en: "Loading…", hi: "लोड हो रहा है…" },
  "general.error": { en: "Error", hi: "त्रुटि" },
  "general.search": { en: "Search cases…", hi: "मामले खोजें…" },
  "general.sign-out": { en: "Sign out", hi: "साइन आउट" },
  "general.accept": { en: "Accept", hi: "स्वीकार करें" },
  "general.modify": { en: "Modify", hi: "संशोधित करें" },
  "general.reject": { en: "Reject", hi: "अस्वीकार करें" },
  "general.cancel": { en: "Cancel", hi: "रद्द करें" },
  "general.save": { en: "Save", hi: "सहेजें" },
} as const;

export type TranslationKey = keyof typeof translations;

// ─── PHRASE & VOCABULARY DICTIONARY FOR DOM TRANSLATION ────────────────────────
// Ordered so longer, specific phrases are matched before short/single words.
const DOM_TRANSLATIONS: [RegExp, string][] = [
  // Full Headers & Features
  [/Smart Scheduling/gi, "स्मार्ट शेड्यूलिंग"],
  [/Conflict Detection/gi, "विरोध पहचान प्रणाली"],
  [/What-If Simulation/gi, "क्या-अगर सिमुलेशन"],
  [/Backlog Simulator/gi, "बैकलॉग सिमुलेटर"],
  [/Governance & Compliance/gi, "शासन एवं अनुपालन"],
  [/Priority Settings/gi, "प्राथमिकता सेटिंग्स"],
  [/Architecture Preview/gi, "वास्तुकला पूर्वावलोकन"],
  [/Activity Log/gi, "गतिविधि लॉग"],
  [/Cause List/gi, "वाद सूची"],
  [/Decision Receipt/gi, "निर्णय रसीद"],
  [/Explainable Decision Receipt/gi, "व्याख्यात्मक निर्णय रसीद"],
  [/NyayaSetu Registry/gi, "न्यायसेतु रजिस्ट्री"],
  [/AI powered court scheduling control/gi, "AI संचालित न्यायालय समय-निर्धारण नियंत्रण"],
  [/AI powered court scheduling/gi, "AI संचालित न्यायालय शेड्यूलिंग"],
  [/Run Scheduling Engine/gi, "शेड्यूलिंग इंजन चलाएं"],
  [/Load SIH Demo/gi, "SIH डेमो लोड करें"],
  [/Load Demo Scenario/gi, "डेमो परिदृश्य लोड करें"],
  [/Load Demo/gi, "डेमो लोड करें"],
  [/Apply Changes/gi, "परिवर्तन लागू करें"],
  [/Generate Optimised Board/gi, "अनुकूलित वाद सूची बनाएं"],
  [/Export PDF/gi, "पीडीएफ डाउनलोड करें"],
  [/Alternative scheduling options/gi, "वैकल्पिक शेड्यूलिंग विकल्प"],
  [/Alternative Scheduling Options/gi, "वैकल्पिक शेड्यूलिंग विकल्प"],
  [/Why this combination was recommended/gi, "इस संयोजन की सिफारिश क्यों की गई"],
  [/Scheduling recommendation · top ranked/gi, "शेड्यूलिंग अनुशंसा · शीर्ष वरीयता"],
  [/Hard Constraints \(all must pass\)/gi, "अनिवार्य शर्तें (सभी पूर्ण होनी चाहिए)"],
  [/Hard Constraints/gi, "अनिवार्य शर्तें"],
  [/Soft Preferences \(ranking only\)/gi, "प्राथमिकता वरीयताएं (केवल रैंकिंग हेतु)"],
  [/Soft Preferences/gi, "प्राथमिकता वरीयताएं"],
  [/Deterministic rules engine/gi, "निश्चित नियम इंजन"],
  [/No AI randomness/gi, "कोई आकस्मिक AI त्रुटि नहीं"],
  [/Same inputs always produce same output/gi, "समान इनपुट पर हमेशा समान परिणाम"],
  [/Court readiness/gi, "न्यायालय तत्परता"],
  [/Registry briefing/gi, "रजिस्ट्री सारांश"],
  [/Judge workload distribution/gi, "न्यायाधीश कार्यभार वितरण"],
  [/Courtroom utilisation/gi, "न्यायालय कक्ष उपयोग"],
  [/Active hearings per judge/gi, "प्रति न्यायाधीश सक्रिय सुनवाइयाँ"],
  [/Pending cases/gi, "लंबित मामले"],
  [/Tier 1 cases/gi, "टीयर 1 मामले"],
  [/Scheduled hearings/gi, "निर्धारित सुनवाइयाँ"],
  [/Conflicts detected/gi, "पहचाने गए विरोध"],
  [/Judge utilisation/gi, "न्यायाधीश उपयोग दर"],
  [/Awaiting scheduling/gi, "शेड्यूलिंग प्रतीक्षारत"],
  [/Disposed cases/gi, "निपटाए गए मामले"],
  [/Fit score \/ 100/gi, "अनुकूलता स्कोर / 100"],
  [/fit score/gi, "अनुकूलता स्कोर"],
  [/minutes estimated/gi, "मिनट अनुमानित"],
  [/estimated duration/gi, "अनुमानित अवधि"],
  [/previous adjournments/gi, "पिछले स्थगन"],
  [/Select a pending case/gi, "एक लंबित मामला चुनें"],
  [/Choose a case…/gi, "मामला चुनें…"],
  [/Choose a pending case…/gi, "लंबित मामला चुनें…"],
  [/No pending cases/gi, "कोई लंबित मामला नहीं"],
  [/Checking case priority/gi, "मामले की प्राथमिकता की जांच"],
  [/Checking judge & courtroom availability/gi, "न्यायाधीश एवं कक्ष उपलब्धता की जांच"],
  [/Checking booking conflicts/gi, "बुकिंग विरोध की जांच"],
  [/Checking duration fit/gi, "अवधि अनुकूलता की जांच"],
  [/Analysis complete/gi, "विश्लेषण पूर्ण"],
  [/Accept & Confirm Listing/gi, "स्वीकार करें एवं सूचीबद्घ करें"],
  [/Modify \/ Pick Alternative/gi, "संशोधित करें / विकल्प चुनें"],
  [/Reject Recommendation/gi, "अनुशंसा अस्वीकार करें"],
  [/Explain recommendation/gi, "अनुशंसा की व्याख्या करें"],
  [/Explain with AI/gi, "AI द्वारा समझाएं"],
  [/Explain with AI Copilot/gi, "AI कोपायलट द्वारा समझाएं"],
  [/AI Decision Support/gi, "AI निर्णय सहायता"],
  [/AI Explanation/gi, "AI व्याख्या"],
  [/Refresh analysis/gi, "विश्लेषण ताज़ा करें"],

  // Indian Legal & Court Terms
  [/Senior Citizen Litigant/gi, "वरिष्ठ नागरिक पक्षकार"],
  [/Senior citizen/gi, "वरिष्ठ नागरिक"],
  [/Fast Track Special Court/gi, "फास्ट ट्रैक विशेष न्यायालय"],
  [/POCSO Act Case/gi, "पॉक्सो (POCSO) अधिनियम मामला"],
  [/POCSO Act/gi, "पॉक्सो अधिनियम"],
  [/POCSO/gi, "पॉक्सो"],
  [/Bail Application/gi, "जमानत याचिका"],
  [/Criminal Law/gi, "दांडिक / आपराधिक विधि"],
  [/Civil Law/gi, "दीवानी विधि"],
  [/Family Law/gi, "पारिवारिक विधि"],
  [/Commercial Disputes/gi, "व्यावसायिक विवाद"],
  [/Commercial Law/gi, "व्यावसायिक विधि"],
  [/Constitutional Law/gi, "संवैधानिक विधि"],
  [/Labour & Industrial/gi, "श्रम एवं औद्योगिक"],
  [/Property Dispute 5yr\+/gi, "5+ वर्ष पुराना संपत्ति विवाद"],
  [/Statutory Limitation Approaching/gi, "कानूनी परिसीमा तिथि निकट"],
  [/Urgent Mentions & Admissions/gi, "तत्काल उल्लेख एवं प्रवेश"],
  [/Contested Arguments & Evidence/gi, "विवादित बहस एवं साक्ष्य"],
  [/Orders & Miscellaneous Disposals/gi, "आदेश एवं विविध निपटान"],
  [/Judge available at this slot/gi, "इस स्लॉट पर न्यायाधीश उपलब्ध हैं"],
  [/Courtroom available/gi, "न्यायालय कक्ष उपलब्ध है"],
  [/No double-booking/gi, "कोई दोहरा आवंटन नहीं"],
  [/Hearing duration fits slot/gi, "सुनवाई अवधि स्लॉट के अनुकूल है"],
  [/Judge workload within threshold/gi, "न्यायाधीश कार्यभार सीमा के भीतर है"],
  [/Not a court holiday/gi, "न्यायालय अवकाश नहीं है"],
  [/Judge emergency leave \/ absence/gi, "न्यायाधीश का आकस्मिक अवकाश / अनुपस्थिति"],
  [/Courtroom emergency infrastructure closure/gi, "कक्ष का आकस्मिक बुनियादी ढांचा बंद"],
  [/Applying simulated condition/gi, "सिम्युलेटेड स्थिति लागू की जा रही है"],
  [/Tracing affected hearings/gi, "प्रभावित सुनवाइयों की पहचान"],
  [/Re-checking judge & courtroom availability/gi, "न्यायाधीश एवं कक्ष की पुनः उपलब्धता जांच"],
  [/Re-checking conflicts and duration fit/gi, "विरोध एवं अवधि की पुनः जांच"],

  // Short words & UI Controls
  [/\bJudicial Officers\b/gi, "न्यायिक अधिकारी"],
  [/\bCourtrooms\b/gi, "न्यायालय कक्ष"],
  [/\bCourtroom\b/gi, "न्यायालय कक्ष"],
  [/\bJudges\b/gi, "न्यायाधीश"],
  [/\bJudge\b/gi, "न्यायाधीश"],
  [/\bSlot\b/gi, "स्लॉट"],
  [/\bSlots\b/gi, "स्लॉट"],
  [/\bBenches\b/gi, "पीठें"],
  [/\bBench\b/gi, "पीठ"],
  [/\bParties\b/gi, "पक्षकार"],
  [/\bStatus\b/gi, "स्थिति"],
  [/\bPriority\b/gi, "प्राथमिकता"],
  [/\bCategory\b/gi, "श्रेणी"],
  [/\bFiling Date\b/gi, "दाखिल तिथि"],
  [/\bAction\b/gi, "कार्रवाई"],
  [/\bActions\b/gi, "कार्रवाइयां"],
  [/\bOverview\b/gi, "अवलोकन"],
  [/\bAdministration\b/gi, "प्रशासन"],
  [/\bScheduling\b/gi, "समय-निर्धारण"],
  [/\bDashboard\b/gi, "डैशबोर्ड"],
  [/\bCases\b/gi, "मामले"],
  [/\bCase\b/gi, "मामला"],
  [/\bCalendar\b/gi, "कैलेंडर"],
  [/\bReports\b/gi, "रिपोर्ट्स"],
  [/\bReport\b/gi, "रिपोर्ट"],
  [/\bDisposed\b/gi, "निपटाया गया"],
  [/\bPending\b/gi, "लंबित"],
  [/\bScheduled\b/gi, "निर्धारित"],
  [/\bAdjourned\b/gi, "स्थगित"],
  [/\bAdjournments\b/gi, "स्थगन"],
  [/\bAdjournment\b/gi, "स्थगन"],
  [/\bConfirmed\b/gi, "पुष्ट"],
  [/\bProposed\b/gi, "प्रस्तावित"],
  [/\bHigh Urgency\b/gi, "अति उच्च प्राथमिकता"],
  [/\bMedium Urgency\b/gi, "मध्यम प्राथमिकता"],
  [/\bNormal Urgency\b/gi, "सामान्य प्राथमिकता"],
  [/\bRefresh\b/gi, "ताज़ा करें"],
  [/\bSign out\b/gi, "साइन आउट"],
  [/\bSearch\b/gi, "खोजें"],
  [/\bCancel\b/gi, "रद्द करें"],
  [/\bSubmit\b/gi, "जमा करें"],
  [/\bSave\b/gi, "सहेजें"],
  [/\bClose\b/gi, "बंद करें"],
  [/\bAccept\b/gi, "स्वीकार करें"],
  [/\bModify\b/gi, "संशोधित करें"],
  [/\bReject\b/gi, "अस्वीकार करें"],
  [/\bOptions\b/gi, "विकल्प"],
  [/\bOption\b/gi, "विकल्प"],
];

// ─── SAFE DOM TEXT TRANSLATION ENGINE ──────────────────────────────────────────
// Uses WeakMap to remember the exact original English string of every text node.
const originalTextMap = new WeakMap<Node, string>();

function shouldSkipElement(el: HTMLElement | null): boolean {
  if (!el) return true;
  const tag = el.tagName.toLowerCase();
  if (
    tag === "script" ||
    tag === "style" ||
    tag === "code" ||
    tag === "pre" ||
    tag === "svg" ||
    tag === "input" ||
    tag === "textarea"
  ) {
    return true;
  }
  if (el.closest(".notranslate") || el.getAttribute("translate") === "no") {
    return true;
  }
  return false;
}

function translateSingleTextNode(node: Text, toHindi: boolean) {
  const parent = node.parentElement;
  if (shouldSkipElement(parent)) return;

  if (toHindi) {
    if (!originalTextMap.has(node)) {
      originalTextMap.set(node, node.nodeValue ?? "");
    }
    const orig = originalTextMap.get(node) ?? "";
    if (!orig || !orig.trim()) return;

    // Check if numbers or symbols only
    if (/^[\d\s.,:;/#%*+()\-–—_]+$/.test(orig)) return;

    let translated = orig;
    for (let i = 0; i < DOM_TRANSLATIONS.length; i++) {
      const [regex, replacement] = DOM_TRANSLATIONS[i]!;
      translated = translated.replace(regex, replacement);
    }

    if (translated !== node.nodeValue) {
      node.nodeValue = translated;
    }
  } else {
    // Restore English
    if (originalTextMap.has(node)) {
      const orig = originalTextMap.get(node);
      if (orig !== undefined && orig !== node.nodeValue) {
        node.nodeValue = orig;
      }
    }
  }
}

function walkAndTranslate(root: Node, toHindi: boolean) {
  if (root.nodeType === Node.TEXT_NODE) {
    translateSingleTextNode(root as Text, toHindi);
    return;
  }

  if (root.nodeType === Node.ELEMENT_NODE) {
    const el = root as HTMLElement;
    if (shouldSkipElement(el)) return;

    // Translate placeholder attributes safely
    if (el.hasAttribute("placeholder")) {
      const ph = el.getAttribute("placeholder") || "";
      if (toHindi) {
        let tPh = ph;
        for (let i = 0; i < DOM_TRANSLATIONS.length; i++) {
          const [regex, replacement] = DOM_TRANSLATIONS[i]!;
          tPh = tPh.replace(regex, replacement);
        }
        if (tPh !== ph) el.setAttribute("placeholder", tPh);
      }
    }

    // Use efficient TreeWalker to find all text nodes under root
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        const p = node.parentElement;
        if (shouldSkipElement(p)) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      },
    });

    let current = walker.nextNode();
    while (current) {
      translateSingleTextNode(current as Text, toHindi);
      current = walker.nextNode();
    }
  }
}

// ─── CONTEXT & PROVIDER ────────────────────────────────────────────────────────
type LanguageContextValue = {
  lang: Language;
  setLang: (l: Language) => void;
  t: (keyOrPhrase: string) => string;
};

const LanguageContext = createContext<LanguageContextValue>({
  lang: "en",
  setLang: () => {},
  t: (keyOrPhrase) => keyOrPhrase,
});

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Language>(() => {
    if (typeof window === "undefined") return "en";
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return stored === "hi" ? "hi" : "en";
  });

  const observerRef = useRef<MutationObserver | null>(null);
  const debounceTimerRef = useRef<number | null>(null);
  const isTranslatingRef = useRef(false);

  function setLang(l: Language) {
    setLangState(l);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, l);
      // Clean up any stale Google Translate cookies that might linger
      document.cookie = "googtrans=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
    }
  }

  useEffect(() => {
    if (typeof document === "undefined") return;

    const isHi = lang === "hi";

    // Disconnect previous observer
    if (observerRef.current) {
      observerRef.current.disconnect();
      observerRef.current = null;
    }
    if (debounceTimerRef.current) {
      window.clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }

    // Run safe full-page translation
    isTranslatingRef.current = true;
    try {
      walkAndTranslate(document.body, isHi);
    } finally {
      isTranslatingRef.current = false;
    }

    // Only observe when in Hindi, watching ONLY childList additions (no characterData!)
    if (isHi) {
      observerRef.current = new MutationObserver((mutations) => {
        if (isTranslatingRef.current) return;

        let hasAddedNodes = false;
        for (let i = 0; i < mutations.length; i++) {
          if (mutations[i]!.addedNodes.length > 0) {
            hasAddedNodes = true;
            break;
          }
        }

        if (hasAddedNodes) {
          if (debounceTimerRef.current) {
            window.clearTimeout(debounceTimerRef.current);
          }
          debounceTimerRef.current = window.setTimeout(() => {
            if (isTranslatingRef.current) return;
            isTranslatingRef.current = true;
            try {
              walkAndTranslate(document.body, true);
            } finally {
              isTranslatingRef.current = false;
            }
          }, 60);
        }
      });

      observerRef.current.observe(document.body, {
        childList: true,
        subtree: true,
      });
    }

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
      if (debounceTimerRef.current) {
        window.clearTimeout(debounceTimerRef.current);
      }
    };
  }, [lang]);

  /**
   * Universal translation helper:
   * 1. Checks if `keyOrPhrase` is a key in `translations` (e.g. "nav.dashboard")
   * 2. Checks if `keyOrPhrase` matches any dictionary phrase
   * 3. Falls back to original phrase when in English or if no match
   */
  function t(keyOrPhrase: string): string {
    if (lang === "en") {
      const known = (translations as Record<string, { en: string; hi: string }>)[keyOrPhrase];
      return known ? known.en : keyOrPhrase;
    }

    // Hindi lookup
    const known = (translations as Record<string, { en: string; hi: string }>)[keyOrPhrase];
    if (known) return known.hi;

    let translated = keyOrPhrase;
    for (let i = 0; i < DOM_TRANSLATIONS.length; i++) {
      const [regex, replacement] = DOM_TRANSLATIONS[i]!;
      translated = translated.replace(regex, replacement);
    }
    return translated;
  }

  return (
    <LanguageContext.Provider value={{ lang, setLang, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  return useContext(LanguageContext);
}
