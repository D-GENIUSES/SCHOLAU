import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { Loader2 } from "lucide-react";
import * as React from "react";
import { cn } from "@/lib/utils";

export const buttonVariants = cva(
  "ui-button inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-full border border-transparent font-semibold leading-5 tracking-[-0.01em] transition-[background-color,border-color,color,box-shadow,transform] duration-100 disabled:pointer-events-none disabled:opacity-45 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary active:translate-y-px active:scale-[0.98] [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        primary: "bg-brand-primary text-ink-inverse shadow-[0_1px_2px_#11243c14] hover:bg-brand-primary-hover active:bg-[#004fa8]",
        secondary: "bg-surface-tint text-brand-primary hover:bg-[#dceafa] active:bg-[#cfe1f5]",
        outline: "border border-line bg-surface-card text-ink hover:border-line-strong hover:bg-surface-page",
        ghost: "text-ink-muted hover:bg-surface-page hover:text-ink",
        danger: "bg-danger text-ink-inverse hover:bg-[#9a1d14]",
        "danger-outline": "border border-danger bg-surface-card text-danger hover:bg-danger-bg",
        link: "h-auto min-h-0 px-0 text-brand-primary underline-offset-4 hover:underline",
      },
      size: {
        md: "min-h-11 px-5 py-2.5 text-sm",
        sm: "min-h-10 px-4 py-2 text-[13px]",
        lg: "min-h-12 px-6 py-3 text-sm",
        icon: "size-11 p-0",
      },
      block: { true: "w-full" },
    },
    compoundVariants: [{ variant: "link", className: "min-h-0 rounded-none border-0 px-0 py-1 shadow-none active:translate-y-0" }],
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
