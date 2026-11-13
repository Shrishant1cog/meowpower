# MeowPower 17-Phase Implementation Roadmap

## Governance

This document defines the complete architecture and acceptance boundary for MeowPower. Phase 1 and the explicitly authorized Phase 1.5 UX/model-discovery enhancement are implemented and awaiting developer testing. Phase 2 through Phase 17 remain design commitments, not implemented features. Each later phase must begin only after the developer sends the exact authorization message:

```text
TESTING COMPLETE. PROCEED TO NEXT PHASE.
```

Each implementation phase must preserve existing work, update migrations and contracts, add meaningful tests, update documentation, and report exact verification results.

## Phase summary

| Phase | Objective | Primary outcome |
|---:|---|---|
| 1 | Complete application foundation | Working local API/UI, persistence, credentials, folder picker, demo jobs, SSE |
| 1.5 | Authorized UX/model-discovery enhancement | Named credential profiles, genuine model catalogs, provider testing, Motion refinement |
| 2 | Persistent settings, security, source management | Full local configuration and source/storage controls |
| 3 | YouTube metadata and captions | Authorized metadata and normalized caption retrieval |
| 4 | Audio extraction and local transcription | FFmpeg extraction and local Whisper fallback |
| 5 | Word alignment and transcript editor | Word-level original-timeline transcript and editor |
| 6 | Video/audio/scene/category intelligence | Multi-signal content analysis |
| 7 | AI clip discovery and ranking | Explainable, diversity-aware candidate opportunities |
| 8 | Candidate review and editing | Interactive candidate selection and trimming |
| 9 | Rendering and smart cropping | Validated vertical/square/landscape renders |
| 10 | Animated subtitle engine | Creator-quality word-level caption rendering |
| 11 | Music library and mixing | Authorized local/auto music with voice ducking |
| 12 | Thumbnails and metadata intelligence | Scored thumbnail and editable metadata generation |
| 13 | YouTube compliance | Versioned PASS/WARNING/REVIEW/FAIL validation |
| 14 | OAuth and publishing | Secure multi-channel resumable publishing |
| 15 | Analytics and learning | Measured prediction calibration and model evaluation |
| 16 | Notifications and recovery | Durable history, retries, restart recovery, cleanup |
| 17 | Full integration and optimization | Production acceptance, profiling, backup, final hardening |

---

## Phase 1 — Complete application foundation

- **Objective:** Establish a functioning local-first MeowPower application, not a static mockup.
- **Modules:** FastAPI lifecycle/config/logging; SQLAlchemy async SQLite; Alembic; settings/providers/folders/jobs/events; native Tkinter picker; keyring adapter; React/Vite/Tailwind/shadcn studio UI; shared HUD; native SSE.
- **Technical decisions:** Loopback-only service, native SSE, persisted event replay, authoritative snapshot cursor, active-job discovery, TanStack Query + Zustand, OS credential store, dedicated GUI executor, route-level lazy loading.
- **Dependencies:** FastAPI, Uvicorn, SQLAlchemy async, aiosqlite, Alembic, Pydantic v2, keyring, React, Vite, Tailwind v4, TanStack Query, Zustand. Motion is added only in the authorized Phase 1.5 enhancement below.
- **API changes:** Implement the Phase 1 contracts in `docs/API_CONTRACTS.md`, including `GET /api/v1/jobs/active`, snapshot cursors, and SSE `after`/`Last-Event-ID` replay.
- **UI changes:** Dashboard/sidebar/theme, URL/local source inputs, music folder dialog, provider settings, dual Start controls, synchronized circular HUD, notifications, planned-state navigation, lazy-loaded routes.
- **Database changes:** `app_settings`, `music_folders`, `ai_provider_configs`, `jobs`, `job_events`; Alembic revisions `20260101_0001` and integrity-hardening revision `20260113_0002`.
- **Tests:** Backend startup/migration/logging/settings/provider/credential/path/job/recovery/SSE/security/persistence; frontend rendering/navigation/theme/source/music/provider/dual-control/refresh recovery/SSE/cancellation/error.
- **Deliverables:** Runnable backend/frontend, pinned dependencies and lockfile, readiness/identity-aware lifecycle scripts, documentation, automated tests, live Windows/browser verification.
- **Acceptance criteria:** Both services run locally and only on loopback; migrations apply; theme/settings persist; secrets are masked/protected; picker path is private; one idempotent job streams actual server progress/ETA; cancellation and interruption recovery are deterministic; refresh resumes from persisted state; both HUDs synchronize; lint/tests/build pass.
- **Known limitations:** The job is explicitly simulated; no media processing, YouTube access, OAuth, rendering, publishing, or analytics exists yet. The project root is physically below the configured OneDrive Desktop hierarchy; relocation requires developer approval.

