"use client";

import { useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { adminUserSchema, type AdminUserInput } from "@/lib/admin-users-schema";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input, NativeSelect, PasswordInput } from "@/components/ui/input";

export function AdminCreateUser({ enabled, onCreated }: { enabled: boolean; onCreated?: () => void }) {
  const busy = useRef(false);
  const [message, setMessage] = useState<{ error: boolean; text: string } | null>(null);
  const form = useForm<AdminUserInput>({ resolver: zodResolver(adminUserSchema), defaultValues: { displayName: "", email: "", password: "", role: "student", requestKey: "" } });
  const { errors, isSubmitting } = form.formState;
  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (busy.current || !enabled) return;
    if (!form.getValues("requestKey")) form.setValue("requestKey", crypto.randomUUID());
    await form.handleSubmit(async values => {
      busy.current = true;
      setMessage(null);
      try {
        const response = await fetch("/api/admin/users", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(values) });
        const result = await response.json();
        if (!response.ok) {
          setMessage({ error: true, text: result.message || "The account could not be created." });
          return;
        }
        setMessage({ error: false, text: `${values.displayName} (${values.email}) has been added as a ${values.role === "lecturer" ? "lecturer" : "student"}. Share the initial password privately. They can change it after signing in.` });
        onCreated?.();
        form.reset({ displayName: "", email: "", password: "", role: values.role, requestKey: "" });
      } catch {
        setMessage({ error: true, text: "Account creation could not be confirmed. Check whether the account exists before retrying." });
      } finally { busy.current = false; }
    })(event);
  };
  return <div className="max-w-xl rounded-card border border-line bg-surface-card p-5 sm:p-6">
    {!enabled && <Alert tone="warning" role="alert">User creation is not configured on this server yet.</Alert>}
    <form onSubmit={submit} noValidate className="mt-4 flex flex-col gap-4">
      {message && <Alert tone={message.error ? "error" : "success"} role={message.error ? "alert" : "status"}>{message.text}</Alert>}
      <fieldset disabled={!enabled || isSubmitting} className="flex min-w-0 flex-col gap-4">
        <legend className="sr-only">New account details</legend>
        <Field id="new-user-role" label="Account type" error={errors.role?.message}><NativeSelect {...form.register("role")}><option value="student">Student</option><option value="lecturer">Lecturer</option></NativeSelect></Field>
        <Field id="new-user-name" label="Name" error={errors.displayName?.message}><Input autoComplete="off" maxLength={60} {...form.register("displayName")} /></Field>
        <Field id="new-user-email" label="Email" error={errors.email?.message}><Input type="email" autoComplete="off" {...form.register("email")} /></Field>
        <Field id="new-user-password" label="Initial password" hint="Use 8â€“72 characters. Share this password privately with the account owner." error={errors.password?.message}><PasswordInput autoComplete="new-password" maxLength={72} {...form.register("password")} /></Field>
        <p className="text-sm text-ink-muted">This account can sign in immediately. Confirm the email belongs to the intended person before creating it. Students complete their academic details after signing in; lecturers receive direct access to their workspace.</p>
        <Button type="submit" loading={isSubmitting}>Add user</Button>
      </fieldset>
    </form>
  </div>;
}
