import { z } from 'zod';

export const AgentControlInputSchema = z.strictObject({
  action: z.enum(['start', 'stop']),
  reason: z.string().optional(),
});
export type AgentControlInput = z.infer<typeof AgentControlInputSchema>;

export const RejectAgentActionInputSchema = z.strictObject({
  reason: z.string().min(5, 'Reason must be at least 5 characters'),
});
export type RejectAgentActionInput = z.infer<typeof RejectAgentActionInputSchema>;
