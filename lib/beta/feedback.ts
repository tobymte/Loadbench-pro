import { z } from 'zod';

// Beta feedback shared schemas and option lists. Used by both the API routes
// and the form components so the enum spellings stay in sync.

export const FEEDBACK_TYPES = [
  { value: 'BUG', label: 'Bug report' },
  { value: 'USABILITY', label: 'Usability feedback' },
  { value: 'FEATURE_REQUEST', label: 'Feature request' },
  { value: 'DATA_ISSUE', label: 'Data issue' },
  { value: 'SAFETY_CONCERN', label: 'Safety concern' },
  { value: 'PERFORMANCE', label: 'Performance issue' },
  { value: 'MOBILE', label: 'Mobile issue' },
  { value: 'DEPLOYMENT', label: 'Deployment / login issue' },
] as const;

export const FEEDBACK_SEVERITIES = [
  { value: 'LOW', label: 'Low' },
  { value: 'MEDIUM', label: 'Medium' },
  { value: 'HIGH', label: 'High' },
  { value: 'CRITICAL', label: 'Critical' },
] as const;

export const FEEDBACK_STATUSES = [
  { value: 'NEW', label: 'New', tone: 'accent' as const },
  { value: 'TRIAGED', label: 'Triaged', tone: 'neutral' as const },
  { value: 'IN_PROGRESS', label: 'In progress', tone: 'warning' as const },
  { value: 'BLOCKED', label: 'Blocked', tone: 'danger' as const },
  { value: 'RESOLVED', label: 'Resolved', tone: 'success' as const },
  { value: 'WONT_FIX', label: "Won't fix", tone: 'neutral' as const },
  { value: 'ARCHIVED', label: 'Archived', tone: 'neutral' as const },
] as const;

export const feedbackTypeEnum = z.enum([
  'BUG',
  'USABILITY',
  'FEATURE_REQUEST',
  'DATA_ISSUE',
  'SAFETY_CONCERN',
  'PERFORMANCE',
  'MOBILE',
  'DEPLOYMENT',
]);

export const feedbackSeverityEnum = z.enum([
  'LOW',
  'MEDIUM',
  'HIGH',
  'CRITICAL',
]);

export const feedbackStatusEnum = z.enum([
  'NEW',
  'TRIAGED',
  'IN_PROGRESS',
  'BLOCKED',
  'RESOLVED',
  'WONT_FIX',
  'ARCHIVED',
]);

// User-facing submission. Reporter identity is filled in server-side from
// the auth context when available; the form does not submit user ids.
export const feedbackCreateInput = z.object({
  title: z.string().min(3).max(240),
  type: feedbackTypeEnum,
  severity: feedbackSeverityEnum,
  pageArea: z.string().max(120).optional().nullable(),
  description: z.string().min(5).max(8000),
  stepsToReproduce: z.string().max(8000).optional().nullable(),
  expectedResult: z.string().max(2000).optional().nullable(),
  actualResult: z.string().max(2000).optional().nullable(),
  deviceBrowser: z.string().max(240).optional().nullable(),
  contactPreference: z.string().max(240).optional().nullable(),
  buildHash: z.string().max(64).optional().nullable(),
  // Anonymous email field, only used when the submission is unauthenticated.
  reporterEmail: z
    .string()
    .email()
    .max(240)
    .optional()
    .nullable()
    .or(z.literal('')),
});

export const feedbackUpdateInput = z.object({
  status: feedbackStatusEnum.optional(),
  adminNotes: z.string().max(8000).optional().nullable(),
});

export type FeedbackCreate = z.infer<typeof feedbackCreateInput>;
export type FeedbackUpdate = z.infer<typeof feedbackUpdateInput>;

export function feedbackTypeLabel(value: string): string {
  return FEEDBACK_TYPES.find((t) => t.value === value)?.label ?? value;
}

export function feedbackSeverityLabel(value: string): string {
  return FEEDBACK_SEVERITIES.find((t) => t.value === value)?.label ?? value;
}

export function feedbackStatusLabel(value: string): string {
  return FEEDBACK_STATUSES.find((t) => t.value === value)?.label ?? value;
}

export function feedbackStatusTone(
  value: string,
): 'accent' | 'neutral' | 'warning' | 'danger' | 'success' {
  return FEEDBACK_STATUSES.find((t) => t.value === value)?.tone ?? 'neutral';
}
