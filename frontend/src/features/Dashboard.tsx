import { Activity, FileSearch, Sparkles } from "lucide-react"

import { MusicSelection } from "@/components/music/MusicSelection"
import { SourceCard } from "@/components/workspace/SourceCard"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { getWorkflowPresentation } from "@/lib/workflow-presentation"
import { useWorkflowStore } from "@/stores/workflow"

export function Dashboard() {
  const job = useWorkflowStore((state) => state.job)
  const event = useWorkflowStore((state) => state.event)
  const stage = event?.stage_label ?? job?.stage_label ?? "Ready"
  const operation = event?.operation ?? job?.operation ?? "Waiting for the Phase 1 partial workflow"
  const workflowPresentation = getWorkflowPresentation(event?.status ?? job?.status)

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
        <div className="max-w-2xl">
          <div className="mb-2 flex items-center gap-2">
            <Badge>Phase 1 partial workflow</Badge>
            <span className="text-xs text-muted-foreground">Local application foundation</span>
          </div>
          <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">Prepare your first production run</h2>
          <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">
            Configure an authorized source and music preference, then start the implemented foundation checks to
            verify local persistence, cancellation, and real-time progress streaming.
          </p>
          <p className="mt-2 max-w-2xl text-xs leading-5 text-muted-foreground">
            Current partial workflow runs the implemented foundation checks. Video processing and AI production
            stages will be added in upcoming phases.
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="size-1.5 rounded-full bg-primary" />
          Runs entirely on 127.0.0.1
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.25fr)_minmax(20rem,0.75fr)]">
        <SourceCard />
        <div className="space-y-5">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="size-4 text-primary" />
                Audio direction
              </CardTitle>
              <CardDescription>Set a preference now; recommendation and mixing arrive in Phase 11.</CardDescription>
            </CardHeader>
            <CardContent>
              <MusicSelection />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Sparkles className="size-4 text-primary" />
                    Workflow activity
                  </CardTitle>
                  <CardDescription className="mt-1">Progress and ETA come from the backend.</CardDescription>
                </div>
                {job && (
                  <Badge variant={workflowPresentation.tone === "error" ? "destructive" : "outline"}>
                    {workflowPresentation.label}
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <div className="rounded-lg border border-border bg-muted/30 p-4">
                <div className="text-sm font-medium">{stage}</div>
                <div className="mt-1 text-xs text-muted-foreground">{operation}</div>
                <Separator className="my-3" />
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <div className="text-muted-foreground">Server progress</div>
                    <div className="mt-1 font-medium tabular-nums">
                      {Math.round(event?.progress_percent ?? job?.progress_percent ?? 0)}%
                    </div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Elapsed</div>
                    <div className="mt-1 font-medium tabular-nums">
                      {(event?.elapsed_seconds ?? job?.elapsed_seconds ?? 0).toFixed(1)}s
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2">
                <FileSearch className="size-4 text-primary" />
                Candidate clips
              </CardTitle>
              <CardDescription className="mt-1">
                Explainable clip discovery and candidate review are intentionally not implemented in Phase 1.
              </CardDescription>
            </div>
            <Badge variant="warning">Planned for Phase 7</Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border border-dashed border-border px-5 py-10 text-center">
            <FileSearch className="mx-auto size-6 text-muted-foreground/70" />
            <p className="mt-3 text-sm font-medium">No clip candidates yet</p>
            <p className="mx-auto mt-1 max-w-md text-xs leading-5 text-muted-foreground">
              The foundation job demonstrates infrastructure only. Transcript analysis, hook scoring, visual interest,
              and diversity-aware ranking will be added in their authorized phases.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
