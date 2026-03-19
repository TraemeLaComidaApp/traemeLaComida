/**
 * Generates a random alphanumeric UUID string (a-z, 0-9).
 * @param {number} length Length of the string. Defaults to 16.
 * @returns {string} A random alphanumeric string.
 */
export const generateUuid = (length = 16) => {
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
};
