import { Clock3 } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

interface PlannedFeaturePageProps {
  title: string
  phase: number
  description: string
}

export function PlannedFeaturePage({ title, phase, description }: PlannedFeaturePageProps) {
  return (
    <div className="mx-auto max-w-3xl">
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-3">
            <div>
              <CardTitle>{title}</CardTitle>
              <CardDescription className="mt-1">{description}</CardDescription>
            </div>
            <Badge variant="warning">Planned for Phase {phase}</Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border border-dashed border-border px-6 py-12 text-center">
            <Clock3 className="mx-auto size-7 text-muted-foreground/70" />
            <h3 className="mt-4 text-sm font-semibold">Not implemented yet</h3>
            <p className="mx-auto mt-2 max-w-lg text-xs leading-5 text-muted-foreground">
              This navigation item identifies a planned capability. MeowPower does not present future functionality as
              active. Continue only after the corresponding phase is explicitly authorized.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
