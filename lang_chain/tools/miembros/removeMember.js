/**
 * @fileoverview Tool for safely removing members from the database
 * @module tools/miembros/removeMember
 * 
 * @description
 * This tool safely removes a member from the miembros table.
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
import dotenv from 'dotenv';
dotenv.config();

const LIDER_ROL_ID = Number(process.env.LIDER_ROL_ID);
const COLABORADOR_ROL_ID = Number(process.env.COLABORADOR_ROL_ID);

const removeMember = tool(async ({ member_id, member_name }, config) => {
    const { userId } = getSessionData(config.configurable.thread_id);
    try {
        // Verify member name matches ID
        await memberMatchesId(member_id, member_name);

        // Check if member has ministry responsibilities
        const ministryCheck = await runQueryPublicTables({
            query: `
                SELECT 
                    m.ministry_id
                FROM people_ministries m
                WHERE m.person_id = $1
            `,
            values: [member_id]
        });

        if (ministryCheck.rows.length > 0) {
            // Get leaders and collaborators for the ministries
            const leadershipInfo = await runQueryPublicTables({
                query: `
                    SELECT DISTINCT
                        m.first_middle_name || ' ' || m.last_name as full_name,
                        mm.role_id,
                        min.name as ministry
                    FROM people_ministries mm
                    JOIN people m ON m.id = mm.person_id
                    JOIN ministries min ON min.id = mm.ministry_id
                    WHERE mm.ministry_id IN (
                        SELECT ministry_id 
                        FROM people_ministries 
                        WHERE person_id = $1
                    )
                    AND mm.role_id IN ($2, $3)
                `,
                values: [member_id, LIDER_ROL_ID, COLABORADOR_ROL_ID]
            });

            const leadershipList = leadershipInfo.rows
                .map(row => `${row.full_name} (ministerio: ${row.ministry})`)
                .join(', ');

            return new Command({
                update: {
                    messages: [
                        new ToolMessage({
                            content: `Cannot remove member '${member_name}' ID: ${member_id}, because they are linked to ministries. Tell the user to contact the following ministry leaders/collaborators: ${leadershipList}`,
                            name: "success",
                            tool_call_id: config.toolCall.id,
                            status: "success"
                        }),
                    ],
                }
            });
        }

        // Proceed with member removal if no ministry responsibilities
        const result = await runQueryPublicTables({
            query: 'UPDATE people SET active = FALSE WHERE id = $1',
            values: [member_id]
        });

        if (result.rowCount > 0) {
            // Remove family relationships
            try {
                await runQueryPublicTables({
                    query: `
                        DELETE FROM families 
                        WHERE (person1_id = $1)
                        OR (person2_id = $1)
                    `,
                    values: [member_id]
                });
            } catch (error) {
                console.error('Remove family relationships error:', error.message);
            }

            // Remove from seguimiento table
            try {
                await runQueryPublicTables({
                    query: `
                        DELETE FROM mentorships 
                        WHERE (mentor_person_id = $1)
                        OR (mentee_person_id = $1)
                    `,
                    values: [member_id]
                });
            } catch (error) {
                console.error('Remove seguimiento relationship error:', error.message);
            }

            addLogFunction(userId, "Eliminar", "Personas", `Eliminar miembro ${member_name}`);
            return new Command({
                update: {
                    messages: [
                        new ToolMessage({
                            content: `Successfully removed member ${member_name} with ID ${member_id}.`,
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
        console.error('Remove member error:', error.message, "Error stack:", error.stack);
        throw new Error(`Failed to remove member: ${error.message}`);
    }
}, {
    name: 'remove_member',
    description: 'Removes a member from the database',
    schema: z.object({
        member_id: z.number().int().positive().describe('ID of the person to be removed. Use check_nombres tool to find the ID.'),
        member_name: z.string().min(1).describe('Validated full name of the person to be removed. Use the check_nombres tool to get the valid full name.')
    })
});

export default removeMember;