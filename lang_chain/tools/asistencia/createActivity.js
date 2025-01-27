import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import { runQueryPublicTables } from '#db/query.js';
import { addLogFunction } from '../../../utils/addAuditLog.js'
import { getSessionData } from '../../../utils/activeSessionsData.js';
import { ToolMessage } from "@langchain/core/messages";
import { Command } from "@langchain/langgraph";
import { userCanAccessActivity } from '../securityChecks.js';

/**
 * Validates if a date is in the past or present
 * @param {string} date - Date string to validate
 * @returns {boolean} - True if date is valid and not in the future
 */
const validatePastDate = (date) => {
  const parsedDate = new Date(date);
  return parsedDate instanceof Date && 
         !isNaN(parsedDate) && 
         parsedDate <= new Date();
};

/**
 * Creates a new activity entry with security validation and logging
 * @typedef {Object} ActivityInput
 * @property {string} Fecha - Activity date
 * @property {number} ministry_id - Ministry ID
 */
const CreateActividad = tool(async ({ activity_date, ministry_id }, config) => {
  const { userId } = getSessionData(config.configurable.thread_id);

  try {
    if (!validatePastDate(activity_date)) {
      return 'Error: Date must be in the past or present';
    }

    await userCanAccessActivity(ministry_id);

    // Security: Using parameterized query to prevent SQL injection
    const sqlQuery = `
      WITH inserted_activity AS (
        INSERT INTO activities (
          ministry_id, date, user_id, creation_date
        )
        VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
        RETURNING id, ministry_id
      )
      SELECT a.id, m.name as ministry_name
      FROM inserted_activity a
      JOIN ministries m ON m.id = a.ministry_id;
    `;
    
    const result = await runQueryPublicTables({ 
      query: sqlQuery, 
      values: [ministry_id, activity_date, userId] 
    });

    if (result.rows.length === 1) {
      const { id: activityId, ministry_name: ministryName } = result.rows[0];
      addLogFunction(userId, "Crear", "Actividades", `Crear actividad con ID: ${activityId}, fecha: ${activity_date}, ministerio: ${ministryName}`);
      return new Command({
        update: {
            messages: [
                new ToolMessage({
                  content: `Activity created successfully with ID: ${activityId} for ministry: ${ministryName}`,
                  name: "success",
                  tool_call_id: config.toolCall.id,
                  status: "success"
                }),
              ],
        }
      });
    }
    
    throw new Error('Failed to create activity');
  } catch (error) {
    console.error('Activity creation error:', error.message);
    return `Error: ${error.message}`;
  }
}, {
  name: 'create_activity',
  description: 'Creates a new activity with required date and ministry ID',
  schema: z.object({
    activity_date: z.string().min(1).describe('Date of the activity in YYYY-MM-DD format.'),
    ministry_id: z.number().int().positive().describe('ID of the ministry to which the activity belongs. Use check_nombre_ministerios tool to find the ministry ID.'),
  }),
});

export default CreateActividad;