/**
 * @fileoverview Tool for checking if the logged user has access to a specific member
 * @module tools/miembros/checkUserAccessToMember
 * 
 * @description
 * This tool verifies if the currently logged-in user has permission to access
 * a specific member's information and validates that the provided name matches the ID.
 * 
 * @example
 * const result = await CheckUserAccessToMember({ 
 *   memberId: 123,
 *   memberName: "John Smith"
 * });
 */

import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import { userCanAccessMember, memberMatchesId } from '../securityChecks.js';
import { getSessionData } from '../../../utils/activeSessionsData.js';

const CheckUserAccessToMember = tool(async ({ memberId, memberName }, config) => {

  console.log('Checking access to member:', memberId, memberName);

  try {
    const { userId } = getSessionData(config.configurable.thread_id);

    // Verify name matches ID first
    await memberMatchesId(memberId, memberName);
    
    // Then check access permissions
    await userCanAccessMember(memberId, userId);
    
    return `User has access to member: ${memberName} (ID: ${memberId})`;
  } catch (error) {
    console.error('Access check error:', error);
    throw new Error(`Access denied: ${error.message}`);
  }
}, {
  name: 'check_user_access_to_member',
  description: 'Verifies if the current user has permission to access a specific member and validates the member name matches the ID.',
  schema: z.object({
    memberId: z.number()
      .int()
      .positive({ message: "Member ID must be a positive integer" })
      .describe("The ID of the member to check access for"),
    memberName: z.string()
      .min(2, { message: "Name must be at least 2 characters long" })
      .max(100, { message: "Name cannot exceed 100 characters" })
      .describe("Full name of the member (must match the database record)")
  }),
  verbose: false
});

export default CheckUserAccessToMember;

