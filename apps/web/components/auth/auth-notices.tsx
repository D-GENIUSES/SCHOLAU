import Link from "next/link";
import { Alert } from "@/components/ui/alert";
import type { AuthContext } from "./auth-navigation";

export function AuthNotices({ error, deactivated }: AuthContext) {
  return <>
    {error === "oauth" ? <Alert tone="warning" role="alert">Google sign-in was cancelled or could not be completed. Please try again or sign in with email.</Alert> : null}
    {error === "link" ? <Alert tone="warning" role="alert">That link is invalid or has expired.</Alert> : null}
    {deactivated === "1" ? <Alert tone="error" role="alert" title="This account is deactivated.">If you think this is a mistake, contact support (see our <Link href="/privacy#contact" className="font-semibold text-brand-primary underline">privacy page</Link>).</Alert> : null}
  </>;
}
