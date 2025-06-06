import { baseConfig } from './base.js'

/**
 * @type {import("prettier").Config}
 */
export const reactConfig = {
  ...baseConfig,
  plugins: [
    '@ianvs/prettier-plugin-sort-imports',
    'prettier-plugin-tailwindcss',
  ],
}
