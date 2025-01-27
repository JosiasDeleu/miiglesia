import {pool} from './dbPool.js';
import { isReadOnlyQuery, rewriteQueryWithPermissions, hasPrivateTables } from './queryProcessor.js';
import { findSessionByUserId } from '../utils/activeSessionsData.js';
import dotenv from 'dotenv';
dotenv.config();

const ADMIN_USER_ID = Number(process.env.ADMIN_USER_ID);

/**
 * Executes a query on public tables with parameter binding
 * @param {Object} params - Query parameters
 * @param {string} params.query - SQL query to execute
 * @param {Array} params.values - Values to bind to the query
 * @throws {Error} If query attempts to access private tables or database error occurs
 * @returns {Promise<QueryResult>} Query execution result
 */
export const runQueryPublicTables = async ({ query, values }) => {
    console.log('runQueryPublicTables. Query:', query, '. Values:', JSON.stringify(values));
    
    if (!query) throw new Error('Query is required');
    if (hasPrivateTables(query)) {
        throw new Error('Access denied: Query contains private tables');
    }

    const client = await pool.connect();
    try {
        return await client.query(query, values);
    } finally {
        client.release();
    }
};

/**
 * Executes a read-only query on public tables with permission checks
 * @param {string} query - SQL query to execute
 * @throws {Error} If query is not read-only or attempts to access private tables
 * @returns {Promise<QueryResult>} Query execution result
 */
export const runQueryReadOnlyPublicTables = async (query, userId) => {

    if (!query) throw new Error('Query is required');
    if (!isReadOnlyQuery(query)) {
        throw new Error('Access denied: Write operations not permitted');
    }
    if (hasPrivateTables(query)) {
        throw new Error('Access denied: Query contains private tables');
    }

    const sessionData = findSessionByUserId(userId);
    const client = await pool.connect();
    try {
        const queryWithLimits = sessionData?.userRole !== ADMIN_USER_ID 
            ? await rewriteQueryWithPermissions(query, userId)
            : query;

        return await client.query(queryWithLimits);
    } finally {
        client.release();
    }
};

/**
 * Executes a query on private tables (restricted access)
 * @param {Object} params - Query parameters
 * @param {string} params.query - SQL query to execute
 * @param {Array} params.values - Values to bind to the query
 * @throws {Error} If database error occurs
 * @returns {Promise<QueryResult>} Query execution result
 */
export const runQueryPrivateTables = async ({ query, values }) => {
    console.log('runQueryPrivateTables. Query:', query, '. Values:', JSON.stringify(values));

    if (!query) throw new Error('Query is required');
    
    const client = await pool.connect();
    try {
        return await client.query(query, values);
    } finally {
        client.release();
    }
};