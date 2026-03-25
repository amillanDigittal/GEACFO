export function FieldError({ message }: { message?: string }) {
  if (!message) return null
  return <p className="text-[11px] text-destructive mt-1">{message}</p>
}
