import { Topbar } from '@/components/layout/Topbar';
import { Card, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { Badge } from '@/components/ui/Badge';

// TODO(backend): fetch components grouped by kind for the current workspace.
const KINDS: Array<{
  kind: 'BULLET' | 'POWDER' | 'PRIMER' | 'CASE';
  label: string;
  hint: string;
}> = [
  { kind: 'BULLET', label: 'Bullets', hint: 'Manufacturer, model, weight, BC' },
  { kind: 'POWDER', label: 'Powders', hint: 'Manufacturer, label, lot' },
  { kind: 'PRIMER', label: 'Primers', hint: 'Manufacturer, model' },
  { kind: 'CASE', label: 'Cases', hint: 'Manufacturer, headstamp, lot' },
];

export default function ComponentsPage() {
  return (
    <>
      <Topbar title="Components" actions={<Button>New component</Button>} />
      <div className="flex-1 overflow-y-auto scrollbar-thin p-6 space-y-6">
        <Card>
          <CardHeader
            title="Component inventory"
            description="Track each lot of each component. Lot numbers matter — record them when you record a session."
          />
          <div className="p-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {KINDS.map((k) => (
                <div
                  key={k.kind}
                  className="rounded-md border border-border bg-bg-alt p-4 flex items-center"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-text">
                        {k.label}
                      </span>
                      <Badge>{k.kind}</Badge>
                    </div>
                    <div className="text-xs text-text-muted mt-1">{k.hint}</div>
                  </div>
                  <Button size="sm" variant="secondary" className="ml-auto">
                    Add {k.kind.toLowerCase()}
                  </Button>
                </div>
              ))}
            </div>
            <div className="mt-6">
              <EmptyState
                title="No components recorded yet"
                description="Start by adding the bullets, powders, primers, and cases you have on hand."
              />
            </div>
          </div>
        </Card>
      </div>
    </>
  );
}
