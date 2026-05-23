-- BigCommerce entitlement fields. Stripe columns remain so legacy rows are
-- preserved; new code paths populate the BigCommerce columns.

ALTER TABLE "WorkspaceEntitlement"
  ADD COLUMN "bigcommerceOrderId"       TEXT,
  ADD COLUMN "bigcommerceCartId"        TEXT,
  ADD COLUMN "bigcommerceCustomerId"    TEXT,
  ADD COLUMN "bigcommerceCustomerEmail" TEXT;

CREATE UNIQUE INDEX "WorkspaceEntitlement_bigcommerceOrderId_key"
  ON "WorkspaceEntitlement"("bigcommerceOrderId");

CREATE INDEX "WorkspaceEntitlement_bigcommerceCustomerId_idx"
  ON "WorkspaceEntitlement"("bigcommerceCustomerId");

CREATE INDEX "WorkspaceEntitlement_bigcommerceCustomerEmail_idx"
  ON "WorkspaceEntitlement"("bigcommerceCustomerEmail");
