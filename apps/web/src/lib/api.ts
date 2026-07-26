import { AppError } from '@logistics/core';

export function jsonError(error: unknown) {
  if (error instanceof AppError) {
    return Response.json({ error: { code: error.code, message: error.message } }, { status: error.status });
  }
  return Response.json({ error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' } }, { status: 500 });
}

export async function requestBody(request: Request) {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

export function clientKey(request: Request, actorId: string) {
  return actorId === 'public' ? request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'public' : actorId;
}
