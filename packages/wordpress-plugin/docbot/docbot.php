<?php
/**
 * Plugin Name: DocBot - AI Medical Consultation
 * Plugin URI: https://docbot.ai
 * Description: AI-powered WhatsApp medical consultation chatbot with multilingual support for Indian languages.
 * Version: 1.0.0
 * Author: DocBot
 * License: GPL v2 or later
 * Requires PHP: 8.0
 * Requires at least: 6.0
 */

if (!defined('ABSPATH')) {
    exit;
}

define('DOCBOT_VERSION', '1.0.0');
define('DOCBOT_PLUGIN_DIR', plugin_dir_path(__FILE__));
define('DOCBOT_PLUGIN_URL', plugin_dir_url(__FILE__));

// Load dependencies
require_once DOCBOT_PLUGIN_DIR . 'includes/class-docbot-encryption.php';
require_once DOCBOT_PLUGIN_DIR . 'includes/class-docbot-settings.php';
require_once DOCBOT_PLUGIN_DIR . 'includes/class-docbot-api-client.php';
require_once DOCBOT_PLUGIN_DIR . 'includes/class-docbot-rest-api.php';
require_once DOCBOT_PLUGIN_DIR . 'includes/class-docbot-admin.php';

/**
 * Plugin activation hook.
 */
function docbot_activate() {
    // Set default options
    if (!get_option('docbot_backend_url')) {
        update_option('docbot_backend_url', '');
    }
    if (!get_option('docbot_is_setup_complete')) {
        update_option('docbot_is_setup_complete', false);
    }

    // Flush rewrite rules
    flush_rewrite_rules();
}
register_activation_hook(__FILE__, 'docbot_activate');

/**
 * Plugin deactivation hook.
 */
function docbot_deactivate() {
    flush_rewrite_rules();
}
register_deactivation_hook(__FILE__, 'docbot_deactivate');

/**
 * Initialize the plugin.
 */
function docbot_init() {
    // Initialize admin
    if (is_admin()) {
        new DocBot_Admin();
    }

    // Always register REST routes
    new DocBot_REST_API();
}
add_action('plugins_loaded', 'docbot_init');
