-- Beta feedback & issue tracker.
--
-- Additive migration. Adds three enums and one table. Touches no existing
-- table or column. Safe to apply against any in-place database.
--
-- Safety: this table captures user-submitted feedback only. A SAFETY_CONCERN
-- type exists so testers can flag perceived safety problems, but the app
-- does not process those rows into advice, pressure estimates, charge
-- recommendations, or safe/unsafe verdicts. Admin triage is human-only.

-- CreateEnum: BetaFeedbackType.
CREATE TYPE "BetaFeedbackType" AS ENUM (
  'BUG',
  'USABILITY',
  'FEATURE_REQUEST',
  'DATA_ISSUE',
  'SAFETY_CONCERN',
  'PERFORMANCE',
  'MOBILE',
  'DEPLOYMENT'
);

-- CreateEnum: BetaFeedbackSeverity.
CREATE TYPE "BetaFeedbackSeverity" AS ENUM (
  'LOW',
  'MEDIUM',
  'HIGH',
  'CRITICAL'
);

-- CreateEnum: BetaFeedbackStatus.
CREATE TYPE "BetaFeedbackStatus" AS ENUM (
  'NEW',
  'TRIAGED',
  'IN_PROGRESS',
  'BLOCKED',
  'RESOLVED',
  'WONT_FIX',
  'ARCHIVED'
);

-- CreateTable: BetaFeedbackIssue.
CREATE TABLE "BetaFeedbackIssue" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT,
  "reporterUserId" TEXT,
  "reporterEmail" TEXT,
  "reporterDisplay" TEXT,
  "title" TEXT NOT NULL,
  "type" "BetaFeedbackType" NOT NULL DEFAULT 'BUG',
  "severity" "BetaFeedbackSeverity" NOT NULL DEFAULT 'MEDIUM',
  "status" "BetaFeedbackStatus" NOT NULL DEFAULT 'NEW',
  "pageArea" TEXT,
  "description" TEXT NOT NULL,
  "stepsToReproduce" TEXT,
  "expectedResult" TEXT,
  "actualResult" TEXT,
  "deviceBrowser" TEXT,
  "contactPreference" TEXT,
  "adminNotes" TEXT,
  "buildHash" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "BetaFeedbackIssue_pkey" PRIMARY KEY ("id")
);

-- CreateIndex.
CREATE INDEX "BetaFeedbackIssue_workspaceId_status_idx" ON "BetaFeedbackIssue"("workspaceId", "status");
CREATE INDEX "BetaFeedbackIssue_status_idx" ON "BetaFeedbackIssue"("status");
CREATE INDEX "BetaFeedbackIssue_type_idx" ON "BetaFeedbackIssue"("type");
CREATE INDEX "BetaFeedbackIssue_severity_idx" ON "BetaFeedbackIssue"("severity");
CREATE INDEX "BetaFeedbackIssue_createdAt_idx" ON "BetaFeedbackIssue"("createdAt");

-- AddForeignKey.
ALTER TABLE "BetaFeedbackIssue" ADD CONSTRAINT "BetaFeedbackIssue_workspaceId_fkey"
  FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "BetaFeedbackIssue" ADD CONSTRAINT "BetaFeedbackIssue_reporterUserId_fkey"
  FOREIGN KEY ("reporterUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
