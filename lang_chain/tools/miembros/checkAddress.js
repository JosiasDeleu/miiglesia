/**
 * @fileoverview Tool for validating addresses using Google Maps API
 * @module tools/miembros/checkAddress
 */

import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import GoogleMaps from '../../tools/checkGoogleMaps.js';

const CheckAddress = tool(async (input) => {
  console.log('Checking address:', input);
  const { address } = input;

  if (!address?.trim()) {
    throw new Error('Address cannot be empty');
  }

  try {
    const addressWithCountry = address + ', Argentina';
    const result = await GoogleMaps.getSimilarAddress(address);
    
    if (!result.found) {
      return `No valid address found. Error: ${result.error || 'Address not found'}`;
    }

    return `This is a similar address found, please confirm: 
      Street: ${result.streetName} ${result.streetNumber}
      City: ${result.city}, ${result.country}
    ` 
    // Neighborhood: ${result.neighborhood}
    //`${result.fullAddress}\nCoordinates: ${result.location.lat}, ${result.location.lng}`;

  } catch (error) {
    console.error('Address validation error:', error);
    throw new Error('Failed to validate address');
  }
}, {
  name: 'check_address',
  description: 'Validates and normalizes an address using Google Maps API. Returns the validated address if found.',
  schema: z.object({
    address: z.string()
      .min(5, { message: "Address must be at least 5 characters long" })
      .max(200, { message: "Address cannot exceed 200 characters" })
      .trim()
      .describe("The address to validate. Can be a partial or complete address.")
  }),
  verbose: false
});

export default CheckAddress;

