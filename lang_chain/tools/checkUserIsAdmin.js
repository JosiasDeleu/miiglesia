import { tool } from '@langchain/core/tools';
import { userIsAdmin } from './securityChecks.js';
import { getSessionData } from '../../utils/activeSessionsData.js';

const CheckUserIsAdmin = tool(async ({},config) => {
  const { userRole } = getSessionData(config.configurable.thread_id);
  console.log('Checking user role:', userRole);
  await userIsAdmin(userRole); // If user is not an admin, it returns an error with a proper message
  return "User is an admin and has permission to create, remove, or update ministries.";

}, {
  name: 'check_user_is_admin',
  description: 'Verifies if the current user is an admin and has permission to create, remove, or update ministries.',
  verbose: false
});

export default CheckUserIsAdmin;

