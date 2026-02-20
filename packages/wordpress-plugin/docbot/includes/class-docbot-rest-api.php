<?php
/**
 * WordPress REST API endpoints that proxy requests to the Vercel backend.
 * These endpoints are called by the React admin app.
 */
class DocBot_REST_API {

    private const NAMESPACE = 'docbot/v1';

    public function __construct() {
        add_action('rest_api_init', [$this, 'register_routes']);
    }

    /**
     * Register all REST routes.
     */
    public function register_routes(): void {
        // Setup / Registration
        register_rest_route(self::NAMESPACE, '/setup/register', [
            'methods' => 'POST',
            'callback' => [$this, 'handle_register'],
            'permission_callback' => [$this, 'check_admin_permission'],
        ]);

        register_rest_route(self::NAMESPACE, '/setup/verify', [
            'methods' => 'POST',
            'callback' => [$this, 'handle_verify_key'],
            'permission_callback' => [$this, 'check_admin_permission'],
        ]);

        // Settings
        register_rest_route(self::NAMESPACE, '/settings', [
            'methods' => 'GET',
            'callback' => [$this, 'get_settings'],
            'permission_callback' => [$this, 'check_admin_permission'],
        ]);

        register_rest_route(self::NAMESPACE, '/settings', [
            'methods' => 'PUT',
            'callback' => [$this, 'update_settings'],
            'permission_callback' => [$this, 'check_admin_permission'],
        ]);

        // Plugin settings (local WP options)
        register_rest_route(self::NAMESPACE, '/plugin-settings', [
            'methods' => 'GET',
            'callback' => [$this, 'get_plugin_settings'],
            'permission_callback' => [$this, 'check_admin_permission'],
        ]);

        // Dashboard stats
        register_rest_route(self::NAMESPACE, '/stats', [
            'methods' => 'GET',
            'callback' => [$this, 'get_stats'],
            'permission_callback' => [$this, 'check_admin_permission'],
        ]);

        // Patients
        register_rest_route(self::NAMESPACE, '/patients', [
            'methods' => 'GET',
            'callback' => [$this, 'get_patients'],
            'permission_callback' => [$this, 'check_admin_permission'],
        ]);

        register_rest_route(self::NAMESPACE, '/patients', [
            'methods' => 'PUT',
            'callback' => [$this, 'update_patient'],
            'permission_callback' => [$this, 'check_admin_permission'],
        ]);

        // Conversations
        register_rest_route(self::NAMESPACE, '/conversations', [
            'methods' => 'GET',
            'callback' => [$this, 'get_conversations'],
            'permission_callback' => [$this, 'check_admin_permission'],
        ]);

        register_rest_route(self::NAMESPACE, '/conversations/(?P<id>[a-zA-Z0-9_-]+)', [
            'methods' => 'GET',
            'callback' => [$this, 'get_conversation'],
            'permission_callback' => [$this, 'check_admin_permission'],
        ]);

        register_rest_route(self::NAMESPACE, '/conversations/(?P<id>[a-zA-Z0-9_-]+)', [
            'methods' => 'PUT',
            'callback' => [$this, 'update_conversation'],
            'permission_callback' => [$this, 'check_admin_permission'],
        ]);

        // Messages
        register_rest_route(self::NAMESPACE, '/conversations/(?P<id>[a-zA-Z0-9_-]+)/messages', [
            'methods' => 'GET',
            'callback' => [$this, 'get_messages'],
            'permission_callback' => [$this, 'check_admin_permission'],
        ]);

        register_rest_route(self::NAMESPACE, '/conversations/(?P<id>[a-zA-Z0-9_-]+)/messages', [
            'methods' => 'POST',
            'callback' => [$this, 'send_message'],
            'permission_callback' => [$this, 'check_admin_permission'],
        ]);
    }

    /**
     * Check if user has admin capability.
     */
    public function check_admin_permission(): bool {
        return current_user_can('manage_options');
    }

    /**
     * Handle doctor registration (setup wizard).
     */
    public function handle_register(WP_REST_Request $request): WP_REST_Response {
        $params = $request->get_json_params();
        $backend_url = sanitize_url($params['backendUrl'] ?? '');
        $master_secret = sanitize_text_field($params['masterSecret'] ?? '');

        if (empty($backend_url) || empty($master_secret)) {
            return new WP_REST_Response(['error' => 'Backend URL and master secret are required'], 400);
        }

        $current_user = wp_get_current_user();
        $client = new DocBot_API_Client();

        $result = $client->register_doctor($backend_url, $master_secret, [
            'wpUserId' => $current_user->ID,
            'wpSiteUrl' => get_site_url(),
            'name' => $current_user->display_name,
            'email' => $current_user->user_email,
            'whatsappPhoneId' => sanitize_text_field($params['whatsappPhoneId'] ?? ''),
            'whatsappToken' => sanitize_text_field($params['whatsappToken'] ?? ''),
        ]);

        if (!$result['success']) {
            return new WP_REST_Response(['error' => $result['error']], $result['status'] ?: 500);
        }

        // Store the API key (encrypted) and backend URL
        DocBot_Settings::set('backend_url', $backend_url);
        DocBot_Settings::set_api_key($result['data']['apiKey']);
        DocBot_Settings::set('doctor_id', $result['data']['id']);
        DocBot_Settings::complete_setup();

        return new WP_REST_Response([
            'success' => true,
            'doctorId' => $result['data']['id'],
        ]);
    }

