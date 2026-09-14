/**
 * Local ESLint plugin for the Masar design-system invariants
 * (docs/DESIGN.md §2.1, §3 — referenced there as `tailwindcss/*`).
 */
import { noPhysicalProperties } from './no-physical-properties.js';
import { noHexColors } from './no-hex-colors.js';

export default {
  rules: {
    'no-physical-properties': noPhysicalProperties,
    'no-hex-colors': noHexColors,
  },
};
