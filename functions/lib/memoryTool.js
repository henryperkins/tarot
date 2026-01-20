/**
 * Memory Tool for Follow-Up Chat
 *
 * Defines the tool schema for AI-driven memory capture during follow-up
 * conversations. The AI can call this tool to save meaningful insights
 * about the user for future personalization.
 */

import { saveMemory } from './userMemory.js';

/**
 * Tool definition for Claude/Azure API
 * Compatible with Anthropic tool_use format
 */
export const MEMORY_TOOL_DEFINITION = {
  name: 'save_memory_note',
  description: `Save a durable, high-signal insight about this person for future readings. Use sparingly - only capture genuinely useful personalization data that will help provide better readings in the future. Notes are staged as session memory first and only promoted if they appear durable.

GOOD memories to save:
- Recurring themes they explore (career transitions, relationship patterns, creative blocks)
- Cards that particularly resonate with them or trigger strong reactions
- Communication preferences (prefers concrete steps vs abstract symbolism, direct vs gentle)
- Significant life context (major life transition, recent loss, starting new chapter)

DO NOT save:
- Specific predictions or outcomes
- Sensitive PII (health details, financial specifics, addresses)
- Momentary emotional states (they seemed stressed today)
- Things they mentioned only in passing or explicitly marked as temporary
- Spiritual beliefs as factual statements`,
  input_schema: {
    type: 'object',
    properties: {
      text: {
        type: 'string',
        description: 'The memory note to save. Keep it concise (1-2 sentences, max 200 characters). Write in third person ("User prefers..." not "You prefer..."). If it is explicitly temporary, prefix with "This reading only:" and consider skipping the tool.'
      },
      keywords: {
        type: 'array',
        items: { type: 'string' },
        description: 'Keywords for categorization and retrieval (max 5 single words, lowercase). Examples: career, moon, communication, transition'
      },
      category: {
        type: 'string',
        enum: ['theme', 'card_affinity', 'communication', 'life_context', 'general'],
        description: 'Memory category: theme (recurring topics), card_affinity (card resonance), communication (style preferences), life_context (current situation), general (other)'
      }
    },
    required: ['text', 'category']
  }
};

/**
 * Tool definition in OpenAI function format (for Chat Completions API)
 */
export const MEMORY_TOOL_OPENAI_FORMAT = {
  type: 'function',
  function: {
    name: MEMORY_TOOL_DEFINITION.name,
    description: MEMORY_TOOL_DEFINITION.description,
    parameters: {
      type: 'object',
      properties: {
        text: {
          type: 'string',
          description: MEMORY_TOOL_DEFINITION.input_schema.properties.text.description
        },
        keywords: {
          type: 'array',
          items: { type: 'string' },
          description: MEMORY_TOOL_DEFINITION.input_schema.properties.keywords.description
        },
        category: {
          type: 'string',
          enum: MEMORY_TOOL_DEFINITION.input_schema.properties.category.enum,
          description: MEMORY_TOOL_DEFINITION.input_schema.properties.category.description
        }
      },
      required: ['text', 'category']
    }
  }
};

/**
 * Tool definition for Azure Responses API (requires name at root level)
 */
export const MEMORY_TOOL_AZURE_RESPONSES_FORMAT = {
  type: 'function',
  name: MEMORY_TOOL_DEFINITION.name,
  description: MEMORY_TOOL_DEFINITION.description,
  parameters: {
    type: 'object',
    properties: {
      text: {
        type: 'string',
        description: MEMORY_TOOL_DEFINITION.input_schema.properties.text.description
      },
      keywords: {
        type: 'array',
        items: { type: 'string' },
        description: MEMORY_TOOL_DEFINITION.input_schema.properties.keywords.description
      },
      category: {
        type: 'string',
        enum: MEMORY_TOOL_DEFINITION.input_schema.properties.category.enum,
        description: MEMORY_TOOL_DEFINITION.input_schema.properties.category.description
      }
    },
    required: ['text', 'category']
  }
};

/**
 * Handle a memory tool call from the AI
 *
 * @param {D1Database} db
 * @param {string} userId
 * @param {string} sessionId - Reading request ID for session scoping
 * @param {Object} toolInput - The tool call arguments from AI
 * @param {string} toolInput.text
 * @param {string[]} [toolInput.keywords]
 * @param {string} toolInput.category
 * @returns {Promise<{success: boolean, message: string}>}
 */
export async function handleMemoryToolCall(db, userId, sessionId, toolInput) {
  if (!db || !userId) {
    return { success: false, message: 'Database or user not available' };
  }

  if (!toolInput?.text || !toolInput?.category) {
    return { success: false, message: 'Missing required fields: text and category' };
  }

  // Save as session-scoped memory initially
  // Will be promoted to global during consolidation if durable
  const result = await saveMemory(db, userId, {
    text: toolInput.text,
    keywords: toolInput.keywords || [],
    category: toolInput.category,
    scope: 'session',
    sessionId: sessionId,
    source: 'ai',
    confidence: 0.8 // AI-captured memories start at 0.8 confidence
  });

  if (result.saved) {
    if (result.deduplicated) {
      return { success: true, message: 'Memory already exists, confidence updated' };
    }
    return { success: true, message: 'Memory saved' };
  }

  if (result.reason === 'text_too_short') {
    return { success: false, message: 'Memory text is too short (min 3 characters)' };
  }

  return {
    success: false,
    message: result.reason === 'sensitive_content'
      ? 'Cannot save: contains sensitive content'
      : 'Failed to save memory'
  };
}

/**
 * Parse tool call from Claude API response
 *
 * Claude API returns tool_use blocks like:
 * { type: 'tool_use', id: '...', name: 'save_memory_note', input: { text: '...', ... } }
 *
 * @param {Object} toolUseBlock - The tool_use content block from Claude
 * @returns {{ name: string, id: string, input: Object } | null}
 */
export function parseToolUseBlock(toolUseBlock) {
  if (!toolUseBlock || toolUseBlock.type !== 'tool_use') {
    return null;
  }

  return {
    name: toolUseBlock.name,
    id: toolUseBlock.id,
    input: toolUseBlock.input || {}
  };
}

/**
 * Create a tool_result block for Claude API
 *
 * @param {string} toolUseId - The tool_use id to respond to
 * @param {Object} result - The result from handleMemoryToolCall
 * @returns {Object} Tool result block for Claude API
 */
export function createToolResultBlock(toolUseId, result) {
  return {
    type: 'tool_result',
    tool_use_id: toolUseId,
    content: JSON.stringify(result)
  };
}

/**
 * Instructions to add to system prompt when memory tool is available
 */
export const MEMORY_TOOL_INSTRUCTIONS = `
## MEMORY TOOL

You have access to a \`save_memory_note\` tool to remember meaningful insights about this person.

**When to use:**
- When they reveal a recurring life theme worth remembering
- When a specific card clearly resonates with them (strong reaction, repeated interest)
- When you notice a clear communication preference
- When they share significant life context that will inform future readings

**When NOT to use:**
- Don't save every detail - only truly durable, useful insights
- Don't save predictions or specific outcomes
- Don't save temporary states ("they seem stressed today")
- Don't save sensitive personal information

**How to use:**
- Write in third person: "User prefers concrete action steps" not "You prefer..."
- Keep it concise (1-2 sentences)
- Choose the most appropriate category
- Add 2-3 relevant keywords
- If the user says this is only for this reading, either skip saving or prefix the note with "This reading only:"

The tool runs silently - don't mention to the user that you're saving a memory.
`.trim();
