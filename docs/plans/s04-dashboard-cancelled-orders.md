---
validated: yes
---
# Plan - Dashboard Cancelled Order Count

## Target story

As a boutique operator, I want the dashboard to show how many orders were cancelled so I can monitor lost orders alongside total and confirmed orders.

## Scope and decisions

- Use the existing canonical order status `cancelled`; there is no separate `annulled` status in the Prisma schema or frontend API type.
- Count cancelled orders created in the dashboard's existing 30-day current window.
- Return the same `{ value, previous }` metric shape as the other dashboard statistics, with `previous` covering the preceding 30-day window.
- Label the stat card `Cancelled orders` and link it to the existing `/orders?status=cancelled` filter.
- Keep the existing dashboard response endpoint and avoid a new endpoint, database field, migration, or analytics query.

## File-by-file implementation map

- `backend/src/dashboard/dashboard.service.ts`: add a `cancelledOrders` metric query using `status: 'cancelled'`, include it in the parallel summary fetch, and return it under `stats`.
- `frontend/src/lib/api.ts`: add `cancelledOrders: Metric` to `DashboardSummary.stats` so the response contract remains typed end to end.
- `frontend/src/app/(app)/dashboard/page.tsx`: render a stat card for cancelled orders using the metric value and period-over-period change, linking to the cancelled orders list.
- `frontend/src/app/(app)/dashboard/dashboard.module.css`: adjust the stats grid breakpoint/column definition if needed so the added card remains balanced on desktop, tablet, and mobile without changing the existing card styling.
- `backend/src/dashboard/dashboard.service.spec.ts` (new, if no existing dashboard test surface is available): verify current and previous cancelled counts, boutique scoping, and the returned metric shape using the existing Nest/Prisma mocking conventions.

## Ordered implementation tasks

### Task 1: Extend the dashboard summary contract

1. Add the cancelled-order metric alongside `totalOrders` and `confirmedOrders` in `DashboardService.summary()`.
2. Reuse the existing `metric()` helper and 30-day date filters so current and previous values have identical semantics to the other stat cards.
3. Ensure the count includes only the current boutique and `status: 'cancelled'`.

### Task 2: Render the dashboard statistic

1. Extend `DashboardSummary.stats` with `cancelledOrders`.
2. Add a `Cancelled orders` `StatCard` linked to `/orders?status=cancelled`.
3. Use `formatNumber()` and `percentChange()` consistently with the existing order cards.
4. Update only the dashboard stats grid sizing required by the additional card; preserve the existing responsive behavior and card appearance.

### Task 3: Focused verification

1. Add or update a dashboard service unit test to assert both date windows, cancelled status filtering, and boutique scoping.
2. Run the focused backend dashboard test or backend test command available in the repository.
3. Run `npx tsc --noEmit` in `backend` and `frontend` to verify the response contract and JSX changes.
4. Confirm the dashboard shows the card with zero safely when there are no cancelled orders and that the link opens the existing cancelled-order filter.

## Definition of done

- The dashboard displays the number of cancelled orders for the last 30 days.
- The card shows a comparison with the previous 30-day period.
- The count is scoped to the signed-in boutique and uses the existing `cancelled` status.
- The card links to the existing cancelled orders view.
- Backend and frontend typechecks pass, and focused dashboard coverage verifies the query behavior.

## Assumption to confirm before execution

“Annulled” and “canceled” refer to the existing `cancelled` order status. If the product needs a distinct annulled status, that requires a separate domain/API decision and should not be folded into this dashboard-only change.
