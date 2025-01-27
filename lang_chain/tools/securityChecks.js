import { runQueryPrivateTables, runQueryPublicTables } from '#db/query.js';
import dotenv from 'dotenv';
dotenv.config();

const ADMIN_USER_ID = Number(process.env.ADMIN_USER_ID);
const LIDER_ROL_ID = Number(process.env.LIDER_ROL_ID);
const COLABORADOR_ROL_ID = Number(process.env.COLABORADOR_ROL_ID);
const ALLOWED_ROLES = [LIDER_ROL_ID, COLABORADOR_ROL_ID];


export async function userCanAccessMember(targetMemberId, userId) {
    // Application admin users have access to all the functions without limitations
    if(userId === ADMIN_USER_ID) return;

    if (!targetMemberId) {
        throw new Error('Target member ID is required');
    }
    if (!userId) {
        throw new Error('No user is currently logged in');
    }

    try {
        const result = await runQueryPrivateTables({
            query: `
                WITH user_member AS (
                    SELECT person_id 
                    FROM users 
                    WHERE id = $1
                ),
                people_count AS (
                    SELECT COUNT(*) AS people_count
                    FROM people
                    WHERE people.user_id = $1
                    AND people.id = $2
                ),
                target_count AS (
                    SELECT COUNT(*) AS target_count
                    FROM people_ministries target
                    JOIN user_member um ON target.person_id = $2
                    WHERE target.ministry_id IN (
                        SELECT ministry_id 
                        FROM people_ministries current
                        WHERE current.person_id = um.person_id
                        AND current.role_id = ANY($3::int[])
                    )
                )
                SELECT 
                    COALESCE(tc.target_count, 0) + COALESCE(mc.people_count, 0) AS total_count
                FROM people_count mc
                CROSS JOIN (SELECT 1) AS dummy
                LEFT JOIN target_count tc ON true;`,
            values: [userId, targetMemberId, ALLOWED_ROLES]
        });

        if (result.rows[0].total_count < 1) {
            throw new Error(`This user doesn't have access to the member with id ${targetMemberId}, due to security restrictions. Report this to the user and suggest him to check with their administrator.`);
        }
        return

    } catch (error) {
        console.error('Error checking member access:', error);
        throw error;
    }
}

export async function memberMatchesId(targetMemberId, targetMemberName) {
    if (!targetMemberId) {
        throw new Error('Target member ID is required');
    }
    if (!targetMemberName || typeof targetMemberName !== 'string') {
        throw new Error('Target member name must be a non-empty string');
    }
    if (targetMemberName.trim().length === 0) {
        throw new Error('Target member name cannot be empty or just whitespace');
    }

    try {
        const nameCheck = await runQueryPublicTables({
            query: `
                SELECT id 
                FROM people 
                WHERE id = $1 
                AND normalized_full_name = LOWER(unaccent($2))
            `,
            values: [targetMemberId, targetMemberName.trim()]
        });

        if (nameCheck.rows.length === 0) {
            throw new Error('Member ID and name do not match or member not found. Please check member information using the "check_nombres" tool.');
        }
        
        return

    } catch (error) {
        console.error('Error checking member name and id match:', error);
        throw new Error(`Failed to verify member name: ${error.message}`);
    }
}

export async function activityMatchesId(targetActivityId, targetMinistryId, targetActivityDate) {
    if (!targetActivityId) {
        throw new Error('Activity ID is required');
    }
    if (!targetMinistryId) {
        throw new Error('Ministry ID is required');
    }
    if (!targetActivityDate) {
        throw new Error('Activity date is required');
    }

    // Validate date format and validity
    const dateValue = new Date(targetActivityDate);
    if (isNaN(dateValue.getTime())) {
        throw new Error('Invalid date format. Please provide a valid date.');
    }

    // Format date as YYYY-MM-DD for PostgreSQL
    const formattedDate = dateValue.toISOString().split('T')[0];

    try {
        const activityCheck = await runQueryPublicTables({
            query: `
                SELECT a.id 
                FROM activities a
                JOIN ministries m ON m.id = a.ministry_id
                WHERE a.id = $1 
                AND m.id = $2
                AND a.date = $3
            `,
            values: [targetActivityId, targetMinistryId, formattedDate]
        });

        if (activityCheck.rows.length === 0) {
            throw new Error('Activity ID, ministry ID and date do not match or activity not found. Please check activity information.');
        }
        
        return

    } catch (error) {
        console.error('Error checking activity details match:', error);
        throw new Error(`Failed to verify activity: ${error.message}`);
    }
}

