export function AuthSteps({ current, labels }: { current: number; labels: readonly [string, string] }) {
  return <ol className="auth-steps" aria-label="Registration steps">{labels.map((label, index) => <li key={label} aria-current={current === index ? "step" : undefined} data-complete={index < current}>{index + 1}. {label}</li>)}</ol>;
}
