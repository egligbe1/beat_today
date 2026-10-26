# BeatToday Studio Business Workspace — PRO product specification

Implementation direction · 26 October 2026 · Booking-first entry point.
This document specifies the product; it does not apply database changes or implement features.

## Product definition

A professional workspace in which a producer runs a studio business and an artist
can follow their work from booking through an agreed scope, production, revisions,
approval and final delivery. Studio booking is an entry point into a working
relationship. The **project** is the shared home for that relationship.

The main journey is:

**Inquiry or booking → proposal → agreement confirmed by both parties → payment
and session confirmation → production → review and revisions → approval → final
delivery → completed project and retained history.**

Physical studio sessions and remote work such as mixing/mastering use the same
project workflow. A remote project does not require an invented calendar booking;
one project may contain several recording sessions and multiple deliverables.

Include the workspace in PRO. Keep the current PRO price and commercial terms
unchanged unless the owner explicitly chooses to revise them. Staff and invited
artists should not need their own PRO subscription to collaborate in a studio
whose owner has an active entitlement.

## What the launch product must contain

| Module | Core capabilities |
| --- | --- |
| Business overview | Upcoming sessions, proposals awaiting agreement, projects due, revisions awaiting action, unpaid balances and delivery status |
| Services and proposals | Recording packages, mixing/mastering, custom production, fixed/hourly quotes, add-ons, expected dates and itemised pricing |
| Booking and availability | Room and engineer availability, opening hours, buffers, blocked time, manual appointments, acceptance, rescheduling and cancellations |
| Confirmed agreements | Versioned scope, price, schedule, deliverables, revision allowance and policies; explicit acceptance by producer and artist |
| Project workspace | Shared brief, milestones, sessions, messages, files, project participants, activity history and current responsibilities |
| Review and revisions | Versioned submissions, audio playback, timestamped feedback, grouped revision requests, round allowance and approval |
| Delivery | Clearly identified final files, balance conditions, private downloads, delivery manifest, receipt and retained version history |
| Clients and team | Private client history, internal notes, invitations, project assignments and scoped roles |
| Business finances | Quotes, deposits, milestones, remaining balances, provider-confirmed receipts, offline-payment records and reviewed refunds |
| Reporting | Booking utilisation, project turnaround, overdue work, revisions used, income collected and balances outstanding |

These belong to the launch specification. The implementation sequence below
organises the build; it does not redefine the product as a basic booking calendar.

## 1. Producer business workspace

Navigation: **Overview · Calendar · Clients · Proposals & Agreements · Projects ·
Finances · Services · Team & Settings.**

The overview is an action centre. Each card should lead to a specific action:
review a booking request, send a proposal, accept an amendment, respond to feedback,
collect a balance or deliver a finished project. Distinguish an overdue producer
submission from work waiting on the artist.

Support several rooms and project collaborators in the data and calendar model
from the beginning. A solo producer should see a simple default resource, while
larger studios can assign rooms and engineers. Do not require a room to offer
remote services. Equipment required for a session can be attached to its resource
requirements; a full inventory/rental business is a separate expansion.

Services can be fixed-price packages, hourly sessions with a minimum duration, or
custom-quote work. Capture inclusions and add-ons explicitly. Example: a recording
package includes two studio hours and a rough mix, but mastering is an add-on.

## 2. Artist workspace

Add **My Projects** and **My Bookings** to the existing artist dashboard. Keep these
separate from purchased beat licenses while allowing a project to reference a
legitimately purchased beat where relevant.

Each project shows:

- Project title, producer/studio, collaborators and the agreed brief.
- Accepted agreement and any amendments, with a downloadable copy.
- Session dates, milestones, deadlines and the next action for each party.
- Quote total, confirmed payments, balance due and payment links.
- Current submissions with playback, versions and feedback.
- Included revision rounds, rounds used, open requests and approved changes.
- Approved final delivery and authorised downloads.

An artist can work with several producers. Each studio sees only its own client
relationship and projects; there is no shared cross-studio client dossier.

## 3. Proposal and agreement workflow

### Agreement contents

