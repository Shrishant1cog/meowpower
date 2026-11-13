import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"
import { MotionButton } from "@/components/motion/primitives"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-[color,background-color,border-color,box-shadow,opacity] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-45 active:translate-y-px [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground shadow-sm shadow-primary/10 hover:bg-primary/90 hover:shadow-md hover:shadow-primary/15",
        destructive:
          "bg-destructive text-white shadow-sm shadow-destructive/10 hover:bg-destructive/90 hover:shadow-md hover:shadow-destructive/15",
        outline:
          "border border-border bg-background shadow-sm hover:border-primary/30 hover:bg-muted hover:shadow-md",
        secondary:
          "border border-transparent bg-secondary text-secondary-foreground shadow-sm hover:bg-secondary/80",
        ghost: "hover:bg-muted hover:text-foreground",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-9 px-4 py-2",
        sm: "h-8 rounded-md px-3 text-xs",
        lg: "h-10 rounded-md px-6",
        icon: "size-9",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
)

export interface ButtonProps
  extends Omit<
      React.ButtonHTMLAttributes<HTMLButtonElement>,
      | "onAnimationStart"
      | "onAnimationEnd"
      | "onAnimationIteration"
      | "onDrag"
      | "onDragStart"
      | "onDragEnd"
      | "onDragEnter"
      | "onDragExit"
      | "onDragLeave"
      | "onDragOver"
      | "onDrop"
    >,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

export function Button({ className, variant, size, asChild = false, ...props }: ButtonProps) {
  const classes = cn(buttonVariants({ variant, size, className }))
  if (asChild) {
    return <Slot className={classes} {...props} />
  }
  return (
    <MotionButton
      className={classes}
      whileHover={{ y: -1 }}
      whileTap={{ y: 0, scale: 0.975 }}
      transition={{ type: "spring", stiffness: 440, damping: 30, mass: 0.55 }}
      {...props}
    />
  )
}

export { buttonVariants }
