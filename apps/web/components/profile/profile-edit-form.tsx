"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import type { Profile } from "@scholau/api";
import { useUpdateProfile } from "@scholau/api/react";
import { fieldErrorMessage, type UpdateProfileInput, updateProfileSchema } from "@scholau/core";
import { CheckboxField } from "@/components/auth/checkbox-field";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { InlineError } from "@/components/ui/states";

export function ProfileEditForm({ profile }: { profile: Profile }) {
  const update = useUpdateProfile();
  const form = useForm<UpdateProfileInput>({
    resolver: zodResolver(updateProfileSchema),
    defaultValues: { displayName: profile.display_name, leaderboardVisible: profile.leaderboard_visible },
  });
  const { errors, isDirty } = form.formState;

  const onSubmit = form.handleSubmit((values) => {
    update.mutate(values, {
      onSuccess: (data) => form.reset({ displayName: data.display_name, leaderboardVisible: data.leaderboard_visible }),
      onError: (err) => {
        const nameError = err.field_errors?.display_name;
        if (nameError !== undefined) form.setError("displayName", { message: fieldErrorMessage(nameError) });
      },
    });
  });

  const nameFieldError = update.error?.field_errors?.display_name !== undefined;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Edit profile</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
          <Field id="profile-name" label="Display name" hint="Shown on leaderboards and to battle opponents." error={errors.displayName?.message}>
            <Input autoComplete="nickname" maxLength={60} {...form.register("displayName", { onChange: () => update.reset() })} />
          </Field>
          <CheckboxField
            id="profile-leaderboard"
            label="Show me on leaderboards"
            hint="When off, your display name and XP are hidden from leaderboards."
            {...form.register("leaderboardVisible", { onChange: () => update.reset() })}
          />
          {update.error && !nameFieldError ? <InlineError error={update.error} /> : null}
          <div className="flex flex-wrap items-center gap-3">
            <Button type="submit" loading={update.isPending} disabled={!isDirty}>
              Save changes
            </Button>
            <p role="status" aria-live="polite" className="text-sm text-success">
              {update.isSuccess && !isDirty ? "Saved" : null}
            </p>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
