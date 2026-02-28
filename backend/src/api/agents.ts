/**
 * Agents API Routes
 */

import { Hono } from 'hono';
import { z } from 'zod';
import type { AgentStatus, AgentResponse, ApiResponse } from '../core/types';
import { AgentManager } from '../agents/manager';
import { agentToggleSchema } from './schemas';

export const agentRoutes = new Hono();

const agentManager = new AgentManager();

// Get all agents status
agentRoutes.get('/', async (c) => {
  const start = Date.now();
  
  const agents = agentManager.getAllAgents();
  
  return c.json<ApiResponse<AgentStatus[]>>({
    success: true,
    data: agents,
    meta: {
      timestamp: new Date().toISOString(),
      requestId: crypto.randomUUID(),
      processingTimeMs: Date.now() - start,
    },
  });
});

// Get specific agent status
agentRoutes.get('/:id', async (c) => {
  const start = Date.now();
  const id = c.req.param('id');
  
  const agent = agentManager.getAgent(id);
  
  if (!agent) {
    return c.json<ApiResponse<null>>({
      success: false,
      error: {
        code: 'NOT_FOUND',
        message: `Agent ${id} not found`,
      },
      meta: {
        timestamp: new Date().toISOString(),
        requestId: crypto.randomUUID(),
        processingTimeMs: Date.now() - start,
      },
    }, 404);
  }
  
  return c.json<ApiResponse<AgentStatus>>({
    success: true,
    data: agent,
    meta: {
      timestamp: new Date().toISOString(),
      requestId: crypto.randomUUID(),
      processingTimeMs: Date.now() - start,
    },
  });
});

// Enable/Disable agent
agentRoutes.post('/:id/toggle', async (c) => {
  const start = Date.now();
  const id = c.req.param('id');
  
  let body: z.infer<typeof agentToggleSchema>;
  try {
    body = agentToggleSchema.parse(await c.req.json());
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json<ApiResponse<null>>({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: error.errors.map(e => e.message).join('; ') },
      }, 400);
    }
    return c.json<ApiResponse<null>>({
      success: false,
      error: { code: 'INVALID_REQUEST', message: 'Invalid request body' },
    }, 400);
  }
  
  try {
    const agent = agentManager.toggleAgent(id, body.enabled);
    
    return c.json<ApiResponse<AgentStatus>>({
      success: true,
      data: agent,
      meta: {
        timestamp: new Date().toISOString(),
        requestId: crypto.randomUUID(),
        processingTimeMs: Date.now() - start,
      },
    });
  } catch (error) {
    return c.json<ApiResponse<null>>({
      success: false,
      error: {
        code: 'TOGGLE_ERROR',
        message: error instanceof Error ? error.message : 'Failed to toggle agent',
      },
      meta: {
        timestamp: new Date().toISOString(),
        requestId: crypto.randomUUID(),
        processingTimeMs: Date.now() - start,
      },
    }, 500);
  }
});

// Get agent decision history
agentRoutes.get('/:id/history', async (c) => {
  const start = Date.now();
  const id = c.req.param('id');
  const limit = parseInt(c.req.query('limit') || '50');
  
  const history = agentManager.getAgentHistory(id, limit);
  
  return c.json<ApiResponse<AgentResponse[]>>({
    success: true,
    data: history,
    meta: {
      timestamp: new Date().toISOString(),
      requestId: crypto.randomUUID(),
      processingTimeMs: Date.now() - start,
    },
  });
});

// Test agent with sample data
agentRoutes.post('/:id/test', async (c) => {
  const start = Date.now();
  const id = c.req.param('id');
  const body = await c.req.json();
  
  try {
    const result = await agentManager.testAgent(id, body);
    
    return c.json<ApiResponse<AgentResponse>>({
      success: true,
      data: result,
      meta: {
        timestamp: new Date().toISOString(),
        requestId: crypto.randomUUID(),
        processingTimeMs: Date.now() - start,
      },
    });
  } catch (error) {
    return c.json<ApiResponse<null>>({
      success: false,
      error: {
        code: 'TEST_ERROR',
        message: error instanceof Error ? error.message : 'Failed to test agent',
      },
      meta: {
        timestamp: new Date().toISOString(),
        requestId: crypto.randomUUID(),
        processingTimeMs: Date.now() - start,
      },
    }, 500);
  }
});