### Phase 1 audit status

The Phase 1 forensic audit and corrective pass are complete. That baseline was superseded by the authorized Phase 1.5 enhancement described below. The current final suite, live API/browser/native-picker/Windows-vault checks, migration verification, and production build pass. The OneDrive placement risk in `docs/SECURITY.md` remains an environmental decision requiring explicit developer approval; it is not authorization to begin Phase 2.

---

## Phase 1.5 — UX refinement and provider model discovery

- **Objective:** Refine the Phase 1 workspace and add safe, genuine model discovery for authorized provider configurations without executing models or implementing any Phase 2 capability.
- **Modules:** Named Windows Credential Manager profiles; active-profile compatibility mirroring; OpenAI, Google Gemini, Anthropic, NVIDIA NIM, OpenAI-compatible, and Ollama model-list adapters; persisted profile-aware catalog cache; genuine Test Connection; `/models` workspace; searchable/manual model combobox; Motion 14 UX primitives; shared partial-workflow labels and idempotent cancellation handling.
- **Technical decisions:** Provider requests remain backend-owned; official endpoints are fixed while compatible/Ollama endpoints are configurable; remote HTTP requires HTTPS and plaintext HTTP is loopback-only; provider requests use bounded timeouts, no redirects, sanitized errors, and a 2 MB response ceiling; catalog validity uses provider type, effective endpoint, and selected profile for a 900-second TTL; manual model fallback remains authoritative; Motion uses `LazyMotion`, asynchronous `domAnimation`, lightweight components, consistent easing, and `MotionConfig reducedMotion="user"`.
- **Dependencies:** Existing Phase 1 stack plus Motion 14.13.0. No external service, OAuth, media, or publishing dependency was added.
- **API changes:** Named-profile collection/mutation routes; `GET /models` with profile selection, cache reuse, and `refresh=true`; `POST /test-connection`; typed provider/catalog/connection responses and sanitized discovery errors.
- **UI changes:** Functional `/models` route; provider/profile management; cached/live/empty/auth/network/refresh/manual-fallback states; accessible model combobox; exact shared `START PARTIAL WORKFLOW` and `CANCEL PARTIAL WORKFLOW` labels; one cancellation notification and clean terminal SSE closure; Motion refinement with reduced-motion support.
- **Database changes:** `provider_credential_profiles`, `provider_model_catalogs`, provider endpoint and active-profile fields, foreign keys/indexes, and safe legacy-reference conversion in Alembic revision `20260113_0003`.
- **Tests:** All six adapter families; endpoint/header mapping; cache/refresh/profile validity; empty/auth/network states; genuine Test Connection; named-profile lifecycle; migration compatibility; frontend discovery/profile/manual fallback; cancellation cursor race; Ruff, Pytest, TypeScript, Vitest, and production build.
- **Deliverables:** Functional model-discovery workspace and provider-profile API, migrated live SQLite schema, Motion refinement, updated contracts/decisions/security/test evidence, and complete automated/live/browser/Windows-vault verification.
- **Acceptance criteria:** Secrets remain only in Windows Credential Manager; legacy provider references survive migration; official/compatible/local discovery works through the correct endpoints; discovery states are explicit; refresh bypasses a valid cache; Test Connection reaches upstream; model selection supports manual fallback; workflow labels are exact; cancellation is idempotent; all final automated and live checks pass.
- **Known limitations:** Model discovery does not execute models. Only the authorized NVIDIA credential was available for a live official-provider request; other official mappings are covered by deterministic integration tests. The supplied reference screenshots were unavailable, and the live OS reduced-motion preference was not enabled. OneDrive relocation still requires explicit developer approval.

### Phase 1.5 implementation status

