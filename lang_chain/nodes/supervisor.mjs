import { MemorySaver } from "@langchain/langgraph";
import { START, END, Annotation, StateGraph, messagesStateReducer, Command} from "@langchain/langgraph";
import { reActMembers, nonReActMembers, otherNodes, allMembers } from './agents.mjs';
import { node_nextStepsSuggestions } from './nextStepsSuggestions.js';
import { agent_router, lastWorker,setLastWorker, transferredToRouter, setTransferredToRouter } from './router.js';
import { createReActNodeHandler } from './createReActNodeHandler.js';
import { createNonReActNodeHandler } from './createNonReActNodeHandler.js';

const AgentState = Annotation.Root({
  messages: Annotation({
    reducer: messagesStateReducer,
    default: () => [],
  }),
  errors: Annotation({
    reducer: (curr, next) => [...(curr || []), next],
    default: () => [],
  })
});

var nextWorker;

async function router(state) {
  console.log("Executing router. Last worker:", lastWorker);

  // Adding the ad-hoc logic so the process always goes through to the router after generating a report
  if (lastWorker === "node_reports") {
    setLastWorker("router");
    setTransferredToRouter(true);
  }

  if (transferredToRouter) {
    const result = await agent_router(state);
    nextWorker = result;
    // if (lastWorker === result) {
    //   // throw new Error("Router stuck in a loop");
    //   console.error("Router stuck in a loop");
    //   nextWorker = "node_generalHelp";
    // }

    setLastWorker(result);
  } else{
    nextWorker = lastWorker;
  }
  setTransferredToRouter(false);

  // Estos nodos no tienen la tool para derivar preguntas a otros agentes
  // if(nextWorker === "node_generalHelp" || nextWorker === "node_unrelatedQuestions"){
  //   setLastWorker("router");
  // }

  return new Command({
      goto: nextWorker,
      update: {
        "messages": 
          state.messages}
  });
}

const workflow = new StateGraph(AgentState)
.addNode("router", router, {
  ends: [...allMembers]
})
.addEdge(START, "router", () => {
  console.log("Edge followed: START -> router");
});
reActMembers.forEach(member => {
  workflow.addNode(member, createReActNodeHandler(member), {
    ends: ["router",END]
  })
});
otherNodes.forEach(member => {
  workflow.addNode(member, eval(member), {
    ends: ["router",END]
  })
});
nonReActMembers.forEach(member => {
  workflow.addNode(member, createNonReActNodeHandler(member), {
    ends: ["router",END]
  })
});

const memory = new MemorySaver();

export const graph = workflow.compile({
  checkpointer: memory,
});