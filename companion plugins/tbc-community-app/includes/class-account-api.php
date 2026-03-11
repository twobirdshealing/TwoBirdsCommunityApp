<?php
/**
 * Account Management API — deactivation & deletion endpoints
 *
 * Endpoints:
 *   POST   /tbc-ca/v1/account/deactivate  - Soft-deactivate profile (reversible via web)
 *   DELETE /tbc-ca/v1/account/delete       - Permanently delete account and all data
 *
 * @package TBC_Community_App
 * @since 3.10.0
 */

if (!defined('ABSPATH')) {
    exit;
}

class TBC_CA_Account_API {

    private static $instance = null;

    public static function get_instance() {
        if (null === self::$instance) {
            self::$instance = new self();
        }
        return self::$instance;
    }

    private function __construct() {
        add_action('rest_api_init', [$this, 'register_routes']);
    }

    // -------------------------------------------------------------------------
    // Routes
    // -------------------------------------------------------------------------

    public function register_routes() {
        register_rest_route(TBC_CA_REST_NAMESPACE, '/account/deactivate', [
            'methods'             => 'POST',
            'callback'            => [$this, 'handle_deactivate'],
            'permission_callback' => 'is_user_logged_in',
        ]);

        register_rest_route(TBC_CA_REST_NAMESPACE, '/account/delete', [
            'methods'             => 'DELETE',
            'callback'            => [$this, 'handle_delete'],
            'permission_callback' => 'is_user_logged_in',
            'args'                => [
                'confirm' => [
                    'required' => true,
                    'type'     => 'string',
                ],
            ],
        ]);
    }

    // -------------------------------------------------------------------------
    // Deactivate Account
    // -------------------------------------------------------------------------

    /**
     * Soft-deactivate the current user's Fluent Community profile.
     * Sets xprofile status to '' (empty) which hides the profile.
     * Reversible by logging in on the web portal.
     */
    public function handle_deactivate(WP_REST_Request $request) {
        $user_id = get_current_user_id();

        if (!$user_id) {
            return new WP_REST_Response([
                'success' => false,
                'message' => 'Not authenticated.',
            ], 401);
        }

        // Get the Fluent Community XProfile
        if (!class_exists('\FluentCommunity\App\Models\XProfile')) {
            return new WP_REST_Response([
                'success' => false,
                'message' => 'Fluent Community is not active.',
            ], 500);
        }

        $xprofile = \FluentCommunity\App\Models\XProfile::where('user_id', $user_id)->first();

        if (!$xprofile) {
            return new WP_REST_Response([
                'success' => false,
                'message' => 'Profile not found.',
            ], 404);
        }

        if ($xprofile->status !== 'active') {
            return new WP_REST_Response([
                'success' => false,
                'message' => 'Profile is already deactivated.',
            ], 400);
        }

        // Deactivate — same as Fluent's ProfileController logic
        $xprofile->status = '';
        $xprofile->save();
        update_user_meta($user_id, '_fcom_deactivated_at', current_time('mysql'));
        do_action('fluent_community/profile_deactivated', $xprofile);

        return new WP_REST_Response([
            'success' => true,
            'message' => 'Your profile has been deactivated. You can reactivate it by logging in on the website.',
        ], 200);
    }

    // -------------------------------------------------------------------------
    // Delete Account
    // -------------------------------------------------------------------------

    /**
     * Permanently delete the current user's WordPress account.
     * This triggers Fluent Community's CleanupHandler::handleUserDeleted()
     * which removes all Fluent data (messages, posts, comments, etc.).
     *
     * Requires { "confirm": "DELETE" } in the request body as a safety check.
     */
    public function handle_delete(WP_REST_Request $request) {
        $user_id = get_current_user_id();

        if (!$user_id) {
            return new WP_REST_Response([
                'success' => false,
                'message' => 'Not authenticated.',
            ], 401);
        }

        // Safety check — require explicit confirmation
        $confirm = $request->get_param('confirm');
        if ($confirm !== 'DELETE') {
            return new WP_REST_Response([
                'success' => false,
                'message' => 'Confirmation required. Send { "confirm": "DELETE" } to proceed.',
            ], 400);
        }

        // Prevent admins from accidentally deleting themselves
        if (user_can($user_id, 'manage_options')) {
            return new WP_REST_Response([
                'success' => false,
                'message' => 'Administrator accounts cannot be deleted from the app. Please use the WordPress admin panel.',
            ], 403);
        }

        // Require wp-admin/includes/user.php for wp_delete_user()
        require_once ABSPATH . 'wp-admin/includes/user.php';

        // Delete the WordPress user — this triggers:
        // - Fluent Community CleanupHandler::handleUserDeleted()
        //   → removes messages, threads, notifications, comments, reactions,
        //     posts, space memberships, activities, xprofile, media
        // - Any other plugins hooked to 'deleted_user'
        $deleted = wp_delete_user($user_id);

        if (!$deleted) {
            return new WP_REST_Response([
                'success' => false,
                'message' => 'Failed to delete account. Please try again or contact support.',
            ], 500);
        }

        return new WP_REST_Response([
            'success' => true,
            'message' => 'Your account and all associated data have been permanently deleted.',
        ], 200);
    }
}
