import { runQueryPublicTables } from '#db/query.js';

/**
 * Retrieves all column names for a specified database table
 * @param {string} tableName - The name of the table to query
 * @returns {Promise<string[]>} Array of column names
 * @throws {Error} If tableName is invalid or database query fails
 */
export async function getTableColumns(tableName) {
    if (typeof tableName !== 'string' || !tableName.trim()) {
        throw new Error('Invalid table name parameter');
    }

    const sqlQuery = `
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = $1
        AND column_name != 'id'
        ORDER BY ordinal_position;
    `;
    const values = [tableName];

    try {
        const result = await runQueryPublicTables({ query: sqlQuery, values });
        return result.rows.map(row => row.column_name);
    } catch (error) {
        throw new Error(`Failed to fetch table columns: ${error.message}`);
    }
}