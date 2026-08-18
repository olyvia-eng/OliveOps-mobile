export class ApiError extends Error {
  status: number;
  code?: string;
  fieldId?: string;

  constructor(message: string, status = 500, code?: string, fieldId?: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.fieldId = fieldId;
  }
}
