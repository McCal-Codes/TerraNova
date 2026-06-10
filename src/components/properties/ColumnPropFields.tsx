import {
  readPropColumnBlocks,
  readPropColumnScanner,
  writePropColumnBlocks,
  writePropColumnScanner,
} from "@/utils/columnPropHelpers";
import { ColumnBlocksList } from "./ColumnBlocksList";
import { ColumnScannerField } from "./ColumnScannerField";

interface ColumnPropFieldsProps {
  prop: Record<string, unknown>;
  onChange: (next: Record<string, unknown>) => void;
  onBlur: () => void;
}

export function ColumnPropFields({ prop, onChange, onBlur }: ColumnPropFieldsProps) {
  const blocks = readPropColumnBlocks(prop);
  const scanner = readPropColumnScanner(prop);

  return (
    <div className="flex flex-col gap-2">
      <ColumnBlocksList
        blocks={blocks}
        onChange={(nextBlocks) => onChange(writePropColumnBlocks(prop, nextBlocks))}
        onBlur={onBlur}
      />
      {scanner && (
        <ColumnScannerField
          scanner={scanner}
          onChange={(nextScanner) => onChange(writePropColumnScanner(prop, nextScanner))}
          onBlur={onBlur}
        />
      )}
    </div>
  );
}
