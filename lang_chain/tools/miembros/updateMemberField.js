/**
 * @fileoverview Tool for updating member fields in the database
 * @module tools/miembros/updateMemberField
 * 
 * @description
 * Updates a single field for an existing member record.
 * Includes validation for field types, allowed values, and data integrity.
 * Logs the update action in the audit trail.
 * 
 * @security
 * - Requires authenticated user
 * - Input validation against allowed values
 * - Foreign key integrity checks
 * - SQL injection prevention through parameterized queries
 */

import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import { addLogFunction } from '../../../utils/addAuditLog.js';
import { getAuxTablesValues, getAuxTablesId } from '../db_helpers/getAuxTables.js';
import { runQueryPublicTables } from '#db/query.js';
import { getTableColumns } from '../db_helpers/getTableColumns.js';
import { ToolMessage } from "@langchain/core/messages";
import { Command } from "@langchain/langgraph";
import { memberMatchesId, userCanAccessMember } from '../securityChecks.js';
import { getSessionData } from '../../../utils/activeSessionsData.js';

const miembrosColumns = await getTableColumns('vw_people');

// Map of fields requiring auxiliary table validation
const fieldOptionsMap = {
  'discipulado': 'aux_discipleships',
  'integracion': 'aux_membership',
  'estado_civil': 'aux_marital_statuses'
};

const updateMemberField = tool(async ({ member_id, member_name, field_name, field_value }, config) => {
  const { userId } = getSessionData(config.configurable.thread_id);

  try {
    await memberMatchesId(member_id, member_name);
    await userCanAccessMember(member_id, userId);

    if (fieldOptionsMap[field_name]) {
      const opciones = await getAuxTablesValues(fieldOptionsMap[field_name]);
      if (!opciones.includes(field_value)) {
        return `Invalid value for ${field_name}. Allowed values: ${opciones.join(', ')}. Select the most similar value from this list and retry. Do not ask the user if the option is too similar.`;
      }
      
      const fieldId = await getAuxTablesId(fieldOptionsMap[field_name], field_value);
      if (!fieldId) {
        throw new Error(`ID not found for value '${field_value}' in ${field_name}`);
      }
      field_value = fieldId;
    }

    // Special validation for birth date
    if (field_name === 'fecha_nacimiento') {
      const date = new Date(field_value);
      if (!(date instanceof Date && !isNaN(date) && date < new Date())) {
        throw new Error('Birth date must be a valid date in the past');
      }
    }

    const result = await runQueryPublicTables({
      query: `
        UPDATE people
        SET ${field_name} = $1
        WHERE id = $2
        RETURNING full_name, id;
      `,
      values: [field_value, member_id]
    });

    if (result.rows.length === 1) {
      const { full_name, id } = result.rows[0];
      addLogFunction(userId, "Actualizar", "Personas", `Actualizar miembro con ID: ${id}, nombre: ${full_name}, campo: ${field_name}, nuevo valor: ${field_value}`);

      return new Command({
        update: {
            messages: [
                new ToolMessage({
                  content: `Member ${full_name} with ID ${id} updated successfully.`,
                  name: "success",
                  tool_call_id: config.toolCall.id,
                  status: "success"
                }),
            ],
        }
      });
    }

    throw new Error('Member not found');
  } catch (error) {
    console.error('Update error:', error);
    throw new Error(`Failed to update member: ${error.message}`);
  }
}, {
  name: 'update_member_field',
  description: 'Updates a single field for an existing record in table personas',
  schema: z.object({
    member_id: z.number().int().positive().describe(`ID of the person to be updated. Use the 'check_nombres' tool to find the person's ID.`),
    member_name: z.string().describe(`Validated full name of the person to be updated. Use the 'check_nombres' tool to get the valid full name.`),
    field_name: z.enum(miembrosColumns).describe('Name of the field to be updated in the personas table. Pick the most similar from this list: ' + miembrosColumns.join(', ')),
    field_value: z.union([z.string(), z.number()]).describe('New value for the specified field.'),
  }),
});

export default updateMemberField;