export class AppError extends Error {
  constructor(
    public code: string,
    message: string,
    public status = 500,
    public details?: unknown,
  ) {
    super(message);
    this.name = new.target.name;
  }
}
export class ValidationError extends AppError {
  constructor(message = "Invalid request.", details?: unknown) {
    super("VALIDATION_ERROR", message, 400, details);
  }
}
export class NotFoundError extends AppError {
  constructor(message = "Record not found.", code = "NOT_FOUND") {
    super(code, message, 404);
  }
}
export class ForbiddenError extends AppError {
  constructor(message = "You do not have access to this resource.") {
    super("FORBIDDEN", message, 403);
  }
}
export class BusinessRuleError extends AppError {
  constructor(message: string, code = "BUSINESS_RULE_VIOLATION") {
    super(code, message, 400);
  }
}
export class UnauthorizedError extends AppError {
  constructor() {
    super("UNAUTHENTICATED", "Please sign in.", 401);
  }
}
