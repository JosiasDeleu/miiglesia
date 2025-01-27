/**
 * @fileoverview Tool for removing a member from a ministry in the database
 * @module tools/miembros/removeMemberFromMinisterio
 * 
 * @description
 * This tool safely removes the relationship between a member and a ministry in the miembros_ministerios table.
 * It includes validation, security checks, and logging of the operation.
 * 
 * @returns {Promise<string>} A message indicating the result of the operation
 * @throws {Error} If validation fails or database operation errors
 */

import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import { addLogFunction } from '../../../utils/addAuditLog.js';
import { runQueryPublicTables } from '#db/query.js';
import { ToolMessage } from "@langchain/core/messages";
import { Command } from "@langchain/langgraph";
import { memberMatchesId, ministryMatchesId } from '../securityChecks.js';
import { getSessionData } from '../../../utils/activeSessionsData.js';

const removeMemberFromMinisterio = tool(async ({ member_id, ministry_id, member_name, ministry_name }, config) => {
    const { userId } = getSessionData(config.configurable.thread_id);

    try {
        // Verify member name matches ID
        await memberMatchesId(member_id, member_name);

        // Verify ministry name matches ID
        await ministryMatchesId(ministry_id, ministry_name);

        // Check if the member is linked to the ministry
        const checkQuery = `
            SELECT 
                mm.*,
                m.full_name as member_name,
                mi.name as ministry_name
            FROM people_ministries mm
            JOIN people m ON m.id = mm.person_id
            JOIN ministries mi ON mi.id = mm.ministry_id
            WHERE person_id = $1 AND ministry_id = $2;
        `;
        const checkResult = await runQueryPublicTables({
            query: checkQuery,
            values: [member_id, ministry_id]
        });

        if (checkResult.rows.length === 0) {
            return `No relationship exists between this member and ministry.`;
        }

        const deleteQuery = `
            DELETE FROM people_ministries 
            WHERE person_id = $1 AND ministry_id = $2;
        `;
        
        const result = await runQueryPublicTables({
            query: deleteQuery,
            values: [member_id, ministry_id]
        });

        if (result.rowCount > 0) {
            addLogFunction(userId, "Desvincular", "Servicio", `Desvincular ${member_name} de ${ministry_name}`);
            return new Command({
                update: {
                    messages: [
                        new ToolMessage({
                            content: `Successfully removed ${member_name} from ministry ${ministry_name}.`,
                            name: "success",
                            tool_call_id: config.toolCall.id,
                            status: "success"
                        }),
                    ],
                }
            });
        }

        throw new Error('Database operation failed');
    } catch (error) {
        console.error('Remove member from ministry error:', error.message);
        throw new Error('Failed to remove member from ministry: ' + error.message);
    }
}, {
    name: 'remove_member_from_ministerio',
    description: 'Removes a member from a ministry',
    schema: z.object({
        member_id: z.number().int().positive().describe('ID of the person to be removed from the ministry. Use check_nombres tool to find the ID.'),
        member_name: z.string().describe('Validated full name of the member. Use check_nombres tool to get the valid full name.'),
        ministry_id: z.number().int().positive().describe('ID of the ministry. Use check_nombre_ministerios tool to find the ministry ID.'),
        ministry_name: z.string().describe('Validated name of the ministry. Use check_nombre_ministerios tool to get the valid ministry name.')
    })
});

export default removeMemberFromMinisterio;