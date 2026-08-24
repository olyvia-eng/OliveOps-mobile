export class ApiError extends Error {
  status: number;
  code?: string;
  fieldId?: string;
  data?: unknown;

  constructor(message: string, status = 500, code?: string, fieldId?: string, data?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.fieldId = fieldId;
    this.data = data;
  }
}
