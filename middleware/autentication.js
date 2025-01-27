import bcrypt from 'bcrypt';
import { runQueryPrivateTables } from '#db/query.js';

export async function authenticateUser(username, password) {
  try {
      // Obtener el usuario por el email
      const usuario = await getUsuarioByEmail(username, true);
      if (!usuario) {
        return false
      }
      var claveDB = usuario.password;

      // Comparar las contraseñas usando bcrypt
      const isPasswordValid = await bcrypt.compare(password, claveDB);


      if (isPasswordValid) {
        // loggedUserId = usuario.id;
        // loggedUserEmail = usuario.email;
        // loggedUserRol = usuario.rol;
        // Si la contraseña es válida, devuelve el objeto con el id del usuario
        return { id: usuario.id, username: usuario.email, rol: usuario.role_id};
      } else {
        return false; // Si la contraseña no es válida
      }
      
    } catch (error) {
      console.error(error.message);
      return false; // Retorna false si las credenciales son incorrectas
    }
}


export async function createUser({ nombre, apellido, email, password, rol }) {
  try {
    // Validar que todos los campos sean proporcionados
    if (!nombre || !apellido || !email || !password || !rol) {
      throw new Error('Todos los campos son obligatorios');
    }

    if (password.length < 6) {
      throw new Error('La contraseña debe tener al menos 6 caracteres');
    }

    // Verificar si ya existe un usuario con el mismo email
    const existingUser = await getUsuarioByEmail(email, false);
    if (existingUser) {
      throw new Error('El email ya está registrado');
    }

    // Hashear la contraseña antes de guardarla
    const hashedPassword = await bcrypt.hash(password, 10);

    // Consulta SQL para insertar el nuevo usuario
    const query = `
      INSERT INTO users (first_middle_name, last_name, email, password, role_id, creation_date)
      VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
    `;
    const values = [nombre, apellido, email, hashedPassword, rol];

    // Execute the query using runQuery
    const result = await runQueryPrivateTables({ query, values }); // Pass query and values as an object

    return result; // Retorna el resultado de la inserción
  } catch (error) {
    throw new Error(error.message);
  }
}


// Función para obtener usuarios de la tabla 'Usuarios'
export async function getUsuarioByEmail(email) {
  // Base SQL query to fetch the user by email
  let query = `
    SELECT id, first_middle_name, last_name, email, password, role_id 
    FROM users 
    WHERE email = $1
    AND active = true
  `;
  const values = [email];

  try {
    // Execute the query using runQuery
    const result = await runQueryPrivateTables({ query, values });

    // Return the first result if available, otherwise return null
    return result.rows.length > 0 ? result.rows[0] : null;
  } catch (err) {
    throw new Error('Database query failed: ' + err.message);
  }
}

// export var loggedUserId;
// export var loggedUserEmail;
// export var loggedUserRol;
