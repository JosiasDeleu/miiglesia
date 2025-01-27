/**
 * Google Maps API client for geocoding services
 * @requires @googlemaps/google-maps-services-js
 */
import { Client } from '@googlemaps/google-maps-services-js';
import dotenv from 'dotenv';
dotenv.config();

/**
 * Extracts specific component from address_components array
 * @param {Array} components - Address components from Google Maps API
 * @param {string} type - The type of component to extract
 * @returns {string} The extracted component or empty string if not found
 */
function getAddressComponent(components, type) {
    const component = components.find(comp => comp.types.includes(type));
    return component ? component.long_name : '';
}

async function getSimilarAddress(address) {
    const client = new Client({});
    try {
        const response = await client.geocode({
            params: {
                address: address,
                key: process.env.GOOGLE_MAPS_API_KEY,
            }
        });

        if (response.data.results && response.data.results.length > 0) {
            const bestMatch = response.data.results[0];
            const components = bestMatch.address_components;
            
            return {
                found: true,
                streetName: getAddressComponent(components, 'route'),
                streetNumber: getAddressComponent(components, 'street_number'),
                neighborhood: getAddressComponent(components, 'neighborhood'),
                city: getAddressComponent(components, 'locality'),
                country: getAddressComponent(components, 'country'),
                placeId: bestMatch.place_id,
                fullAddress: bestMatch.formatted_address
            };
        } else {
            return {
                found: false,
                error: 'No similar addresses found'
            };
        }
    } catch (error) {
        return {
            found: false,
            error: error.message
        };
    }
}

export default { getSimilarAddress };
