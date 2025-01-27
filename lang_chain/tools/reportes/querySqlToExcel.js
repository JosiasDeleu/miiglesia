import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import { runQueryReadOnlyPublicTables } from '#db/query.js';
import ExcelJS from 'exceljs';
import path from 'path';
import { fileURLToPath } from 'url';
import { ToolMessage } from "@langchain/core/messages";
import { Command } from "@langchain/langgraph";
import { getSessionData } from '../../../utils/activeSessionsData.js';
import { mkdir } from 'fs/promises';

/**
 * @typedef {Object} QueryCacheEntry
 * @property {Array<Object>} data - Cached query results
 * @property {number} timestamp - Cache entry creation timestamp
 */

// Configuration constants
const CACHE_TTL = 0 * 60 * 1000; // 0 minutes
const QUERY_TIMEOUT = 30000; // 30 seconds
const MAX_RESULTS = 10000;

/** @type {Map<string, QueryCacheEntry>} */
const queryCache = new Map();

/**
 * Validates and sanitizes SQL query
 * @param {string} query - SQL query to validate
 * @returns {boolean} - Whether the query is valid
 */
const isValidQuery = (query) => {
  if (!query || typeof query !== 'string') return false;
  const sanitized = query.trim().toLowerCase();
  return sanitized.startsWith('select');
};

/**
 * Ensures the directory exists, creates it if it doesn't
 * @param {string} dirPath - Directory path to check/create
 */
async function ensureDirectoryExists(dirPath) {
  try {
    await mkdir(dirPath, { recursive: true });
  } catch (error) {
    if (error.code !== 'EEXIST') {
      throw error;
    }
  }
}

/**
 * Saves query results to Excel file with formatting
 * @param {Array<Object>} data - Query results to save
 * @returns {Promise<string>} - Path to saved Excel file
 */
export async function saveToExcel(data) {
  if (!Array.isArray(data) || data.length === 0) {
    throw new Error('Invalid data format');
  }

  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Query Results');
  
  if (data.length > 0) {
    // Set headers
    worksheet.columns = Object.keys(data[0]).map(key => ({
      header: key,
      key: key,
      width: 15 // Default width
    }));

    // Add rows
    worksheet.addRows(data);

    // Auto fit columns width based on content (max 50)
    worksheet.columns.forEach(column => {
      let maxLength = 0;
      column.eachCell({ includeEmpty: true }, cell => {
        const columnLength = cell.value ? cell.value.toString().length : 10;
        maxLength = Math.max(maxLength, columnLength);
      });
      column.width = Math.min(50, Math.max(12, maxLength + 2));
    });

    // Style the header row
    const headerRow = worksheet.getRow(1);
    headerRow.font = {
      bold: true,
      color: { argb: 'FFFFFF' }
    };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: '2F75B5' }
    };
    headerRow.alignment = {
      vertical: 'middle',
      horizontal: 'center'
    };

    // Add borders to all cells
    worksheet.eachRow({ includeEmpty: true }, row => {
      row.eachCell({ includeEmpty: true }, cell => {
        cell.border = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' }
        };
        // Align text to the left for data cells
        if (row.number !== 1) {
          cell.alignment = {
            vertical: 'middle',
            horizontal: 'left'
          };
        }
      });
    });

    // Freeze the header row
    worksheet.views = [
      { state: 'frozen', xSplit: 0, ySplit: 1 }
    ];
  }

  // Create filename with timestamp in a secure way
  const timestamp = new Date().toISOString().replace(/[^0-9]/g, '');
  // const dirname = path.dirname(fileURLToPath(import.meta.url));
  const reportsDir = process.env.REPORTS_DIR;
  const filename = `Mi_Iglesia_Reporte_${timestamp}.xlsx`;
  console.log('filename:', filename);
  const filepath = path.join(reportsDir, filename);

  // Ensure directory exists before writing file
  await ensureDirectoryExists(reportsDir);
  
  await workbook.xlsx.writeFile(filepath);
  console.log(`Excel file saved at: ${filepath}`);
  return filename;
}

/**
 * LangChain tool that executes SQL queries and generates Excel reports
 * @param {Object} input - Tool input containing SQL query
 * @param {Object} config - Tool configuration
 * @returns {Promise<Command>} - Command with execution result
 * @throws {Error} - On query execution failure or invalid input
 */
const QuerySqlToExcel = tool(async ({ sql_query }, config) => {
  const { userId } = getSessionData(config.configurable.thread_id);
  console.log("Starting QuerySqlToExcel tool with query:", sql_query);
  try {
    // Security validation
    if (!isValidQuery(sql_query)) {
      throw new Error('Invalid query: Only SELECT statements are allowed');
    }

    const cacheKey = sql_query.toLowerCase().trim();
    const cached = queryCache.get(cacheKey);
    let limitedResult;
    
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      limitedResult = cached.data;
    } else {
      const result = await Promise.race([
        runQueryReadOnlyPublicTables(sql_query, userId),
        new Promise((_, reject) => setTimeout(() => 
          reject(new Error('Query execution timeout')), QUERY_TIMEOUT))
      ]);

      if (!result?.rows?.length) {
        throw new Error('Query returned no results');
      }

      limitedResult = result.rows.slice(0, MAX_RESULTS);
    }

    const filepath = await saveToExcel(limitedResult);

    queryCache.set(cacheKey, {
      data: limitedResult,
      timestamp: Date.now(),
      filepath
    });

    return new Command({
      update: {
        messages: [
          new ToolMessage({
            content: `Excel file created successfully with this name: ${filepath}`,
            name: "success",
            tool_call_id: config.toolCall.id,
            status: "success"
          }),
        ],
      }
    });

  } catch (error) {
    throw new Error(`Query execution failed: ${error.message}`);
  }
}, {
  name: 'query-sql-excel',
  description: "Executes SELECT queries and generates Excel reports. Input must be a valid SQL SELECT statement. Output is the name of the Excel file generated.",
  schema: z.object({
    sql_query: z.string().describe("SQL SELECT query to execute")
  })
});

export default QuerySqlToExcel;



// const testData = [
//   { id: 1, name: 'John Doe', email: 'john@example.com' },
//   { id: 2, name: 'Jane Smith', email: 'jane@example.com' },
//   { id: 3, name: 'Bob Wilson', email: 'bob@example.com' }
// ];

// async function test() {
//   try {
//     const filePath = await saveToExcel(testData);
//     console.log('Excel file created successfully at:', filePath);
//   } catch (error) {
//     console.error('Error creating Excel file:', error);
//   }
// }

// test();