import type { Actor } from '@logistics/core';
import { toolNamesFor } from './registry';

export const authorizedToolNames = (actor: Actor) => toolNamesFor(actor);
