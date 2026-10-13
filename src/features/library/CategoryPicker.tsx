export interface CategoryPickerProps {
  /** Selected category ids. */
  value: string[];
  onChange: (ids: string[]) => void;
}

/** STUB — replaced by the library worker. Multi-select chips + inline "new category". */
export function CategoryPicker({ value }: CategoryPickerProps) {
  return <div>{value.length} categories</div>;
}
