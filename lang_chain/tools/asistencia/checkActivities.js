/**
 * @fileoverview Tool for searching activities by ministry and date
 * @module tools/asistencia/checkActivities
 */

import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import { runQueryPublicTables } from '#db/query.js';
import { getMinisteriosList } from '../ministerios/db_helpers/getAuxTables.js';

const opcionesMinisterios = await getMinisteriosList();

const CheckActivities = tool(async ({ ministry, date }) => {
  // Validate and format date
  const dateValue = new Date(date);
  if (isNaN(dateValue.getTime())) {
    throw new Error('Invalid date format. Please provide a valid date.');
  }
  const formattedDate = dateValue.toISOString().split('T')[0];

  try {
    const sqlQuery = `
    SELECT 
        a.id,
        m.name as ministry_name,
        a.date
    FROM 
        activities a
        JOIN ministries m ON m.id = a.ministry_id
    WHERE 
        UPPER(unaccent(m.name)) = UPPER(unaccent($1))
        AND a.date = $2
    ORDER BY 
        a.date DESC;
    `;
    
    const result = await runQueryPublicTables({
      query: sqlQuery, 
      values: [ministry.trim(), formattedDate]
    });

    if (result.rows.length === 0) {
      return `No activities found for ministry "${ministry}" on ${date}`;
    }

    const formattedActivities = result.rows.map(activity => 
      `Activity ID: ${activity.id}, Ministry: ${activity.ministry_name}, Date: ${activity.date.toISOString().split('T')[0]}`
    );
    
    return `Found activities:\n${formattedActivities.join('\n')}`;

  } catch (error) {
    console.error('Database query error:', error);
    throw new Error('Failed to search for activities');
  }
}, {
  name: 'check_activities',
  description: 'Searches for activities by ministry name and date. Returns matching activity IDs, ministry names, and dates.',
  schema: z.object({
    ministry: z.enum(opcionesMinisterios)
      .describe("Name of the ministry to search for. User the 'check_nombre_ministerios' tool to find the ministry name. Select the most similar from this list: " + opcionesMinisterios.join(', ')),
    date: z.string()
      .describe("Date of the activity in any valid date format (YYYY-MM-DD recommended)")
  }),
  verbose: false
});

export default CheckActivities;

