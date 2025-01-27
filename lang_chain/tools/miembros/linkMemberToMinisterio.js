/**
 * @fileoverview Tool to link members to ministries with specific roles
 * @module tools/miembros/linkMemberToMinisterio
 */

import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import { addLogFunction } from '../../../utils/addAuditLog.js';
import { runQueryPublicTables } from '#db/query.js';
import { getAuxTablesValues } from '../db_helpers/getAuxTables.js';
import { ToolMessage } from "@langchain/core/messages";
import { Command } from "@langchain/langgraph";
import { memberMatchesId, userIsLiderOfParentMinistry, ministryMatchesId } from '../securityChecks.js';
import { getSessionData } from '../../../utils/activeSessionsData.js';

const opcionesRoles = await getAuxTablesValues('aux_ministry_roles');

const linkMemberToMinisterio = tool(async ({ member_id, ministry_id, role_name, member_name, ministry_name }, config) => {
    try {
        
        const { userId } = getSessionData(config.configurable.thread_id);

        // Security: Check if user is leader of parent ministry
        // This is a security check to ensure the user has the right permissions to link members to ministries
        // Only leaders of parent ministries can link members to ministries, since this allows both leaders and
        // collaborators to access to members information.
        await userIsLiderOfParentMinistry(userId, ministry_id);

        // Verify member name matches ID
        await memberMatchesId(member_id, member_name);

        await ministryMatchesId(ministry_id, ministry_name);

        // Validate role exists and is allowed
        if (!opcionesRoles.includes(role_name)) {
            return `Invalid role. Allowed roles: ${opcionesRoles.join(', ')}. Use the most similar one from the list.`;
        }

        // Get role ID with SQL injection protection
        const roleResult = await runQueryPublicTables({
            query: 'SELECT id FROM aux_roles WHERE nombre = $1',
            values: [role_name]
        });

        if (!roleResult.rows.length) {
            return `Role "${role_name}" not found`;
        }

        // Check for existing relationship
        const exists = await runQueryPublicTables({
            query: `
                SELECT r.name as role_name 
                FROM people_ministries pm
                JOIN aux_ministry_roles r ON r.id = pm.role_id
                WHERE pm.person_id = $1 AND pm.ministry_id = $2
            `,
            values: [member_id, ministry_id]
        });

        if (exists.rows.length) {
            return `Member is already linked to this ministry with role: ${exists.rows[0].role_name}`;
        }

        // Create relationship and return details
        const result = await runQueryPublicTables({
            query: `
                WITH inserted AS (
                    INSERT INTO people_ministries (person_id, ministry_id, role_id)
                    VALUES ($1, $2, $3)
                    RETURNING person_id, ministry_id, role_id
                )
                SELECT 
                    p.full_name as member_name,
                    min.name as ministry_name,
                    r.name as role_name
                FROM inserted i
                JOIN people p ON p.id = i.person_id
                JOIN ministries min ON min.id = i.ministry_id
                JOIN aux_ministry_roles r ON r.id = i.role_id
            `,
            values: [member_id, ministry_id, roleResult.rows[0].id]
        });

        if (result.rows.length === 1) {
            const { member_name, ministry_name, role_name } = result.rows[0];
            addLogFunction(userId, "Vincular", "Servicio", `Vincular miembro ${member_name} al ministerio ${ministry_name} como ${role_name}`);
            return new Command({
                update: {
                    messages: [
                        new ToolMessage({
                            content: `Successfully linked ${member_name} to ministry ${ministry_name} as ${role_name}`,
                            name: "success",
                            tool_call_id: config.toolCall.id,
                            status: "success"
                        }),
                    ],
                }
            });
        }

        throw new Error('Failed to create ministry link');
    } catch (error) {
        throw new Error(`Ministry link creation failed: ${error.message}`);
    }
}, {
    name: 'link_member_to_ministerio',
    description: 'Links a member to a ministry with a specific role',
    schema: z.object({
        member_id: z.number().int().positive().describe('ID of the member. Use check_nombres tool to find the ID.'),
        member_name: z.string().describe('Validated full name of the member. Use the check_nombres tool to get the valid full name.'),
        ministry_id: z.number().int().positive().describe('ID of the ministry. Use check_nombre_ministerios tool to find the ID.'),
        ministry_name: z.string().describe('Validated name of the ministry. Use the check_nombre_ministerios tool to get the valid name.'),
        role_name: z.enum(opcionesRoles).describe('Role of the member within the ministry. Pick the most similar from this list: ' + opcionesRoles.join(', '))
    })
});

export default linkMemberToMinisterio;
