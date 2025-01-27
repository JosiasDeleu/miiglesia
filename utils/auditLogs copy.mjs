import { runQueryPrivateTables } from '../db/query.js';

const objectMapping = {
    'Actividades': {
        table: 'actividades',
        columns: 'CONCAT(m.nombre, \' - \', a.fecha)',
        join: 'LEFT JOIN actividades a ON al.id_afectado = a.id LEFT JOIN ministerios m ON a.ministerio_id = m.id'
    },
    'Familias': {
        table: 'familias',
        columns: 'CONCAT(m1.nombre, \' \', m1.apellido, \' - \', m2.nombre, \' \', m2.apellido)',
        join: 'LEFT JOIN familias f ON al.id_afectado = f.id LEFT JOIN miembros m1 ON f.miembro1_id = m1.id LEFT JOIN miembros m2 ON f.miembro2_id = m2.id'
    },
    'Miembros': {
        table: 'miembros',
        columns: 'CONCAT(m3.nombre, \' \', m3.apellido)',
        join: 'LEFT JOIN miembros m3 ON al.id_afectado = m3.id'
    },
    'Usuarios': {
        table: 'usuarios',
        columns: 'CONCAT(u2.nombre, \' \', u2.apellido)',
        join: 'LEFT JOIN usuarios u2 ON al.id_afectado = u2.id'
    },
    'Miembros_Ministerios': {
        table: 'miembros_ministerios',
        columns: 'CONCAT(m4.nombre, \' \', m4.apellido, \' → \', min.nombre)',
        join: 'LEFT JOIN miembros_ministerios mm ON al.id_afectado = mm.id LEFT JOIN miembros m4 ON mm.miembro_id = m4.id LEFT JOIN ministerios min ON mm.ministerio_id = min.id'
    },
    'Seguimiento': {
        table: 'seguimiento',
        columns: 'CONCAT(m5.nombre, \' \', m5.apellido, \' → \', m6.nombre, \' \', m6.apellido)',
        join: 'LEFT JOIN seguimiento s ON al.id_afectado = s.id LEFT JOIN miembros m5 ON s.seguidor = m5.id LEFT JOIN miembros m6 ON s.persona_seguida = m6.id'
    }
};

export async function getAuditLogs(page = 1, limit = 10, filters = {}) {
    const offset = (page - 1) * limit;
    const mainValues = [limit, offset];
    const filterValues = [];
    let countWhereClause = [];
    let mainWhereClause = [];
    let mainValueIndex = 3;
    let countValueIndex = 1;

    if (filters.accion) {
        mainWhereClause.push(`al.accion = $${mainValueIndex}`);
        countWhereClause.push(`al.accion = $${countValueIndex}`);
        filterValues.push(filters.accion);
        mainValueIndex++;
        countValueIndex++;
    }

    if (filters.categoria) {
        mainWhereClause.push(`al.objeto_afectado = $${mainValueIndex}`);
        countWhereClause.push(`al.objeto_afectado = $${countValueIndex}`);
        filterValues.push(filters.categoria);
        mainValueIndex++;
        countValueIndex++;
    }

    if (filters.usuario) {
        mainWhereClause.push(`CONCAT(u.nombre, ' ', u.apellido) ILIKE $${mainValueIndex}`);
        countWhereClause.push(`CONCAT(u.nombre, ' ', u.apellido) ILIKE $${countValueIndex}`);
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
        query: `SELECT COUNT(*) FROM audit al 
                LEFT JOIN usuarios u ON al.usuario = u.id 
                ${countWhereString}`,
        values: filterValues
    });

    const result = await runQueryPrivateTables({
        query: `SELECT al.accion, al.objeto_afectado, al.id_afectado, 
               CONCAT(u.nombre, ' ', u.apellido) as usuario,
               al.timestamp as fecha,
               CASE 
                   WHEN al.objeto_afectado = 'Actividades' THEN ${objectMapping['Actividades'].columns}
                   WHEN al.objeto_afectado = 'Familias' THEN ${objectMapping['Familias'].columns}
                   WHEN al.objeto_afectado = 'Miembros' THEN ${objectMapping['Miembros'].columns}
                   WHEN al.objeto_afectado = 'Personas' THEN ${objectMapping['Miembros'].columns}
                   WHEN al.objeto_afectado = 'Usuarios' THEN ${objectMapping['Usuarios'].columns}
                   WHEN al.objeto_afectado = 'Miembros_Ministerios' THEN ${objectMapping['Miembros_Ministerios'].columns}
                   WHEN al.objeto_afectado = 'Seguimiento' THEN ${objectMapping['Seguimiento'].columns}
                   ELSE 'N/A'
               END as objeto_detalle
        FROM audit al
        LEFT JOIN usuarios u ON al.usuario = u.id
        ${objectMapping['Actividades'].join}
        ${objectMapping['Familias'].join}
        ${objectMapping['Miembros'].join}
        ${objectMapping['Usuarios'].join}
        ${objectMapping['Miembros_Ministerios'].join}
        ${objectMapping['Seguimiento'].join}
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
