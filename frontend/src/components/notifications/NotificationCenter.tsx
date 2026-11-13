import { MotionDiv } from "@/components/motion/primitives"
import { CheckCircle2, Info, X, XCircle } from "lucide-react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { useWorkflowStore } from "@/stores/workflow"

export function NotificationCenter() {
  const notifications = useWorkflowStore((state) => state.notifications)
  const dismiss = useWorkflowStore((state) => state.dismissNotification)

  return (
    <div className="fixed right-4 top-20 z-50 flex w-[min(22rem,calc(100vw-2rem))] flex-col gap-2">
      {notifications.map((notification) => {
        const Icon =
          notification.tone === "success"
            ? CheckCircle2
            : notification.tone === "error"
              ? XCircle
              : Info
        return (
          <MotionDiv
            key={notification.id}
            initial={{ opacity: 0, y: -8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.16, ease: [0.22, 1, 0.36, 1] }}
            className="flex gap-3 rounded-lg border border-border bg-popover p-3 text-popover-foreground shadow-xl"
            role={notification.tone === "error" ? "alert" : "status"}
          >
            <Icon
              className={cn(
                "mt-0.5 size-4 shrink-0",
                notification.tone === "success" && "text-primary",
                notification.tone === "error" && "text-destructive",
              )}
            />
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium">{notification.title}</div>
              <p className="mt-0.5 text-xs leading-5 text-muted-foreground">
                {notification.message}
              </p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="size-7 shrink-0"
              onClick={() => dismiss(notification.id)}
              aria-label="Dismiss notification"
            >
              <X className="size-3.5" />
            </Button>
          </MotionDiv>
        )
      })}
    </div>
  )
}
