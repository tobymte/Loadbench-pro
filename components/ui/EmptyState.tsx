export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="border border-dashed border-border rounded-lg px-8 py-12 text-center">
      <h3 className="text-sm font-medium text-text">{title}</h3>
      {description && (
        <p className="text-xs text-text-muted mt-2 max-w-md mx-auto leading-relaxed">
          {description}
        </p>
      )}
      {action && <div className="mt-5 flex justify-center">{action}</div>}
    </div>
  );
}