Implementation and the full verification matrix are complete. The final automated suite passed **43 backend tests and 20 frontend tests across 4 files**, TypeScript and the production build passed, `npm audit` reported zero vulnerabilities, and `pip check` reported no broken requirements. Live migration, provider discovery (including 83 NVIDIA NIM models), Windows Credential Manager lifecycle, SQLite integrity, API, browser, theme persistence, Motion loading, shared start/cancel behavior, and zero-console-error checks passed.

Two live-only defects found during verification were corrected with regression coverage: the credential-profile collection route incorrectly awaited its service constructor, and cancel-response/event-cursor ordering could suppress the cancellation notification and cause SSE reconnects. The implementation is awaiting developer testing; no Phase 2 work is authorized or present.

---

## Phase 2 — Persistent settings, security and source management

- **Objective:** Turn Phase 1 configuration into a complete, secure local management surface.
- **Modules:** Provider/task-model assignment service; hardware detector; disk/memory manager; local source repository; file validation; model registry; safe settings import/export.
- **Technical decisions:** Capability-based provider routing; encrypted/opaque token references; canonical storage roots and size limits; hardware-aware model profiles; no silent cloud fallback.
- **Dependencies:** Existing Phase 1 stack; optional `psutil` and maintained hardware-detection packages after compatibility review.
- **API changes:** CRUD for providers/tasks/models, source metadata CRUD, hardware/storage status, settings import/export.
- **UI changes:** Complete settings tabs, source library, model routing matrix, disk warning states, hardware profile.
- **Database changes:** Source, model profile, task assignment, hardware profile, and settings schema tables with migrations.
- **Tests:** CRUD, assignment conflicts, import validation, path traversal rejection, file-size/type checks, disk thresholds.
- **Deliverables:** Secure full settings management and persistent local source inventory.
- **Acceptance criteria:** All settings survive restart; secrets remain absent from DB/API/logs; source paths stay private; invalid/oversized files are rejected clearly; hardware-aware profiles persist.
- **Known limitations:** Source import does not yet retrieve YouTube media or process it.

---

## Phase 3 — YouTube metadata and caption retrieval

- **Objective:** Retrieve authorized YouTube metadata and captions before considering local transcription.
- **Modules:** URL parser; YouTube Data API/OAuth integration; caption discovery; language selection; authorized caption retrieval; caption normalization/error taxonomy; metadata source records.
- **Technical decisions:** Metadata access never implies media-byte access; caption-first policy; official API/OAuth only; preserve original timestamps; distinguish access, authorization, availability, and parse errors.
- **Dependencies:** Official YouTube API client or thin typed HTTP adapter; OAuth dependency selected in Phase 14 unless a public-data-only path is explicitly supported.
- **API changes:** YouTube source intake, metadata retrieval, caption availability/language endpoints.
- **UI changes:** URL validation, metadata card, caption language selection, explicit access errors.
- **Database changes:** Source metadata, caption track, retrieval attempt/error records.
- **Tests:** URL variants, invalid IDs, unavailable captions, multiple languages, malformed tracks, API errors, timestamp preservation.
- **Deliverables:** Authorized metadata/caption pipeline with normalized caption records.
- **Acceptance criteria:** Valid links produce metadata; caption tracks and languages are visible; unauthorized media retrieval is rejected; normalized captions retain source timing.
- **Known limitations:** This phase does not download or transcribe restricted media.

---

## Phase 4 — Audio extraction and local transcription fallback

- **Objective:** Extract authorized audio and provide a memory-aware local speech-recognition fallback.
- **Modules:** FFmpeg locator/probe/extractor; Faster-Whisper/CTranslate2 adapter; whisper.cpp evaluation; VAD; model cache; hardware/memory profile; transcript cache.
- **Technical decisions:** Caption-first then forced-alignment check then ASR; bounded process workers; cancellation/timeout; content-addressed caches; benchmark before selecting the default ASR runtime.
- **Dependencies:** Project-local or licensed FFmpeg; maintained Faster-Whisper/CTranslate2 and optional whisper.cpp binaries after benchmark/license review.
- **API changes:** Media probe, extraction, transcription job/status/cache endpoints.
- **UI changes:** Transcription stage progress, model/runtime choice, hardware warning, cache/retry controls.
- **Database changes:** Media artifact, model runtime, transcription run/cache, error records.
- **Tests:** FFmpeg argument construction, timeout/cancellation, corrupt media, CPU/GPU profiles, cache reuse, VAD behavior.
- **Deliverables:** Reliable authorized audio extraction and local ASR fallback.
- **Acceptance criteria:** Audio/video sync is valid; ASR runs within measured resource bounds; cache reuse is safe; cancellation terminates work; captions avoid unnecessary ASR.
- **Known limitations:** Phase 4 creates sentence/cue-level output; word-level alignment is Phase 5.

