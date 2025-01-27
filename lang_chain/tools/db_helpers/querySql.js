import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import { runQueryReadOnlyPublicTables } from '#db/query.js';
import { getSessionData } from '../../../utils/activeSessionsData.js';

/**
 * @typedef {Object} CacheEntry
 * @property {string} data - Cached query result
 * @property {number} timestamp - Cache entry creation time
 */

const CACHE_TTL = 0 * 1000; // Cache disabled
const QUERY_TIMEOUT = 10000; // 10 seconds
const MAX_RESULTS = 1000;

/** @type {Map<string, CacheEntry>} */
const queryCache = new Map();

/**
 * Validates and sanitizes SQL query
 * @param {string} query - Raw SQL query
 * @returns {boolean} - Whether query is valid
 */
const isValidQuery = (query) => {
  if (!query || typeof query !== 'string') return false;
  const sanitized = query.trim().toLowerCase();
  // Prevent non select queries
  return sanitized.startsWith('select');
};

const QuerySql = tool(async ({ query }, config) => {
  console.log('[[[ TOOL ]]] QuerySql input:', JSON.stringify({ query }));
  const { userId } = getSessionData(config.configurable.thread_id);
  console.log('[[[ TOOL ]]] QuerySql userId:', userId);
  try {
      if (!query || typeof query !== 'string' || !query.trim().toLowerCase().startsWith('select')) return 'Error: Only single SELECT statements are allowed';

      // Check cache
    const cached = queryCache.get(query);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return cached.data;
    }

    // Execute query with timeout
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Query timeout')), QUERY_TIMEOUT)
    );
    const queryPromise = runQueryReadOnlyPublicTables(query, userId);
    
    const result = await Promise.race([queryPromise, timeoutPromise]);

    const limitedResult = Array.isArray(result) 
      ? result.slice(0, MAX_RESULTS)
      : result;

    const formattedResult = JSON.stringify(limitedResult);
    queryCache.set(query, {
      data: formattedResult,
      timestamp: Date.now()
    });

    return formattedResult;
  } catch (error) {
    const errorMessage = `Database error: ${error.message}.
      Use the tool 'info-sql-tool' to query the correct table fields.`;
    console.error(errorMessage);
    return errorMessage;
  }
}, {
  name: 'query-sql',
  description: "Executes read-only SQL queries. Input must be a valid SELECT statement using PostgreSQL sintax. Returns JSON-formatted results. If the query is not correct, an error message will be returned. If an error is returned, rewrite the query, check the query, and try again. If you encounter an issue with Unknown column 'xxxx' in 'field list', use info-sql-tool to query the correct table fields. Use this tool only if there are no other more specific tools to complete the request.",
  schema: z.object({
    query: z.string()
      .min(1)
      .describe("Detailed and correct SQL query. Must be a SELECT statement using PostgreSQL syntax."),
  }),
  verbose: false
});

export default QuerySql;