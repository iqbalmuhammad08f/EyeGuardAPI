/**
 * Shared validation constants dan helpers untuk password policy.
 * Digunakan di routes/auth.js dan routes/profile.js.
 */

/** Regex: min 8 karakter, huruf besar, huruf kecil, angka */
const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;

const PASSWORD_ERROR_MSG =
    'Password minimal 8 karakter, mengandung huruf besar, huruf kecil, dan angka';

/**
 * Validasi password dengan policy yang berlaku.
 * @param {string} password
 * @returns {{ valid: boolean, message?: string }}
 */
const validatePassword = (password) => {
    if (!PASSWORD_REGEX.test(password)) {
        return { valid: false, message: PASSWORD_ERROR_MSG };
    }
    return { valid: true };
};

module.exports = { PASSWORD_REGEX, PASSWORD_ERROR_MSG, validatePassword };
