import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import { Command } from "@langchain/langgraph";
import { HumanMessage, ToolMessage } from "@langchain/core/messages";

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
const handoff_to_human = tool(async (input,config) => {

    const { questionToUser } = input;

    const tool_message = {
        "role": "tool",
        "content": "Successfully transferred to human",
        "name": config.toolCall.name,
        "tool_call_id": config.toolCall.id,
    }

    return new Command({
        // this is the state update
        update: {
            messages: [
                new ToolMessage({
                  content: questionToUser,
                  name: "handoff_node_human",
                  tool_call_id: config.toolCall.id
                }),
              ],
        //   messages: [tool_message],
        //   messages: [new HumanMessage({ content: questionToUser}), tool_message],
        },
        goto: "node_human",
        // graph: Command.PARENT
      });

}, {
    name: 'handoff_to_human',
    description: 'Returns the question to the user',
    schema: z.object({
        questionToUser: z.string().describe("The question to ask the user"),
    }),
    verbose: true
});

export default handoff_to_human;