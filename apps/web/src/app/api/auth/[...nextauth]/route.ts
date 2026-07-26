import { handlers } from '../../../../auth';

const get = handlers.GET as unknown as (request: Request) => Promise<Response>;
const post = handlers.POST as unknown as (request: Request) => Promise<Response>;

export const GET = (request: Request) => get(request);
export const POST = (request: Request) => post(request);
