/**
 * Loads criteria catalogs based on issue type.
 */

import { readFileSync, readdirSync, existsSync } from 'fs';
import path from 'path';

let criteriaCache = {};

/**
 * Load criteria catalog for a specific issue type.
 * @param {string} type - story | task | bug | epic
 * @returns {Object|null} Criteria catalog or null if not found
 */
export function loadCriteria(type) {
    if (criteriaCache[type]) return criteriaCache[type];

    const criteriaDir = path.join(process.cwd(), 'references', 'criteria');
    if (!existsSync(criteriaDir)) {
        console.warn(`Criteria directory not found: ${criteriaDir}`);
        return null;
    }

    // Find matching criteria file (version-agnostic)
    const files = readdirSync(criteriaDir);
    const criteriaFile = files.find(f =>
        f.toLowerCase().includes(type) &&
        f.toLowerCase().includes('criteria') &&
        f.endsWith('.json')
    );

    if (!criteriaFile) {
        console.warn(`No criteria file found for type: ${type}`);
        return null;
    }

    try {
        const filePath = path.join(criteriaDir, criteriaFile);
        const content = readFileSync(filePath, 'utf-8');
        const data = JSON.parse(content);

        criteriaCache[type] = data;
        return data;
    } catch (error) {
        console.error(`Failed to load criteria for ${type}: ${error.message}`);
        return null;
    }
}

/**
 * Get all required criteria for a type.
 * @param {string} type - story | task | bug | epic
 * @returns {Array} Array of required criterion IDs
 */
export function getRequiredCriteria(type) {
    const criteria = loadCriteria(type);
    if (!criteria || !criteria.criteria) return [];

    return criteria.criteria
        .filter(c => c.required === true)
        .map(c => c.id);
}

/**
 * Clear cache (useful for testing or hot-reload).
 */
export function clearCache() {
    criteriaCache = {};
}