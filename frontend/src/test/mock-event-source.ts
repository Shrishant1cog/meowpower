import { vi } from "vitest"

type Listener = (event: MessageEvent<string>) => void

export class MockEventSource {
  static instances: MockEventSource[] = []
  readonly url: string
  readonly listeners = new Map<string, Set<Listener>>()
  closed = false

  constructor(url: string | URL) {
    this.url = String(url)
    MockEventSource.instances.push(this)
  }

  addEventListener(type: string, listener: EventListenerOrEventListenerObject) {
    const listeners = this.listeners.get(type) ?? new Set<Listener>()
    listeners.add(listener as Listener)
    this.listeners.set(type, listeners)
  }

  removeEventListener(type: string, listener: EventListenerOrEventListenerObject) {
    this.listeners.get(type)?.delete(listener as Listener)
  }

  close() {
    this.closed = true
  }

  emit(type: string, data: unknown, lastEventId = "") {
    const event = new MessageEvent(type, { data: JSON.stringify(data), lastEventId })
    this.listeners.get(type)?.forEach((listener) => listener(event))
  }
}

export function installMockEventSource() {
  MockEventSource.instances = []
  vi.stubGlobal(
    "EventSource",
    class extends MockEventSource {
      constructor(url: string | URL) {
        super(url)
      }
    },
  )
  return MockEventSource
}
