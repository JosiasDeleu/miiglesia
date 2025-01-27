import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import { runQueryPublicTables } from '#db/query.js';

/**
 * @description Retrieves and formats a list of members associated with a ministry, grouped by their roles
 * @returns {Promise<string>} Formatted string containing members grouped by roles
 * @throws {Error} If database query fails or invalid input is provided
 */
const getAttendees = tool(async ({ ministry_id }) => {
  try {
    const query = `
      SELECT 
        m.first_middle_name || ' ' || m.last_name as full_name,
        ar.name as role
      FROM people_ministries mm
      JOIN people m ON m.id = mm.person_id
      JOIN aux_ministry_roles ar ON ar.id = mm.role_id
      WHERE mm.ministry_id = $1
      ORDER BY ar.name, m.last_name, m.first_middle_name;
    `;

    const result = await runQueryPublicTables({
      query,
      values: [ministry_id]
    });

    if (!result?.rows?.length) {
      return `No members found for ministry ID: ${ministry_id}`;
    }

    const membersByRole = result.rows.reduce((acc, row) => {
      const { full_name, role } = row;  // Updated variable names
      if (!acc[role]) {
        acc[role] = [];
      }
      acc[role].push(full_name);
      return acc;
    }, {});

    return Object.entries(membersByRole)
      .map(([role, members]) => 
        `${role}:\n${members.map(m => `- ${m}`).join('\n')}\n`
      )
      .join('\n');

  } catch (error) {
    return `Error retrieving members: ${error.message}`;
  }
}, {
  name: 'get_attendees',
  description: 'Get a list of all members associated with a ministry, grouped by their roles.',
  schema: z.object({
    ministry_id: z.number().int().positive().describe('ID of the ministry. Use check_nombre_ministerios tool to find the ministry ID.'),
  }),
});

export default getAttendees;
