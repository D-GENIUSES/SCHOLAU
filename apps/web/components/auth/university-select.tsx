"use client";

import { NIGERIAN_UNIVERSITIES } from "@scholau/core";
import type { Ref } from "react";
import { Field } from "@/components/ui/field";
import { SearchSelect } from "@/components/ui/search-select";

const aliases: Record<string, string> = {
  "University of Lagos": "UNILAG", "University of Ibadan": "UI",
  "University of Nigeria": "UNN", "University of Ilorin": "UNILORIN",
  "University of Benin": "UNIBEN", "University of Port": "UNIPORT",
  "Ahmadu Bello University": "ABU", "Obafemi Awolowo University": "OAU",
  "Federal University of Technology, Akure": "FUTA", "Federal University of Technology, Minna": "FUTMINNA",
  "Federal University of Technology, Owerri": "FUTO", "Lagos State University": "LASU",
  "Bayero University": "BUK", "Nnamdi Azikiwe University": "UNIZIK",
  "National Open University": "NOUN",
};

const universities = [...NIGERIAN_UNIVERSITIES]
  .sort((a, b) => a.label.localeCompare(b.label, "en-NG", { sensitivity: "base" }))
  .map((university) => ({ ...university,
    searchTerms: Object.entries(aliases).filter(([name]) => university.label.startsWith(name)).map(([, alias]) => alias).join(" "),
  }));

export function UniversitySelect({ value, onChange, onBlur, inputRef, error }: {
  value: string; onChange: (value: string) => void; onBlur: () => void; inputRef: Ref<HTMLInputElement>; error?: string;
}) {
  return <Field id="sign-up-university" label="University" error={error}>
    <SearchSelect ref={inputRef} id="sign-up-university" options={universities} value={value}
      onChange={onChange} onBlur={onBlur} placeholder="Search or select your university" emptyMessage="No universities match. Try another name." />
  </Field>;
}
