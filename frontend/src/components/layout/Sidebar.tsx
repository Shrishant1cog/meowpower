import {
  BarChart3,
  Bot,
  Clapperboard,
  FolderOpen,
  Home,
  Library,
  Music2,
  PanelLeftClose,
  PanelLeftOpen,
  Settings,
  Sparkles,
  Upload,
  Video,
} from "lucide-react"
import { useReducedMotion } from "motion/react"
import { MotionAside, MotionDiv, MotionSpan } from "@/components/motion/primitives"
import { NavLink } from "react-router-dom"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { useUiStore } from "@/stores/ui"

const navigation = [
  { label: "Dashboard", path: "/", icon: Home, phase: 1 },
  { label: "Create Shorts", path: "/create", icon: Clapperboard, phase: 1 },
  { label: "Video Library", path: "/library", icon: Library, phase: 2 },
  { label: "Generated Clips", path: "/clips", icon: Video, phase: 8 },
  { label: "Upload History", path: "/uploads", icon: Upload, phase: 14 },
  { label: "Analytics", path: "/analytics", icon: BarChart3, phase: 15 },
  { label: "Music Library", path: "/music", icon: Music2, phase: 11 },
  { label: "AI Models", path: "/models", icon: Bot, phase: 1.5 },
  { label: "Settings", path: "/settings", icon: Settings, phase: 1 },
]

export function Sidebar() {
  const collapsed = useUiStore((state) => state.sidebarCollapsed)
  const toggle = useUiStore((state) => state.toggleSidebar)
  const reduceMotion = useReducedMotion()

  return (
    <MotionAside
      className="relative z-30 hidden h-screen shrink-0 border-r border-border bg-card/95 md:flex md:flex-col"
      initial={false}
      animate={{ width: collapsed ? 72 : 248 }}
      transition={
        reduceMotion
          ? { duration: 0 }
          : { type: "spring", stiffness: 320, damping: 34, mass: 0.7 }
      }
      aria-label="Primary navigation"
    >
      <div
        className={cn(
          "flex h-16 items-center border-b border-border",
          collapsed ? "justify-center px-2" : "px-4",
        )}
      >
        <MotionDiv
          className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary text-primary-foreground shadow-sm shadow-primary/20"
          whileHover={{ rotate: reduceMotion ? 0 : -4, scale: reduceMotion ? 1 : 1.04 }}
        >
          <Sparkles className="size-4.5" aria-hidden="true" />
        </MotionDiv>
        {!collapsed && (
          <MotionDiv
            className="ml-3 min-w-0"
            initial={{ opacity: 0, x: -4 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.16 }}
          >
            <div className="truncate text-sm font-semibold tracking-tight">MeowPower</div>
            <div className="text-[11px] text-muted-foreground">Local production studio</div>
          </MotionDiv>
        )}
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-2 py-4">
        {navigation.map((item) => {
          const Icon = item.icon
          return (
            <NavLink
              key={item.path}
              to={item.path}
              title={collapsed ? item.label : undefined}
              className={cn(
                "group relative flex h-10 items-center rounded-md text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                collapsed ? "justify-center px-2" : "gap-3 px-3",
                "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              {({ isActive }) => (
                <>
                  {isActive && (
                    <MotionSpan
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ duration: reduceMotion ? 0 : 0.14 }}
                      className="absolute inset-0 rounded-md bg-accent text-accent-foreground shadow-sm"
                    />
                  )}
                  <Icon className="relative z-10 size-4 shrink-0" aria-hidden="true" />
                  {!collapsed && (
                    <>
                      <span className="relative z-10 min-w-0 flex-1 truncate">{item.label}</span>
                      {item.phase > 1 && (
                        <Badge
                          variant="outline"
                          className="relative z-10 px-1.5 py-0 text-[9px] uppercase tracking-wide"
                        >
                          Phase {item.phase}
                        </Badge>
                      )}
                    </>
                  )}
                </>
              )}
            </NavLink>
          )
        })}
      </nav>

      {!collapsed && (
        <MotionDiv
          className="m-3 rounded-lg border border-border bg-background p-3"
          initial={{ opacity: 0, y: 5 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="flex items-center gap-2 text-xs font-medium">
            <FolderOpen className="size-3.5 text-primary" />
            Project-local by design
          </div>
          <p className="mt-1.5 text-[11px] leading-4 text-muted-foreground">
            Sources, models, caches, and settings stay inside this MeowPower installation.
          </p>
        </MotionDiv>
      )}

      <div className={cn("border-t border-border p-2", collapsed ? "flex justify-center" : "flex justify-end")}>
        <Button
          variant="ghost"
          size="icon"
          onClick={toggle}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          <MotionSpan
            animate={{ rotate: collapsed ? 180 : 0 }}
            transition={{ duration: reduceMotion ? 0 : 0.18 }}
            className="grid place-items-center"
          >
            {collapsed ? <PanelLeftOpen /> : <PanelLeftClose />}
          </MotionSpan>
        </Button>
      </div>
    </MotionAside>
  )
}
