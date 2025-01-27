import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import { runQueryPublicTables } from '#db/query.js';
import { addLogFunction } from '../../../utils/addAuditLog.js';
import { ToolMessage } from "@langchain/core/messages";
import { Command } from "@langchain/langgraph";
import { userCanAccessActivity, activityMatchesId } from '../securityChecks.js';
import { getSessionData } from '../../../utils/activeSessionsData.js';

/**
 * @description Registers attendance for multiple members to an activity
 * @returns {Promise<string>} Success or error message
 * @throws {Error} When database operations fail
 */
const registerAttendance = tool(async ({ activity_id, member_ids, ministry_id, activity_date }, config) => {
  const { userId } = getSessionData(config.configurable.thread_id);

  try {
    // Security: Verify activity id matches ministry and date
    await activityMatchesId(activity_id, ministry_id, activity_date);  

    // Verify the user has access to the ministry to create this activity
    await userCanAccessActivity(ministry_id, userId);

    // Register attendance with safe parameterized query
    const result = await runQueryPublicTables({
      query: `
        WITH inserted_attendance AS (
          INSERT INTO attendances (activity_id, person_id)
          SELECT $1, unnest($2::integer[])
          ON CONFLICT (activity_id, person_id) DO NOTHING
          RETURNING activity_id, person_id
        )
        SELECT i.person_id, m.name as ministry_name
        FROM inserted_attendance i
        JOIN activities a ON a.id = i.activity_id
        JOIN ministries m ON m.id = a.ministry_id;
      `,
      values: [activity_id, member_ids]
    });

    if (result.rows.length === 0) {
      throw new Error('No rows were inserted. Possibly already registered or invalid data');
    }

    addLogFunction(userId, "Registrar asistencia", "Actividades", 
      `Registrar asistencia para ${result.rows.length} miembros en la actividad del ministerio "${ministry_name}" en la fecha ${activity_date}`);

    return new Command({
      update: {
          messages: [
              new ToolMessage({
                content: `Successfully registered attendance for ${result.rows.length} member(s) in ministry "${ministry_name}" on date ${activity_date}`,
                name: "success",
                tool_call_id: config.toolCall.id,
                status: "success"
              }),
            ],
      }
    });

  } catch (error) {
    console.error('Register attendance error:', error);
    return 'An error occurred while registering attendance';
  }
}, {
  name: 'register_attendance',
  description: 'Register attendance for multiple members to an activity',
  schema: z.object({
    activity_id: z.number().positive().int().describe('ID of the activity for which attendance is being registered.'),
    member_ids: z.array(z.number().positive().int()).min(1).max(1000).describe('Array of member IDs who attended the activity. Use tool check_nombres to find member IDs.'),
    ministry_id: z.number().positive().describe('ID of the ministry to which the activity belongs. Use tool check_nombre_ministerios to find the ministry ID.'),
    activity_date: z.string().describe('Date of the activity in YYYY-MM-DD format.'),
  }),
});

export default registerAttendance;
