/**
 * @fileoverview Tool for safely removing a ministerio from the database with validation and logging
 * @module tools/ministerios/removeMinisterio
 * @requires @langchain/core/tools
 * @requires zod
 * @requires #db/query
 * @requires ../db_helpers/addLogFunction
 * 
 * @description
 * This tool handles the safe removal of ministerio entries from the database.
 * It includes existence validation, error handling, and logging of the deletion operation.
 */

import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import { runQueryPublicTables } from '#db/query.js';
import { addLogFunction } from '../../../utils/addAuditLog.js';
import { ToolMessage } from "@langchain/core/messages";
import { Command } from "@langchain/langgraph";
import { userIsAdmin, ministryMatchesId } from '../securityChecks.js';
import { getSessionData } from '../../../utils/activeSessionsData.js';

const removeMinisterio = tool(async ({ ministry_id, ministry_name }, config) => {

    try {
        const { userId, userRole } = getSessionData(config.configurable.thread_id);
        await userIsAdmin(userRole);
        await ministryMatchesId(ministry_id, ministry_name);

        const deleteQuery = `
            DELETE FROM ministries WHERE id = $1;
        `;
        const result = await runQueryPublicTables({
            query: deleteQuery,
            values: [ministry_id]
        });

        if (result.rowCount > 0) {
            addLogFunction(userId, "Eliminar", "Ministerios", `Eliminar ministerio ${ministry_name} (ID: ${ministry_id})`);
            return new Command({
                update: {
                    messages: [
                    new ToolMessage({
                        content: `Successfully removed ministerio '${ministry_name}' (ID: ${ministry_id}).`,
                        name: "success",
                        tool_call_id: config.toolCall.id,
                        status: "success"
                    }),
                    ],
                }
            });
        }
        
        throw new Error('Deletion operation failed');
    } catch (error) {
        console.error('Ministerio removal error:', error);
        throw new Error(`Failed to remove ministerio: ${error.message}`);
    }
}, {
    name: 'remove_ministerio',
    description: `Removes a ministerio from the database.`,
    schema: z.object({
        ministry_id: z.number().int().positive().describe('Unique identifier of the ministerio to remove. Use check_nombre_ministerios tool to find the ministry ID.'),
        ministry_name: z.string().min(1).describe('Validated name of the ministry to be removed. Use the check_nombre_ministerios tool to get the valid name.')
    }),
});

export default removeMinisterio;