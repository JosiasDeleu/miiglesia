import { getAuxTablesValues } from '../tools/db_helpers/getAuxTables.js'

const opcionesDiscipulado = await getAuxTablesValues('aux_discipleships');
const opcionesIntegracion = await getAuxTablesValues('aux_membership');
const opcionesEstadoCivil = await getAuxTablesValues('aux_marital_statuses');
const opcionesRoles = await getAuxTablesValues('aux_ministry_roles');
const opcionesParentesco = await getAuxTablesValues('aux_relationships');

export const prompts_table_descriptions = {
  vw_people: `The following describes the 'vw_people' table schema in our church management database. This table stores comprehensive information about church members and attendees.
            The columns are:
            *   'id' (integer): Unique identifier (primary key).
            *   'first_middle_name' (string): First name and middle name (if any).
            *   'last_name' (string): Last name.
            *   'birth_date' (date): Date of birth.
            *   'gender' (ENUM('Masculino', 'Femenino')): Gender.
            *   'marital_status' (ENUM(${opcionesEstadoCivil})): Marital status.
            *   'dni' (string): National identification number.
            *   'phone' (string): Phone number.
            *   'email' (string): Email address.
            *   'address' (string): Address.
            *   'discipleship' (ENUM(${opcionesDiscipulado})): Discipleship status.
            *   'baptized' (boolean): Baptized (true/false).
            *   'membership' (ENUM(${opcionesIntegracion})): Level of integration to the church (Asistente, Miembro, Siervo, Lider).
            *   'responsible1_name' (string): Name of the father, mother, or legal guardian of a minor (primary).
            *   'responsible1_phone' (string): Phone number of the father, mother, or legal guardian of a minor (primary).
            *   'responsible2_name' (string): Name of the father, mother, or legal guardian of a minor (secondary).
            *   'responsible2_phone' (string): Phone number of the father, mother, or legal guardian of a minor (secondary).
            *   'notes' (string): Additional notes.

            Here's a sample row in JSON format:
            {
                "id": 9,
                "first_middle_name": "LUCRECIA",
                "last_name": "DIAZ",
                "birth_date": "1996-01-23",
                "gender": "Femenino",
                "marital_status": "Soltero/a",
                "dni": "38542102",
                "phone": "3516667718",
                "email": "diazlucrecia@gmail.com",
                "address": "cristobal colon 123",
                "discipleship": "Discipulado 1",
                "baptized": true,
                "membership": "Asistente",
                "responsible1_name": "Juan Diaz",
                "responsible1_phone": "3516667718",
                "responsible2_name": "Maria Lopez",
                "responsible2_phone": "3516667718",
                "notes": "Florencia llego a la iglesia por invitacion de su amiga Maria."
            }
`,

  ministries: `The following describes the 'ministries' table schema in our church management database. This table stores information about different ministries within the church.

  The columns are:
  *   'id' (integer): Unique identifier (primary key).
  *   'name' (string): Name of the ministry (not null).
  *   'description' (string): Description of the ministry.
  *   'parent_ministry_id' (integer): Foreign key referencing the 'id' of a parent ministry (nullable, references the column 'id' of the 'ministries' table itself).

  Here's a sample row in JSON format:
  {
      "id": 1,
      "name": "Jóvenes",
      "description": "Ministerio enfocado en el crecimiento espiritual de los jóvenes",
      "parent_ministry_id": 2,
  }
  `,

  vw_ministries: `The following describes the 'vw_ministries' table schema in our church management database. This table stores information about different ministries within the church.

  The columns are:
  *   'id' (integer): Unique identifier (primary key).
  *   'name' (string): Name of the ministry (not null).
  *   'description' (string): Description of the ministry.
  *   'parent_ministry_name' (string): Name of the parent ministry. If it is empty, the ministry is a top-level ministry.

  Here's a sample row in JSON format:
  {
      "id": 1,
      "name": "Celula de Jóvenes",
      "description": "Grupo pequeño enfocado en el crecimiento espiritual de los jóvenes",
      "parent_ministry_name": "Jóvenes",
  }
  `,

  people_ministries: `The following describes the 'people_ministries' table schema in our church management database. This table stores information about the relationship between church members and ministries.
    The columns are:
    *   'id' (integer): Unique identifier (primary key).
    *   'person_id' (integer): Foreign key referencing the 'id' of a member (references column 'id' in the 'vw_people' table).
    *   'ministry_id' (integer): Foreign key referencing the 'id' of a ministry (references column 'id' in the 'vw_ministries' table).
    *   'role_id' (integer): Foreign key referencing the 'id' of a role (references column 'id' in the 'aux_ministry_roles' table).

    Here's a sample row in JSON format:
    {
        "id": 3,
        "person_id": 113,
        "ministry_id": 2,
        "role_id": 34
      }
  `,

  activities: `The following describes the 'activities' table schema in our church management database. This table stores information about activities related to different ministries.
    The columns are:
    *   'id' (integer): Unique identifier (primary key).
    *   'ministry_id' (integer): Foreign key referencing the 'id' of a ministry (references column 'id' in the 'vw_ministries' table).
    *   'date' (date): Date of the activity (not null).
    *   'time' (time): Time of the activity.
    *   'location' (string): Location of the activity.
    *   'title' (string): Title of the activity.
    *   'comments' (string): Comments about the activity.

    Here's a sample row in JSON format:
    {
        "id": 1,
        "ministry_id": 4,
        "date": "2025-01-01",
        "time": "08.00.00",
        "location": "Iglesia",
        "title": "Comunicacion efectiva",
        "comments": "Predicador invitado: Juan Perez",
    }
  `,

  attendances: `The following describes the 'attendances' table schema in our church management database. This table stores information about attendance at activities.
    The columns are:
    *   'id' (integer): Unique identifier (primary key).
    *   'activity_id' (integer): Foreign key referencing the 'id' of an activity (references column 'id' in the 'activities' table).
    *   'person_id' (integer): Foreign key referencing the 'id' of a member (references column 'id' in the 'vw_people' tables).

    Here's a sample row in JSON format:
    {
        "id": 1,
        "activity_id": 2,
        "person_id": 3
    }
  `,

  families: `The following describes the 'families' table schema in our church management database. This table stores information about relationships between family members.
    The columns are:
    *   'id' (integer): Unique identifier (primary key).
    *   'person1_id' (integer): Foreign key referencing the 'id' of a member (references column 'id' in the 'vw_people' table).
    *   'person2_id' (integer): Foreign key referencing the 'id' of another member (references column 'id' in the 'vw_people' table).
    *   'relationship_id' (integer): Foreign key referencing the 'id' of a relationship (references column 'id' in the 'aux_relationships' table, not null).

    Here's a sample row in JSON format:
    {
        "id": 5,
        "person1_id": 135,
        "person2_id": 136,
        "relationship_id": 5
    }
  `,

  mentorships: `The following describes the 'mentorships' table schema in our church management database. This table stores information about relationships between members, where one member mentors another.
    The columns are:
    *   'id' (integer): Unique identifier (primary key).
    *   'mentee_person_id' (integer): Foreign key referencing the 'id' of the member being followed (references column 'id' in the 'vw_people' tables).
    *   'mentor_person_id' (integer): Foreign key referencing the 'id' of the member doing the following (references column 'id' in the 'vw_people' tables).

    Here's a sample row in JSON format:
    {
        "id": 2,
        "mentee_person_id": 20,
        "mentor_person_id": 3
    }
  `,

  aux_relationships: `The following describes the 'aux_relationships' table schema in our church management database. This table stores information about types of family relationships.
    The columns are:
    *   'id' (integer): Unique identifier (primary key).
    *   'name' (string): Name of the relationship (not null).
    *   'inverse_relationship_id' (integer): Foreign key referencing the 'id' of the inverse relationship (references column 'id' of the 'aux_relationships' table itself).

    Here's a sample row in JSON format:
    {
        "id": 1,
        "name": "Padre/Madre",
        "inverse_relationship_id": 5
      }
            The current registered family relationships are: ${opcionesParentesco.join(', ')}.
  `,

  aux_ministry_roles: `The following describes the 'aux_ministry_roles' table schema in our church management database. This table stores information about roles within ministries.
    The columns are:
    *   'id' (integer): Unique identifier (primary key).
    *   'name' (string): Name of the role (not null).

    Here's a sample row in JSON format:
    {
        "id": 34,
        "name": "líder"
    }
    
    The current registered roles are: ${opcionesRoles.join(', ')}.
  `,
};