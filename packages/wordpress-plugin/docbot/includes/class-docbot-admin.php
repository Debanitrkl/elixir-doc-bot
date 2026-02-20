<?php
/**
 * Handles WordPress admin menu and script enqueuing for the React SPA.
 */
class DocBot_Admin {

    public function __construct() {
        add_action('admin_menu', [$this, 'add_admin_menu']);
        add_action('admin_enqueue_scripts', [$this, 'enqueue_scripts']);
    }

    /**
     * Add DocBot menu to WordPress admin sidebar.
     */
    public function add_admin_menu(): void {
        add_menu_page(
            'DocBot',
            'DocBot',
            'manage_options',
            'docbot',
            [$this, 'render_admin_page'],
            'dashicons-format-chat',
            30
        );

        // Sub-menus (all point to the same React SPA, routing handled by HashRouter)
        add_submenu_page('docbot', 'Dashboard', 'Dashboard', 'manage_options', 'docbot', [$this, 'render_admin_page']);
        add_submenu_page('docbot', 'Conversations', 'Conversations', 'manage_options', 'docbot#/conversations', [$this, 'render_admin_page']);
        add_submenu_page('docbot', 'Patients', 'Patients', 'manage_options', 'docbot#/patients', [$this, 'render_admin_page']);
        add_submenu_page('docbot', 'Settings', 'Settings', 'manage_options', 'docbot#/settings', [$this, 'render_admin_page']);
    }

    /**
     * Render the admin page container (React mounts here).
     */
    public function render_admin_page(): void {
        echo '<div id="docbot-admin-root"></div>';
    }

    /**
     * Enqueue React app scripts and styles.
     */
    public function enqueue_scripts(string $hook): void {
        // Only load on DocBot pages
        if (strpos($hook, 'docbot') === false) {
            return;
        }

        $dist_dir = DOCBOT_PLUGIN_DIR . 'admin/dist/';
        $dist_url = DOCBOT_PLUGIN_URL . 'admin/dist/';

        // Look for the built assets
        $manifest_file = $dist_dir . '.vite/manifest.json';

        if (file_exists($manifest_file)) {
            $manifest = json_decode(file_get_contents($manifest_file), true);
            $entry = $manifest['src/main.tsx'] ?? $manifest['index.html'] ?? null;

            if ($entry) {
                // Enqueue CSS
                if (!empty($entry['css'])) {
                    foreach ($entry['css'] as $i => $css_file) {
                        wp_enqueue_style(
                            'docbot-admin-' . $i,
                            $dist_url . $css_file,
                            [],
                            DOCBOT_VERSION
                        );
                    }
                }

                // Enqueue JS
                wp_enqueue_script(
                    'docbot-admin',
                    $dist_url . $entry['file'],
                    [],
                    DOCBOT_VERSION,
                    true
                );

                // Add type="module" for Vite builds
                add_filter('script_loader_tag', function ($tag, $handle) {
                    if ($handle === 'docbot-admin') {
                        return str_replace('<script ', '<script type="module" ', $tag);
                    }
                    return $tag;
                }, 10, 2);
            }
        } else {
            // Development fallback - load from Vite dev server
            wp_enqueue_script(
                'docbot-admin-vite',
                'http://localhost:5173/src/main.tsx',
                [],
                null,
                true
            );

            add_filter('script_loader_tag', function ($tag, $handle) {
                if ($handle === 'docbot-admin-vite') {
                    return str_replace('<script ', '<script type="module" ', $tag);
                }
                return $tag;
            }, 10, 2);
        }

        // Pass data to the React app
        wp_localize_script('docbot-admin', 'docbotData', [
            'restUrl' => rest_url('docbot/v1/'),
            'nonce' => wp_create_nonce('wp_rest'),
            'isSetupComplete' => DocBot_Settings::is_setup_complete(),
            'adminUrl' => admin_url(),
            'pluginUrl' => DOCBOT_PLUGIN_URL,
        ]);
    }
}