Every agreement must describe the actual work being commissioned:

- Parties, studio/business identity, project title and service type.
- Brief and scope; exclusions and artist-supplied materials.
- Session bookings, milestones and expected delivery dates.
- Itemised price, currency, deposit, payment milestones and outstanding balance.
- Deliverables: number of songs/versions, formats, stems, instrumental/acapella,
  sample rate/bit depth where relevant, and whether source/session files are included.
- Included revision rounds, what constitutes a revision, submission window and
  price/approval process for additional work.
- Credits and agreed ownership/usage terms, including any separately required beat
  license. A service agreement must never silently grant exclusive beat rights.
- Cancellation, rescheduling, no-show, refund and final-delivery conditions.
- File-retention policy and how a disagreement is raised.

Templates should be service-specific and configurable. Contract wording and rights
choices need owner review before launch; the app should not invent ownership
terms or represent a click as a guarantee of legal enforceability.

### Confirmation and amendments

Producer drafts a proposal → artist reviews or requests changes → producer sends
a final version → both parties explicitly accept that exact version.

Record agreement version, content hash, actor, timestamp and the verified account
used for each acceptance. Show each party's confirmation separately. Save an
immutable snapshot and readable downloadable copy; do not reconstruct an accepted
agreement from mutable profile or service settings.

Changing a draft invalidates prior draft acceptance. Changing an accepted price,
scope, deadline, revision allowance or rights term creates an amendment requiring
fresh acceptance from both parties. Preserve the original agreement and history.
A new version does not silently replace the active one. Calendar/payment changes
covered by an amendment take effect only when the amendment is confirmed and its
resource/payment requirements can be met.

Agreement states: **DRAFT → SENT → CHANGES_REQUESTED or AWAITING_ACCEPTANCE →
ACCEPTED**, with explicit EXPIRED, WITHDRAWN and SUPERSEDED outcomes. Track each
party's acceptance individually. Agreement status is independent of payment,
booking and project status.

## 4. Booking as part of a project

An artist may request a time from a public studio page or start with an inquiry.
The producer can also create a project for a client who arrived by phone or in
person, then invite them to review the agreement.

Requests alone do not reserve a room. After agreement acceptance and producer
approval, acquire a short payment hold; the required verified deposit confirms the
session. Services with no deposit can confirm immediately after the same conflict
checks. An inquiry may create a tentative project, but active production begins
only when the agreement and required payment conditions are met.

A project can have several sessions. Session completion does not automatically
complete a mixing/mastering project or mark its deliverables approved.

Availability must consider room, assigned engineer, any exclusive equipment,
confirmed sessions, active holds, blocked time, working hours and buffers.
All resources must be acquired atomically. Rescheduling acquires the replacement
allocation before releasing the original. Expired holds are released in reservation
transactions as well as by background cleanup. Late payments must never create
double bookings; conflicting captures enter a visible reconciliation workflow.

Store timestamps in UTC plus an IANA studio timezone. Show studio-local time and
clearly labelled artist-local time when different. Test daylight-saving boundaries.
Recurring bookings require per-session conflict checks and transparent exceptions.

## 5. Production and milestones

A project holds a brief, assigned people, a target completion date and milestones.
Useful templates include:

- Recording: preparation → sessions → editing → rough mix → final files.
- Mixing: source intake → first mix → revision rounds → approved mix → delivery.
- Mastering: source intake → first master → review → approved master → delivery.
- Custom production: brief → demo → arrangement → production review → final delivery.

Allow manual milestone adjustments through the agreed change process. Display
responsibility and deadlines for both parties. Internal tasks and notes are
separate from artist-visible milestones and messages.

Projects may be **AWAITING_AGREEMENT, AWAITING_PAYMENT, SCHEDULED, IN_PRODUCTION,
AWAITING_ARTIST_REVIEW, REVISION_IN_PROGRESS, READY_FOR_DELIVERY, COMPLETED,
ON_HOLD, CANCELLED or DISPUTED**. Keep payment and individual deliverable approval
states separate. A project must not imply every song is approved because one is.

