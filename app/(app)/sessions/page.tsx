import { Topbar } from '@/components/layout/Topbar';
import { Card, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';

// TODO(backend): fetch sessions with load + rifle joins, scoped to workspace.

export default function SessionsPage() {
  return (
    <>
      <Topbar title="Range sessions" actions={<Button>Log session</Button>} />
      <div className="flex-1 overflow-y-auto scrollbar-thin p-6 space-y-6">
        <Card>
          <CardHeader
            title="Range sessions"
            description="Record what you shot, when, where, and with what weather. Group size and chronograph data optional."
          />
          <div className="p-5">
            <EmptyState
              title="No sessions logged"
              description="Log a session to track velocity, group size, and conditions against a recorded load."
              action={<Button>Log a session</Button>}
            />
          </div>
        </Card>
      </div>
    </>
  );
}
