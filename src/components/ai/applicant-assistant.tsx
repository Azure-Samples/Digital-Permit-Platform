"use client";

import { useState } from "react";
import { Languages, MessageCircleQuestion } from "lucide-react";
import { ChatPanel } from "./chat-panel";
import { SUPPORTED_LANGUAGES, isRtl } from "@/lib/ai/languages";

// Localised UI strings + starter prompts. English and Bengali are
// fully localised (the scenario in the brief); other languages fall
// back to English chips while the assistant still answers in-language.
const LOCALE: Record<
  string,
  { intro: string; placeholder: string; suggestions: string[] }
> = {
  en: {
    intro:
      "Ask about running a licensed business — training staff, selling alcohol responsibly, and what local policy expects.",
    placeholder: "Type your question…",
    suggestions: [
      "I've just employed someone new in my corner shop. What do I need to train them on?",
      "What is Challenge 25 and do I have to do it?",
      "What ID can I accept when someone buys alcohol?",
      "Can I sell alcohol during my normal shop opening hours?",
    ],
  },
  bn: {
    intro:
      "লাইসেন্সপ্রাপ্ত ব্যবসা পরিচালনা সম্পর্কে জিজ্ঞাসা করুন — কর্মী প্রশিক্ষণ, দায়িত্বশীলভাবে অ্যালকোহল বিক্রি, কী করা যায় ও যায় না। উত্তরগুলি আপনার কাউন্সিলের লাইসেন্সিং নীতির উপর ভিত্তি করে।",
    placeholder: "আপনার প্রশ্ন লিখুন…",
    suggestions: [
      "আমি আমার দোকানে নতুন একজন কর্মী নিয়োগ দিয়েছি। তাকে কী কী বিষয়ে প্রশিক্ষণ দিতে হবে?",
      "Challenge 25 কী এবং আমাকে কি এটি করতে হবে?",
      "কেউ অ্যালকোহল কিনলে আমি কোন পরিচয়পত্র গ্রহণ করতে পারি?",
      "আমি কি আমার দোকানের স্বাভাবিক খোলার সময়ে অ্যালকোহল বিক্রি করতে পারি?",
    ],
  },
};

export function ApplicantAssistant({
  taxiPolicyAvailable = false,
}: {
  taxiPolicyAvailable?: boolean;
}) {
  const [lang, setLang] = useState("en");
  const locale = LOCALE[lang] ?? LOCALE.en;
  const intro =
    taxiPolicyAvailable && lang === "en"
      ? "Ask about running a licensed business or meeting local taxi and private-hire requirements. Answers use the relevant active council policy."
      : locale.intro;
  const suggestions = [
    ...locale.suggestions,
    ...(taxiPolicyAvailable && lang === "en"
      ? ["What do I need to apply for a taxi or private hire driver licence?"]
      : []),
  ];
  const rtl = isRtl(lang);

  return (
    <div>
      {/* Language selector */}
      <div className="bg-white border border-govuk-mid-grey p-4 mb-4">
        <label
          htmlFor="assistant-language"
          className="flex items-center gap-2 font-bold mb-2"
        >
          <Languages className="h-5 w-5 text-govuk-blue" />
          Choose your language / আপনার ভাষা নির্বাচন করুন
        </label>
        <div className="flex flex-wrap gap-2">
          {SUPPORTED_LANGUAGES.map((l) => (
            <button
              key={l.code}
              type="button"
              onClick={() => setLang(l.code)}
              lang={l.code}
              dir={l.rtl ? "rtl" : "ltr"}
              className={`px-3 py-1.5 text-sm border ${
                lang === l.code
                  ? "bg-govuk-blue text-white border-govuk-blue"
                  : "bg-white text-govuk-blue border-govuk-mid-grey hover:border-govuk-blue"
              }`}
            >
              {l.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-2 mb-2 text-govuk-dark-grey">
        <MessageCircleQuestion className="h-5 w-5" />
        <span className="text-sm">
          Answers are given in{" "}
          <strong>
            {SUPPORTED_LANGUAGES.find((l) => l.code === lang)?.label}
          </strong>
          .
        </span>
      </div>

      <ChatPanel
        key={lang}
        persona="applicant"
        language={lang}
        rtl={rtl}
        intro={intro}
        placeholder={locale.placeholder}
        suggestions={suggestions}
        resetKey={lang}
      />

      <p className="text-xs text-govuk-dark-grey mt-3">
        This is general guidance, not a formal decision. For anything specific to
        your premises, vehicle, driver or operator application, contact the council&apos;s
        licensing team.
      </p>
    </div>
  );
}
