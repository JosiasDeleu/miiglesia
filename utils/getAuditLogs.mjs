import { runQueryPrivateTables } from '../db/query.js';

export async function getAuditLogs(page = 1, limit = 10, filters = {}) {
    const offset = (page - 1) * limit;
    const mainValues = [limit, offset];
    const filterValues = [];
    let countWhereClause = [];
    let mainWhereClause = [];
    let mainValueIndex = 3;
    let countValueIndex = 1;

    if (filters.accion) {
        mainWhereClause.push(`al.action = $${mainValueIndex}`);
        countWhereClause.push(`al.action = $${countValueIndex}`);
        filterValues.push(filters.accion);
        mainValueIndex++;
        countValueIndex++;
    }

    if (filters.categoria) {
        mainWhereClause.push(`al.affected_object = $${mainValueIndex}`);
        countWhereClause.push(`al.affected_object = $${countValueIndex}`);
        filterValues.push(filters.categoria);
        mainValueIndex++;
        countValueIndex++;
    }

    if (filters.detalle) {
        mainWhereClause.push(`LOWER(unaccent(al.detail)) ILIKE LOWER(unaccent($${mainValueIndex}))`);
        countWhereClause.push(`LOWER(unaccent(al.detail)) ILIKE LOWER(unaccent($${countValueIndex}))`);
        filterValues.push(`%${filters.detalle}%`);
        mainValueIndex++;
        countValueIndex++;
    }

    if (filters.usuario) {
        mainWhereClause.push(`CONCAT(u.first_middle_name, ' ', u.last_name) ILIKE $${mainValueIndex}`);
        countWhereClause.push(`CONCAT(u.first_middle_name, ' ', u.last_name) ILIKE $${countValueIndex}`);
        filterValues.push(`%${filters.usuario}%`);
        mainValueIndex++;
        countValueIndex++;
    }

    if (filters.fechaDesde) {
        mainWhereClause.push(`al.timestamp >= $${mainValueIndex}`);
        countWhereClause.push(`al.timestamp >= $${countValueIndex}`);
        filterValues.push(filters.fechaDesde);
        mainValueIndex++;
        countValueIndex++;
    }

    if (filters.fechaHasta) {
        mainWhereClause.push(`al.timestamp <= $${mainValueIndex}`);
        countWhereClause.push(`al.timestamp <= $${countValueIndex}`);
        filterValues.push(filters.fechaHasta);
        mainValueIndex++;
        countValueIndex++;
    }

    const countWhereString = countWhereClause.length > 0 ? `WHERE ${countWhereClause.join(' AND ')}` : '';
    const mainWhereString = mainWhereClause.length > 0 ? `WHERE ${mainWhereClause.join(' AND ')}` : '';

    const countResult = await runQueryPrivateTables({
        query: `SELECT COUNT(*) FROM audit_log al 
                LEFT JOIN users u ON al.user_id = u.id 
                ${countWhereString}`,
        values: filterValues
    });

    const result = await runQueryPrivateTables({
        query: `SELECT al.action, al.affected_object, al.detail,
               CONCAT(u.first_middle_name, ' ', u.last_name) as user,
               al.timestamp as date
        FROM audit_log al
        LEFT JOIN users u ON al.user_id = u.id
        ${mainWhereString}
        ORDER BY al.timestamp DESC
        LIMIT $1 OFFSET $2`,
        values: [...mainValues, ...filterValues]
    });

    return {
        logs: result.rows,
        total: parseInt(countResult.rows[0].count),
        pages: Math.ceil(parseInt(countResult.rows[0].count) / limit)
    };
}
