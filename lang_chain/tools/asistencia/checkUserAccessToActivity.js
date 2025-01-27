/**
 * @fileoverview Tool for checking if the logged user has access to a specific activity
 * @module tools/miembros/checkUserAccessToActivity
 */

import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import { userCanAccessActivity, ministryMatchesId } from '../securityChecks.js';
import { getSessionData } from '../../../utils/activeSessionsData.js';

const CheckUserAccessToActivity = tool(async ({ ministry_id, ministry_name }, config) => {
  const { userId } = getSessionData(config.configurable.thread_id);

  try {
    await ministryMatchesId(ministry_id, ministry_name);
    await userCanAccessActivity(ministry_id, userId);
    
    return `User has access to ministry: ${ministry_name} (ID: ${ministry_id})`;
  } catch (error) {
    console.error('Access check error:', error);
    throw new Error(`Access denied: ${error.message}`);
  }
}, {
  name: 'check_user_access_to_activity',
  description: 'Verifies if the current user has permission to access a specific ministry.',
  schema: z.object({
    ministry_id: z.number()
      .int()
      .positive({ message: "Ministry ID must be a positive integer" })
      .describe("The ID of the ministry to check access for"),
    ministry_name: z.string()
      .describe("Name of the ministry to search for. Use the 'check_nombre_ministerios' tool to find the ministry name.")
  }),
  verbose: false
});

export default CheckUserAccessToActivity;

