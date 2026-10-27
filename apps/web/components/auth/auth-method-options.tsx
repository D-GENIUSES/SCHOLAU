import Link from "next/link";
import { Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AuthHeading } from "./auth-heading";
import { authHref, type AuthContext } from "./auth-navigation";
import { GoogleSignIn } from "./google-sign-in";

export function AuthMethodOptions({ mode, context }: { mode: "sign-in" | "sign-up"; context: AuthContext }) {
  const signup = mode === "sign-up";
  const action = signup ? "Sign up" : "Sign in";
  return <div className="auth-method-options">
    <AuthHeading title={signup ? "Create your account" : "Welcome back"} description={signup ? "Choose how you'd like to join ScholAu." : "Sign in to your ScholAu account."} />
    <div className="auth-method-buttons">
      <Button asChild block size="lg"><Link href={authHref(signup ? "/sign-up" : "/sign-in", context, { role: signup ? "student" : undefined, method: "email" })}><Mail aria-hidden="true" />{action} with email</Link></Button>
      <GoogleSignIn next={context.next} mode={mode} label={`${action} with Google`} />
    </div>
    <p className="auth-method-legal">Read our <Link href="/terms">Terms of Use</Link> and <Link href="/privacy">Privacy Policy</Link>.</p>
    <p className="auth-method-switch">{signup ? "Already have an account?" : "New to ScholAu?"} <Link href={authHref(signup ? "/sign-in" : "/sign-up", context)}>{signup ? "Sign in" : "Create account"}</Link></p>
  </div>;
}
