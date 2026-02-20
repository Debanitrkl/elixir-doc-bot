<?php
/**
 * HTTP client for communicating with the Vercel backend.
 */
class DocBot_API_Client {

    private string $base_url;
    private string $api_key;

    public function __construct() {
        $this->base_url = DocBot_Settings::get_backend_url();
        $this->api_key = DocBot_Settings::get_api_key();
    }

    /**
     * Make a GET request to the backend.
     */
    public function get(string $endpoint, array $params = []): array {
        $url = $this->base_url . $endpoint;
        if (!empty($params)) {
            $url .= '?' . http_build_query($params);
        }

        $response = wp_remote_get($url, [
            'headers' => $this->get_headers(),
            'timeout' => 30,
        ]);

        return $this->handle_response($response);
    }

    /**
     * Make a POST request to the backend.
     */
    public function post(string $endpoint, array $body = []): array {
        $response = wp_remote_post($this->base_url . $endpoint, [
            'headers' => $this->get_headers(),
            'body' => wp_json_encode($body),
            'timeout' => 30,
        ]);

        return $this->handle_response($response);
    }

    /**
     * Make a PUT request to the backend.
     */
    public function put(string $endpoint, array $body = []): array {
        $response = wp_remote_request($this->base_url . $endpoint, [
            'method' => 'PUT',
            'headers' => $this->get_headers(),
            'body' => wp_json_encode($body),
            'timeout' => 30,
        ]);

        return $this->handle_response($response);
    }

    /**
     * Register a new doctor (uses master secret, not API key).
     */
    public function register_doctor(string $backend_url, string $master_secret, array $doctor_data): array {
        $body = array_merge($doctor_data, [
            'masterSecret' => $master_secret,
        ]);

        $response = wp_remote_post($backend_url . '/api/doctors/register', [
            'headers' => [
                'Content-Type' => 'application/json',
            ],
            'body' => wp_json_encode($body),
            'timeout' => 30,
        ]);

        return $this->handle_response($response);
    }

    /**
     * Verify an API key is valid.
     */
    public function verify_api_key(string $backend_url, string $api_key): array {
        $response = wp_remote_get($backend_url . '/api/auth/verify', [
            'headers' => [
                'Authorization' => 'Bearer ' . $api_key,
                'Content-Type' => 'application/json',
            ],
            'timeout' => 15,
        ]);

        return $this->handle_response($response);
    }

    /**
     * Get default headers for API requests.
     */
    private function get_headers(): array {
        return [
            'Authorization' => 'Bearer ' . $this->api_key,
            'Content-Type' => 'application/json',
        ];
    }

    /**
     * Parse and handle the HTTP response.
     */
    private function handle_response($response): array {
        if (is_wp_error($response)) {
            return [
                'success' => false,
                'error' => $response->get_error_message(),
                'status' => 0,
            ];
        }

        $status_code = wp_remote_retrieve_response_code($response);
        $body = wp_remote_retrieve_body($response);
        $data = json_decode($body, true);

        if ($status_code >= 200 && $status_code < 300) {
            return [
                'success' => true,
                'data' => $data,
                'status' => $status_code,
            ];
        }

        return [
            'success' => false,
            'error' => $data['error'] ?? 'Request failed',
            'status' => $status_code,
            'data' => $data,
        ];
    }
}