    /**
     * Verify an existing API key.
     */
    public function handle_verify_key(WP_REST_Request $request): WP_REST_Response {
        $params = $request->get_json_params();
        $backend_url = sanitize_url($params['backendUrl'] ?? '');
        $api_key = sanitize_text_field($params['apiKey'] ?? '');

        if (empty($backend_url) || empty($api_key)) {
            return new WP_REST_Response(['error' => 'Backend URL and API key are required'], 400);
        }

        $client = new DocBot_API_Client();
        $result = $client->verify_api_key($backend_url, $api_key);

        if (!$result['success']) {
            return new WP_REST_Response(['error' => 'Invalid API key'], 401);
        }

        // Store credentials
        DocBot_Settings::set('backend_url', $backend_url);
        DocBot_Settings::set_api_key($api_key);
        DocBot_Settings::set('doctor_id', $result['data']['doctor']['id'] ?? '');
        DocBot_Settings::complete_setup();

        return new WP_REST_Response(['success' => true, 'doctor' => $result['data']['doctor']]);
    }

    /**
     * Get plugin settings (local WP options).
     */
    public function get_plugin_settings(): WP_REST_Response {
        return new WP_REST_Response(DocBot_Settings::get_all());
    }

    /**
     * Proxy: Get doctor settings from backend.
     */
    public function get_settings(): WP_REST_Response {
        $client = new DocBot_API_Client();
        $result = $client->get('/api/settings');
        return new WP_REST_Response($result['success'] ? $result['data'] : ['error' => $result['error']], $result['status'] ?: 200);
    }

    /**
     * Proxy: Update doctor settings on backend.
     */
    public function update_settings(WP_REST_Request $request): WP_REST_Response {
        $client = new DocBot_API_Client();
        $result = $client->put('/api/settings', $request->get_json_params());
        return new WP_REST_Response($result['success'] ? $result['data'] : ['error' => $result['error']], $result['status'] ?: 200);
    }

    /**
     * Proxy: Get dashboard stats.
     */
    public function get_stats(): WP_REST_Response {
        $client = new DocBot_API_Client();
        $result = $client->get('/api/stats');
        return new WP_REST_Response($result['success'] ? $result['data'] : ['error' => $result['error']], $result['status'] ?: 200);
    }

    /**
     * Proxy: Get patients list.
     */
    public function get_patients(WP_REST_Request $request): WP_REST_Response {
        $client = new DocBot_API_Client();
        $result = $client->get('/api/patients', $request->get_query_params());
        return new WP_REST_Response($result['success'] ? $result['data'] : ['error' => $result['error']], $result['status'] ?: 200);
    }

    /**
     * Proxy: Update patient.
     */
    public function update_patient(WP_REST_Request $request): WP_REST_Response {
        $client = new DocBot_API_Client();
        $result = $client->put('/api/patients', $request->get_json_params());
        return new WP_REST_Response($result['success'] ? $result['data'] : ['error' => $result['error']], $result['status'] ?: 200);
    }

    /**
     * Proxy: Get conversations list.
     */
    public function get_conversations(WP_REST_Request $request): WP_REST_Response {
        $client = new DocBot_API_Client();
        $result = $client->get('/api/conversations/list', $request->get_query_params());
        return new WP_REST_Response($result['success'] ? $result['data'] : ['error' => $result['error']], $result['status'] ?: 200);
    }

    /**
     * Proxy: Get single conversation.
     */
    public function get_conversation(WP_REST_Request $request): WP_REST_Response {
        $id = $request->get_param('id');
        $client = new DocBot_API_Client();
        $result = $client->get("/api/conversations/{$id}");
        return new WP_REST_Response($result['success'] ? $result['data'] : ['error' => $result['error']], $result['status'] ?: 200);
    }

    /**
     * Proxy: Update conversation.
     */
    public function update_conversation(WP_REST_Request $request): WP_REST_Response {
        $id = $request->get_param('id');
        $client = new DocBot_API_Client();
        $result = $client->put("/api/conversations/{$id}", $request->get_json_params());
        return new WP_REST_Response($result['success'] ? $result['data'] : ['error' => $result['error']], $result['status'] ?: 200);
    }

    /**
     * Proxy: Get messages for a conversation.
     */
    public function get_messages(WP_REST_Request $request): WP_REST_Response {
        $id = $request->get_param('id');
        $client = new DocBot_API_Client();
        $result = $client->get("/api/conversations/{$id}/messages", $request->get_query_params());
        return new WP_REST_Response($result['success'] ? $result['data'] : ['error' => $result['error']], $result['status'] ?: 200);
    }

    /**
     * Proxy: Send a doctor reply.
     */
    public function send_message(WP_REST_Request $request): WP_REST_Response {
        $id = $request->get_param('id');
        $client = new DocBot_API_Client();
        $result = $client->post("/api/conversations/{$id}/messages", $request->get_json_params());
        return new WP_REST_Response($result['success'] ? $result['data'] : ['error' => $result['error']], $result['status'] ?: 200);
    }
}
