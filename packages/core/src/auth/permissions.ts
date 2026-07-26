import type { Role } from '@logistics/shared';

export interface Actor {
  id: string;
  role: Role;
}

export const CAPABILITIES = {
  'shipment:quote': ['PUBLIC', 'AGENT', 'MANAGER', 'ADMIN', 'SUPER_ADMIN'],
  'shipment:create': ['AGENT', 'MANAGER', 'ADMIN', 'SUPER_ADMIN'],
  'shipment:update': ['AGENT', 'MANAGER', 'ADMIN', 'SUPER_ADMIN'],
  'shipment:cancel': ['AGENT', 'MANAGER', 'ADMIN', 'SUPER_ADMIN'],
  'shipment:track': ['PUBLIC', 'AGENT', 'DRIVER', 'MANAGER', 'ADMIN', 'SUPER_ADMIN'],
  'shipment:flag': ['PUBLIC', 'AGENT', 'MANAGER', 'ADMIN', 'SUPER_ADMIN'],
  'shipment:location:update': ['DRIVER', 'MANAGER', 'ADMIN', 'SUPER_ADMIN'],
  'shipment:view:all': ['MANAGER', 'ADMIN', 'SUPER_ADMIN'],
  'flag:approve': ['MANAGER', 'ADMIN', 'SUPER_ADMIN'],
  'flag:reject': ['MANAGER', 'ADMIN', 'SUPER_ADMIN'],
  'driver:reassign': ['MANAGER', 'ADMIN', 'SUPER_ADMIN'],
  'user:manage': ['ADMIN', 'SUPER_ADMIN'],
  'pricing:override': ['ADMIN', 'SUPER_ADMIN'],
  'admin:manage': ['SUPER_ADMIN'],
  'system:config': ['SUPER_ADMIN'],
  'agent:control': ['ADMIN', 'SUPER_ADMIN'],
  'agent:action:review': ['MANAGER', 'ADMIN', 'SUPER_ADMIN'],
} as const satisfies Record<string, readonly Role[]>;

export type Capability = keyof typeof CAPABILITIES;

export function can(actor: Actor, cap: Capability): boolean {
  const allowedRoles = CAPABILITIES[cap] as readonly Role[];
  return allowedRoles.includes(actor.role);
}
