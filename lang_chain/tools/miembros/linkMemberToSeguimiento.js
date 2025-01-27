/**
 * @fileoverview Tool to create a mentoring relationship between two members
 * @module tools/miembros/linkMemberToSeguimiento
 */

import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import { addLogFunction } from '../../../utils/addAuditLog.js';
import { runQueryPublicTables } from '#db/query.js';
import { getSessionData } from '../../../utils/activeSessionsData.js';
import { ToolMessage } from "@langchain/core/messages";
import { Command } from "@langchain/langgraph";
import { memberMatchesId } from '../securityChecks.js';

const linkMemberToSeguimiento = tool(async ({ mentor_id, mentor_name, mentee_id, mentee_name }, config) => {
    
    const { userId } = getSessionData(config.configurable.thread_id);

    try {
        if (mentor_id === mentee_id) {
            return 'A member cannot follow themselves.';
        }

        await memberMatchesId(mentor_id, mentor_name);
        await memberMatchesId(mentee_id, mentee_name);

        const checkResult = await runQueryPublicTables({
            query: 'SELECT 1 FROM mentorships WHERE mentor_person_id = $1 AND mentee_person_id = $2',
            values: [mentor_id, mentee_id]
        });

        if (checkResult.rows.length > 0) {
            return 'This mentoring relationship already exists.';
        }

        const result = await runQueryPublicTables({
            query: `
                WITH inserted AS (
                    INSERT INTO mentorships (mentor_person_id, mentee_person_id, user_id, creation_date)
                    VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
                    RETURNING mentor_person_id, mentee_person_id
                )
                SELECT 
                    i.*,
                    m1.full_name AS mentor_name,
                    m2.full_name AS mentee_name
                FROM inserted i
                JOIN people m1 ON m1.id = i.mentor_person_id
                JOIN people m2 ON m2.id = i.mentee_person_id;
            `,
            values: [mentor_id, mentee_id, userId]
        });

        if (result.rows.length === 1) {

            addLogFunction(userId, "Vincular", "Seguimiento", `Vinvular miembro ${mentor_name} como seguidor de miembro ${mentee_name} en seguimiento`);

            return new Command({
                update: {
                    messages: [
                        new ToolMessage({
                            content: `Successfully registered mentoring relationship: ${mentor_name} will mentor ${mentee_name}.`,
                            name: "success",
                            tool_call_id: config.toolCall.id,
                            status: "success"
                        }),
                    ],
                }
            });
        } else {
            throw new Error('Error creating mentoring relationship.');
        }
    } catch (error) {
        return `Error creating mentoring relationship: ${error.message}`;
    }
}, {
    name: 'link_member_to_seguimiento',
    description: 'Creates a mentoring relationship between two members',
    schema: z.object({
        mentor_id: z.number().int().positive().describe('ID of the member who is mentoring. Use check_nombres tool to find the ID.'),
        mentor_name: z.string().min(1).describe('Validated full name of the mentor. Use check_nombres tool to get the valid full name.'),
        mentee_id: z.number().int().positive().describe('ID of the member being mentored. Use check_nombres tool to find the ID.'),
        mentee_name: z.string().min(1).describe('Validated full name of the mentee. Use check_nombres tool to get the valid full name.')
    })
});

export default linkMemberToSeguimiento;
