import type { output } from "zod";
import type { ImportDetail } from "./admin.model.ts";
import type {
  EnrollBulkSchema,
  EnrollImportSchema,
  EnrollSchema,
} from "./admin.validator.ts";

export type EnrollDto = output<typeof EnrollSchema>;
export type EnrollBulkDto = output<typeof EnrollBulkSchema>;
export type EnrollImportDto = output<typeof EnrollImportSchema>;

export interface BulkCounts {
  enrolled: number;
  duplicates: number;
  errors: number;
}

export interface ImportResult extends BulkCounts {
  total: number;
  details: ImportDetail[];
}
