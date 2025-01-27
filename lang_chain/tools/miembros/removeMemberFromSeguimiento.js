/**
 * @fileoverview Tool for removing mentoring relationships between members in the database
 * @module tools/miembros/removeMemberFromSeguimiento
 * 
 * @description
 * This tool safely removes mentoring relationships between two members in the seguimiento table.
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
import { memberMatchesId } from '../securityChecks.js';
import { getSessionData } from '../../../utils/activeSessionsData.js';

const removeMemberFromSeguimiento = tool(async ({ mentor_id, mentee_id, mentor_name, mentee_name }, config) => {
    const { userId } = getSessionData(config.configurable.thread_id);

    try {
        // Verify follower and followed names match IDs
        await memberMatchesId(mentor_id, mentor_name);
        await memberMatchesId(mentee_id, mentee_name);

        // Check if mentoring relationship exists
        const checkResult = await runQueryPublicTables({
            query: `
                SELECT 
                    s.*,
                    m1.full_name as follower_name,
                    m2.full_name as followed_name
                FROM mentorships s
                JOIN people m1 ON m1.id = s.mentor_person_id
                JOIN people m2 ON m2.id = s.mentee_person_id
                WHERE mentor_person_id = $1 AND mentee_person_id = $2
            `,
            values: [mentor_id, mentee_id]
        });

        if (checkResult.rows.length === 0) {
            return 'No mentoring relationship exists between these members.';
        }

        // Security: Using parameterized query for deletion
        const deleteResult = await runQueryPublicTables({
            query: `
                DELETE FROM mentorships 
                WHERE mentor_person_id = $1 AND mentee_person_id = $2
            `,
            values: [mentor_id, mentee_id]
        });

        if (deleteResult.rowCount > 0) {
            addLogFunction(userId, "Desvincular", "Seguimiento", `Desvincular seguimiento de ${mentor_id} a ${mentee_id}`);
            return new Command({
                update: {
                    messages: [
                        new ToolMessage({
                            content: `Successfully removed mentoring relationship between ${mentor_name} and ${mentee_name}.`,
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
        console.error('Remove mentoring relationship error:', error.message);
        throw new Error('Failed to remove mentoring relationship: ' + error.message);
    }
}, {
    name: 'remove_member_from_seguimiento',
    description: 'Removes a mentoring relationship between two members',
    schema: z.object({
        mentor_id: z.number().int().positive().describe('ID of the member who is mentoring to be removed. Use check_nombres tool to find the ID.'),
        mentor_name: z.string().min(1).describe('Validated full name of the follower. Use check_nombres tool to get the valid full name.'),
        mentee_id: z.number().int().positive().describe('ID of the member being mentored to be removed. Use check_nombres tool to find the ID.'),
        mentee_name: z.string().min(1).describe('Validated full name of the followed member. Use check_nombres tool to get the valid full name.')
    })
});

export default removeMemberFromSeguimiento;
