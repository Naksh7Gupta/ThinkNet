import { useDesignerStore } from "@/store/designer-store";

export function IssuesPanel() {
  const validation = useDesignerStore((s) => s.lastValidation);
  const lastError = useDesignerStore((s) => s.lastError);
  const lastNote = useDesignerStore((s) => s.lastNote);
  const shapeNote = useDesignerStore((s) => s.lastShapePreview?.note);
  const note = lastNote ?? shapeNote;

  const errors = [
    ...(lastError ? [lastError.split("\n")].flat() : []),
    ...(validation && !validation.valid ? validation.errors : []),
  ];

  return (
    <div className="h-28 border-t border-border bg-card px-4 py-2">
      <div className="mb-1 flex items-center justify-between text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        <span>Backend results</span>
        {validation?.valid && <span className="normal-case tracking-normal text-success">Graph valid</span>}
      </div>
      <div className="h-[72px] overflow-auto text-[12px] leading-5">
        {errors.length === 0 && !note && (
          <p className="text-muted-foreground">
            Validate, preview shapes, compile, or export to see actual backend responses here.
          </p>
        )}
        {errors.map((error) => (
          <div key={error} className="text-destructive">
            {error}
          </div>
        ))}
        {note && errors.length === 0 && <p className="text-muted-foreground">{note}</p>}
      </div>
    </div>
  );
}
