/**
 * @fileoverview Tool for removing family relationships between members in the database
 * @module tools/miembros/removeFamilyMembers
 * 
 * @description
 * This tool safely removes family relationships between two members in the familias table.
 * It includes validation, security checks, and logging of the operation.
 * 
 * @returns {Promise<string>} A message indicating the result of the operation
 * @throws {Error} If validation fails or database operation errors
 */

import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import { runQueryPublicTables } from '#db/query.js';
import { addLogFunction } from '../../../utils/addAuditLog.js';
import { ToolMessage } from "@langchain/core/messages";
import { Command } from "@langchain/langgraph";
import { memberMatchesId } from '../securityChecks.js';
import { getSessionData } from '../../../utils/activeSessionsData.js';

const removeFamilyMembers = tool(async ({ member1_id, member2_id, member1_name, member2_name }, config) => {
    const { userId } = getSessionData(config.configurable.thread_id);

    try {
        // Verify member1 name matches ID
        await memberMatchesId(member1_id, member1_name);

        // Verify member2 name matches ID
        await memberMatchesId(member2_id, member2_name);

        // Check if family relationship exists
        const checkResult = await runQueryPublicTables({
            query: `
                SELECT 
                    f.*,
                    m1.full_name as member1_name,
                    m2.full_name as member2_name
                FROM families f
                JOIN people m1 ON m1.id = f.person1_id
                JOIN people m2 ON m2.id = f.person2_id
                WHERE (person1_id = $1 AND person2_id = $2)
                OR (person1_id = $2 AND person2_id = $1)
            `,
            values: [member1_id, member2_id]
        });

        if (checkResult.rows.length === 0) {
            return 'No family relationship exists between these members.';
        }

        const deleteResult = await runQueryPublicTables({
            query: `
                DELETE FROM families 
                WHERE (person1_id = $1 AND person2_id = $2)
                OR (person1_id = $2 AND person2_id = $1)
            `,
            values: [member1_id, member2_id]
        });

        if (deleteResult.rowCount > 0) {
            addLogFunction(userId, "Desvincular", "Familias", `Desvincular ${member1_name} de ${member2_name}`);
            return new Command({
                update: {
                    messages: [
                        new ToolMessage({
                            content: `Successfully removed family relationship between ${member1_name} and ${member2_name}.`,
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
        console.error('Remove family members error:', error.message);
        throw new Error('Failed to remove family relationship: ' + error.message);
    }
}, {
    name: 'remove_family_members',
    description: 'Removes a family relationship between two members',
    schema: z.object({
        member1_id: z.number().int().positive().describe('ID of the first member in the family relationship to be removed. Use check_nombres tool to find the ID.'),
        member1_name: z.string().describe('Validated full name of the first member. Use check_nombres tool to get the valid full name.'),
        member2_id: z.number().int().positive()
            // .refine(val => val !== z.get('member1_id'), 'Member IDs must be different.')
            .describe('ID of the second member in the family relationship to be removed. Use check_nombres tool to find the ID.'),
        member2_name: z.string().describe('Validated full name of the second member. Use check_nombres tool to get the valid full name.')
    })
});

export default removeFamilyMembers;