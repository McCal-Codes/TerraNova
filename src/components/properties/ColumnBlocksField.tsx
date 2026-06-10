import {
  readColumnBlocks,
  writeColumnBlocks,
  type WeightedAssignmentEntry,
} from "@/utils/weightedAssignmentSummary";
import { ColumnBlocksList } from "./ColumnBlocksList";

interface ColumnBlocksFieldProps {
  entry: WeightedAssignmentEntry;
  onChange: (next: WeightedAssignmentEntry) => void;
  onBlur: () => void;
}

export function ColumnBlocksField({ entry, onChange, onBlur }: ColumnBlocksFieldProps) {
  const blocks = readColumnBlocks(entry);

  return (
    <ColumnBlocksList
      blocks={blocks}
      onChange={(nextBlocks) => onChange(writeColumnBlocks(entry, nextBlocks))}
      onBlur={onBlur}
    />
  );
}
