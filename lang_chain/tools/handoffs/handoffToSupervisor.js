import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import { Command } from "@langchain/langgraph";
import { ToolMessage } from "@langchain/core/messages";

/**
 * Handoff control to another agent within the system.
 * @async
 * @function handoffToAgent
 * @param {Object} input - The input parameters.
 * @param {string} input.agent_name - The name of the agent to hand off to.
 * @param {Object} [input.state_update] - Optional state updates to pass to the target agent.
 * @returns {Promise<Command>} A command directing the handoff.
 * @throws {Error} If the agent name is invalid or the handoff fails.
 */
const HandoffToSupervisor = tool(async ({question_to_user},config) => {
  console.log('[[[ TOOL ]]] HandoffToSupervisor input:', JSON.stringify(question_to_user));

    return new Command({
        update: {
            messages: [
                new ToolMessage({
                  content: question_to_user,
                  name: "handoff_router",
                  tool_call_id: config.toolCall.id
                }),
              ],
        }
      });

}, {
    name: 'handoff_to_supervisor',
    description: 'Tool to handoff the user question to the supervisor. Use it when the agent cannot handle the user request.',
    schema: z.object({
        question_to_user: z.string().describe(`A summary of the user question. 
          Do not add any additional details, just the question. 
          For instance: 'Crear ministerio' or 'Actualizar miembro' or 'Eliminar actividad' or 'Tomar asistencia'.`),
    }),
    verbose: true
});

export default HandoffToSupervisor;