/**
 * @fileoverview Tool for creating new Ministerio entries in the database
 * @module tools/ministerios/createMinisterio
 * 
 * @requires @langchain/core/tools
 * @requires zod
 * @requires db/query
 * @requires db_helpers/addLogFunction
 * @requires db_helpers/getAuxTables
 */

import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import { runQueryPublicTables } from '#db/query.js';
import { addLogFunction } from '../../../utils/addAuditLog.js';
import { getMinisteriosList } from '../db_helpers/getAuxTables.js';
import { getSessionData } from '../../../utils/activeSessionsData.js';
import { ToolMessage } from "@langchain/core/messages";
import { Command } from "@langchain/langgraph";
import { userIsAdmin } from '../securityChecks.js';

const opcionesMinisterios = await getMinisteriosList();

const createMinisterio = tool(async ({ name, description, parent_ministry }, config) => {

  try {
    const { userId, userRole } = getSessionData(config.configurable.thread_id);
    await userIsAdmin(userRole);
    
    const parentMinistryId = parent_ministry ? 
      await runQueryPublicTables({
        query: 'SELECT id FROM ministries WHERE name = $1',
        values: [parent_ministry.trim()]
      }).then(result => result.rows[0]?.id) : null;

    const result = await runQueryPublicTables({
      query: `
        INSERT INTO ministries (
          name, description, parent_ministry_id, creation_date, user_id
        )
        VALUES ($1, $2, $3, CURRENT_TIMESTAMP, $4)
        RETURNING id;
      `,
      values: [
        name.trim(),
        description.trim(),
        parentMinistryId,
        userId,
      ]
    });

    if (result.rows[0]?.id) {
      const ministerioCreadoId = result.rows[0].id;
      addLogFunction(userId, "Crear", "Ministerios", `Crear ministerio con ID: ${ministerioCreadoId}, nombre: ${name}, descripcion: ${description}, ministerio padre: ${parent_ministry}`);

      return new Command({
        update: {
          messages: [
            new ToolMessage({
              content: `Ministerio ${name} successfully created with ID: ${ministerioCreadoId}.`,
              name: "success",
              tool_call_id: config.toolCall.id,
              status: "success"
            }),
          ],
        }
      });
    }
    
    throw new Error('Failed to create Ministerio.');
  } catch (error) {
    console.error('CreateMinisterio Error:', error);
    throw new Error(`Failed to create Ministerio: ${error.message}`);
  }
}, {
  name: 'create_ministerio',
  description: 'Creates a new Ministerio entry in the database.',
  schema: z.object({
    name: z.string().min(1, { message: "Name must be at least 1 character long" }).describe('Name of the ministry.'),
    description: z.string().min(1, { message: "Description must be at least 1 character long" }).describe('Description of the ministry.'),
    parent_ministry: z.enum(["", null, ...opcionesMinisterios]).optional().describe('Name of the parent ministry, if applicable. Use check_nombre_ministerios tool to find confirm the ministry name.'),
  }),
});

export default createMinisterio;
