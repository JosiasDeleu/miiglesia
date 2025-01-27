import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import { runQueryPublicTables } from '#db/query.js';
import { addLogFunction } from '../../../utils/addAuditLog.js';
import { ToolMessage } from "@langchain/core/messages";
import { Command } from "@langchain/langgraph";
import { userCanAccessActivity, activityMatchesId, memberMatchesId } from '../securityChecks.js';
import { getSessionData } from '../../../utils/activeSessionsData.js';

/**
 * Removes an attendance record for a member from a specific activity.
 * @throws {Error} When database operations fail
 * @returns {Promise<string>} Success or error message
 */
const removeAttendance = tool(async ({ activity_id, member_id, ministry_id, activity_date, member_name }, config) => {
    const { userId } = getSessionData(config.configurable.thread_id);

    try {
        // Security: Verify activity id matches ministry and date
        await activityMatchesId(activity_id, ministry_id, activity_date);  

        // Verify member name matches ID
        await memberMatchesId(member_id, member_name);

        // Verify the user has access to the ministry to create this activity
        await userCanAccessActivity(ministry_id, userId);

        // Verify attendance record exists using parameterized query
        const checkResult = await runQueryPublicTables({
            query: 'SELECT 1 FROM attendances WHERE activity_id = $1 AND person_id = $2',
            values: [activity_id, member_id]
        });

        if (checkResult.rows.length === 0) {
            return `Attendance record not found for the specified member and activity`;
        }

        // Delete attendance record using parameterized query
        const result = await runQueryPublicTables({
            query: `
                WITH attendance_info AS (
                    SELECT a.activity_id, a.person_id, m.name as ministry_name
                    FROM attendances a
                    JOIN activities act ON act.id = a.activity_id
                    JOIN ministries m ON m.id = act.ministry_id
                    WHERE a.activity_id = $1 AND a.person_id = $2
                )
                DELETE FROM attendances 
                WHERE activity_id = $1 AND person_id = $2
                RETURNING (SELECT ministry_name FROM attendance_info);
            `,
            values: [activity_id, member_id]
        });

        if (result.rowCount > 0) {
            const { ministry_name } = result.rows[0];
            addLogFunction(userId, "Eliminar asistencia", "Actividades", 
                `Eliminar asistencia para miembro '${member_name}' de la actividad '${activity_id}' del ministerio '${ministry_name}' con fecha ${activity_date}`);
            return new Command({
                update: {
                    messages: [
                        new ToolMessage({
                            content: `Successfully removed attendance for member '${member_name}' from activity '${activity_id}' in ministry '${ministry_name}'`,
                            name: "success",
                            tool_call_id: config.toolCall.id,
                            status: "success"
                        }),
                    ],
                }
            });
        }
        
        throw new Error('Database delete operation failed');
    } catch (error) {
        throw new Error(`Failed to remove attendance: ${error.message}`);
    }
}, {
    name: 'remove_attendance',
    description: 'Removes an attendance record for a member from a specific activity',
    schema: z.object({
        activity_id: z.number().positive().int().describe('ID of the activity.'),
        member_id: z.number().positive().int().describe('ID of the member. Use check_nombres tool to find the member ID.'),
        ministry_id: z.number().positive().describe('ID of the ministry to which the activity belongs. Use check_nombre_ministerios tool to find the ministry ID.'),
        activity_date: z.string().describe('Date of the activity in YYYY-MM-DD format.'),
        member_name: z.string().describe('Validated full name of the person to be removed. Use the check_nombres tool to get the valid full name.')
    }),
});

export default removeAttendance;