---

## Phase 5 — Word-level alignment and transcript editor

- **Objective:** Produce and edit a timestamped word transcript on the original video timeline.
- **Modules:** WhisperX or evaluated forced-alignment adapter; sentence grouping; language ID; optional speaker ID; confidence; JSON/SRT/VTT/ASS exporters; transcript editor.
- **Technical decisions:** Forced alignment against accessible audio before full ASR; monotonic valid word records; original timeline preservation; explicit confidence semantics.
- **Dependencies:** Phase 4 audio/ASR; evaluated alignment stack and compatible model weights.
- **API changes:** Alignment runs, transcript CRUD, timeline navigation, subtitle export/download.
- **UI changes:** Word/sentence transcript editor, timeline navigator, confidence/language display, export menu.
- **Database changes:** Transcript, word, sentence, speaker, language, and export records.
- **Tests:** Timestamp validity/order, no unnecessary duplicates, speaker assignment, round-trip exports, editor navigation, large transcript performance.
- **Deliverables:** Reusable word-level transcript and format exports.
- **Acceptance criteria:** Every word has valid non-negative start/end; timestamps map to original media; exports are valid; edits persist.
- **Known limitations:** Optional diarization quality depends on the selected model and audio.

---

## Phase 6 — Video, audio, scene and category intelligence

- **Objective:** Build multi-signal understanding of visual, audio, pacing, semantic, and category content.
- **Modules:** Scene detector; frame sampler; visual/face/subject analysis; energy/clarity/silence/pacing analysis; semantic analysis; category classifier; hook/payoff detector.
- **Technical decisions:** Cache by content hash/config fingerprint; bounded sampling; combine independent signals rather than one opaque score; confidence and evidence for categories.
- **Dependencies:** FFmpeg/OpenCV or maintained equivalents, local embedding/model options after benchmark and license review.
- **API changes:** Analysis run/status/results, evidence inspection, category override.
- **UI changes:** Signal timeline, scene strips, category/confidence, evidence panels.
- **Database changes:** Analysis run, frame/scene, audio metric, semantic segment, category prediction.
- **Tests:** Golden fixtures, boundary detection tolerance, silence/energy calculations, deterministic category evaluation, cache invalidation.
- **Deliverables:** Persisted multi-signal analysis ready for clip discovery.
- **Acceptance criteria:** Signals are explainable and reproducible; category confidence is meaningful; expensive stages are bounded and cancellable.
- **Known limitations:** Face/subject analysis is best-effort and must not be treated as identity recognition.

---

## Phase 7 — AI clip discovery and ranking

- **Objective:** Generate multiple high-quality, diverse clip opportunities with transparent scores.
- **Modules:** Candidate generator; semantic embeddings; temporal refinement; hook/narrative/payoff analysis; multi-signal 0–100 scorer; overlap suppression; semantic deduplication; MMR diversity selection.
- **Technical decisions:** Explainable weighted factors, never a virality guarantee; temporal IoU and semantic similarity for duplicate handling; generate overlaps before refinement.
- **Dependencies:** Phase 5 transcript and Phase 6 signals; optional local embeddings after evaluation.
- **API changes:** Candidate generation, ranked list, factor breakdown, regenerate/re-rank.
- **UI changes:** Ranked candidates, contribution bars, strengths/weaknesses, suggested operations.
- **Database changes:** Clip candidate, interval, factor score, transcript excerpt, ranking run.
- **Tests:** Boundary correctness, score bounds/contributions, duplicate suppression, diversity, deterministic fixtures, calibration hooks.
- **Deliverables:** Explainable ranked clip-opportunity engine.
- **Acceptance criteria:** Candidates avoid cutting key words; scores total 0–100 with visible contributions; near-duplicates are suppressed; labels never promise virality.
- **Known limitations:** Predictions are estimates until Phase 15 supplies measured outcomes.

