/**
 * @fileoverview Tool for updating specific fields of a Ministerio entity in the database
 * @module tools/ministerios/updateMinisterioField
 * 
 * @typedef {Object} UpdateMinisterioInput
 * @property {number} MinisterioId - ID of the ministerio to update
 * @property {string} Campo - Field name to update (nombre, descripcion, ministerio_padre_id)
 * @property {string|number} Valor - New value for the field
 * 
 * @throws {Error} If database operation fails or invalid input is provided
 * @returns {Promise<string>} Success or error message
 */

import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import { runQueryPublicTables } from '#db/query.js';
import { addLogFunction } from '../../../utils/addAuditLog.js';
import { ToolMessage } from "@langchain/core/messages";
import { Command } from "@langchain/langgraph";
import { userIsAdmin, ministryMatchesId } from '../securityChecks.js';
import { getSessionData } from '../../../utils/activeSessionsData.js';

const ALLOWED_FIELDS = Object.freeze(['name', 'description', 'parent_ministry_id']);

const updateMinisterioField = tool(async ({ ministry_id, field, value, ministry_name }, config) => {

  try {
    const { userId, userRole } = getSessionData(config.configurable.thread_id);
    await userIsAdmin(userRole);
    await ministryMatchesId(ministry_id, ministry_name);

    const fieldName = field.toLowerCase();
    
    const sqlQuery = `
      UPDATE ministries
      SET ${fieldName} = $1
      WHERE id = $2
      RETURNING id, ${fieldName} as updated_field;
    `;

    const result = await runQueryPublicTables({ 
      query: sqlQuery, 
      values: [value, ministry_id] 
    });

    if (result.rows.length === 0) {
      throw new Error('Ministerio not found or update failed');
    }

    const { id, updated_field } = result.rows[0];
    addLogFunction(userId, "Actualizar", "Ministerios", `Actualizar ministerio con ID: ${id}, nombre: ${ministry_name}, campo: ${field}, nuevo valor: ${value}`);

    return new Command({
      update: {
          messages: [
          new ToolMessage({
              content: `Successfully updated ${field} for Ministerio ID: ${id} to: ${updated_field}.`,
              name: "success",
              tool_call_id: config.toolCall.id,
              status: "success"
          }),
          ],
      }
    });
  } catch (error) {
    console.error('Update operation failed:', error);
    throw new Error(`Failed to update Ministerio: ${error.message}`);
  }
}, {
  name: 'update_ministerio_field',
  description: 'Updates a specific field of an existing Ministerio record in the database',
  schema: z.object({
    ministry_id: z.number().positive().describe('ID of the ministry to be updated. Use check_nombre_ministerios tool to find the ministry ID.'),
    ministry_name: z.string().describe('Validated name of the ministry to be updated. Use the check_nombre_ministerios tool to get the valid name.'),
    field: z.enum(ALLOWED_FIELDS).describe('Name of the field to update. Pick the most similar from this list: ' + ALLOWED_FIELDS.join(', ')),
    value: z.union([z.string(), z.number()]).describe('New value for the specified field')
  }),
});

export default updateMinisterioField;
