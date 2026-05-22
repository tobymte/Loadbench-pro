import { Topbar } from '@/components/layout/Topbar';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';

export default function SettingsPage() {
  return (
    <>
      <Topbar title="Settings" />
      <div className="flex-1 overflow-y-auto scrollbar-thin p-6 space-y-6">
        <Card>
          <CardHeader
            title="Workspace"
            description="Workspace details apply to every member."
          />
          <CardBody className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="ws-name">Name</label>
              <input id="ws-name" defaultValue="My workspace" />
            </div>
            <div>
              <label htmlFor="ws-slug">Slug</label>
              <input id="ws-slug" defaultValue="my-workspace" />
            </div>
            <div className="md:col-span-2">
              <Button>Save</Button>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Members"
            description="Anyone with workspace access can see and edit loads. Use Viewer for read-only access."
            actions={<Button size="sm">Invite</Button>}
          />
          <CardBody>
            <table>
              <thead>
                <tr>
                  <th>Email</th>
                  <th>Role</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>you@example.com</td>
                  <td>
                    <Badge tone="accent">OWNER</Badge>
                  </td>
                  <td />
                </tr>
              </tbody>
            </table>
            {/* TODO(backend): list WorkspaceMember rows; add invite / role-change actions */}
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Account"
            description="Connected via Clerk."
          />
          <CardBody>
            <p className="text-sm text-text-muted">
              {/* TODO(auth): wire Clerk UserButton or account-management routes */}
              Account management will appear here once Clerk is configured.
            </p>
          </CardBody>
        </Card>
      </div>
    </>
  );
}
