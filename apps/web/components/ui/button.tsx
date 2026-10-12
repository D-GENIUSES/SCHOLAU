import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { Loader2 } from "lucide-react";
import * as React from "react";
import { cn } from "@/lib/utils";

export const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-control font-semibold transition-colors disabled:pointer-events-none disabled:opacity-55 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-brand-primary [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        primary: "bg-brand-primary text-ink-inverse hover:bg-brand-primary-hover",
        secondary: "bg-surface-tint text-brand-primary hover:bg-[#dcecff]",
        outline: "border border-line bg-surface-card text-ink hover:border-line-strong hover:bg-surface-page",
        ghost: "text-ink hover:bg-surface-tint",
        danger: "bg-danger text-ink-inverse hover:bg-[#9a1d14]",
        "danger-outline": "border border-danger bg-surface-card text-danger hover:bg-danger-bg",
        link: "h-auto min-h-0 px-0 text-brand-primary underline-offset-4 hover:underline",
      },
      size: {
        md: "min-h-12 px-5 text-base",
        sm: "min-h-11 px-4 text-sm",
        lg: "min-h-12 px-6 text-lg",
        icon: "size-11",
      },
      block: { true: "w-full" },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  loading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, block, asChild, loading, disabled, children, type, ...props }, ref) => {
    if (asChild) {
      return (
        <Slot ref={ref} className={cn(buttonVariants({ variant, size, block }), className)} {...props}>
          {children}
        </Slot>
      );
    }
    return (
      <button
        ref={ref}
        type={type ?? "button"}
        className={cn(buttonVariants({ variant, size, block }), className)}
        disabled={disabled || loading}
        aria-busy={loading || undefined}
        {...props}
      >
        {loading ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
        {children}
      </button>
    );
  },
);
Button.displayName = "Button";