## 6. Review, versions and revision rounds

The producer submits a labelled version of a specific deliverable, such as
“Song A — Mix v2”, with a change summary. Files are immutable versions; uploading
v3 never overwrites v2. Identify the latest submission and approved version clearly.

The artist can play review audio, place timestamped comments, add overall notes,
and compare or return to earlier versions. Feedback can be discussed before the
artist deliberately submits it as a revision request.

**One revision round is a submitted batch of feedback against an identified
version, not every comment or message.** Show included, used and remaining rounds.
Producer accepts the request into work, submits a replacement version and marks
which feedback items were addressed. Preserve an audit trail for corrections to
round accounting; do not silently consume a round for re-uploading a corrupt file.

When feedback changes scope or exceeds the allowance, the producer proposes a
priced change order with its delivery impact. Artist acceptance and any required
payment come before that additional work becomes committed. Existing agreed work
and payments remain visible while the change is pending.

“Approve this version” is explicit and records the version and actor. A producer
cannot approve on behalf of the artist. Silence must not automatically count as
approval unless a separately agreed policy is implemented transparently. Approved
work can be reopened through a visible amendment/change-order process.

## 7. Final delivery and completion

A review submission and a final delivery are distinct actions. Before delivery,
show a checklist of agreed items: files/formats, accepted versions, credits,
agreement, receipt and any remaining balance condition.

Final delivery creates an immutable manifest linking each deliverable to its exact
file version. Artist sees what was delivered and can download authorised files
individually; bundle downloads can be added where generation cost is manageable.
Provide a delivery acknowledgment and history. Record downloads as access events,
without treating a download alone as approval of every contractual obligation.

Use private R2 assets and short-lived download links. Apply review-preview and
final-file permissions separately; final access follows the agreed payment terms.
Do not place source sessions, stems or paid masters on public catalog URLs.
Preserve purchased/delivered assets under the documented retention policy; never
introduce automatic storage deletion as an incidental cleanup feature.

## 8. Payments and business finance

Support deposit, milestone and final-balance requests tied to the accepted scope.
An invoice can combine session charges, production work and approved extras;
issued invoice versions and receipts retain their original amounts and history.
Keep online provider-confirmed payments distinct from producer-recorded cash or
external transfers. Offline entries do not create money in the platform wallet.

Launch online collection in GHS, matching the configured merchant. Current PRO
0% platform commission is the proposed studio policy; processing charges are
separate and visible. No PRO price change is assumed by this plan.

Show **quoted value, invoiced amount, money collected, deposits held, refundable
liability, remaining balance and earnings available for payout** as distinct values.
A future-session deposit is not automatically withdrawable sale revenue. Completion,
cancellation, disputes and clearance determine eligibility under the chosen policy.

Use studio-specific payment purposes and ledgers. Do not send studio deposits
through beat-order settlement, generate beat licenses, or let the existing mature
beat-sale job clear them. Capture/replay/partial-payment/late-callback handling must
be idempotent. Refunds remain pending until the provider confirms the outcome.

The owner must choose cancellation/refund rules, dispute handling and when studio
money becomes eligible for payout before real collection launches. Scope changes
need accepted amendments; paid invoices are never silently rewritten.

## 9. Clients, collaborators and access

A studio client record contains relationship history, projects, bookings, approved
contact information and private notes. Manual contacts need not create accounts;
claiming/linking a contact to an artist requires verified identity and an invitation.

Suggested project-scoped roles:

| Role | Access |
| --- | --- |
| Studio owner | Business settings, entitlements, team, all studio work and finances |
| Studio manager | Delegated calendar/client/project operations; financial access only if granted |
| Engineer/collaborator | Assigned projects, permitted files, sessions and tasks |
| Artist/client | Their agreements, bookings, submissions, payments and delivery |

Invitations, membership changes and sensitive actions are auditable. A collaborator
must not see unrelated artists, owner payout details or every studio project.
Public pages show only published services and approved studio information. Private
notes, exact access instructions and client contacts remain protected.

