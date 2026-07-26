import { authenticateCredentials } from '@logistics/core';
import { LoginInputSchema } from '@logistics/shared';
import { requestBody } from '../../../../../lib/api';
import { issueMobileToken } from '../../../../../server/auth/mobile-jwt';

export async function POST(request: Request) {
  const parsed = LoginInputSchema.safeParse(await requestBody(request));
  if (!parsed.success) return Response.json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid credentials' } }, { status: 400 });
  const user = await authenticateCredentials(parsed.data.email, parsed.data.password);
  if (!user) return Response.json({ error: { code: 'UNAUTHORIZED', message: 'Invalid credentials' } }, { status: 401 });
  return Response.json({ accessToken: await issueMobileToken({ id: user.id, role: user.role }), expiresIn: 900 });
}
