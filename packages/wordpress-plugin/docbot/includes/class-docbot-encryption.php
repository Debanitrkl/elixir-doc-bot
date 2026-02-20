<?php
/**
 * Handles encryption/decryption of sensitive data stored in WP options.
 * Uses AES-256-GCM with a key from wp-config.php.
 */
class DocBot_Encryption {

    private const CIPHER = 'aes-256-gcm';
    private const TAG_LENGTH = 16;

    /**
     * Get the encryption key from wp-config.php constant or generate from AUTH_KEY.
     */
    private static function get_key(): string {
        if (defined('DOCBOT_ENCRYPTION_KEY') && DOCBOT_ENCRYPTION_KEY) {
            return hash('sha256', DOCBOT_ENCRYPTION_KEY, true);
        }
        // Fallback to WordPress AUTH_KEY
        return hash('sha256', AUTH_KEY . 'docbot_encryption', true);
    }

    /**
     * Encrypt a plaintext string.
     */
    public static function encrypt(string $plaintext): string {
        $key = self::get_key();
        $iv = random_bytes(openssl_cipher_iv_length(self::CIPHER));

        $encrypted = openssl_encrypt(
            $plaintext,
            self::CIPHER,
            $key,
            OPENSSL_RAW_DATA,
            $iv,
            $tag,
            '',
            self::TAG_LENGTH
        );

        if ($encrypted === false) {
            throw new RuntimeException('Encryption failed');
        }

        // Combine iv + tag + ciphertext, base64 encode
        return base64_encode($iv . $tag . $encrypted);
    }

    /**
     * Decrypt a ciphertext string.
     */
    public static function decrypt(string $ciphertext): string {
        $key = self::get_key();
        $data = base64_decode($ciphertext);

        if ($data === false) {
            throw new RuntimeException('Invalid ciphertext');
        }

        $iv_length = openssl_cipher_iv_length(self::CIPHER);
        $iv = substr($data, 0, $iv_length);
        $tag = substr($data, $iv_length, self::TAG_LENGTH);
        $encrypted = substr($data, $iv_length + self::TAG_LENGTH);

        $decrypted = openssl_decrypt(
            $encrypted,
            self::CIPHER,
            $key,
            OPENSSL_RAW_DATA,
            $iv,
            $tag
        );

        if ($decrypted === false) {
            throw new RuntimeException('Decryption failed');
        }

        return $decrypted;
    }
}
