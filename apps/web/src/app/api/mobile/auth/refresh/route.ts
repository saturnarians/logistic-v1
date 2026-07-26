import { issueMobileToken, readMobileActor } from '../../../../../server/auth/mobile-jwt';

export async function POST(request: Request) {
  const actor = await readMobileActor(request);
  if (!actor) return Response.json({ error: { code: 'UNAUTHORIZED', message: 'Invalid token' } }, { status: 401 });
  return Response.json({ accessToken: await issueMobileToken(actor), expiresIn: 900 });
}
