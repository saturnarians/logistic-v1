import type { Actor } from '@logistics/core';

export const PUBLIC_TOOLS = ['getQuote', 'trackShipment', 'flagShipment'] as const;
const AGENT_TOOLS = ['createShipment', 'updateShipment', 'cancelShipment'] as const;
const DRIVER_TOOLS = ['updateLocation', 'viewAssignedShipments'] as const;
const MANAGER_TOOLS = ['approveFlag', 'rejectFlag', 'reassignDriver', 'viewAllShipments'] as const;

export function toolNamesFor(actor: Actor): readonly string[] {
  switch (actor.role) {
    case 'PUBLIC': return PUBLIC_TOOLS;
    case 'AGENT': return [...PUBLIC_TOOLS, ...AGENT_TOOLS];
    case 'DRIVER': return [...PUBLIC_TOOLS, ...DRIVER_TOOLS];
    case 'MANAGER': case 'ADMIN': case 'SUPER_ADMIN': return [...PUBLIC_TOOLS, ...AGENT_TOOLS, ...DRIVER_TOOLS, ...MANAGER_TOOLS];
  }
}
