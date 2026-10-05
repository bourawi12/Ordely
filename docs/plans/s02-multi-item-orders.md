# Implementation Plan: Multi-Item Orders (`OrderItem` Relational Migration)

**Story ID**: `s02-multi-item-orders`  
**Frontmatter**:
```yaml
validated: yes
```

---

## 1. Overview & Goals
Migrate the `Order` database model from storing a single `item` string and `quantity` number to a one-to-many `OrderItem` relation. This enables:
- True e-commerce cart support (multiple distinct products per order with individual quantities and unit prices).
- Automatic grand total calculation based on item subtotals.
- Backward compatibility for existing CSV imports and API consumers.

---

## 2. Step-by-Step Execution Tasks

### Task 1: Prisma Schema & Migration (`backend/prisma/`)
1. Add `OrderItem` model to `backend/prisma/schema.prisma`:
   ```prisma
   model OrderItem {
     id          Int     @id @default(autoincrement())
     orderId     Int
     order       Order   @relation(fields: [orderId], references: [id], onDelete: Cascade)
     productName String  @db.VarChar(150)
     quantity    Int     @default(1)
     unitPrice   Decimal @default(0) @db.Decimal(10, 3)

     @@index([orderId])
     @@map("order_items")
   }
   ```
2. Update `Order` model: add `items OrderItem[]` relation; remove single `item` and `quantity` fields.
3. Update `prisma/seed.ts` to populate `items` for seeded orders.
4. Run `npx prisma migrate dev --name add_order_items` and `npx prisma generate`.

---

### Task 2: Backend DTOs & Service (`backend/src/orders/`)
1. Create `dto/create-order-item.dto.ts` with `productName`, `quantity`, and optional `unitPrice`.
2. Update `dto/create-order.dto.ts` to validate `items: CreateOrderItemDto[]` using `@ValidateNested({ each: true })` and `@Type(() => CreateOrderItemDto)`.
3. Update `orders.service.ts`:
   - `findAll()` and `findOne()`: include `items: true` in queries.
   - `create()`: use Prisma nested `items: { create: dto.items }`. Automatically compute `total` if not explicitly passed.
   - `importCsv()`: parse CSV lines into `items: [{ productName, quantity, unitPrice }]`.
4. Update unit tests `orders.service.spec.ts`.

---

### Task 3: Backend Analytics & Dashboard (`backend/src/`)
1. Update `dashboard.service.ts` and `analytics.service.ts` to include `items` in Prisma queries where item breakdowns are queried or displayed.

---

### Task 4: Frontend API Types & Components (`frontend/src/`)
1. Update `Order` and `OrderItem` types in `frontend/src/lib/api.ts`.
2. Update `NewOrderForm.tsx` to support dynamic multi-item row inputs (Add Item / Remove Item buttons, quantity inputs, unit price inputs, live grand total calculation).
3. Update `CsvImportForm.tsx` to reflect the updated CSV format with sample template download.
4. Update Orders List (`frontend/src/app/(app)/orders/page.tsx`) to render concise item chips/badges (e.g. `2x Robe Silk`, `1x Sac Noir`).

---

## 3. Verification Plan

- [ ] **Database & Migrations**: `npx prisma migrate dev` completes with code 0.
- [ ] **Backend Compilation**: `npx tsc --noEmit` in `backend` exits with 0 errors.
- [ ] **Backend Unit Tests**: `npm test` passes all unit test suites.
- [ ] **Frontend Compilation**: `npx tsc --noEmit` in `frontend` exits with 0 errors.
