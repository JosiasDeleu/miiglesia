import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import ExcelJS from 'exceljs';
import path from 'path';
import fs from 'fs';
import { ToolMessage } from "@langchain/core/messages";
import { Command } from "@langchain/langgraph";

/**
 * Creates an Excel file from tabular data and saves it locally
 * @param {Object} input - The input object containing table data
 * @param {Object} config - The configuration object containing tool call information
 * @returns {Promise<Command>} A command object containing the operation result
 * @throws {Error} If file operations fail or input is invalid
 */
const exportExcelFile = tool(async ({ table_data }, config) => {
  try {
    // Validate table structure
    if (table_data.trim().length === 0) {
      throw new Error('Table data cannot be empty');
    }

    // Parse table string into rows with validation
    const rows = table_data.split('\n')
      .map(line => line.split('|')
        .map(cell => cell.trim())
        .filter(cell => cell !== ''))
      .filter(row => row.length > 0);

    if (rows.length === 0) {
      throw new Error('No valid data rows found');
    }

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Report');

    worksheet.addRows(rows);

    // Generate filename with timestamp and sanitize
    const timestamp = new Date().toISOString().replace(/[^0-9]/g, '');
    const fileName = `report_${timestamp}.xlsx`;
    const reportsDir = path.join(process.cwd(), 'reportes');
    const filePath = path.join(reportsDir, fileName);

    // Secure directory creation and path validation
    const normalizedPath = path.normalize(reportsDir);
    if (!normalizedPath.startsWith(process.cwd())) {
      throw new Error('Invalid file path detected');
    }

    await fs.promises.mkdir(normalizedPath, { recursive: true, mode: 0o755 });
    await workbook.xlsx.writeFile(filePath);

    return new Command({
      update: {
        messages: [
          new ToolMessage({
            content: `Excel file successfully saved to: ${fileName}`,
            name: "success",
            tool_call_id: config.toolCall.id,
            status: "success"
          }),
        ],
      }
    });

  } catch (error) {
    console.error('Error creating Excel file:', error.message, error.stack);
    return `Error creating Excel file: ${error.message}`;
  }
}, {
  name: 'export_excel_file',
  description: 'Creates an Excel file from a table string input and saves it locally',
  schema: z.object({
    table_data: z.string()
      .min(1, { message: "Table data is required" })
      .describe('Table data as a string with rows separated by newlines and columns separated by the pipe symbol "|".')
  }),
});

export default exportExcelFile;
