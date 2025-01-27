import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { prompts_agents } from '../prompts/prompts_agents.js';
import { modelOpenAi, modelGoogle } from '../llmModelsConfig.js';
import { setLastWorker, transferredToRouter, setTransferredToRouter } from './router.js';


export const createNonReActNodeHandler = (nodeName) => async (state) => {
  try {
    console.log(`Executing ${nodeName}`);
    
    const instructionKey = nodeName.replace("node_", "");
    const systemInstructions = prompts_agents[instructionKey];
    const messages = [{"role": "system", "content": systemInstructions}, ...state.messages];
    const result = await modelOpenAi.invoke(messages);
    const lastMessage = result.content;
    setTransferredToRouter(true);
    return {
      messages: [new HumanMessage({ content: lastMessage})]
    };

  } catch (error) {
    console.error(`Error in ${nodeName}:`, error);
    return {
      messages: [new SystemMessage({ content: `Error in ${nodeName}: ${error.message}` })],
      errors: error,
    };
  }
};