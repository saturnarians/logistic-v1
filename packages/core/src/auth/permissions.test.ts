import { describe, expect, it } from 'bun:test';
import { CAPABILITIES, can, type Actor } from './permissions';

const roles = ['PUBLIC', 'AGENT', 'DRIVER', 'MANAGER', 'ADMIN', 'SUPER_ADMIN'] as const;

describe('packages/core permissions', () => {
  it('checks capabilities correctly according to matrix', () => {
    const publicActor: Actor = { id: '1', role: 'PUBLIC' };
    const agentActor: Actor = { id: '2', role: 'AGENT' };
    const managerActor: Actor = { id: '3', role: 'MANAGER' };

    expect(can(publicActor, 'shipment:quote')).toBe(true);
    expect(can(publicActor, 'shipment:create')).toBe(false);

    expect(can(agentActor, 'shipment:create')).toBe(true);
    expect(can(agentActor, 'flag:approve')).toBe(false);

    expect(can(managerActor, 'flag:approve')).toBe(true);
  });
});

describe('capability matrix', () => {
  it('allows exactly the roles declared for every capability', () => {
    for (const [capability, allowedRoles] of Object.entries(CAPABILITIES)) {
      for (const role of roles) {
        const actor: Actor = { id: role, role };
        expect(can(actor, capability as keyof typeof CAPABILITIES)).toBe((allowedRoles as readonly Actor['role'][]).includes(role));
      }
    }
  });
});
