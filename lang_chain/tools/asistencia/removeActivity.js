import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import { runQueryPublicTables } from '#db/query.js';
import { addLogFunction } from '../../../utils/addAuditLog.js';
import { ToolMessage } from "@langchain/core/messages";
import { Command } from "@langchain/langgraph";
import { getSessionData } from '../../../utils/activeSessionsData.js';
import { userCanAccessActivity, activityMatchesId } from '../securityChecks.js';

/**
 * Removes an activity from the database after performing security checks
 * @async
 * @function removeActivity
 * @returns {Promise<string>} A message indicating the result of the operation
 * @throws {Error} If database operations fail
 */
const removeActivity = tool(async ({ activity_id, ministry_id, activity_date }, config) => {
    const { userId } = getSessionData(config.configurable.thread_id);

    try {
        // Security: Verify activity id matches ministry and date
        await activityMatchesId(activity_id, ministry_id, activity_date);  

        // Verify the user has access to the ministry to create this activity
        await userCanAccessActivity(ministry_id, userId);

        const deleteQuery = `
            WITH activity_info AS (
                SELECT a.id, m.name as ministry_name
                FROM activities a
                JOIN ministries m ON m.id = a.ministry_id
                WHERE a.id = $1
            )
            DELETE FROM activities 
            WHERE id = $1
            RETURNING (SELECT ministry_name FROM activity_info);
        `;
        const result = await runQueryPublicTables({
            query: deleteQuery,
            values: [activity_id]
        });

        if (result.rowCount > 0) {
            const { ministry_name } = result.rows[0];
            addLogFunction(userId, "Eliminar", "Actividades", `Eliminar actividad ${activity_id} del ministerio "${ministry_name}" on date ${activity_date}`);
            return new Command({
                update: {
                    messages: [
                        new ToolMessage({
                            content: `Activity ${activity_id} successfully removed`,
                            name: "success",
                            tool_call_id: config.toolCall.id,
                            status: "success"
                        }),
                    ],
                }
            });
        }
        
        throw new Error('Deletion failed');
    } catch (error) {
        console.error('Activity removal failed:', error);
        throw new Error('Failed to remove activity');
    }
}, {
    name: 'remove_activity',
    description: 'Removes an activity from the database',
    schema: z.object({
        activity_id: z.number()
            .int().positive().describe('ID of the activity to be removed.'),
        ministry_id: z.number().positive().describe('ID of the ministry to which the activity belongs. Use check_nombre_ministerios tool to find the ministry ID.'),
        activity_date: z.string().describe('Date of the activity in YYYY-MM-DD format.'),
    }),
});

export default removeActivity;