import {graph} from "./nodes/supervisor.mjs";
import { HumanMessage } from "@langchain/core/messages";
import { setLastWorker, setTransferredToRouter } from './nodes/router.js';

export var lastSessionId;

function sanitizeInput(input) {
  // Replace tabs with spaces and trim
  input = input.replace(/\t/g, ' ').trim();
  // Normalize multiple spaces to single space
  input = input.replace(/\s+/g, ' ');
  return input;
}

const keyWords = ['$$','###']

export const streamSupervisor = async function* (mensajeEntrada, sessionId) {
  console.log("streamSupervisor -> sessionId:", sessionId);
  const sanitizedInput = sanitizeInput(mensajeEntrada);
  
  if(sessionId !== lastSessionId){
    console.log("Updating lastWorker to router");
    setLastWorker("router");
    setTransferredToRouter(true);
    lastSessionId = sessionId;
  }

  let buffer = '';
  let isBuffering = false;
  let currentKeyWord = '';

  try {
    let eventStream = await graph.streamEvents(
      { messages: [new HumanMessage(sanitizedInput)] },
      { 
        version: "v2",
        configurable: { thread_id: sessionId}, 
        streamMode: "messages",
        recursionLimit: 30
      }
    );

    for await (const { event, data } of eventStream) {
      if (event === "on_chat_model_stream" && data.chunk.content) {
        const content = data.chunk.content;
        
        // Check for keywords in the content
        const foundKeyWord = keyWords.find(kw => content.includes(kw));
        
        if (foundKeyWord) {
          if (!isBuffering) {
            // Start buffering
            isBuffering = true;
            currentKeyWord = foundKeyWord;
            // buffer = content.split(foundKeyWord)[1] || '';
            buffer = content;
          } else if (foundKeyWord === currentKeyWord) {
            // End buffering and yield the complete buffered content
            const finalContent = buffer + content;
            yield finalContent;
            buffer = '';
            isBuffering = false;
            currentKeyWord = '';
            
            // Handle any remaining content after the closing keyword
            const remainingContent = content.split(foundKeyWord)[1];
            if (remainingContent) yield remainingContent;
          } else {
            // Different keyword found while buffering, add to buffer
            buffer += content;
          }
        } else if (isBuffering) {
          // Add to buffer while in buffering mode
          buffer += content;
        } else {
          // Normal output when not buffering
          yield content;
        }
      }
    }
  } catch (error) {
    console.error("Supervisor stream failed:", error);
    throw new Error(`Supervisor stream failed: ${error.message}`);
  }
};

// export const streamSupervisor2 = async function* (mensajeEntrada, sessionId) {
//   try {
//     let eventStream = await graph.stream(
//       { messages: [new HumanMessage(mensajeEntrada)] },
//       { 
//         // version: "v2",
//         configurable: { thread_id: sessionId }, 
//         subgraphs: true
//         // streamMode: "updates"
//       }
//     );
//     for await (const output of eventStream) {
//       if (!output?.__end__) {
//         console.log(JSON.stringify(output));
//         console.log("----");
//       }
//     }

//     // for await (const { event, data, metadata } of eventStream) {
//     //   console.log("Data chunk content: ", data.chunk.content, "|");
//     //   yield data.chunk.content;
//     //   // if (event === "on_chat_model_stream" && data.chunk.content) { //event === "on_chat_model_stream" && 
//     //   //   // if (true) {
//     //   //   console.log("Data chunk content: ", data.chunk.content, "|");
//     //   //   yield data.chunk.content;
//     //   // }
//     // }
//   } catch (error) {
//     console.error("Supervisor stream failed:", error);
//     throw new Error(`Supervisor stream failed: ${error.message}`);
//   }
// };

// let eventStream = await graph.streamEvents(
//   { messages: [{ role: "user", content: "Cuantas personas estan registradas con el nombre Juan Perez?" }]},
//   { version: "v2",
//     configurable: { thread_id: "94333333"}, streamMode: "messages"
//   },
// );

// for await (const { event, data, metadata } of eventStream) {
//   // if(metadata.tags?.includes("final_node")){ //&& event === "on_chain_end"
//   //   console.warn("Metadata tags: ",metadata)
//   //   console.warn("Event: ",event)
//   //   console.warn("Data: ",JSON.stringify(data))
//   //   // console.warn("Data chunk content: ",data.chunk.content, "|");

//   // }
//   // Si quiero hacer stream real desde un nodo, tengo que usar "on_chat_model_stream"
//   if (event === "on_chat_model_stream" ) { //&& metadata.tags?.includes("final_node")
//     if (data.chunk.content) {
//       console.warn("Data chunk content: ",data.chunk.content, "|");
//       // console.warn("Data: ",JSON.stringify(data), "|");
//       // console.warn("Next: ",data.input?.next, "|");
//     }
//   }
// }


//   const generator = await streamSupervisor2("Agregar una persona", "9433333312341335");
//   // const generator = await streamSupervisor2("crear nuevo miembro", "943333331234133");
        
//   for await (const output of generator) {
//     console.log(output)
//   }

// const generator2 = await streamSupervisor2("en realidad quiero crear un ministerio", "9433333312341335");
// // const generator = await streamSupervisor2("crear nuevo miembro", "943333331234133");
        
// for await (const output of generator2) {
//   console.log(output)
// }