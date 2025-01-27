// LangChain core imports
import { ChatOpenAI } from "@langchain/openai";
import { createReactAgent } from "@langchain/langgraph/prebuilt";

// DB helper tools
import QuerySql from '../tools/db_helpers/querySql.js';
import InfoSqlTool from '../tools/db_helpers/infoSqlTool.js';

// Member management tools
import checkNombres from '../tools/miembros/checkNombres.js';
import checkUserAccessToMember from '../tools/miembros/checkUserAccessToMember.js';
import checkAddress from '../tools/miembros/checkAddress.js';
import createMember from '../tools/miembros/createMember.js';
import updateMemberField from '../tools/miembros/updateMemberField.js';
import linkMemberToMinisterio from '../tools/miembros/linkMemberToMinisterio.js';
import linkFamilyMembers from '../tools/miembros/linkFamilyMembers.js';
import linkMemberToSeguimiento from '../tools/miembros/linkMemberToSeguimiento.js';
import removeMemberFromSeguimiento from '../tools/miembros/removeMemberFromSeguimiento.js';
import removeFamilyMembers from '../tools/miembros/removeFamilyMembers.js';
import removeMember from '../tools/miembros/removeMember.js';
import removeMemberFromMinisterio from '../tools/miembros/removeMemberFromMinisterio.js';

// Ministerio management tools
import createMinisterio from '../tools/ministerios/createMinisterio.js';
import CheckUserIsAdmin from '../tools/checkUserIsAdmin.js';
import checkNombreMinisterios from '../tools/ministerios/checkNombreMinisterios.js';
import updateMinisterioField from '../tools/ministerios/updateMinisterioField.js';
import removeMinisterio from '../tools/ministerios/removeMinisterio.js';

// Activity and attendance tools
import getAttendees from '../tools/asistencia/getAttendees.js';
import registerAttendance from '../tools/asistencia/registerAttendance.js';
import removeAttendance from '../tools/asistencia/removeAttendance.js';
import createActivity from '../tools/asistencia/createActivity.js';
import updateActivityField from '../tools/asistencia/updateActivityField.js';
import removeActivity from '../tools/asistencia/removeActivity.js';

// Reports tools
import querySqlToExcel from '../tools/reportes/querySqlToExcel.js';

// Handoff tools
import HandoffToSupervisor from '../tools/handoffs/handoffToSupervisor.js';

// LLM Config
import {LLM_CONFIG} from '../llmModelsConfig.js';

const modelOpenAI4omini = new ChatOpenAI(LLM_CONFIG.models.openai_gpt_4o_mini);
const modelOpenAI4o = new ChatOpenAI(LLM_CONFIG.models.openai_gpt_4o);

var generalTools = [];
generalTools.push(InfoSqlTool);
generalTools.push(QuerySql);
generalTools.push(HandoffToSupervisor);
generalTools.push(checkUserAccessToMember);

export const agent_createMember = createReactAgent({
  llm: modelOpenAI4omini,
  tools: [createMember, updateMemberField, removeMember, checkNombres, ...generalTools],
  verbose: true
});

export const agent_updateMember = createReactAgent({
  llm: modelOpenAI4omini,
  tools: [...generalTools, updateMemberField, checkNombres, checkAddress],
  verbose: true
});

export const agent_registerAttendance = createReactAgent({
  llm: modelOpenAI4omini,
  tools: [
    ...generalTools,
    checkNombres, 
    getAttendees, 
    registerAttendance,
    removeAttendance,
    createActivity,
    updateActivityField,
    removeActivity
  ],
  verbose: true
});

export const agent_reports = createReactAgent({
  llm: modelOpenAI4o,
  tools: [...generalTools, checkNombres, checkNombreMinisterios, querySqlToExcel],
  verbose: true,
});

export const agent_createMinisterio = createReactAgent({
  llm: modelOpenAI4omini,
  tools: [
    createMinisterio,
    removeMinisterio,
    checkNombreMinisterios,
    CheckUserIsAdmin,
    ...generalTools
  ],
  verbose: true,
});

export const agent_updateMinisterio = createReactAgent({
  llm: modelOpenAI4omini,
  tools: [updateMinisterioField, checkNombreMinisterios, CheckUserIsAdmin, ...generalTools],
  verbose: true,
});

export const agent_linkMemberToMinisterio = createReactAgent({
  llm: modelOpenAI4omini,
  tools: [
    ...generalTools,
    checkNombres,
    checkNombreMinisterios,
    linkMemberToMinisterio,
    removeMemberFromMinisterio  // Added new tool
  ],
  verbose: true,
});

export const agent_linkFamilyMembers = createReactAgent({
    llm: modelOpenAI4omini,
    tools: [
        ...generalTools,
        checkNombres,
        linkFamilyMembers,
        removeFamilyMembers
    ],
    verbose: true,
});

export const agent_linkMemberToSeguimiento = createReactAgent({
    llm: modelOpenAI4omini,
    tools: [
        ...generalTools,
        checkNombres,
        linkMemberToSeguimiento,
        removeMemberFromSeguimiento
    ],
    verbose: true,
});

export const agent_createActivity = createReactAgent({
  llm: modelOpenAI4omini,
  tools: [
    createActivity,
    updateActivityField,
    checkNombreMinisterios,
    ...generalTools
  ],
  verbose: true,
});

export const agent_registerMembersAttendance = createReactAgent({
  llm: modelOpenAI4omini,
  tools: [
    registerAttendance,
    getAttendees,
    checkNombreMinisterios,
    checkNombres,
    ...generalTools
  ],
  verbose: true,
});

export const agent_removeActivity = createReactAgent({
  llm: modelOpenAI4omini,
  tools: [
    removeActivity,
    checkNombreMinisterios,
    ...generalTools
  ],
  verbose: true,
});

export const agent_updateActivity = createReactAgent({
  llm: modelOpenAI4omini,
  tools: [
    updateActivityField,
    checkNombreMinisterios,
    ...generalTools
  ],
  verbose: true,
});


export const reActMembers = [
  "node_createMember", 
  "node_updateMember", 
  "node_reports", 
  "node_createMinisterio", 
  "node_updateMinisterio",
  "node_linkMemberToMinisterio",
  "node_linkFamilyMembers",
  "node_linkMemberToSeguimiento",
  "node_createActivity",
  "node_registerMembersAttendance",
  "node_removeActivity",
  "node_updateActivity"
];

export const nonReActMembers = [
  "node_generalHelp",
  "node_unrelatedQuestions",
];

export const otherNodes = [
  // "node_registerAttendance", 
  "node_nextStepsSuggestions"
];

export const allMembers = [...reActMembers, ...nonReActMembers, ...otherNodes];