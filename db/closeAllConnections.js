
import {pool} from './dbPool.js';


// Function to close all pool connections
const closeConnections = async () => {
    try {
      await pool.end();
      console.log('All pool connections closed.');
    } catch (error) {
      console.error('Error closing pool connections:', error);
    }
  };
  
  // Example usage
  (async () => {
    try {
      // Perform some database operations
      const res = await pool.query('SELECT NOW()');
      console.log('Current Time:', res.rows[0]);
      
      // Close the pool connections
      await closeConnections();
    } catch (error) {
      console.error('Error:', error);
    }
  })();