---

## Phase 8 — Candidate review and manual editing

- **Objective:** Let creators inspect, trim, reject, regenerate, and prioritize candidates.
- **Modules:** Preview generation; frame/audio preview; transcript-assisted trim; candidate state machine; regeneration; manual boundary constraints.
- **Technical decisions:** Preserve server-generated boundaries and manual overrides separately; validate minimum/maximum duration and speech boundaries; regenerate is explicit.
- **Dependencies:** Phase 7 candidates and media preview infrastructure.
- **API changes:** Preview assets, boundary adjustment, accept/reject/prefer, regenerate, transcript-assisted trim.
- **UI changes:** Candidate review workspace with preview, transcript, trim handles, status controls.
- **Database changes:** Candidate review state, boundary revisions, preferences, preview artifacts.
- **Tests:** Boundary validation, state transitions, regeneration isolation, preview availability, concurrent edits.
- **Deliverables:** Complete manual candidate review loop.
- **Acceptance criteria:** Users can preview every candidate, adjust safely, persist choices, and regenerate without losing prior selections.
- **Known limitations:** Preview codecs are temporary; final render is Phase 9.

---

## Phase 9 — Video rendering and smart cropping

- **Objective:** Produce validated renders with intelligent framing and synchronization.
- **Modules:** FFmpeg cut/render pipeline; 9:16/1:1/16:9/custom presets; subject/face/active-speaker tracking; blur-fill; safe areas; normalization; output validator.
- **Technical decisions:** Default 9:16 1080×1920; argument-array subprocesses; manual override; blur-fill when cropping harms content; landscape is not labeled Shorts.
- **Dependencies:** FFmpeg, optional tracking models, Phase 8 approved boundaries.
- **API changes:** Render job/presets, progress, validation report, artifact download/path-safe reference.
- **UI changes:** Crop preview, format presets, manual framing, render progress, validation panel.
- **Database changes:** Render job, preset, crop decision, artifact, validation result.
- **Tests:** Dimension/aspect/codec/duration checks, sync validation, cancellation, corruption, tracking fallback, safe-area fixtures.
- **Deliverables:** Publish-candidate video renders and validation reports.
- **Acceptance criteria:** Output passes duration/resolution/aspect/frame-rate/codec/container/audio/sync checks; no file leaks through arbitrary paths.
- **Known limitations:** Tracking quality is content dependent and must expose fallback/manual controls.

---

## Phase 10 — Animated subtitle engine

- **Objective:** Render creator-quality animated subtitles from aligned words.
- **Modules:** Phrase grouping; karaoke/highlight animation; templates; font/stroke/shadow/position controls; ASS/libass pipeline; subtitle editor; real-time preview.
- **Technical decisions:** Readability limits, maximum words/reading speed, platform-safe zones, phrase-aware grouping, synchronized word timings.
- **Dependencies:** Phase 5 transcript, Phase 9 renderer, libass-capable FFmpeg.
- **API changes:** Template CRUD, style settings, subtitle preview/render, timing validation.
- **UI changes:** Template gallery, style editor, timeline preview, caption density warnings.
- **Database changes:** Subtitle template, style configuration, caption group, render artifact.
- **Tests:** Timing boundaries, no overlap/clipping, density/readability, template serialization, render synchronization.
- **Deliverables:** Animated subtitle rendering and editor.
- **Acceptance criteria:** Captions remain synchronized/readable and inside safe areas; style changes persist; exports are valid.
- **Known limitations:** Font availability can affect exact rendering and must be checked locally.

---

## Phase 11 — Music library and audio mixing

