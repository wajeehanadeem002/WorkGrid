export function FieldError({
  errors,
  id,
}: {
  errors?: string[] | undefined;
  id: string;
}) {
  if (!errors?.length) return null;
  return (
    <p id={id} className="field-error">
      {errors[0]}
    </p>
  );
}
