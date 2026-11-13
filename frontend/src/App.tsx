import { lazy, useState } from "react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { BrowserRouter, Route, Routes } from "react-router-dom"

import { AppShell } from "@/components/layout/AppShell"
import { MotionProvider } from "@/components/motion/MotionProvider"
import { TooltipProvider } from "@/components/ui/tooltip"

const Dashboard = lazy(() =>
  import("@/features/Dashboard").then((module) => ({ default: module.Dashboard })),
)
const PlannedFeaturePage = lazy(() =>
  import("@/features/PlannedFeaturePage").then((module) => ({
    default: module.PlannedFeaturePage,
  })),
)
const ModelsPage = lazy(() =>
  import("@/features/ModelsPage").then((module) => ({ default: module.ModelsPage })),
)
const SettingsPage = lazy(() =>
  import("@/features/SettingsPage").then((module) => ({ default: module.SettingsPage })),
)

export default function App() {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { retry: 1, refetchOnWindowFocus: false },
          mutations: { retry: false },
        },
      }),
  )

  return (
    <MotionProvider>
      <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <TooltipProvider delayDuration={250}>
          <Routes>
            <Route element={<AppShell />}>
              <Route index element={<Dashboard />} />
              <Route path="create" element={<Dashboard />} />
              <Route path="settings" element={<SettingsPage />} />
              <Route
                path="library"
                element={
                  <PlannedFeaturePage
                    title="Video Library"
                    phase={2}
                    description="Persistent local source records, validation, and storage management arrive in Phase 2."
                  />
                }
              />
              <Route
                path="clips"
                element={
                  <PlannedFeaturePage
                    title="Generated Clips"
                    phase={8}
                    description="Candidate previews, manual trimming, rejection, and regeneration arrive in Phase 8."
                  />
                }
              />
              <Route
                path="uploads"
                element={
                  <PlannedFeaturePage
                    title="Upload History"
                    phase={14}
                    description="OAuth publishing, resumable uploads, and channel history arrive in Phase 14."
                  />
                }
              />
              <Route
                path="analytics"
                element={
                  <PlannedFeaturePage
                    title="Analytics"
                    phase={15}
                    description="Measured YouTube results and prediction calibration arrive in Phase 15."
                  />
                }
              />
              <Route
                path="music"
                element={
                  <PlannedFeaturePage
                    title="Music Library"
                    phase={11}
                    description="Track scanning, previews, mood matching, and authorized mixing arrive in Phase 11."
                  />
                }
              />
              <Route path="models" element={<ModelsPage />} />
              <Route
                path="*"
                element={
                  <PlannedFeaturePage
                    title="Page not found"
                    phase={1}
                    description="The requested local workspace route does not exist."
                  />
                }
              />
            </Route>
          </Routes>
        </TooltipProvider>
      </BrowserRouter>
      </QueryClientProvider>
    </MotionProvider>
  )
}
