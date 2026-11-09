# ADR 0001 — Weekly cycle v4

Date: 2026-11-08. Status: accepted and implemented locally.

The existing bounded meal-plan JSON aggregate remains the source of meal snapshots.
Document schema 4 is independent of HTTP API version. It adds a `cycle` object:
week-only exceptions, prioritized fridge IDs, explicit cooking batches and allocations,
and inventory uncertainty. Missing batches in older documents mean one cooking per slot;
reading never migrates data or creates purchase facts from checks.

New `/v4/meal-plans` operations create/start a week with one persisted intent, preview
shopping with GET, prepare a shopping trip with POST, and preview/apply batch changes.
Trips have their own optimistic version and immutable completed history; lines keep
stable IDs, manual-source references, requirements, basket state and actual purchase.
A separate request journal stores the input and result for retry across reload/timeouts.
All writes lock the owner first, then plan/trip, verify owner/version and execute inventory
operations in the same REQUIRED transaction. Reusing a request ID with a different input
is a conflict. Request results are replayed before version checking.

Batch ingredients are scaled once by prepared portions; allocations refer to slots.
Cooked batches are excluded from future raw requirements. Eating portions only changes
allocations. Available food comes from current fridge state, never fridge plus historical
purchases. Unknown and estimated quantities require review. Revisions record an inventory
fingerprint and dependencies; changed inventory rejects apply without partial mutation.
Existing normalization, serving scaling, unit conversion and inventory operations are reused.

Legacy v2/v3 mutation routes reject schema-4 documents. Shared generation workers preserve
schema and cycle metadata. Shared persistence rejects schema downgrades. Existing documents,
checks, budget preferences and immutable old migrations are preserved. Additive migration
numbers start at V30 after existing uncommitted V27–V29.

Quantities use existing server base units (g/ml/pcs), rounded to 0.001 for requirements;
no density or raw/cooked conversion is inferred. UTC instants are used for events;
meal dates remain local dates, with Europe/Warsaw as the existing account default.

V31 adds a prepared-portion transfer ledger and `meal_plan.cycle_revision`.
Transfers create a cooked allocation in the receiving plan and count against the
source batch's free portions. Eating updates the transfer and source version in
the same transaction. Dependent allocations prevent undo of the source cooking.
Trip rows also retain selected store, department and suggested packages independently
of the quantity-dependent requirement key. Legacy revision APIs on v4 documents
use the same durable cycle preview/apply path, including current-inventory checks.

The v4 shopping-preferences read adds provenance for the saved planning mode.
Old v3 forced promotion defaults do not opt an existing user into promotion-first
planning. A consciously saved v4 choice is remembered. A reused legacy plan ID
without a matching v4 intent journal is rejected instead of migrating or replacing
that plan. Shopping-trip preparation prices current requirements using saved
eligible offers/private prices only; no live catalog fetch is needed to buy food.

Local dev recovery: V31 was observed as already applied during implementation.
Its original checksum is now fixed at 1291847981. The discarded-portion column
belongs to additive V32, not a rewrite of V31. The migration regression runs an
original V31 schema with an existing transfer row through the latest migrations
and checks preservation of its quantities and identity. Optional SMTP availability
is excluded only from the local docker profile's health check.
