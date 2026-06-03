import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-semibold tracking-tight transition-[transform,box-shadow,background-color,border-color,color] duration-200 ease-ops focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-white active:translate-y-px disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default:
          "ops-btn-navy shadow-[0_10px_24px_rgba(7,17,31,0.18)] hover:-translate-y-px hover:shadow-[0_14px_30px_rgba(7,17,31,0.24)]",
        primary:
          "bg-[hsl(var(--primary))] text-white shadow-[0_8px_20px_rgba(8,127,105,0.24)] hover:bg-[hsl(168_90%_28%)] hover:shadow-[0_12px_28px_rgba(8,127,105,0.32)]",
        brand:
          "ops-btn-brand shadow-[0_10px_24px_rgba(11,180,196,0.22)] hover:-translate-y-px",
        secondary:
          "bg-slate-100 text-slate-900 ring-1 ring-inset ring-slate-200/70 hover:bg-slate-200/80",
        outline:
          "border border-slate-200 bg-white text-slate-800 shadow-ops-xs hover:border-slate-300 hover:bg-slate-50",
        ghost: "text-slate-700 hover:bg-slate-100 hover:text-slate-950",
        destructive:
          "bg-destructive text-destructive-foreground shadow-[0_8px_20px_rgba(220,38,38,0.18)] hover:bg-destructive/90",
      },
      size: {
        default: "h-10 px-4",
        sm: "h-8 px-3 text-xs",
        lg: "h-11 px-6 text-[15px]",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
