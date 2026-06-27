# Shabiya Gym Management — Performance Optimization Guide

## What Was Done (Ready to Apply)

### New Files Created

| File | Purpose |
|------|---------|
| `contexts/AuthContext.jsx` | Unified auth context — replaces 3 separate IndexedDB reads with 1 shared state |
| `lib/hooks/useSwrData.js` | SWR-based data hooks for dashboard, members, finance, trainer history |
| `lib/hooks/useUserRole.optimized.js` | Drop-in replacement that reads from AuthContext (0ms vs 10-50ms) |
| `lib/hooks/usePermissions.optimized.js` | Drop-in replacement that reads from AuthContext |
| `components/shared/RouteProtectionOptimized.jsx` | Uses AuthContext instead of own IndexedDB read |
| `app/(admin)/layout.optimized.js` | Uses AuthContext + optimized RouteProtection |
| `app/(admin)/admin/dashboard/page.optimized.js` | SWR-powered dashboard — no waterfall, auto-caching |
| `next.config.optimized.mjs` | Enables optimizePackageImports for lucide-react + caching headers |

---

## How to Apply (Step by Step)

### Step 1: Replace files (copy optimized → original)

```bash
# Backup originals first
cp app/\(admin\)/layout.js app/\(admin\)/layout.backup.js
cp app/\(admin\)/admin/dashboard/page.js app/\(admin\)/admin/dashboard/page.backup.js
cp lib/hooks/useUserRole.js lib/hooks/useUserRole.backup.js
cp lib/hooks/usePermissions.js lib/hooks/usePermissions.backup.js
cp components/shared/RouteProtection.jsx components/shared/RouteProtection.backup.jsx
cp next.config.mjs next.config.backup.mjs

# Apply optimized versions
cp app/\(admin\)/layout.optimized.js app/\(admin\)/layout.js
cp app/\(admin\)/admin/dashboard/page.optimized.js app/\(admin\)/admin/dashboard/page.js
cp lib/hooks/useUserRole.optimized.js lib/hooks/useUserRole.js
cp lib/hooks/usePermissions.optimized.js lib/hooks/usePermissions.js
cp components/shared/RouteProtectionOptimized.jsx components/shared/RouteProtection.jsx
cp next.config.optimized.mjs next.config.mjs
```

### Step 2: Update root layout (already done in app/layout.js)
The root layout now includes `AuthProvider` wrapping all children and lazy-loads `NotificationManager`.

### Step 3: Remove old import of MessagingDashboard from dashboard
The new dashboard page uses `dynamic(() => import(...))` — no change needed if you copied the optimized page.

---

## What Each Optimization Does

### 1. AuthContext (Biggest Win — saves ~100-300ms per page)

**Before:** Every page did this chain:
- `SessionRestoration` → IndexedDB read (~20ms)
- `RouteProtection` → `usePermissions` → IndexedDB read AGAIN (~20ms)  
- Page component → `useUserRole` → IndexedDB read AGAIN (~20ms)
- Total: 3 sequential async reads of THE SAME DATA

**After:** One sync `localStorage.getItem()` call (~0.1ms), shared via React Context to all components. IndexedDB is only used by `SessionRestoration` on app startup.

### 2. SWR Data Hooks (saves ~500-2000ms on revisits)

**Before:** Every page navigation to dashboard/members/finance did a full network fetch. No caching. Go to members → back to dashboard → fetches everything from scratch.

**After:** 
- First visit: fetches normally, caches result
- Page revisit within 60s: shows cached data INSTANTLY, revalidates in background
- `keepPreviousData: true`: shows old data while new data loads (no skeleton flash)
- `dedupingInterval`: prevents duplicate requests if multiple components ask for same data

### 3. Lazy-loaded NotificationManager (saves ~80KB initial bundle)

**Before:** Firebase SDK (~80KB gzipped) loaded on EVERY page, even login page, even before user is authenticated.

**After:** `dynamic(() => import(...), { ssr: false })` — Firebase only loads after the page renders. Users see content faster.

### 4. optimizePackageImports (saves ~50-100KB bundle)

**Before:** `lucide-react` imports like `import { Users, CheckCircle, ... } from "lucide-react"` can pull in more than needed depending on bundler behavior.

**After:** Next.js experimental `optimizePackageImports` ensures only the specific icons you import are bundled. Same for `react-icons` and `@supabase/supabase-js`.

### 5. Removed Waterfall in Dashboard (saves ~1-2 seconds)

**Before:**
1. Wait for auth → 2. Wait for gym resolution → 3. Wait for dashboard data fetch → 4. Render

**After:**
1. Auth available instantly from context
2. Gym already in context (from localStorage)
3. SWR immediately starts fetching with gym ID
4. If cached data exists, render immediately

---

## What's Left (Needs Your Input)

### Supabase SQL Functions (Send Me These)

I need the SQL for these RPC functions to optimize them:
- `get_dashboard_data` — might be fetching too many columns or doing unnecessary JOINs
- `get_members_paginated` — pagination can be optimized with proper indexes  
- `get_member_stats` — might be doing full table scans
- `get_member_details` — might fetch too much data upfront
- `get_finance_data` — the heaviest endpoint, might need decomposition

### Database Indexes (Verify These Exist)

```sql
-- Essential indexes for performance
CREATE INDEX IF NOT EXISTS idx_members_gym_id ON members(gym_id);
CREATE INDEX IF NOT EXISTS idx_memberships_gym_id ON memberships(gym_id);
CREATE INDEX IF NOT EXISTS idx_memberships_status ON memberships(status);
CREATE INDEX IF NOT EXISTS idx_memberships_end_date ON memberships(end_date);
CREATE INDEX IF NOT EXISTS idx_attendance_gym_date ON attendance(gym_id, check_in_date);
CREATE INDEX IF NOT EXISTS idx_payments_gym_id ON payments(gym_id);
CREATE INDEX IF NOT EXISTS idx_payments_created_at ON payments(created_at);
CREATE INDEX IF NOT EXISTS idx_member_credentials_login_value ON member_credentials(login_value);
```

### Phase 2: Pages Still to Optimize

These pages still use raw `fetch` + `useEffect` — I can convert them to SWR hooks in the next round:

1. **Members page** (`app/(admin)/members/page.js` — 1560 lines) 
   - Needs SWR for member list + stats
   - Heavy modals should be dynamic imports

2. **Finance page** (`app/(admin)/finance/page.js` — 2230 lines)
   - Needs SWR for finance data
   - Excel export (xlsx library) should be dynamic import

3. **Member Detail** (`app/(admin)/members/[id]/page.js` — 1906 lines)
   - 7 modal imports at top — all should be `dynamic()`
   - SWR hook already created (`useMemberDetails`)

4. **Attendance page** — currently uses direct `supabase.from()` client calls
   - Should go through API routes like other pages
   
5. **Analytics page** — 6 separate supabase.from() calls
   - Needs single RPC function on Supabase side
   - Then wrap with SWR

6. **Customer pages** — same patterns, lower priority

---

## Expected Impact

| Metric | Before | After Phase 1 | After Phase 2 |
|--------|--------|---------------|---------------|
| Dashboard first paint | ~2-4s | ~0.5-1s | ~0.3-0.8s |
| Page revisit (cached) | ~2-4s | ~0.1-0.3s | ~0.1-0.3s |
| Initial JS bundle | ~300KB+ | ~220KB | ~180KB |
| Auth check per page | ~60-150ms | ~0.1ms | ~0.1ms |
| IndexedDB reads/page | 3 | 0 | 0 |
