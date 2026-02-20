<?php
/**
 * Manages DocBot plugin settings stored in WordPress options.
 */
class DocBot_Settings {

    private const OPTION_PREFIX = 'docbot_';

    /**
     * Get a setting value.
     */
    public static function get(string $key, $default = null) {
        return get_option(self::OPTION_PREFIX . $key, $default);
    }

    /**
     * Set a setting value.
     */
    public static function set(string $key, $value): bool {
        return update_option(self::OPTION_PREFIX . $key, $value);
    }

    /**
     * Delete a setting.
     */
    public static function delete(string $key): bool {
        return delete_option(self::OPTION_PREFIX . $key);
    }

    /**
     * Get the backend URL.
     */
    public static function get_backend_url(): string {
        return rtrim(self::get('backend_url', ''), '/');
    }

    /**
     * Get the encrypted API key.
     */
    public static function get_api_key(): string {
        $encrypted = self::get('api_key_encrypted', '');
        if (empty($encrypted)) {
            return '';
        }
        try {
            return DocBot_Encryption::decrypt($encrypted);
        } catch (Exception $e) {
            error_log('DocBot: Failed to decrypt API key: ' . $e->getMessage());
            return '';
        }
    }

    /**
     * Store the API key (encrypted).
     */
    public static function set_api_key(string $api_key): bool {
        try {
            $encrypted = DocBot_Encryption::encrypt($api_key);
            return self::set('api_key_encrypted', $encrypted);
        } catch (Exception $e) {
            error_log('DocBot: Failed to encrypt API key: ' . $e->getMessage());
            return false;
        }
    }

    /**
     * Check if initial setup is complete.
     */
    public static function is_setup_complete(): bool {
        return (bool) self::get('is_setup_complete', false);
    }

    /**
     * Mark setup as complete.
     */
    public static function complete_setup(): bool {
        return self::set('is_setup_complete', true);
    }

    /**
     * Get all settings for the admin UI.
     */
    public static function get_all(): array {
        return [
            'backend_url' => self::get_backend_url(),
            'is_setup_complete' => self::is_setup_complete(),
            'has_api_key' => !empty(self::get_api_key()),
            'doctor_id' => self::get('doctor_id', ''),
        ];
    }
}
