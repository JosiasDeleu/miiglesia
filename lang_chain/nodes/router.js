import {modelOpenAi, modelGoogle} from '../llmModelsConfig.js';
import { z } from 'zod';
import { prompts_agents } from '../prompts/prompts_agents.js';
import { allMembers } from './agents.mjs';
import { SystemMessagePromptTemplate } from "@langchain/core/prompts";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";

export var lastWorker;
export function setLastWorker(worker){
  lastWorker = worker;
}

export var transferredToRouter = true;
export function setTransferredToRouter(transferred){
  transferredToRouter = transferred;
}

const nextAgentSchema = z.object({
    nextAgent: z.enum(allMembers).describe("The name of the agent to hand off to")
});

const prompt = SystemMessagePromptTemplate.fromTemplate(prompts_agents.router);
const formattedPrompt = await prompt.format({ members: allMembers.join(", ") });

export async function agent_router(state) {
  const lastMessage = state.messages[state.messages.length - 1];
  const messages = [formattedPrompt, new HumanMessage({ content: lastMessage.content})];
  const structuredModel = modelOpenAi.withStructuredOutput(nextAgentSchema);
  const result = await structuredModel.invoke(messages);
  return result.nextAgent;
}