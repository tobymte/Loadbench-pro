-- Workspace entitlements for Stripe-backed premium feature gating.
--
-- This migration introduces the WorkspaceEntitlement table and the
-- EntitlementStatus enum used to track Stripe subscription state per
-- workspace + feature key (e.g. "pressure_modeling").
--
-- Nothing in this migration touches load-safety validation. Premium
-- entitlement state only controls which UI surfaces are unlocked.

-- CreateEnum
CREATE TYPE "EntitlementStatus" AS ENUM (
  'INACTIVE',
  'TRIALING',
  'ACTIVE',
  'PAST_DUE',
  'CANCELED',
  'INCOMPLETE',
  'INCOMPLETE_EXPIRED',
  'UNPAID',
  'PAUSED'
);

-- CreateTable
CREATE TABLE "WorkspaceEntitlement" (
  "id"                   TEXT NOT NULL,
  "workspaceId"          TEXT NOT NULL,
  "featureKey"           TEXT NOT NULL,
  "status"               "EntitlementStatus" NOT NULL DEFAULT 'INACTIVE',
  "stripeCustomerId"     TEXT,
  "stripeSubscriptionId" TEXT,
  "stripePriceId"        TEXT,
  "currentPeriodEnd"     TIMESTAMP(3),
  "cancelAtPeriodEnd"    BOOLEAN NOT NULL DEFAULT false,
  "createdAt"            TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"            TIMESTAMP(3) NOT NULL,

  CONSTRAINT "WorkspaceEntitlement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WorkspaceEntitlement_stripeSubscriptionId_key"
  ON "WorkspaceEntitlement"("stripeSubscriptionId");

-- CreateIndex
CREATE UNIQUE INDEX "WorkspaceEntitlement_workspaceId_featureKey_key"
  ON "WorkspaceEntitlement"("workspaceId", "featureKey");

-- CreateIndex
CREATE INDEX "WorkspaceEntitlement_stripeCustomerId_idx"
  ON "WorkspaceEntitlement"("stripeCustomerId");

-- AddForeignKey
ALTER TABLE "WorkspaceEntitlement"
  ADD CONSTRAINT "WorkspaceEntitlement_workspaceId_fkey"
  FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
