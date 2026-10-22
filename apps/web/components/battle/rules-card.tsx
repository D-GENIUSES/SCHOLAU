import { COPY } from "@scholau/core";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function BattleRulesCard({ title = "How battles work", headingLevel = "h2" }: { title?: string; headingLevel?: "h2" | "h3" }) {
  return (
    <Card className="battle-rules-card">
      <CardHeader>
        <CardTitle as={headingLevel}>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="mb-3 text-sm text-ink-muted">Same questions. Same time. A fair challenge for both players.</p>
        <p className="mb-3 text-sm font-semibold">{COPY.battle.rewards}</p>
        <details className="battle-rules-details"><summary>Format &amp; fair play rules</summary><div className="pt-3"><BattleRulesList /></div></details>
      </CardContent>
    </Card>
  );
}

export function BattleRulesList() {
  return (
    <ul className="flex flex-col gap-3">
      <li className="text-sm text-ink-muted">Fair play: stay in the app, use a full window, and do not share your screen. Leaving or losing focus is flagged. Smaller windows are flagged as possible split-screen use. Copying battle text is disabled. Three flags automatically forfeit the battle.</li>
      <li className="flex gap-3">
        <div>
          <p className="font-semibold">{COPY.battle.rewards}</p>
          <p className="text-sm text-ink-muted">{COPY.battle.rewardsNote}</p>
        </div>
      </li>
      <li className="flex gap-3">
        <p>{COPY.battle.format}</p>
      </li>
      <li className="flex gap-3">
        <p className="text-sm text-ink-muted">
          Both players get the same questions at the same time. Your opponent never sees your choices.
        </p>
      </li>
    </ul>
  );
}
