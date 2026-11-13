import { Suspense } from "react"
import { useQuery } from "@tanstack/react-query"
import { MotionDiv } from "@/components/motion/primitives"
import { Moon, Sun } from "lucide-react"
import { Outlet, useLocation } from "react-router-dom"

import { WorkflowControls } from "@/components/hud/WorkflowControls"
import { NotificationCenter } from "@/components/notifications/NotificationCenter"
import { Sidebar } from "@/components/layout/Sidebar"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { apiRequest } from "@/lib/api"
import { queryKeys } from "@/lib/query-keys"
import { useSettings } from "@/hooks/useSettings"
import { useActiveJob } from "@/hooks/useActiveJob"
import { useJobEvents } from "@/hooks/useJobEvents"
import { useWorkflowStore } from "@/stores/workflow"
import { getWorkflowPresentation } from "@/lib/workflow-presentation"
import type { HealthResponse } from "@/types/api"

const pageTitles: Record<string, string> = {
  "/": "Dashboard",
  "/create": "Create Shorts",
  "/library": "Video Library",
  "/clips": "Generated Clips",
  "/uploads": "Upload History",
  "/analytics": "Analytics",
  "/music": "Music Library",
  "/models": "AI Models",
  "/settings": "Settings",
}

export function AppShell() {
  const location = useLocation()
  const { data: settings, setTheme } = useSettings()
  useActiveJob()
  const activeJobId = useWorkflowStore((state) => state.activeJobId)
  const workflowJob = useWorkflowStore((state) => state.job)
  const workflowEvent = useWorkflowStore((state) => state.event)
  useJobEvents(activeJobId)
  const health = useQuery({
    queryKey: queryKeys.health,
    queryFn: () => apiRequest<HealthResponse>("/api/v1/health"),
    retry: false,
  })

  const isDark =
    settings?.theme === "dark" ||
    (settings?.theme !== "light" &&
      window.matchMedia("(prefers-color-scheme: dark)").matches)
  const nextTheme = isDark ? "light" : "dark"
  const workflowStatus = workflowEvent?.status ?? workflowJob?.status
  const workflowPresentation = getWorkflowPresentation(workflowStatus)

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-40 flex h-16 shrink-0 items-center border-b border-border bg-background/90 px-4 backdrop-blur-md sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <div className="grid size-8 place-items-center rounded-md bg-primary text-primary-foreground md:hidden">
              <span className="text-xs font-bold">MP</span>
            </div>
            <div>
              <h1 className="truncate text-sm font-semibold tracking-tight">
                {pageTitles[location.pathname] ?? "MeowPower"}
              </h1>
              <p className="hidden text-[11px] text-muted-foreground sm:block">
                Local-first workspace
              </p>
            </div>
          </div>

          <div className="ml-auto flex items-center gap-2 sm:gap-3">
            <div className="hidden items-center gap-2 rounded-md border border-border bg-card px-2.5 py-1.5 text-[11px] text-muted-foreground lg:flex">
              <span
                className={`size-1.5 rounded-full ${health.isSuccess ? "bg-primary" : "bg-muted-foreground/50"}`}
              />
              {health.isSuccess ? "Local API connected" : "API status unknown"}
            </div>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => void setTheme(nextTheme)}
                  aria-label={`Switch to ${nextTheme} theme`}
                >
                  {isDark ? <Sun /> : <Moon />}
                </Button>
              </TooltipTrigger>
              <TooltipContent>{nextTheme === "dark" ? "Dark theme" : "Light theme"}</TooltipContent>
            </Tooltip>
            <Separator orientation="vertical" className="hidden h-7 sm:block" />
            <WorkflowControls placement="top" />
          </div>
        </header>

        <main className="relative min-h-0 flex-1 overflow-y-auto">
          <div className="studio-grid pointer-events-none absolute inset-x-0 top-0 h-64 opacity-35" />
          <MotionDiv
            key={location.pathname}
            className="route-content relative mx-auto w-full max-w-[1500px] px-4 pb-28 pt-6 sm:px-6 lg:px-8"
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
          >
            <Suspense
              fallback={
                <div className="grid min-h-48 place-items-center text-sm text-muted-foreground" role="status">
                  Loading local workspace…
                </div>
              }
            >
              <Outlet />
            </Suspense>
          </MotionDiv>
        </main>
      </div>

      <MotionDiv
        className="fixed bottom-5 right-5 z-30 rounded-xl border border-border bg-background/95 p-3 shadow-xl backdrop-blur-md"
      >
        <WorkflowControls placement="bottom" />
      </MotionDiv>
      <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">
        {workflowPresentation.label}: {workflowEvent?.stage_label ?? workflowJob?.stage_label ?? "Ready"}
      </div>
      <NotificationCenter />
    </div>
  )
}
