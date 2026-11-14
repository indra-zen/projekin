"use client";

import { AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import type * as React from "react";
import { useFormStatus } from "react-dom";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import type { FormState } from "@/server/action-result";

/** Success/error banner for a Server Action result. */
export function FormAlert({ state }: { state: FormState<unknown> }) {
  if (!state) return null;
  if (state.ok) {
    if (!state.message) return null;
    return (
      <Alert className="bg-success">
        <CheckCircle2 className="text-primary" />
        <AlertDescription className="text-foreground">
          {state.message}
        </AlertDescription>
      </Alert>
    );
  }
  return (
    <Alert variant="destructive">
      <AlertCircle />
      <AlertDescription>{state.error.message}</AlertDescription>
    </Alert>
  );
}

export function fieldError(
  state: FormState<unknown>,
  name: string,
): string | undefined {
  if (!state || state.ok) return undefined;
  return state.error.fieldErrors?.[name]?.[0];
}

export function fieldValue(
  state: FormState<unknown>,
  name: string,
  fallback = "",
): string {
  if (state && !state.ok && state.values && name in state.values) {
    return state.values[name] ?? fallback;
  }
  return fallback;
}

type FieldProps = {
  label: string;
  htmlFor: string;
  error?: string;
  hint?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
};

export function Field({
  label,
  htmlFor,
  error,
  hint,
  className,
  children,
}: FieldProps) {
  return (
    <div className={cn("space-y-2", className)}>
      <Label htmlFor={htmlFor} className="font-semibold">
        {label}
      </Label>
      {children}
      {hint && !error ? (
        <p className="text-muted-foreground text-xs">{hint}</p>
      ) : null}
      {error ? (
        <p
          id={`${htmlFor}-error`}
          className="text-destructive text-xs font-medium"
        >
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function SubmitButton({
  children,
  pendingLabel = "Memproses…",
  className,
  variant,
  disabled,
}: {
  children: React.ReactNode;
  pendingLabel?: string;
  className?: string;
  variant?:
    "default" | "secondary" | "accent" | "destructive" | "outline" | "ghost";
  disabled?: boolean;
}) {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      className={className}
      variant={variant}
      disabled={pending || disabled}
      aria-busy={pending}
    >
      {pending ? (
        <>
          <Loader2 className="mr-2 size-4 animate-spin" /> {pendingLabel}
        </>
      ) : (
        children
      )}
    </Button>
  );
}
