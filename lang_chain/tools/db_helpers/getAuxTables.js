/**
 * @fileoverview Helper functions to interact with auxiliary database tables
 * @module db_helpers/getAuxTables
 */

import { runQueryPublicTables } from '#db/query.js';

// List of valid auxiliary tables for validation
const AUXILIARY_TABLES = Object.freeze([
    'aux_discipleships',
    'aux_marital_statuses',
    'aux_membership',
    'aux_relationships',
    'aux_ministry_roles'
]);

/**
 * Retrieves all values from a specified auxiliary table
 * @param {string} tableName - Name of the auxiliary table
 * @returns {Promise<string[]>} Array of values from the table
 * @throws {Error} If invalid table name is provided
 */
export async function getAuxTablesValues(tableName) {
    if (!AUXILIARY_TABLES.includes(tableName)) {
        throw new Error(`Invalid table name: ${tableName}`);
    }

    try {
        const sqlQuery = `SELECT name FROM ${tableName}`;  // Changed 'nombre' to 'name'
        const values = [];
        const result = await runQueryPublicTables({query: sqlQuery, values});
        return result.rows.map(row => row.name);  // Changed 'nombre' to 'name'
    } catch (error) {
        console.error('Error retrieving auxiliary table data:', error);
        throw error; // Re-throw to handle in caller
    }
}

/**
 * Retrieves ID for a specific value from an auxiliary table
 * @param {string} tableName - Name of the auxiliary table
 * @param {string} value - Value to look up
 * @returns {Promise<number|null>} ID of the matching row or null if not found
 * @throws {Error} If invalid table name is provided
 */
export async function getAuxTablesId(tableName, value) {
    if (!AUXILIARY_TABLES.includes(tableName)) {
        throw new Error(`Invalid table name: ${tableName}`);
    }

    if (!value || typeof value !== 'string') {
        throw new Error('Invalid value parameter');
    }

    try {
        const sqlQuery = `SELECT id FROM ${tableName} WHERE name = $1`;  // Changed 'nombre' to 'name'
        const values = [value];
        const result = await runQueryPublicTables({query: sqlQuery, values});
        return result.rows[0]?.id || null;
    } catch (error) {
        console.error('Error retrieving auxiliary table ID:', error);
        throw error; // Re-throw to handle in caller
    }
}

/**
 * Retrieves sorted list of all Ministerios names
 * @returns {Promise<string[]>} Array of Ministerios names
 * @throws {Error} If database query fails
 */
export async function getMinisteriosList() {
    try {
        const values = [];
        const result = await runQueryPublicTables({
            query: 'SELECT name FROM ministries ORDER BY name',  // Changed from 'Ministerios' and 'nombre'
            values
        });
        return result.rows.map(row => row.name);  // Changed 'nombre' to 'name'
    } catch (error) {
        console.error('Error retrieving Ministerios data:', error);
        throw error; // Re-throw to handle in caller
    }
}
