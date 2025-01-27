import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import { addLogFunction } from '../../../utils/addAuditLog.js';
import { getTableColumns } from '../db_helpers/getTableColumns.js';
import { runQueryPublicTables } from '#db/query.js';
import { ToolMessage } from "@langchain/core/messages";
import { Command } from "@langchain/langgraph";
import { userCanAccessActivity, activityMatchesId } from '../securityChecks.js';
import { getSessionData } from '../../../utils/activeSessionsData.js';

/**
 * Validates if a date is in the present or future
 * @param {string} date - Date string to validate
 * @returns {boolean} True if date is valid and in present/future
 */
const isValidFutureDate = (date) => {
  const parsedDate = new Date(date);
  return parsedDate instanceof Date && !isNaN(parsedDate) && parsedDate >= new Date();
};

// Cache table columns to avoid repeated DB calls
const activityColumns = await getTableColumns('activities');

/**
 * Tool for securely updating single fields in the actividades table
 * Includes validation, logging, and SQL injection prevention
 */
const updateActivityField = tool(async ({ activity_id, field_name, field_value, ministry_id, activity_date }, config) => {
  const { userId } = getSessionData(config.configurable.thread_id);

  try {
    await activityMatchesId(activity_id, ministry_id, activity_date);  
    await userCanAccessActivity(ministry_id, userId);

    if (field_name === 'fecha' && !isValidFutureDate(field_value)) {
      return 'Date must be valid and not in the past.';
    }

    const sqlQuery = `
      WITH updated_activity AS (
        UPDATE activities
        SET ${field_name} = $1
        WHERE id = $2
        RETURNING id, ministry_id
      )
      SELECT ua.id, m.name as ministry_name
      FROM updated_activity ua
      JOIN ministries m ON m.id = ua.ministry_id;
    `;
    
    const result = await runQueryPublicTables({
      query: sqlQuery,
      values: [field_value, activity_id]
    });

    if (result.rows.length === 1) {
      const { id, ministry_name } = result.rows[0];
      addLogFunction(userId, "Actualizar", "Actividades", 
        `Actualizar actividad con ID: ${id}, del ministerio: ${ministry_name}, campo: ${field_name}, nuevo valor: ${field_value}`);
      return new Command({
        update: {
          messages: [
            new ToolMessage({
                content: `Activity '${id}' was successfully updated in ministry '${ministry_name}'`,
                name: "success",
                tool_call_id: config.toolCall.id,
                status: "success"
            }),
          ],
        }
      });
    }

    throw new Error('Activity not found or update failed');
  } catch (error) {
    console.error('Update activity error:', error);
    return `Failed to update activity: ${error.message}`;
  }
}, {
  name: 'update_activity_field',
  description: 'Updates a single field in the Actividades table.',
  schema: z.object({
    activity_id: z.number().positive().describe('ID of the activity to be updated.'),
    field_name: z.enum(activityColumns).describe('Name of the field to be updated in the actividades table. Pick the most similar from this list: ' + activityColumns.join(', ')),
    field_value: z.string().min(1).describe('New value for the specified field.'),
    ministry_id: z.number().positive().describe('ID of the ministry to which the activity belongs. Use check_nombre_ministerios tool to find the ministry ID.'),
    activity_date: z.string().describe('Date of the activity in YYYY-MM-DD format.'),
  }),
});

export default updateActivityField;