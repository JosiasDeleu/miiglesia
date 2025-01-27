import { prompts_agents } from '../prompts/prompts_agents.js';
import { SystemMessagePromptTemplate } from "@langchain/core/prompts";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { modelOpenAi, modelGoogle } from '../llmModelsConfig.js';
import { getSessionData } from '../../utils/activeSessionsData.js';
import dotenv from 'dotenv';
dotenv.config();

const ADMIN_USER_ID = Number(process.env.ADMIN_USER_ID);

export var lastWorker;
export function setLastWorker(worker){
  lastWorker = worker;
}

const nextSteps = [
  "Agregar un nuevo miembro",
  "Actualizar datos de un miembro",
  "Eliminar un miembro",
  "Obtener información de un miembro",
  "Obtener información de un ministerio",
  "Asignar persona a un ministerio",
  "Asignar parentezco",
  "Agregar otras personas a la actividad",
  "Cargar otra actividad",
  "Modificar la actividad cargada",
  "Eliminar una actividad",
  "Vincular una persona a este ministerio",
  "Eliminar una persona a este ministerio",
  "Registrar una relacion familiar",
  "Eliminar una relacion familiar",
  "Registrar un discipulado o seguimiento",
  "Eliminar un discipulado o seguimiento",
  "Registrar asistentes",
  "Crear otra actividad",
  "Eliminar actividad",
  "Registrar más asistentes",
  "Eliminar asistencia"
]

const nextStepsOnlyLeaders = [
  "Agregar un ministerio",
  "Actualizar datos de un ministerio",
  "Eliminar un ministerio",
]

const prompt = SystemMessagePromptTemplate.fromTemplate(prompts_agents.nextStepsSuggestions);


export async function node_nextStepsSuggestions(state, config) {
  const { userId } = getSessionData(config.configurable.thread_id);

  if (userId === ADMIN_USER_ID) {
    nextSteps.push(...nextStepsOnlyLeaders);
  }
  const formattedPrompt = await prompt.format({nextSteps: nextSteps.join(", ")});
  
  const messages = [formattedPrompt, ...state.messages];
  const result = await modelOpenAi.invoke(messages);
  const lastMessage = result.content;
  return {
    messages: [new HumanMessage({ content: lastMessage})]
  };
}