- **Objective:** Select authorized music and mix it intelligibly with speech.
- **Modules:** Local folder scanner; supported format metadata; preview player; mood/tempo/energy analysis; automatic recommendations; voice ducking; fades/offsets; normalization; peak checks.
- **Technical decisions:** Separate platform-only sounds from downloadable local files; do not extract YouTube music; recommendations require genuine authorized data; preserve speech intelligibility.
- **Dependencies:** Phase 9 audio pipeline; maintained local audio metadata/beat/tempo libraries after review.
- **API changes:** Track scan/list/preview metadata; recommendation candidates; mix settings/render.
- **UI changes:** Music library browser, waveform/preview, recommendation reasons, mixer controls.
- **Database changes:** Track, metadata, recommendation, mix settings, licensing note.
- **Tests:** Supported/unsupported formats, scan boundaries, duration metadata, ducking, fades, normalization, peak prevention.
- **Deliverables:** Persistent music library and configurable mixed audio.
- **Acceptance criteria:** Local files remain private; authorized tracks only; voice remains clear; peak/sync checks pass.
- **Known limitations:** Mood/tempo estimates may be imperfect; trending audio is shown only when a genuine source exists.

---

## Phase 12 — Thumbnails and metadata intelligence

- **Objective:** Select strong thumbnail frames and generate accurate, editable publishing metadata.
- **Modules:** Frame extraction; sharpness/subject/face/composition/contrast/motion scoring; hook/transcript relevance; text-safe space; optional enhancement; title/description/hashtag/keyword/category generation.
- **Technical decisions:** Preserve meaning/subject; do not fabricate claims; keep platform-only sounds separate; require approval before publish.
- **Dependencies:** Phase 6 analysis, Phase 9 rendered clips, optional selected AI provider for text assistance.
- **API changes:** Thumbnail candidates/scores/enhancement, metadata generate/edit/approve, category override.
- **UI changes:** Thumbnail grid, score reasons, text editor, metadata variants, approval state.
- **Database changes:** Thumbnail candidate/score, metadata draft/version, category override, approval.
- **Tests:** Sharpness/composition fixtures, metadata truthfulness checks, text-safe bounds, version editing.
- **Deliverables:** Scored thumbnail candidates and editable metadata package.
- **Acceptance criteria:** Strong frames are explainable; metadata reflects content; no irrelevant hashtag stuffing; approvals persist.
- **Known limitations:** AI enhancement is optional and cannot alter the source meaning.

---

## Phase 13 — YouTube compliance

- **Objective:** Validate assets and metadata against current, versioned YouTube publishing rules.
- **Modules:** Rule registry; Shorts qualification; duration/aspect/resolution/format/size checks; thumbnail/title/description limits; music/copyright indicators; declarations/privacy checks; human-review flags.
- **Technical decisions:** Consult official documentation during implementation; version rules; PASS/WARNING/REVIEW REQUIRED/FAIL; never guarantee acceptance/monetization.
- **Dependencies:** Official current YouTube documentation; Phase 9–12 artifacts.
- **API changes:** Validation run/report, rule version, remediation details, acknowledgement.
- **UI changes:** Compliance panel by category, plain-language explanations, required human review.
- **Database changes:** Rule version, validation result/item, acknowledgement.
- **Tests:** Boundary fixtures, rule-version changes, warning/fail logic, current three-minute qualification criteria.
- **Deliverables:** Versioned compliance report.
- **Acceptance criteria:** Applicable limits are checked and explained; ambiguous cases require review; checks do not claim a guarantee.
- **Known limitations:** YouTube rules change; the versioned registry must be maintained.

---

## Phase 14 — YouTube OAuth and publishing

- **Objective:** Securely publish approved content through official YouTube APIs.
- **Modules:** Google OAuth multi-account/channel flow; secure token storage/refresh/revocation; resumable uploads; metadata/thumbnail upload where officially supported; upload history; retry/error recovery.
- **Technical decisions:** OS credential storage for tokens; PKCE/state validation; private/unlisted default; explicit final review; official API only.
- **Dependencies:** Google OAuth/API client libraries; Phase 13 compliance; Phase 9/10/12 assets.
- **API changes:** OAuth start/callback/disconnect; channel list/select; upload start/resume/cancel/status/history.
- **UI changes:** Account/channel wizard, visibility selection, upload progress, errors, history.
- **Database changes:** Channel reference, publication record, upload attempt, status/history, thumbnail result.
- **Tests:** OAuth state/PKCE, token refresh/revoke, resumable chunks, retries, privacy defaults, upload failure recovery.
- **Deliverables:** Functional official YouTube publishing.
- **Acceptance criteria:** No Google password storage; uploads resume and report status; final review is required; history records channel/ID/privacy/URL.
- **Known limitations:** Thumbnail support depends on the official upload path and API capabilities.

