import { Topbar } from '@/components/layout/Topbar';
import { LoadForm } from '@/components/forms/LoadForm';

export default function NewLoadPage() {
  return (
    <>
      <Topbar title="New load" />
      <div className="flex-1 overflow-y-auto scrollbar-thin p-6">
        <div className="max-w-4xl mx-auto">
          <LoadForm />
        </div>
      </div>
    </>
  );
}
