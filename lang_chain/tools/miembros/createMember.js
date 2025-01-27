/**
 * @fileoverview Tool for creating new members in the database with required fields
 * @module tools/miembros/createMember
 * 
 * @description
 * Creates a new member record with basic required information.
 * Includes validation for required fields and data types.
 * Logs the creation action in the audit trail.
 */

import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import { runQueryPublicTables } from '#db/query.js';
import { addLogFunction } from '../../../utils/addAuditLog.js';
import { getSessionData } from '../../../utils/activeSessionsData.js';
import { ToolMessage } from "@langchain/core/messages";
import { Command } from "@langchain/langgraph";

const validatePastDate = (date) => {
  const parsedDate = new Date(date);
  return parsedDate instanceof Date && 
         !isNaN(parsedDate) && 
         parsedDate < new Date() &&
         parsedDate.getFullYear() > 1900;
};

const CreateMiembro = tool(async ({ Nombre, Apellido, Sexo, FechaNacimiento }, config) => {
  try {
    if (!validatePastDate(FechaNacimiento)) {
      throw new Error('Birth date must be a valid past date');
    }
  
    const { userId } = getSessionData(config.configurable.thread_id);
  
    const result = await runQueryPublicTables({
      query: `
          INSERT INTO people (
            first_middle_name, last_name, birth_date, gender,
            user_id, creation_date, active
          )
          VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP, TRUE)
          ON CONFLICT (first_middle_name, last_name, birth_date, gender)
          DO UPDATE 
          SET active = TRUE,
              user_id = EXCLUDED.user_id,
              creation_date = CURRENT_TIMESTAMP
          WHERE people.active = FALSE
          RETURNING id, active, 
              (xmax <> 0) AS was_updated;
      `,
      values: [
        Nombre.trim(), 
        Apellido.trim(), 
        FechaNacimiento, 
        Sexo, 
        userId
      ]
    });
  
    if (result.rows.length === 1) {
      const { id: memberId, was_updated } = result.rows[0];
  
      if (was_updated) {
        addLogFunction(userId, "Actualizar", "Personas", 
          `Reactivar persona con ID: ${memberId}, nombre: ${Nombre} ${Apellido}, sexo: ${Sexo}, fecha de nacimiento: ${FechaNacimiento}`
        );
  
        return new Command({
          update: {
            messages: [
              new ToolMessage({
                content: `The person already existed in the database, but was inactive. It was reactivated successfully with ID: ${memberId}`,
                name: "success",
                tool_call_id: config.toolCall.id,
                status: "success"
              }),
            ],
          }
        });
      } else {
        addLogFunction(userId, "Crear", "Personas", 
          `Crear persona con ID: ${memberId}, nombre: ${Nombre} ${Apellido}, sexo: ${Sexo}, fecha de nacimiento: ${FechaNacimiento}`
        );
  
        return new Command({
          update: {
            messages: [
              new ToolMessage({
                content: `Person created successfully with ID: ${memberId}`,
                name: "success",
                tool_call_id: config.toolCall.id,
                status: "success"
              }),
            ],
          }
        });
      }
    }
  
    throw new Error('Failed to create or reactivate member');
  } catch (error) {
    console.error('Database error:', error);
    throw new Error(`Failed to create member record. Error message: ${error.message}`);
  }
  
}, {
  name: 'create_member',
  description: 'Creates a new member record with required fields: first name, last name, gender, and birth date.',
  schema: z.object({
    Nombre: z.string().trim().min(1, { message: "First name must be at least 1 character long" }).describe('First name of the person.'),
    Apellido: z.string().trim().min(1, { message: "Last name must be at least 1 character long" }).trim().describe('Last name of the person.'),
    Sexo: z.enum(["Masculino", "Femenino"]).describe('Gender of the person.'),
    FechaNacimiento: z.string().describe('Birth date of the person in YYYY-MM-DD format. Asume that the user uses a non-US date format. For example, 10/12/2021 for December 10, 2021, should be formatted as 2021-12-10.'),
  }),
  verbose: true
});

export default CreateMiembro;