---

## Phase 15 — Analytics and performance learning

- **Objective:** Compare actual channel performance with predictions and improve future ranking.
- **Modules:** YouTube Analytics adapter; views/retention/engagement/subscriber metrics; prediction-result comparison; category performance; personalized scorer; model evaluation.
- **Technical decisions:** Separate measured audience results from estimated popularity; avoid leakage; version models; evaluate on held-out channel history; explain changes.
- **Dependencies:** Phase 14 published records and official analytics API access.
- **API changes:** Analytics import/summary; prediction comparison; category/model performance; recalibration trigger.
- **UI changes:** Analytics workspace, actual-versus-predicted views, retention, category/model evaluation.
- **Database changes:** Metric snapshot, prediction, result, model version, evaluation run.
- **Tests:** API normalization, missing data, attribution windows, calibration metrics, model version reproducibility.
- **Deliverables:** Measured analytics and calibrated learning loop.
- **Acceptance criteria:** Actual and estimated values remain clearly distinct; calibration uses real outcomes; model changes are versioned/evaluated.
- **Known limitations:** Sparse channel history limits personalization.

---

## Phase 16 — Notifications and job recovery

- **Objective:** Make long jobs durable, recoverable, and understandable across restarts.
- **Modules:** Local notification service; full job history; persistent stage checkpoints; retry/resume; cancellation; process recovery; background lifecycle; storage cleanup.
- **Technical decisions:** Resume only idempotent stages; bounded retries; artifact checksums; explicit cleanup policy; no silent data deletion.
- **Dependencies:** Phase 4–14 job workers/artifacts and persistent job model.
- **API changes:** History/detail/retry/resume/cleanup/notification preferences.
- **UI changes:** Job history, recovery banners, retry/resume, cleanup controls, notification settings.
- **Database changes:** Expanded job checkpoints, attempts, artifacts, notification records, cleanup audit.
- **Tests:** Kill/restart recovery, retry boundaries, idempotency, cleanup dry-run, notification failure isolation.
- **Deliverables:** Durable job operations and restart recovery.
- **Acceptance criteria:** Interrupted work resumes or becomes explicitly recoverable; retries are bounded; cleanup never removes unapproved artifacts silently.
- **Known limitations:** External provider side effects may not be safely repeatable.

---

## Phase 17 — Full integration and production optimization

- **Objective:** Validate, profile, secure, optimize, and package the complete local studio for developer acceptance.
- **Modules:** End-to-end suite; security review; CPU/GPU/memory/DB/SSE/UI profiling; FFmpeg/upload verification; backup/restore; production build; final scripts/docs.
- **Technical decisions:** Optimize measured bottlenecks only; bounded worker profiles; integrity checks; reproducible local build; explicit operational limits.
- **Dependencies:** All prior phases and representative licensed test fixtures.
- **API changes:** Only stability/compatibility fixes or documented versioned additions.
- **UI changes:** Performance/accessibility/responsiveness refinements from profiling and usability review.
- **Database changes:** Index/query tuning and migrations only when measurements justify them.
- **Tests:** Full backend/frontend/e2e suite, recovery drill, security checks, production build, media integrity/upload validation.
- **Deliverables:** Production-optimized local application, verified backup/restore, final documentation and acceptance report.
- **Acceptance criteria:** All critical workflows pass end-to-end; measured resource use is acceptable on target hardware; security review has no unresolved critical issue; startup/backup/restore work from project root.
- **Known limitations:** YouTube policies, API quotas, model licenses, and consumer hardware remain external constraints.

---

## Cross-phase engineering rules

1. No phase may silently implement a later phase.
2. No local media, transcript, or music is sent to a cloud provider without explicit user selection and disclosure.
3. Every new endpoint has typed request/response schemas and documented errors.
4. Every schema change has an Alembic migration and upgrade/downgrade review.
5. Every long operation has persistent state, cancellation, bounded retry, timeout, and cleanup behavior.
6. Every generated file and dependency cache remains inside the MeowPower root.
7. Every UI control either performs its documented action or clearly identifies the future phase.
8. Opportunity scores are explainable estimates, never guarantees.
9. Tests use project-local temporary directories.
10. Exact test/build results are reported; failures are fixed or honestly identified as external limitations.
