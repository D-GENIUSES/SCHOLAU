"use client";

import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { LecturerOffering } from "@scholau/core";
import { adminUserSchema, type AdminUserInput } from "@/lib/admin-users-schema";
import { lecturerApi } from "@/lib/lecturer-api";
import { getBrowserSupabase } from "@/lib/supabase/browser";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input, PasswordInput } from "@/components/ui/input";

export function AdminCreateLecturer({ enabled, onCreated }: { enabled: boolean; onCreated?: () => void }) {
  const busy = useRef(false);
  const [message, setMessage] = useState<{ error: boolean; text: string } | null>(null);
  const [offerings, setOfferings] = useState<LecturerOffering[]>([]);
  const [offeringError, setOfferingError] = useState(false);
  const [offeringsLoading, setOfferingsLoading] = useState(true);
  const [offeringRefresh, setOfferingRefresh] = useState(0);
  const [welcomeConfirmed, setWelcomeConfirmed] = useState<boolean | null>(null);
  const [courseSearch, setCourseSearch] = useState("");
  const [offeringIds, setOfferingIds] = useState<string[]>([]);
  const form = useForm<AdminUserInput>({
    resolver: zodResolver(adminUserSchema),
    defaultValues: { displayName: "", email: "", password: "", role: "lecturer", requestKey: "", offeringIds: [] },
  });
  const { errors, isSubmitting } = form.formState;

  useEffect(() => {
    if (!enabled) return;
    let active = true;
    void lecturerApi(getBrowserSupabase())
      .offerings()
      .then(result => {
        if (!active) return;
        setOfferings(result.items);
        const published = new Set(result.items.map(course => course.id));
        setOfferingIds(current => current.filter(id => published.has(id)));
      })
      .catch(() => {
        if (active) setOfferingError(true);
      })
      .finally(() => {
        if (active) setOfferingsLoading(false);
      });
    return () => {
      active = false;
    };
  }, [enabled, offeringRefresh]);

  function refreshOfferings() {
    setOfferingError(false);
    setOfferingsLoading(true);
    setOfferingRefresh(current => current + 1);
  }

  const filtered = offerings.filter(o =>
    `${o.code} ${o.title} ${o.university} ${o.department}`.toLowerCase().includes(courseSearch.toLowerCase()),
  );

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (busy.current || !enabled) return;
    if (!form.getValues("requestKey")) form.setValue("requestKey", crypto.randomUUID());
    form.setValue("role", "lecturer");
    form.setValue("offeringIds", offeringIds);
    setMessage(null);
    setWelcomeConfirmed(null);
    await form.handleSubmit(async values => {
      busy.current = true;
      try {
        const response = await fetch("/api/admin/users", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(values),
        });
        const result = await response.json();
        if (!response.ok) {
          setMessage({ error: true, text: result.message || "The lecturer account could not be created." });
          if (response.status === 422) refreshOfferings();
          return;
        }
        const count = result.assignmentCount ?? 0;
        setMessage({
          error: false,
          text: `${values.displayName} (${values.email}) was added and verified. ${count} teaching ${count === 1 ? "assignment" : "assignments"} saved.`,
        });
        setWelcomeConfirmed(result.provisionWelcomeSent === true);
        onCreated?.();
        form.reset({ displayName: "", email: "", password: "", role: "lecturer", requestKey: "", offeringIds: [] });
        setOfferingIds([]);
        setCourseSearch("");
      } catch {
        setMessage({ error: true, text: "Account creation could not be confirmed. Check whether the account exists before retrying." });
      } finally {
        busy.current = false;
      }
    })(event);
  };

  return (
    <div className="max-w-xl rounded-card border border-line bg-surface-card p-5 sm:p-6">
      {!enabled && <Alert tone="warning" role="alert">User creation is not configured on this server yet.</Alert>}
      <form onSubmit={submit} noValidate className="mt-4 flex flex-col gap-4">
        {message && <Alert tone={message.error ? "error" : "success"} role={message.error ? "alert" : "status"}>{message.text}</Alert>}
        {welcomeConfirmed !== null && (
          <Alert tone={welcomeConfirmed ? "success" : "warning"} role="status">
            {welcomeConfirmed ? "Welcome email accepted for delivery." : "Welcome email could not be confirmed. The lecturer account is ready to use."}
          </Alert>
        )}
        <fieldset disabled={!enabled || isSubmitting} className="flex min-w-0 flex-col gap-4">
          <legend className="sr-only">New lecturer details</legend>
          <Field id="new-lecturer-name" label="Name" error={errors.displayName?.message}>
            <Input autoComplete="off" maxLength={60} {...form.register("displayName")} />
          </Field>
          <Field id="new-lecturer-email" label="Email" error={errors.email?.message}>
            <Input type="email" autoComplete="off" {...form.register("email")} />
          </Field>
          <Field
            id="new-lecturer-password"
            label="Initial password"
            hint="Use 8–72 characters. This initial password is included in the welcome email."
            error={errors.password?.message}
          >
            <PasswordInput autoComplete="new-password" maxLength={72} {...form.register("password")} />
          </Field>
          <div className="flex flex-col gap-3 border-t border-line pt-4">
            <h3 className="text-sm font-bold">Teaching assignments</h3>
            <p className="text-sm text-ink-muted">Select at least one published course. You can change assignments later from Manage.</p>
            {offeringError && (
              <Alert tone="warning">
                Course offerings could not be loaded.{" "}
                <button type="button" className="font-semibold underline" onClick={refreshOfferings}>Try again</button>
              </Alert>
            )}
            {errors.offeringIds?.message && <p role="alert" className="text-sm text-danger">{errors.offeringIds.message}</p>}
            {offeringsLoading ? <p className="text-sm text-ink-muted">Loading course offerings…</p> : null}
            {!offeringsLoading && !offeringError ? (
              <>
                <Field id="lecturer-course-search" label="Find a course">
                  <Input value={courseSearch} onChange={e => setCourseSearch(e.target.value)} placeholder="Course code, title or department" />
                </Field>
                <p className="text-sm">{offeringIds.length} selected</p>
                <div className="max-h-64 overflow-y-auto rounded-control border border-line">
                  {filtered.map(o => (
                    <label key={o.id} className="flex items-start gap-3 border-t border-line px-3 py-3 text-sm first:border-t-0">
                      <input
                        type="checkbox"
                        className="mt-1 size-4 shrink-0"
                        checked={offeringIds.includes(o.id)}
                        onChange={e => setOfferingIds(current => (e.target.checked ? [...current, o.id] : current.filter(id => id !== o.id)))}
                      />
                      <span>
                        <strong>
                          {o.code} · {o.title}
                        </strong>
                        <span className="block text-xs text-ink-muted">
                          {o.university} · {o.department} · {o.period} · {o.semester}
                        </span>
                      </span>
                    </label>
                  ))}
                  {!filtered.length ? <p className="p-3 text-sm text-ink-muted">No course offerings match this search.</p> : null}
                </div>
              </>
            ) : null}
          </div>
          <p className="text-sm text-ink-muted">Confirm the email belongs to the intended lecturer before creating the account.</p>
          <Button type="submit" loading={isSubmitting} disabled={offeringsLoading || offeringError}>
            Add lecturer
          </Button>
        </fieldset>
      </form>
    </div>
  );
}