Check the studio owner's active PRO entitlement on the server. On expiry, stop
new business and publishing while retaining access needed to fulfil, revise,
communicate about, settle and download existing commitments. Preserve all client,
agreement, booking and financial history. Re-subscribing restores the workspace.

## 10. Architecture and integration with BeatToday

Existing subscription checks, profiles, messaging, notifications, Paystack and R2
are foundations. Existing `producer_services`/`service_bookings` describe delivery
work and do not implement this agreement/project lifecycle. Extend with reviewed,
additive structures; never reinterpret historical rows or remove existing data.

Likely domains: studios and memberships; resources and availability; clients;
service offerings and proposals; agreements, versions and acceptances; projects,
participants and milestones; sessions/calendar allocations; deliverables and file
versions; comments and revision rounds; change orders; invoices, payments and
ledger entries; delivery manifests; notifications and audit events.

Use scoped RLS and server-side permissions, atomic resource allocation, immutable
commercial snapshots and idempotent payment/delivery operations. Share infrastructure
without merging beat-license rights, studio service terms and financial lifecycles.
Do not use user-editable profile metadata as a team or entitlement authority.

Notifications use a durable outbox. Batch reminders and deadline checks through a
shared runner, not a QStash schedule per booking or project. The current Free
allowances are shared with existing jobs and other applications. Measure storage,
audio-preview processing, mail and job consumption; keep configurable upload and
retention limits. Free infrastructure can support a constrained pilot, but capacity
for a large commercial studio workload must not be promised without measurement.

## Delivery plan and launch gates

Build vertical workflows, with a single integrated product as the launch target:

1. **Business and agreement backbone:** studio/team permissions, clients, service
   proposals, immutable agreement versions and two-party confirmation. Demonstrate
   a producer inviting an artist and reaching a confirmed scope.
2. **Project collaboration:** milestones, private versioned files, playback,
   timestamped feedback, revision rounds, change orders and explicit approval.
   Demonstrate one song progressing from first submission to approved version.
3. **Calendar and business operations:** room/engineer scheduling, booking intake,
   conflict protection, manual and recurring sessions, reminders and dashboard.
   Demonstrate several sessions linked to an ongoing project.
4. **Finance and delivery integration:** deposit/milestone/balance requests,
   provider-confirmed receipts, studio liabilities, refund/dispute handling,
   final manifests and secure downloads. Demonstrate the complete lifecycle with
   provider test mode before real collection.
5. **Integrated pilot and release:** test the entire path with studio owners and
   artists, including delays, disagreements, failed payments and subscription expiry.
   Release the agreed workspace after these workflows work together.

The user has directed a booking-first entry point. The existing agreement/project
foundation is retained: service and availability selection → request → producer
reservation → agreement acceptance → confirmed session and ongoing project.
The studio dashboard prioritises the calendar and requests; projects follow each
accepted booking rather than being the required first action.

## Definition of done

- Producer and artist see the same accepted agreement, exact version and obligations.
- Neither party can silently change accepted scope, price, rights or revision limits.
- Every submission, comment, revision round, approval and final delivery references
  the correct project, deliverable and version.
- Artists can see what is happening, what they owe and what action is needed next.
- Concurrent bookings cannot consume the same room/engineer allocation twice.
- Additional work requires an accepted change order; comments alone do not consume
  revision rounds or create charges.
- Payments reconcile safely under retries, partial captures and late callbacks;
  refundable deposits cannot accidentally become withdrawable earnings.
- Final assets remain private, complete, traceable and accessible to entitled clients.
- Team permissions, cross-studio isolation and PRO-expiry continuity are tested.
- The complete workflow works on mobile and fits measured operational budgets.

## Decisions for the next design session

Confirm the service agreement fields and commercial defaults; revision-round
policy; final approval/delivery rules; deposit and payout eligibility; cancellation
and dispute handling; initial team permissions; and practical file/storage limits.

Recommended next deliverable: screen-by-screen flows for producer and artist,
followed by a reviewed additive data model. No SQL migration, payment, refund or
asset-maintenance operation is authorized by this specification; database changes
remain subject to AGENTS.md and explicit approval of the specific operation.
