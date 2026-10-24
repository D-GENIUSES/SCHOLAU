import { BookOpen, Clock3, EyeOff, Monitor, ShieldCheck, ShieldAlert, Trophy } from "lucide-react";
import "./battle-rules.css";
import { COPY } from "@scholau/core";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function BattleRulesCard({ title = "How battles work", headingLevel = "h2" }: { title?: string; headingLevel?: "h2" | "h3" }) {
  return (
    <Card className="battle-rules-card">
      <CardHeader className="battle-rules-heading"><span className="battle-section-icon"><ShieldCheck size={20} aria-hidden /></span>
        <CardTitle as={headingLevel}>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="mb-3 text-sm text-ink-muted">Same questions. Same time. A fair challenge for both players.</p>
        <div className="battle-rewards-panel"><Trophy size={22} aria-hidden /><div><span className="battle-rewards-label">MAKE EVERY ANSWER COUNT</span><p className="text-sm font-semibold">{COPY.battle.rewards}</p></div></div>
        <details className="battle-rules-details"><summary>Format &amp; fair play rules</summary><div className="pt-3"><BattleRulesList /></div></details>
      </CardContent>
    </Card>
  );
}

const rules = [
  { Icon: BookOpen, title: "One shared challenge", text: "Both players get the same 5–30 questions. Accuracy decides the winner; equal scores draw." },
  { Icon: Clock3, title: "Read. Think. Answer.", text: "Each question starts with reading time, followed by 5–15 seconds to answer." },
  { Icon: Monitor, title: "Stay in the arena", text: "Keep the app focused and use a full window. Leaving, losing focus or using a small window can trigger a flag." },
  { Icon: EyeOff, title: "Keep your answers yours", text: "Do not share your screen. Copying battle text is disabled, and your opponent cannot see your choices." },
  { Icon: ShieldAlert, title: "Three flags end your battle", text: "Three fair-play flags automatically forfeit the match. Stay focused until the result appears.", warning: true },
  { Icon: Trophy, title: "Know your XP limits", text: COPY.battle.rewardsNote },
];

export function BattleRulesList() {
  return <ul className="battle-rule-list">{rules.map(({ Icon, title, text, warning }) => (
    <li key={title} className={warning ? "battle-rule-item battle-rule-warning" : "battle-rule-item"}>
      <span className="battle-rule-icon"><Icon size={18} aria-hidden /></span>
      <div><p className="battle-rule-title">{title}</p><p className="battle-rule-copy">{text}</p></div>
    </li>
  ))}</ul>;
}
