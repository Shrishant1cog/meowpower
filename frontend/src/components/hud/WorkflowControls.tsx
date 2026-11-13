import { CircleStop, Play } from "lucide-react"
import { MotionDiv } from "@/components/motion/primitives"

import { CircularProgressHUD } from "@/components/hud/CircularProgressHUD"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import { useWorkflowActions } from "@/hooks/useWorkflowActions"
import { getWorkflowPresentation } from "@/lib/workflow-presentation"
import { useWorkflowStore } from "@/stores/workflow"

interface WorkflowControlsProps {
  placement: "top" | "bottom"
}

export function WorkflowControls({ placement }: WorkflowControlsProps) {
  const job = useWorkflowStore((state) => state.job)
  const event = useWorkflowStore((state) => state.event)
  const { start, cancel, isStarting, isCancelling } = useWorkflowActions()
  const running = job?.status === "queued" || job?.status === "running"
  const status = getWorkflowPresentation(event?.status ?? job?.status)

  return (
    <MotionDiv className="flex items-center gap-3">
      <CircularProgressHUD size={placement === "top" ? "sm" : "md"} />
      {placement === "bottom" && (
        <Badge variant={status.tone === "error" ? "destructive" : "outline"}>{status.label}</Badge>
      )}
      {running ? (
        <Button variant="outline" onClick={() => void cancel()} disabled={isCancelling}>
          {isCancelling ? <Spinner /> : <CircleStop />}
          CANCEL PARTIAL WORKFLOW
        </Button>
      ) : (
        <Button onClick={() => void start()} disabled={isStarting}>
          {isStarting ? <Spinner /> : <Play />}
          START PARTIAL WORKFLOW
        </Button>
      )}
    </MotionDiv>
  )
}
