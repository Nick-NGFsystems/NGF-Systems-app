-- Stripe foundation: separate one-time payments from subscriptions,
-- preserve subscription history, add webhook idempotency log.

-- 1. Drop the single-subscription-per-client constraint so history is preserved.
ALTER TABLE "subscriptions" DROP CONSTRAINT IF EXISTS "subscriptions_client_id_key";

-- 2. Track which plan key the subscription was created from.
ALTER TABLE "subscriptions" ADD COLUMN IF NOT EXISTS "plan_key" TEXT;

-- 3. Indexes for common lookups.
CREATE INDEX IF NOT EXISTS "subscriptions_client_id_idx" ON "subscriptions"("client_id");
CREATE INDEX IF NOT EXISTS "subscriptions_status_idx"    ON "subscriptions"("status");

-- 4. One-time payments table (builds, standalone fees).
CREATE TABLE IF NOT EXISTS "payments" (
    "id"                      TEXT PRIMARY KEY,
    "client_id"               TEXT NOT NULL,
    "stripe_customer_id"      TEXT,
    "stripe_checkout_session" TEXT UNIQUE,
    "stripe_payment_intent"   TEXT UNIQUE,
    "plan_key"                TEXT,
    "plan_name"               TEXT NOT NULL,
    "status"                  TEXT NOT NULL DEFAULT 'PAID',
    "amount_cents"            INTEGER NOT NULL,
    "created"                 TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated"                 TIMESTAMP(3) NOT NULL
);

CREATE INDEX IF NOT EXISTS "payments_client_id_idx" ON "payments"("client_id");
CREATE INDEX IF NOT EXISTS "payments_status_idx"    ON "payments"("status");

-- 5. Stripe webhook idempotency log.
CREATE TABLE IF NOT EXISTS "processed_stripe_events" (
    "event_id"   TEXT PRIMARY KEY,
    "event_type" TEXT NOT NULL,
    "processed"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "processed_stripe_events_event_type_idx" ON "processed_stripe_events"("event_type");