export async function ministryMatchesId(targetMinistryId, targetMinistryName) {
    if (!targetMinistryId) {
        throw new Error('Ministry ID is required');
    }
    if (!targetMinistryName || typeof targetMinistryName !== 'string') {
        throw new Error('Ministry name must be a non-empty string');
    }

    try {
        const ministryCheck = await runQueryPublicTables({
            query: `
                SELECT id 
                FROM ministries 
                WHERE id = $1 
                AND normalized_name = LOWER(unaccent($2))
            `,
            values: [targetMinistryId, targetMinistryName.trim()]
        });

        if (ministryCheck.rows.length === 0) {
            throw new Error('Ministry ID and name do not match or ministry not found. Please check ministry information.');
        }
        
        return

    } catch (error) {
        console.error('Error checking ministry details match:', error);
        throw new Error(`Failed to verify ministry: ${error.message}`);
    }
}

export async function userCanAccessActivity(targetMinistryId, userId) {
    // Application admin users have access to all the functions without limitations
    if(userId === ADMIN_USER_ID) return;

    if (!targetMinistryId) {
        throw new Error('Target ministry ID is required');
    }
    if (!userId) {
        throw new Error('No user is currently logged in');
    }

    try {
        const result = await runQueryPrivateTables({
            query: `
                WITH user_member AS (
                    SELECT person_id 
                    FROM users 
                    WHERE id = $1
                )
                SELECT COUNT(*) as count
                FROM ministries m
                CROSS JOIN user_member um
                WHERE m.id = $2
                AND m.id IN (
                    SELECT ministry_id 
                    FROM people_ministries current
                    WHERE current.person_id = um.person_id
                    AND current.role_id = ANY($3::int[])
                )`,
            values: [userId, targetMinistryId, ALLOWED_ROLES]
        });

        if (result.rows[0].count < 1) {
            throw new Error(`This user doesn't have access to the ministry with id ${targetMinistryId}, due to security restrictions, 
                so they cannot manage activities related to this ministry. 
                Report this to the user and suggest them to check with their administrator.`);
        }
        return

    } catch (error) {
        console.error('Error checking ministry access:', error);
        throw error;
    }
}

export async function userIsAdmin(userRole) {
    if (userRole !== ADMIN_USER_ID) {
        throw new Error(`This user is not an administrator and they don't have access to create, update, or remove ministries. Report this to the user and suggest him to check with their administrator.`);
    }
}

export async function userIsLiderOfParentMinistry(userId, ministryId) {
    if (!ministryId) {
        throw new Error('Ministry ID is required');
    }
    if (userId) {
        throw new Error('No user is currently logged in');
    }

    try {
        const result = await runQueryPrivateTables({
            query: `
                WITH user_member AS (
                    SELECT person_id 
                    FROM users 
                    WHERE id = $2
                ),
                target_ministry AS (
                    SELECT COALESCE(
                        (SELECT parent_ministry_id FROM ministries WHERE id = $1),
                        $1
                    ) AS parent_id
                )
                SELECT CASE
                    WHEN EXISTS (
                        SELECT 1
                        FROM people_ministries mm
                        JOIN target_ministry tm ON mm.ministry_id = tm.parent_id
                        JOIN user_member um ON mm.person_id = um.person_id
                        WHERE mm.role_id = $3
                    )
                    THEN 'ok'
                    ELSE 'nok'
                END AS check_result
            `,
            values: [ministryId, userId, LIDER_ROL_ID]
        });

        if (result.rows[0].check_result !== 'ok') {
            throw new Error(`The user is not a leader of the parent ministry of the ministry with ID ${ministryId}, 
                and therefore doesn't have permission to assign people to this ministry.
                Report this to the user and suggest them to check with their leader.`);
        }
        return

    } catch (error) {
        console.error('Error checking user leader role for parent ministry:', error);
        throw new Error(`Failed to verify user leader role: ${error.message}`);
    }
}