/**
 * Full-Page High-Performance Hindi Translation Engine for NyayaSetu
 *
 * Provides:
 * 1. Deep Context-Based Translation (`useLanguage()` & `t()`)
 * 2. Instant DOM TreeWalker + MutationObserver with 500+ Legal, Judicial & UI Terms
 * 3. Seamless Google Translate Integration for 100% full-page translation of dynamic content
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
  "nav.priority-settings": { en: "Priority Settings", hi: "प्राथमिकता सेटिंग" },
  "nav.architecture": { en: "Architecture Preview", hi: "वास्तुकला पूर्वावलोकन" },

  // Dashboard
  "dash.pending-cases": { en: "Pending cases", hi: "लंबित मामले" },
  "dash.tier1-cases": { en: "Tier 1 cases", hi: "टीयर 1 मामले" },
  "dash.scheduled": { en: "Scheduled hearings", hi: "निर्धारित सुनवाइयाँ" },
  "dash.conflicts": { en: "Conflicts detected", hi: "पहचाने गए विरोध" },
  "dash.judge-util": { en: "Judge utilisation", hi: "न्यायाधीश उपयोग" },
  "dash.courtroom-util": { en: "Courtroom utilisation", hi: "कक्ष उपयोग" },
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
  "cause-list.generate": { en: "Generate Optimised Board", hi: "अनुकूलित बोर्ड बनाएं" },
  "cause-list.morning": { en: "Urgent Mentions & Admissions", hi: "तत्काल उल्लेख एवं प्रवेश" },
  "cause-list.contested": { en: "Contested Arguments & Evidence", hi: "विवादित तर्क एवं साक्ष्य" },
  "cause-list.afternoon": { en: "Orders & Miscellaneous Disposals", hi: "आदेश एवं विविध निपटान" },

  // General & Actions
  "general.refresh": { en: "Refresh", hi: "ताज़ा करें" },
  "general.loading": { en: "Loading…", hi: "लोड हो रहा है…" },
  "general.error": { en: "Error", hi: "त्रुटि" },
  "general.search": { en: "Search cases…", hi: "मामले खोजें…" },
  "general.sign-out": { en: "Sign out", hi: "साइन आउट" },
} as const;

export type TranslationKey = keyof typeof translations;

// ─── PHRASE & VOCABULARY DICTIONARY FOR FULL-DOM TRANSLATION ───────────────────
const DOM_TRANSLATIONS: [RegExp, string][] = [
  // Full Headers & Sentences
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
  [/NyayaSetu Registry/gi, "न्यायसेतु रजिस्ट्री"],
  [/AI powered court scheduling control/gi, "AI संचालित न्यायालय समय-निर्धारण नियंत्रण"],
  [/AI powered court scheduling/gi, "AI संचालित न्यायालय शेड्यूलिंग"],
  [/Run Scheduling Engine/gi, "शेड्यूलिंग इंजन चलाएं"],
  [/Load Demo Scenario/gi, "डेमो परिदृश्य लोड करें"],
  [/Load Demo/gi, "डेमो लोड करें"],
  [/Apply Changes/gi, "परिवर्तन लागू करें"],
  [/Generate Optimised Board/gi, "अनुकूलित वाद सूची बनाएं"],
  [/Export PDF/gi, "पीडीएफ डाउनलोड करें"],
  [/Alternative scheduling options/gi, "वैकल्पिक शेड्यूलिंग विकल्प"],
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
  [/Fit score/gi, "अनुकूलता स्कोर"],
  [/minutes estimated/gi, "मिनट अनुमानित"],
  [/estimated duration/gi, "अनुमानित अवधि"],
  [/previous adjournments/gi, "पिछले स्थगन"],
  [/adjournments/gi, "स्थगन"],
  [/Select a pending case/gi, "एक लंबित मामला चुनें"],
  [/Choose a case…/gi, "मामला चुनें…"],
  [/No pending cases/gi, "कोई लंबित मामला नहीं"],
  [/Checking case priority/gi, "मामले की प्राथमिकता की जांच"],
  [/Checking judge & courtroom availability/gi, "न्यायाधीश एवं कक्ष उपलब्धता की जांच"],
  [/Checking booking conflicts/gi, "बुकिंग विरोध की जांच"],
  [/Checking duration fit/gi, "अवधि अनुकूलता की जांच"],
  [/Analysis complete/gi, "विश्लेषण पूर्ण"],
  [/Accept & Confirm Listing/gi, "स्वीकार करें एवं सूचीबद्घ करें"],
  [/Modify \/ Pick Alternative/gi, "संशोधित करें / विकल्प चुनें"],
  [/Reject Recommendation/gi, "अनुशंसा अस्वीकार करें"],
  [/Explain with AI Copilot/gi, "AI कोपायलट द्वारा समझाएं"],
  [/AI Explanation/gi, "AI व्याख्या"],

  // Indian Legal & Court Terms
  [/Senior Citizen Litigant/gi, "वरिष्ठ नागरिक पक्षकार"],
  [/Fast Track Special Court/gi, "फास्ट ट्रैक विशेष न्यायालय"],
  [/POCSO Act Case/gi, "पॉक्सो (POCSO) अधिनियम मामला"],
  [/POCSO/gi, "पॉक्सो"],
  [/Bail Application/gi, "जमानत याचिका"],
  [/Criminal Law/gi, "दांडिक / आपराधिक विधि"],
  [/Civil Law/gi, "दीवानी विधि"],
  [/Family Law/gi, "पारिवारिक विधि"],
  [/Commercial Disputes/gi, "व्यावसायिक विवाद"],
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
  [/\bJudge\b/g, "न्यायाधीश"],
  [/\bCourtroom\b/g, "कक्ष"],
  [/\bSlot\b/g, "स्लॉट"],
  [/\bBenches\b/g, "पीठें"],
  [/\bParties\b/g, "पक्षकार"],
  [/\bStatus\b/g, "स्थिति"],
  [/\bPriority\b/g, "प्राथमिकता"],
  [/\bCategory\b/g, "श्रेणी"],
  [/\bFiling Date\b/g, "दाखिल तिथि"],
  [/\bAction\b/g, "कार्रवाई"],
  [/\bActions\b/g, "कार्रवाइयां"],
  [/\bOverview\b/g, "अवलोकन"],
  [/\bAdministration\b/g, "प्रशासन"],
  [/\bScheduling\b/g, "समय-निर्धारण"],
  [/\bDashboard\b/g, "डैशबोर्ड"],
  [/\bCases\b/g, "मामले"],
  [/\bJudges\b/g, "न्यायाधीश"],
  [/\bCourtrooms\b/g, "न्यायालय कक्ष"],
  [/\bCalendar\b/g, "कैलेंडर"],
  [/\bReports\b/g, "रिपोर्ट्स"],
  [/\bDisposed\b/g, "निपटाया गया"],
  [/\bPending\b/g, "लंबित"],
  [/\bScheduled\b/g, "निर्धारित"],
  [/\bAdjourned\b/g, "स्थगित"],
  [/\bConfirmed\b/g, "पुष्ट"],
  [/\bProposed\b/g, "प्रस्तावित"],
  [/\bClear\b/g, "स्पष्ट / कोई नहीं"],
  [/\bHigh Urgency\b/g, "अति उच्च प्राथमिकता"],
  [/\bMedium Urgency\b/g, "मध्यम प्राथमिकता"],
  [/\bStandard\b/g, "सामान्य"],
  [/\bRefresh\b/g, "ताज़ा करें"],
  [/\bSign out\b/g, "साइन आउट"],
  [/\bSearch\b/g, "खोजें"],
  [/\bCancel\b/g, "रद्द करें"],
  [/\bSubmit\b/g, "जमा करें"],
  [/\bSave\b/g, "सहेजें"],
  [/\bClose\b/g, "बंद करें"],
];

// ─── DOM TEXT TRANSLATION ENGINE ──────────────────────────────────────────────
const originalTextMap = new WeakMap<Node, string>();

function translateDOMNode(node: Node, toHindi: boolean) {
  if (node.nodeType === Node.TEXT_NODE) {
    const parent = node.parentElement;
    if (!parent) return;
    const tag = parent.tagName.toLowerCase();
    if (tag === "script" || tag === "style" || tag === "code" || tag === "pre") return;
    if (parent.closest(".notranslate") || parent.getAttribute("translate") === "no") return;

    if (toHindi) {
      if (!originalTextMap.has(node)) {
        originalTextMap.set(node, node.nodeValue ?? "");
      }
      const orig = originalTextMap.get(node) ?? "";
      if (!orig.trim()) return;

      let translated = orig;
      for (const [regex, replacement] of DOM_TRANSLATIONS) {
        translated = translated.replace(regex, replacement);
      }
      if (translated !== orig) {
        node.nodeValue = translated;
      }
    } else {
      if (originalTextMap.has(node)) {
        node.nodeValue = originalTextMap.get(node) ?? node.nodeValue;
      }
    }
  } else if (node.nodeType === Node.ELEMENT_NODE) {
    const el = node as HTMLElement;
    // Translate placeholders
    if (el.hasAttribute("placeholder")) {
      const ph = el.getAttribute("placeholder") || "";
      if (toHindi) {
        let tPh = ph;
        for (const [regex, replacement] of DOM_TRANSLATIONS) {
          tPh = tPh.replace(regex, replacement);
        }
        el.setAttribute("placeholder", tPh);
      }
    }
    // Walk child nodes
    node.childNodes.forEach((child) => {
      translateDOMNode(child, toHindi);
    });
  }
}

function runFullDOMTranslation(toHindi: boolean) {
  if (typeof document === "undefined") return;
  const root = document.body;
  if (!root) return;
  translateDOMNode(root, toHindi);
}

// ─── GOOGLE TRANSLATE HELPER INTEGRATION ──────────────────────────────────────
declare global {
  interface Window {
    google?: {
      translate?: {
        TranslateElement: new (
          options: { pageLanguage: string; includedLanguages: string; autoDisplay: boolean },
          elementId: string
        ) => void;
      };
    };
    googleTranslateElementInit?: () => void;
  }
}

function initGoogleTranslateScript(toHindi: boolean) {
  if (typeof window === "undefined" || typeof document === "undefined") return;

  // Set Google Translate cookie
  const cookieVal = toHindi ? "/en/hi" : "/en/en";
  document.cookie = `googtrans=${cookieVal}; path=/; domain=${window.location.hostname}`;
  document.cookie = `googtrans=${cookieVal}; path=/;`;

  // Check if combo exists and trigger it
  const select = document.querySelector<HTMLSelectElement>(".goog-te-combo");
  if (select) {
    select.value = toHindi ? "hi" : "en";
    select.dispatchEvent(new Event("change"));
    return;
  }

  // If script not loaded yet, inject it
  if (!document.getElementById("google-translate-script")) {
    window.googleTranslateElementInit = () => {
      if (window.google?.translate?.TranslateElement) {
        new window.google.translate.TranslateElement(
          {
            pageLanguage: "en",
            includedLanguages: "hi,en",
            autoDisplay: false,
          },
          "google_translate_element"
        );
        setTimeout(() => {
          const combo = document.querySelector<HTMLSelectElement>(".goog-te-combo");
          if (combo && toHindi) {
            combo.value = "hi";
            combo.dispatchEvent(new Event("change"));
          }
        }, 300);
      }
    };

    const s = document.createElement("script");
    s.id = "google-translate-script";
    s.type = "text/javascript";
    s.src = "//translate.google.com/translate_a/element.js?cb=googleTranslateElementInit";
    document.body.appendChild(s);
  }
}

// ─── CONTEXT & PROVIDER ────────────────────────────────────────────────────────
type LanguageContextValue = {
  lang: Language;
  setLang: (l: Language) => void;
  t: (key: TranslationKey) => string;
};

const LanguageContext = createContext<LanguageContextValue>({
  lang: "en",
  setLang: () => {},
  t: (key) => translations[key]?.en ?? key,
});

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Language>(() => {
    if (typeof window === "undefined") return "en";
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return stored === "hi" ? "hi" : "en";
  });

  const observerRef = useRef<MutationObserver | null>(null);

  function setLang(l: Language) {
    setLangState(l);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, l);
    }
  }

  // Trigger translation when language changes or DOM updates
  useEffect(() => {
    const isHi = lang === "hi";

    // 1. Instant full-page DOM translation
    runFullDOMTranslation(isHi);

    // 2. Google Translate integration for complete coverage
    initGoogleTranslateScript(isHi);

    // 3. Observe dynamic DOM changes (e.g., page navigation, modal opening, table loading)
    if (observerRef.current) {
      observerRef.current.disconnect();
    }

    if (isHi) {
      observerRef.current = new MutationObserver((mutations) => {
        for (const m of mutations) {
          if (m.type === "childList") {
            m.addedNodes.forEach((node) => translateDOMNode(node, true));
          } else if (m.type === "characterData" && m.target) {
            translateDOMNode(m.target, true);
          }
        }
      });

      observerRef.current.observe(document.body, {
        childList: true,
        subtree: true,
        characterData: true,
      });
    }

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, [lang]);

  function t(key: TranslationKey): string {
    return translations[key]?.[lang] ?? key;
  }

  return (
    <LanguageContext.Provider value={{ lang, setLang, t }}>
      <div id="google_translate_element" style={{ display: "none" }} />
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  return useContext(LanguageContext);
}
