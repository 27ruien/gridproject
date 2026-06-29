export type ScheduleFileTask = {
  model?: string;
  name?: string;
  owners?: string[];
  startDate?: string;
  dueDate?: string;
  workdays?: number;
  status?: string;
  category?: string;
  color?: string;
};

export type ScheduleFileResult = {
  tasks: ScheduleFileTask[];
  phases?: unknown[];
  warnings: string[];
  errors: Array<{ code: string; message: string }>;
  fileName?: string;
  sheetName?: string;
  detectedHeaders?: string[];
  missingRequiredFields?: string[];
  rowErrors?: Array<{ rowNumber: number | string; message: string }>;
};

export function parseScheduleFile(file: File): Promise<ScheduleFileResult>;
