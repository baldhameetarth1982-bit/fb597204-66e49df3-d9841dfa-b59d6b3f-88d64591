import i18n from "i18next";
import { initReactI18next } from "react-i18next";

const resources = {
  en: {
    translation: {
      "nav.home": "Home",
      "nav.bills": "Bills",
      "nav.visitors": "Visitors",
      "nav.society": "Society",
      "nav.profile": "Profile",
      "nav.search": "Search",
      "common.loading": "Loading…",
      "common.save": "Save",
      "common.cancel": "Cancel",
      "common.search": "Search",
      "common.noResults": "No results",
      "common.language": "Language",
      "greeting.morning": "Good morning",
      "greeting.afternoon": "Good afternoon",
      "greeting.evening": "Good evening",
      "bills.due": "Due",
      "bills.paid": "Paid",
      "bills.overdue": "Overdue",
      "visitors.preapprove": "Pre-approve visitor",
      "visitors.frequent": "Frequent",
    },
  },
  hi: {
    translation: {
      "nav.home": "होम",
      "nav.bills": "बिल",
      "nav.visitors": "आगंतुक",
      "nav.society": "सोसाइटी",
      "nav.profile": "प्रोफ़ाइल",
      "nav.search": "खोज",
      "common.loading": "लोड हो रहा है…",
      "common.save": "सहेजें",
      "common.cancel": "रद्द करें",
      "common.search": "खोजें",
      "common.noResults": "कोई परिणाम नहीं",
      "common.language": "भाषा",
      "greeting.morning": "सुप्रभात",
      "greeting.afternoon": "नमस्कार",
      "greeting.evening": "शुभ संध्या",
      "bills.due": "बकाया",
      "bills.paid": "भुगतान हो गया",
      "bills.overdue": "अतिदेय",
      "visitors.preapprove": "आगंतुक को पूर्व-अनुमोदित करें",
      "visitors.frequent": "बार-बार",
    },
  },
  gu: {
    translation: {
      "nav.home": "હોમ",
      "nav.bills": "બિલ",
      "nav.visitors": "મુલાકાતીઓ",
      "nav.society": "સોસાયટી",
      "nav.profile": "પ્રોફાઇલ",
      "nav.search": "શોધ",
      "common.loading": "લોડ થઈ રહ્યું છે…",
      "common.save": "સાચવો",
      "common.cancel": "રદ કરો",
      "common.search": "શોધો",
      "common.noResults": "કોઈ પરિણામ નથી",
      "common.language": "ભાષા",
      "greeting.morning": "શુભ સવાર",
      "greeting.afternoon": "નમસ્કાર",
      "greeting.evening": "શુભ સાંજ",
      "bills.due": "બાકી",
      "bills.paid": "ચૂકવેલ",
      "bills.overdue": "મુદત વીતી",
      "visitors.preapprove": "મુલાકાતીને પૂર્વ-મંજૂરી આપો",
      "visitors.frequent": "વારંવાર",
    },
  },
};

const STORAGE_KEY = "sociohub.lang";
const initialLang =
  (typeof window !== "undefined" && window.localStorage.getItem(STORAGE_KEY)) || "en";

if (!i18n.isInitialized) {
  void i18n.use(initReactI18next).init({
    resources,
    lng: initialLang,
    fallbackLng: "en",
    interpolation: { escapeValue: false },
  });
}

export function setLanguage(lang: "en" | "hi" | "gu") {
  void i18n.changeLanguage(lang);
  if (typeof window !== "undefined") window.localStorage.setItem(STORAGE_KEY, lang);
}

export const SUPPORTED_LANGS = [
  { code: "en", label: "English" },
  { code: "hi", label: "हिन्दी" },
  { code: "gu", label: "ગુજરાતી" },
] as const;

export default i18n;
