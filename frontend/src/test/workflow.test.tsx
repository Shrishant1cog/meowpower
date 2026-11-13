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

describe("shared workflow controls and SSE", () => {
  beforeEach(() => {
    resetWorkflow()
    installMockEventSource()
  })

  it("uses both Start buttons for one idempotent backend operation", async () => {
    const user = userEvent.setup()
    const { fetchMock } = installApiMock()
    render(<App />)

    const startButtons = await screen.findAllByRole("button", {
      name: "START PARTIAL WORKFLOW",
    })
    expect(startButtons).toHaveLength(2)
    await user.click(startButtons[0])
    await user.click(startButtons[1])

    await waitFor(() => {
      const jobPosts = fetchMock.mock.calls.filter(
        ([url, init]) => url === "/api/v1/jobs/demo" && init?.method === "POST",
      )
      expect(jobPosts).toHaveLength(1)
    })
  })

  it("parses SSE progress and keeps both HUDs synchronized with server ETA", async () => {
    const user = userEvent.setup()
    installApiMock()
    render(<App />)

    await user.click(
      (await screen.findAllByRole("button", { name: "START PARTIAL WORKFLOW" }))[0],
    )
    await waitFor(() => expect(MockEventSource.instances).toHaveLength(1))
    const source = MockEventSource.instances[0]
    source.emit("job.progress", {
      job_id: "job-test-1",
      status: "running",
      stage: "analysis_preview",
      stage_label: "Previewing analysis stages",
      progress_percent: 42,
      elapsed_seconds: 18,
      eta_remaining_seconds: 37,
      message: "Running foundation demonstration",
      updated_at: "2026-01-01T00:00:18Z",
      operation: "Simulating local intelligence",
      error_message: null,
      sequence: 1,
    })

    await waitFor(() => expect(screen.getAllByText("42%").length).toBeGreaterThanOrEqual(2))
    expect(screen.getAllByText(/37s remaining/).length).toBeGreaterThanOrEqual(2)
    expect(screen.getAllByText("18s elapsed · 37s remaining").length).toBeGreaterThanOrEqual(2)
  })

  it("cancels the running job from the shared controls", async () => {
    const user = userEvent.setup()
    const { fetchMock, state } = installApiMock()
    render(<App />)

    await user.click(
      (await screen.findAllByRole("button", { name: "START PARTIAL WORKFLOW" }))[0],
    )
    await waitFor(() => expect(MockEventSource.instances).toHaveLength(1))
    MockEventSource.instances[0].emit("job.progress", {
      job_id: "job-test-1",
      status: "running",
      stage: "foundation_demo",
      stage_label: "Preparing local workspace",
      progress_percent: 12,
      elapsed_seconds: 3,
      eta_remaining_seconds: 20,
      message: "Running",
      updated_at: "2026-01-01T00:00:03Z",
      operation: "Validating project services",
      error_message: null,
      sequence: 1,
    })

    const cancelButtons = await screen.findAllByRole("button", {
      name: "CANCEL PARTIAL WORKFLOW",
    })
    await user.click(cancelButtons[0])
    await waitFor(() => {
      expect(
        fetchMock.mock.calls.some(
          ([url, init]) => url === "/api/v1/jobs/job-test-1/cancel" && init?.method === "POST",
        ),
      ).toBe(true)
    })
    expect(await screen.findByText("Partial workflow cancelled")).toBeInTheDocument()

    const source = MockEventSource.instances[0]
    expect(source.closed).toBe(false)
    source.emit("job.progress", {
      job_id: "job-test-1",
      status: "cancelled",
      stage: "cancelled",
      stage_label: "Partial workflow cancelled",
      progress_percent: 12,
      elapsed_seconds: 3,
      eta_remaining_seconds: 0,
      message: "Simulated workflow activity cancelled",
      updated_at: "2026-01-01T00:00:03Z",
      operation: "Stopping the partial workflow",
      error_message: null,
      sequence: state.job.last_event_sequence + 1,
    })
    expect(source.closed).toBe(true)
    expect(screen.getAllByText("Partial workflow cancelled")).toHaveLength(1)
  })

  it("shows a recoverable error notification for a failed SSE event", async () => {
    const user = userEvent.setup()
    installApiMock()
    render(<App />)

    await user.click(
      (await screen.findAllByRole("button", { name: "START PARTIAL WORKFLOW" }))[0],
    )
    await waitFor(() => expect(MockEventSource.instances).toHaveLength(1))
    MockEventSource.instances[0].emit("job.progress", {
      job_id: "job-test-1",
      status: "failed",
      stage: "failed",
      stage_label: "Workflow failed",
      progress_percent: 55,
      elapsed_seconds: 8,
      eta_remaining_seconds: 0,
      message: "Simulated workflow activity failed",
      updated_at: "2026-01-01T00:00:08Z",
      operation: "Handling simulated workflow error",
      error_message: "Fixture failure",
      sequence: 1,
    })

    expect(await screen.findByText("Partial workflow failed")).toBeInTheDocument()
    expect(screen.getByText("Simulated workflow activity failed")).toBeInTheDocument()
  })
})
