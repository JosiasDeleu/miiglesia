import pkg from 'node-sql-parser';
import { pool } from './dbPool.js';
import dotenv from 'dotenv';
dotenv.config();

const { Parser } = pkg;
const LIDER_ROL_ID = Number(process.env.LIDER_ROL_ID);
const COLABORADOR_ROL_ID = Number(process.env.COLABORADOR_ROL_ID);
const ALLOWED_ROLES = [LIDER_ROL_ID, COLABORADOR_ROL_ID];

const parser = new Parser();

const sqlParserOptions = {
  database: 'Postgresql'
}

const privateTables = ['audit_log', 'users', 'refresh_tokens', 'aux_user_roles'];  

// This is the member_id associated with the user logged in
let member_id;

async function getMemberId(userId) {
    if (!member_id) {
        let client
        try {
            client = await pool.connect();
            const result = await client.query(
                'SELECT person_id FROM users WHERE id = $1',
                [userId]
            );
            member_id = result.rows[0]?.person_id;
        } catch (error) {
            console.error(error);
            throw error;
        } finally {
            if (client) {
                client.release();
            }
        }
    }
    return member_id;
}

export function isReadOnlyQuery(sqlQuery) {
  try {
      if (!sqlQuery || typeof sqlQuery !== 'string' || sqlQuery.trim() === '') {
          console.error('Invalid SQL query string');
          return false;
      }

      const parsed = parser.astify(sqlQuery, sqlParserOptions);
      if (Array.isArray(parsed)) {
          return parsed.every(stmt => stmt.type === 'select');
      }
      return parsed?.type === 'select';
  } catch (err) {
      console.error('Error while parsing the query:', err);
      return false;
  }
}

// Helper function to recursively check tables in AST
function findTablesInAST(ast, tables = new Set()) {
  if (!ast) return tables;
  if (Array.isArray(ast)) {
    ast.forEach(node => findTablesInAST(node, tables));
  } else if (typeof ast === 'object') {
    if (ast.table) {
      tables.add(ast.table);
    }
    Object.values(ast).forEach(value => findTablesInAST(value, tables));
  }
  return tables;
}

export function hasPrivateTables(sqlQuery) {
  try {
    if (!sqlQuery || typeof sqlQuery !== 'string' || sqlQuery.trim() === '') {
      return false;
    }

    const ast = parser.astify(sqlQuery, sqlParserOptions);
    const tables = findTablesInAST(ast);
    return [...tables].some(table => privateTables.includes(table));
  } catch (err) {
    console.error('Error while checking for private tables:', err);
    return true; // Return true on error to be safe
  }
}

// This function changes the name of a specific table in the AST
function renameTablesInAST(ast, oldName, newName) {
  if (!ast) return;
  if (Array.isArray(ast)) {
    ast.forEach(node => renameTablesInAST(node, oldName, newName));
  } else if (typeof ast === 'object') {
    if (ast.table === oldName) {
      ast.table = newName;
    }
    Object.values(ast).forEach(value => renameTablesInAST(value, oldName, newName));
  }
}

// This function adds a condition to the AST if the query uses the 'personas' table, to show only the people assigned to a ministry in which the user is a lider or collaborator.
// It appends a condition to the WHERE clause of the query, to filter the results based on the user's permissions:
//      1. It first check to what ministries the user is added as a lider or collaborator.
//      2. Then it gets the list of members linked to that ministry.
async function addConditionIfHasPersonas(ast, userId) {
  if (ast && ast.type === 'select' && ast.from) {
    const fromItems = Array.isArray(ast.from) ? ast.from : [ast.from];
    const usesPersonas = fromItems.some(item => item && item.table === 'vw_people');
    if (usesPersonas) {
        const memberId = await getMemberId(userId);
        if (!memberId) {
            throw new Error('Member ID not found');
        }
        const conditionAST = {
          type: 'expr_list',
          value: [
        {
          type: 'binary_expr',
          operator: 'OR',
          left: {
              type: 'binary_expr',
              operator: 'in',
              left: { type: 'column_ref', table: 'vw_people', column: 'id' },
              right: {
                type: 'expr_list',
                value: [
                  {
                    type: 'select',
                    columns: [
                      {
                        expr: { type: 'column_ref', table: 'people_ministries', column: 'person_id' },
                        as: null
                      }
                    ],
                    from: [{ db: null, table: 'people_ministries', as: null }],
                    where: {
                      type: 'binary_expr',
                      operator: 'in',
                      left: { type: 'column_ref', table: 'people_ministries', column: 'ministry_id' },
                      right: {
                        type: 'expr_list',
                        value: [
                          {
                            type: 'select',
                            columns: [
                              {
                                expr: { type: 'column_ref', table: 'people_ministries', column: 'ministry_id' },
                                as: null
                              }
                            ],
                            from: [{ db: null, table: 'people_ministries', as: null }],
                            where: {
                              type: 'binary_expr',
                              operator: 'AND',
                              left: {
                                type: 'binary_expr',
                                operator: '=',
                                left: { type: 'column_ref', table: 'people_ministries', column: 'person_id' },
                                right: { type: 'number', value: memberId }
                              },
                              right: {
                                type: 'binary_expr',
                                operator: 'IN',
                                left: { type: 'column_ref', table: 'people_ministries', column: 'role_id' },
                                right: {
                                  type: 'expr_list',
                                  value: ALLOWED_ROLES.map(role => ({ type: 'number', value: role }))
                                }
                              }
                            }
                          }
                        ]
                      }
                    }
                  }
                ]
              }
          },
          right: {
            type: 'binary_expr',
            operator: 'IN',
            left: { type: 'column_ref', table: 'vw_people', column: 'id' },
            right: {
              type: 'expr_list',
              value: [
            {
              type: 'select',
              columns: [
                {
                  expr: { type: 'column_ref', table: 'people', column: 'id' },
                  as: null
                }
              ],
              from: [{ db: null, table: 'people', as: null }],
              where: {
                type: 'binary_expr',
                operator: '=',
                left: { type: 'column_ref', table: 'people', column: 'user_id' },
                right: { type: 'number', value: userId }
              }
            }]}
          }
        }]}
          
          
      if (!ast.where) {
        ast.where = conditionAST;
      } else {
        ast.where = {
          type: 'binary_expr',
          operator: 'AND',
          left: ast.where,
          right: conditionAST
        };
      }
    }
  }
  if (Array.isArray(ast)) {
    ast.forEach(async node => await addConditionIfHasPersonas(node));
  } else if (ast && typeof ast === 'object') {
    Object.values(ast).forEach(async value => {
      if (value && typeof value === 'object') {
        await addConditionIfHasPersonas(value);
      }
    });
  }
}

export async function rewriteQueryWithPermissions(sql, userId) {
  const ast = parser.astify(sql, sqlParserOptions);
//   renameTablesInAST(ast, 'personas2', 'personas');
  await addConditionIfHasPersonas(ast, userId);
  return parser.sqlify(ast).replace(/`/g, '');
}
