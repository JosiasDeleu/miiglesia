import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { Command } from "@langchain/langgraph";
import { prompts_agents } from '../prompts/prompts_agents.js';
import { 
  agent_registerAttendance, 
  agent_createMember, 
  agent_updateMember, 
  agent_reports, 
  agent_createMinisterio,
  agent_updateMinisterio,
  agent_linkMemberToMinisterio,
  agent_linkFamilyMembers,
  agent_linkMemberToSeguimiento,
  agent_createActivity,
  agent_registerMembersAttendance,
  agent_removeActivity,
  agent_updateActivity
} from './agents.mjs';
import { setLastWorker, transferredToRouter, setTransferredToRouter } from './router.js';

export const createReActNodeHandler = (nodeName) => async (state, config) => {
  try {
    console.log(`Executing ${nodeName}`);
    
    const agent = eval(nodeName.replace("node_", "agent_"));
    const { messages } = state;
    let updatedMessages = [...messages];
    const instructionKey = nodeName.split('_')[1];
    updatedMessages.unshift(new SystemMessage(`
      Respond to the conversation below following these instructions:
      <instructions>
      ${prompts_agents[instructionKey]}

      If the user requests is not related to your function (e.g., 'you are the createMember agent, and the user asks to create a new church'), use the tool 'handoff_to_supervisor' to forward the question to the supervisor and respond "---".
      Reply always in the language of the user.
      </instructions>`));

    const result = await agent.invoke({ messages: updatedMessages }, config);

    const lastMessage = result.messages[result.messages.length - 1];
    const previousMessage = result.messages[result.messages.length - 2];

    if(previousMessage.tool_call_id){
      const toolName = previousMessage.name;

      if(toolName.startsWith("handoff")){
        setTransferredToRouter(true);
        let goto = toolName.replace("handoff_", "");
        console.log(`----------- Transferring to ${goto} -----------`)
        let aiMsg = {role: "human", content: previousMessage.content};
        return new Command({goto, update: { "messages": [aiMsg] } });
      }

      else if(toolName.startsWith("success")){
        setTransferredToRouter(true);
        let goto = "node_nextStepsSuggestions";
        console.log(`----------- Transferring to ${goto} -----------`)
        let aiMsg = {role: "human", content: lastMessage.content};
        return new Command({goto, update: { "messages": [aiMsg] } });
      }
    } 
    
    return {
      messages: [new HumanMessage({ content: lastMessage.content})], //, name: nodeName 
    };

  } catch (error) {
    console.error(`Error in ${nodeName}:`, error);
    return {
      messages: [new SystemMessage({ content: `Error in ${nodeName}: ${error.message}` })],
      errors: error,
    };
  }
};
