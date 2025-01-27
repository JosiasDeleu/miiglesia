/**
 * @fileoverview Tool for fuzzy searching members by name in the database
 * @module tools/miembros/checkNombres
 * 
 * @requires pg_trgm PostgreSQL extension for fuzzy string matching
 * @requires fuzzystrmatch PostgreSQL extension for phonetic matching
 * 
 * @description
 * This tool performs fuzzy name matching against the miembros table
 * using PostgreSQL's pg_trgm and fuzzystrmatch extensions.
 * It helps identify potential duplicate entries and verify member existence.
 * 
 * @example
 * const result = await CheckNombres({ nombreCompleto: "John Smith" });
 * // Returns: "One member found: John Smith (Id: 123)"
 * 
 * @returns {Promise<string>} A formatted string containing matching members
 * @throws {Error} If the name is empty or database query fails
 */

// This tool uses pg_trgm extension for fuzzy search with similarity threshold
// and fuzzystrmatch for phonetic string comparison
// Note: Threshold can be adjusted with: SET pg_trgm.similarity_threshold = 0.5;

import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import { runQueryPublicTables } from '#db/query.js';

const minSimilarity = 0.5;

const CheckNombres = tool(async ({ nombreCompleto }) => {

  console.log('Searching for member:', nombreCompleto);

  try {
    const sqlQuery = `
    SELECT 
        (first_middle_name || ' ' || last_name) AS nombre_completo, 
        id
    FROM 
        people
    WHERE 
        SIMILARITY(normalized_full_name, LOWER(unaccent($1))) > $2
        AND active = true
    ORDER BY 
        SIMILARITY(normalized_full_name, LOWER(unaccent($1))) DESC;
    `;
    
    const result = await runQueryPublicTables({
      query: sqlQuery, 
      values: [nombreCompleto, minSimilarity]
    });

    console.log('Name query result:', JSON.stringify(result.rows));
    
    if (result.rows.length === 0) {
      return "No members found with this name.";
    }

    const formattedMembers = result.rows.map(member => 
      `${member.nombre_completo} (Id: ${member.id})`
    );
    
    if (result.rows.length === 1) {
      return `One member found: ${formattedMembers[0]}`
    }
    else {
      return `Several members found with similar names: ${formattedMembers.join(', ')}`
    }

  } catch (error) {
    console.error('Database query error:', error);
    throw new Error('Failed to search for members');
  }
}, {
  name: 'check_nombres',
  description: 'Searches for members by name using fuzzy matching. Returns matching member names and IDs. Input should be the approximate name to search for.',
  schema: z.object({
    nombreCompleto: z.string()
      .min(2, { message: "Name must be at least 2 characters long" })
      .max(100, { message: "Name cannot exceed 100 characters" })
      .trim()
      .describe("Full name of the person to search for. Can include first name, middle name, and/or last names. The search is accent-insensitive and uses fuzzy matching to find similar names.")
  }),
  verbose: false
});

export default CheckNombres;

