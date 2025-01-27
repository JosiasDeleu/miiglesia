import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import { prompts_table_descriptions} from '../../prompts/prompts_table_descriptions.js';
import { DATABASE_TABLES} from '../../prompts/prompts_agents.js';

/**
 * Retrieves schema and sample data for the specified table from the database.
 * Ensures only recognized table names are used to mitigate SQL injection risks.
 */
const InfoSqlTool = tool(
  async ({ table }) => {
    console.log('[[[ TOOL ]]] InfoSqlTool input:', JSON.stringify({ table }));
    try {
      const tableDesc = prompts_table_descriptions[table];
      return tableDesc || 'No prompt description available';
    } catch (error) {
      return `Error: ${error.message}`;
    }
  },
  {
    name: 'info-sql-tool',
    description: 'Retrieves schema and sample data for a specific table. Use this tool to get a description of the fields in a table.',
    schema: z.object({
      table: z.enum(DATABASE_TABLES).describe("Table name to query. Pick a table from the list: " + DATABASE_TABLES.join(', ')),
    }),
  }
);

export default InfoSqlTool;