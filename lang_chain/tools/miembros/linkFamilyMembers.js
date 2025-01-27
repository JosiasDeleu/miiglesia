/**
 * @fileoverview Tool for creating bidirectional family relationships between members
 * @module tools/miembros/linkFamilyMembers
 * 
 * @description
 * This tool creates bidirectional family relationships between two members in the database.
 * It ensures both directions of the relationship are created (e.g., if A is parent of B,
 * then B is child of A) maintaining data consistency.
 */

import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import { addLogFunction } from '../../../utils/addAuditLog.js';
import { runQueryPublicTables } from '#db/query.js';
import { getAuxTablesValues } from '../db_helpers/getAuxTables.js';
import { ToolMessage } from "@langchain/core/messages";
import { Command } from "@langchain/langgraph";
import { memberMatchesId } from '../securityChecks.js';
import { getSessionData } from '../../../utils/activeSessionsData.js';

const allowedRelationships = await getAuxTablesValues('aux_relationships');

const linkFamilyMembers = tool(async ({ member1_id, member2_id, member1_name, member2_name, relationship_name }, config) => {
    console.log('linkFamilyMembers:', { member1_id, member2_id, member1_name, member2_name, relationship_name });
    const { userId } = getSessionData(config.configurable.thread_id);

    try {
        // Verify member names match IDs
        await memberMatchesId(member1_id, member1_name);
        await memberMatchesId(member2_id, member2_name);

        // Check if relationship already exists with details
        const checkQuery = `
            SELECT 
                f.*,
                m1.full_name as nombre_miembro1,
                m2.full_name as nombre_miembro2,
                p.name as tipo_parentesco
            FROM families f
            JOIN people m1 ON m1.id = f.person1_id
            JOIN people m2 ON m2.id = f.person2_id
            JOIN aux_relationships p ON p.id = f.relationship_id
            WHERE (person1_id = $1 AND person2_id = $2)
            OR (person1_id = $2 AND person2_id = $1)
            LIMIT 1;
        `;
        const checkResult = await runQueryPublicTables({
            query: checkQuery,
            values: [member1_id, member2_id]
        });

        if (checkResult.rows.length > 0) {
            const { nombre_miembro1, nombre_miembro2, tipo_parentesco } = checkResult.rows[0];
            return `Relationship already exists: ${nombre_miembro1} is ${tipo_parentesco} of ${nombre_miembro2}`;
        }

        // Get both relationship IDs in a single query
        const relationshipQuery = `
            SELECT p1.id as relationship_id, p2.id as inverse_relationship_id
            FROM aux_relationships p1
            JOIN aux_relationships p2 ON p2.id = p1.inverse_relationship_id
            WHERE LOWER(p1.name) = LOWER($1);
        `;
        const relationshipResult = await runQueryPublicTables({
            query: relationshipQuery,
            values: [relationship_name]
        });

        if (relationshipResult.rows.length === 0) {
            return `Relationship type "${relationship_name}" not found in database`;
        }

        const { relationship_id, inverse_relationship_id } = relationshipResult.rows[0];

        // Insert both relationships in a transaction
        const insertQuery = `
            WITH inserted AS (
                INSERT INTO families (person1_id, person2_id, relationship_id)
                VALUES ($1, $2, $3), ($2, $1, $4)
                RETURNING person1_id, person2_id, relationship_id
            )
            SELECT 
                i.*,
                m1.full_name as nombre_miembro1,
                m2.full_name as nombre_miembro2,
                p.name as tipo_parentesco
            FROM inserted i
            JOIN people m1 ON m1.id = i.person1_id
            JOIN people m2 ON m2.id = i.person2_id
            JOIN aux_relationships p ON p.id = i.relationship_id
            LIMIT 1;
        `;
        
        const result = await runQueryPublicTables({
            query: insertQuery,
            values: [member1_id, member2_id, relationship_id, inverse_relationship_id]
        });

        if (result.rows.length === 1) {
            const { nombre_miembro1, nombre_miembro2, tipo_parentesco } = result.rows[0];
            addLogFunction(userId, "Vincular", "Familias", `Vincular ${nombre_miembro1} como ${tipo_parentesco} de ${nombre_miembro2}`);
            return new Command({
                update: {
                    messages: [
                    new ToolMessage({
                        content: `Successfully created relationship: ${nombre_miembro1} is ${tipo_parentesco} of ${nombre_miembro2}`,
                        name: "success",
                        tool_call_id: config.toolCall.id,
                        status: "success"
                    }),
                    ],
                }
            });
        }

        throw new Error('Failed to create relationship');
    } catch (error) {
        console.error('Error in linkFamilyMembers:', error);
        return `Operation failed: ${error.message}`;
    }
}, {
    name: 'link_family_members',
    description: 'Creates a bidirectional family relationship between two members',
    schema: z.object({
        member1_id: z.number().int().positive().describe('ID of the first member. Use check_nombres tool to find the ID.'),
        member1_name: z.string().min(1).describe('Validated full name of the first member. Use check_nombres tool to get the valid full name.'),
        member2_id: z.number().int().positive().describe('ID of the second member. Use check_nombres tool to find the ID.'),
            // .refine(val => val !== this.member1_id, { message: "Cannot create a relationship between a member and themselves" }),
        member2_name: z.string().min(1).describe('Validated full name of the second member. Use check_nombres tool to get the valid full name.'),
        relationship_name: z.enum(allowedRelationships).describe('Type of relationship between the two members. Pick the most similar from this list: ' + allowedRelationships.join(', '))
    }),
    verbose: true
});

export default linkFamilyMembers;
