import { Topbar } from '@/components/layout/Topbar';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';

export default function NotebookPage() {
  return (
    <>
      <Topbar title="Notebook" />
      <div className="flex-1 overflow-y-auto scrollbar-thin p-6 space-y-6">
        <Card>
          <CardHeader
            title="Reloading notebook"
            description="A chronological journal of everything you did at the bench and on the range — components, charges, OAL, primers, weather, and what you observed."
          />
          <CardBody>
            <p className="text-sm text-text-muted leading-relaxed max-w-2xl">
              The notebook view aggregates Loads and Range Sessions into one
              timeline. Use it to review your work-up history at a glance and
              to spot pressure-sign patterns across temperature, lot changes,
              or seating depth.
            </p>
            {/* TODO(backend): paginate combined Load + RangeSession events ordered by date */}
          </CardBody>
        </Card>
      </div>
    </>
  );
}
