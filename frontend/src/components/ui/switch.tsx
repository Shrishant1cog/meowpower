import * as React from "react"
import * as SwitchPrimitive from "@radix-ui/react-switch"
import { MotionSpan } from "@/components/motion/primitives"

import { cn } from "@/lib/utils"

export function Switch({ className, ...props }: React.ComponentProps<typeof SwitchPrimitive.Root>) {
  const [internalChecked, setInternalChecked] = React.useState(props.defaultChecked ?? false)
  const checked = props.checked ?? internalChecked

  const handleCheckedChange = (next: boolean) => {
    if (props.checked === undefined) setInternalChecked(next)
    props.onCheckedChange?.(next)
  }

  return (
    <SwitchPrimitive.Root
      className={cn(
        "peer inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent bg-input transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-primary",
        className,
      )}
      {...props}
      onCheckedChange={handleCheckedChange}
    >
      <SwitchPrimitive.Thumb asChild>
        <MotionSpan
          className="pointer-events-none block size-4 rounded-full bg-background shadow-lg ring-0"
          animate={{ x: checked ? 16 : 0 }}
          transition={{ type: "spring", stiffness: 520, damping: 34 }}
        />
      </SwitchPrimitive.Thumb>
    </SwitchPrimitive.Root>
  )
}
