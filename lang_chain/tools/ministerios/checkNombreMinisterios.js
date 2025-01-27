/**
 * @fileoverview Tool for searching and validating ministry names in the database
 * @module tools/ministerios/checkNombreMinisterios
 * 
 * @description This tool searches for existing ministries with similar names using
 * PostgreSQL's trigram similarity matching. It helps prevent duplicate entries and
 * provides search capabilities for existing ministries.
 * 
 * @requires {@link @langchain/core/tools}
 * @requires {@link zod}
 * @requires {@link #db/query}
 */

import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import { runQueryPublicTables } from '#db/query.js';

const minSimilarity = 0.5;

const checkNombreMinisterios = tool(async ({ ministry_name }) => {
  console.log('[[[ TOOL ]]] checkNombreMinisterios input:', JSON.stringify({ ministry_name }));
  try {
    const sqlQuery = `
        SELECT id, name, description, parent_ministry_id  
        FROM ministries 
        WHERE 
            SIMILARITY(normalized_name, LOWER(unaccent($1))) > $2
        ORDER BY 
            SIMILARITY(normalized_name, LOWER(unaccent($1))) DESC;
    `;  
    
    const result = await runQueryPublicTables({
      query: sqlQuery,
      values: [ministry_name, minSimilarity]
    });

    if (!result?.rows?.length) {
      return `No ministries found similar to "${ministry_name}"`;
    }

    const ministries = result.rows.map(row => 
      `Name: ${row.name}, Description: ${row.description}, (ID: ${row.id})`
    ).join('\n');

    return `Found similar ministries:\n${ministries}`;

  } catch (error) {
    console.error('Ministry search error:', error);
    return 'An error occurred while searching for ministries. Please try again.';
  }
}, {
  name: 'check_nombre_ministerios',
  description: 'Searches for ministries by name using fuzzy matching. Returns matching member ministry names and IDs. Input should be the approximate ministry name to search for.',
  schema: z.object({
    ministry_name: z.string()
      .min(1, { message: "Name is required" })
      .describe('Name of the ministry to search for. The search is accent-insensitive and uses fuzzy matching to find similar names.'),
  }),
});

export default checkNombreMinisterios;
