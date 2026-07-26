export class AppError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status = 400,
  ) {
    super(message);
  }
}

export const forbidden = (message = 'You do not have permission to perform this action') =>
  new AppError('FORBIDDEN', message, 403);

export const notFound = (message = 'Resource not found') => new AppError('NOT_FOUND', message, 404);
