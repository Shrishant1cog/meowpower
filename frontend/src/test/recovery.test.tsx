import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it } from "vitest"

import App from "@/App"
import { installApiMock } from "@/test/api-mock"
import { installMockEventSource, MockEventSource } from "@/test/mock-event-source"
import { useWorkflowStore } from "@/stores/workflow"

function resetWorkflow() {
  useWorkflowStore.setState({
    activeJobId: null,
    job: null,
    event: null,
    lastEventSequence: 0,
    isStarting: false,
    isCancelling: false,
    idempotencyKey: null,
    notifications: [],
  })
}

function runningJob(cursor: number) {
  return {
    id: "job-test-1",
    job_type: "foundation_demo" as const,
    status: "running" as const,
    stage: "analysis_preview",
    stage_label: "Previewing analysis stages",
    operation: "Simulating local intelligence",
    progress_percent: 40,
    elapsed_seconds: 12,
    eta_remaining_seconds: 18,
    message: "Running",
    error_message: null,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:12Z",
    started_at: "2026-01-01T00:00:00Z",
    completed_at: null,
    last_event_sequence: cursor,
  }
}

describe("job refresh recovery and ordered SSE state", () => {
  beforeEach(() => {
    resetWorkflow()
    installMockEventSource()
  })

  it("discovers an active persisted job and subscribes from its snapshot cursor", async () => {
    const { state, fetchMock } = installApiMock()
    state.job = runningJob(5)
    state.activeJob = runningJob(5)
    state.jobStatus = "running"

    render(<App />)

    await waitFor(() => expect(useWorkflowStore.getState().activeJobId).toBe("job-test-1"))
    await waitFor(() => expect(MockEventSource.instances).toHaveLength(1))
    expect(MockEventSource.instances[0].url).toContain("/api/v1/jobs/job-test-1/events?after=5")
    expect(
      fetchMock.mock.calls.some(
        ([url, init]) => url === "/api/v1/jobs/active" && (init?.method ?? "GET") === "GET",
      ),
    ).toBe(true)
    expect(
      fetchMock.mock.calls.some(
        ([url, init]) => url === "/api/v1/jobs/job-test-1" && (init?.method ?? "GET") === "GET",
      ),
    ).toBe(true)
  })

  it("rejects duplicate, regressing, and unrelated-job events", async () => {
    const { state } = installApiMock()
    state.job = runningJob(5)
    state.activeJob = runningJob(5)
    state.jobStatus = "running"

    render(<App />)
    await waitFor(() => expect(MockEventSource.instances).toHaveLength(1))
    const source = MockEventSource.instances[0]

    source.emit("job.progress", {
      job_id: "job-test-1",
      status: "running",
      stage: "analysis_preview",
      stage_label: "Previewing analysis stages",
      progress_percent: 60,
      elapsed_seconds: 20,
      eta_remaining_seconds: 10,
      message: "Running",
      updated_at: "2026-01-01T00:00:20Z",
      operation: "Simulating local intelligence",
      error_message: null,
      sequence: 6,
    })
    await waitFor(() => expect(useWorkflowStore.getState().job?.progress_percent).toBe(60))

    source.emit("job.progress", {
      job_id: "job-test-1",
      status: "running",
      stage: "stale",
      stage_label: "Stale duplicate",
      progress_percent: 10,
      elapsed_seconds: 5,
      eta_remaining_seconds: 40,
      message: "Stale",
      updated_at: "2026-01-01T00:00:05Z",
      operation: "Stale operation",
      error_message: null,
      sequence: 6,
    })
    source.emit("job.progress", {
      job_id: "job-test-1",
      status: "queued",
      stage: "older",
      stage_label: "Older event",
      progress_percent: 1,
      elapsed_seconds: 1,
      eta_remaining_seconds: 50,
      message: "Older",
      updated_at: "2026-01-01T00:00:01Z",
      operation: "Older operation",
      error_message: null,
      sequence: 5,
    })
    source.emit("job.progress", {
      job_id: "another-job",
      status: "failed",
      stage: "failed",
      stage_label: "Unrelated failure",
      progress_percent: 99,
      elapsed_seconds: 99,
      eta_remaining_seconds: 0,
      message: "Unrelated",
      updated_at: "2026-01-01T00:00:99Z",
      operation: "Unrelated operation",
      error_message: null,
      sequence: 7,
    })

    expect(useWorkflowStore.getState().job?.progress_percent).toBe(60)
    expect(useWorkflowStore.getState().lastEventSequence).toBe(6)
    expect(useWorkflowStore.getState().activeJobId).toBe("job-test-1")
  })

  it("uses one shared cancellation state for the top and bottom controls", async () => {
    const user = userEvent.setup()
    const { state, fetchMock } = installApiMock()
    state.cancelDelayMs = 150
    render(<App />)

    const startButtons = await screen.findAllByRole(
      "button",
      { name: "START PARTIAL WORKFLOW" },
      { timeout: 3_000 },
    )
    expect(startButtons).toHaveLength(2)
    await user.click(startButtons[0])
    await waitFor(() => expect(MockEventSource.instances).toHaveLength(1))
    const cancelButtons = await screen.findAllByRole("button", {
      name: "CANCEL PARTIAL WORKFLOW",
    })
    expect(cancelButtons).toHaveLength(2)

    await user.click(cancelButtons[0])
    await waitFor(() => {
      for (const button of screen.getAllByRole("button", {
        name: "CANCEL PARTIAL WORKFLOW",
      })) {
        expect(button).toBeDisabled()
      }
    })
    expect(
      fetchMock.mock.calls.filter(
        ([url, init]) => url === "/api/v1/jobs/job-test-1/cancel" && init?.method === "POST",
      ),
    ).toHaveLength(1)
  })
})
