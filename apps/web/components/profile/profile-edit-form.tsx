"use client";

import { ProfilePhotoEditor } from "@/components/profile/profile-photo-editor";
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
import { useState } from "react";
import { suggestUsernames, UsernameSuggestions } from "@/components/auth/username-suggestions";

export function ProfileEditForm({ profile }: { profile: Profile }) {
  const update = useUpdateProfile();
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const form = useForm<UpdateProfileInput>({
    resolver: zodResolver(updateProfileSchema),
    defaultValues: { username: profile.username, leaderboardVisible: profile.leaderboard_visible },
  });
  const { errors, isDirty } = form.formState;

  const onSubmit = form.handleSubmit((values) => {
    update.mutate(values, {
      onSuccess: (data) => {
        form.reset({ username: data.username, leaderboardVisible: data.leaderboard_visible });
        setSuggestions([]);
      },
      onError: (err) => {
        const nameError = err.field_errors?.username;
        if (nameError !== undefined) {
          form.setError("username", { message: fieldErrorMessage(nameError) });
          void suggestUsernames(values.username).then(setSuggestions);
        }
      },
    });
  });

  const nameFieldError = update.error?.field_errors?.username !== undefined;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Edit profile</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="mb-6 border-b border-line pb-6"><ProfilePhotoEditor profile={profile} /></div>
        <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
          <Field id="profile-name" label="Username" hint="Unique across ScholAu. Used in battles, rankings and friends. 3–24 letters, numbers or underscores." error={errors.username?.message}>
            <Input autoComplete="username" autoCapitalize="none" spellCheck={false} maxLength={24} {...form.register("username", { onChange: () => update.reset() })} />
          </Field>
          <UsernameSuggestions names={suggestions} onChoose={(name) => {
            form.setValue("username", name, { shouldDirty: true, shouldValidate: true });
            form.clearErrors("username"); update.reset(); setSuggestions([]);
          }} />
          <CheckboxField id="profile-leaderboard" label="Show me on leaderboards"
            hint="Turn this off to hide your username and XP from rankings."
            {...form.register("leaderboardVisible", { onChange: () => update.reset() })} />
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
