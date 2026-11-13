import * as React from "react"
import * as TooltipPrimitive from "@radix-ui/react-tooltip"
import { MotionDiv } from "@/components/motion/primitives"

import { cn } from "@/lib/utils"

export const TooltipProvider = TooltipPrimitive.Provider
export const Tooltip = TooltipPrimitive.Root
export const TooltipTrigger = TooltipPrimitive.Trigger

export function TooltipContent({
  className,
  sideOffset = 6,
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Content>) {
  return (
    <TooltipPrimitive.Portal>
      <TooltipPrimitive.Content sideOffset={sideOffset} {...props} asChild>
        <MotionDiv
          initial={{ opacity: 0, y: -3, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.14, ease: [0.22, 1, 0.36, 1] }}
          className={cn(
            "z-50 rounded-md bg-foreground px-2.5 py-1.5 text-xs text-background shadow-md",
            className,
          )}
        />
      </TooltipPrimitive.Content>
    </TooltipPrimitive.Portal>
  )
}
