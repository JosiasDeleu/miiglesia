/**
 * Adds an audit log entry to the database
 * @param {string} action - The action being logged
 * @param {number|string} affectedId - The ID of the affected record
 * @param {string} affectedObject - The type of object being affected
 * @returns {Promise<{success: boolean, message: string}>} Result of the operation
 * @throws {Error} When database operation fails or validation errors occur
 */
import { runQueryPrivateTables } from '#db/query.js';

export async function addLogFunction(userId, action, category, detail) {
  // Input validation
  if (!action || typeof action !== 'string') {
    throw new Error('Invalid action parameter');
  }
  if (!detail) {
    throw new Error('Invalid detail parameter');
  }
  if (!userId) {
    throw new Error('Invalid userId parameter');
  }

  try {
    const sqlQuery = `
      INSERT INTO audit_log (user_id, action, affected_object, detail, timestamp) 
      VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
    `;
    const values = [userId, action, category, detail];
    
    await runQueryPrivateTables({ query: sqlQuery, values });
    return { success: true, message: "Log entry added successfully" };
    
  } catch (error) {
    throw new Error(`Failed to add audit log: ${error.message}`);
  }
}
