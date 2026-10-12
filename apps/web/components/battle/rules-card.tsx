import { Swords, Timer, Trophy } from "lucide-react";
import { COPY } from "@scholau/core";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function BattleRulesCard({ title = "How battles work", headingLevel = "h2" }: { title?: string; headingLevel?: "h2" | "h3" }) {
  return (
    <Card tint>
      <CardHeader>
        <CardTitle as={headingLevel}>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <BattleRulesList />
      </CardContent>
    </Card>
  );
}

export function BattleRulesList() {
  return (
    <ul className="flex flex-col gap-3">
      <li className="flex gap-3">
        <Trophy className="mt-0.5 size-5 shrink-0 text-brand-primary" aria-hidden />
        <div>
          <p className="font-semibold">{COPY.battle.rewards}</p>
          <p className="text-sm text-ink-muted">{COPY.battle.rewardsNote}</p>
        </div>
      </li>
      <li className="flex gap-3">
        <Timer className="mt-0.5 size-5 shrink-0 text-brand-primary" aria-hidden />
        <p>{COPY.battle.format}</p>
      </li>
      <li className="flex gap-3">
        <Swords className="mt-0.5 size-5 shrink-0 text-brand-primary" aria-hidden />
        <p className="text-sm text-ink-muted">
          Both players get the same questions at the same time. Your opponent never sees your choices.
        </p>
      </li>
    </ul>
  );
}
