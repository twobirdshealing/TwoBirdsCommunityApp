<?php
/**
 * Frontend Class
 * Injects JavaScript and CSS into the FluentCommunity portal page
 * to render custom fields in the Vue SPA profile pages.
 *
 * Uses the same injection pattern as FluentCommunity's own FeaturesHandler:
 *   - fluent_community/portal_head     -> CSS
 *   - fluent_community/before_js_loaded -> JS config vars
 *   - fluent_community/portal_footer   -> JS module
 *
 * @package TBC_Registration
 */

namespace TBCRegistration;

defined('ABSPATH') || exit;

class Frontend {

    private $fields;

    public function __construct(Fields $fields) {
        $this->fields = $fields;
    }

    /**
     * Inject CSS into the portal page <head>.
     */
    public function inject_css() {
        ?>
        <link rel="stylesheet"
              href="<?php echo esc_url(TBC_REG_URL . 'assets/css/profile-fields.css'); ?>?v=<?php echo esc_attr(TBC_REG_VERSION); ?>"
              media="screen"/>
        <?php
    }

    /**
     * Inject JavaScript configuration variables before the SPA scripts load.
     * Makes field definitions, type configs, and nonces available to our JS.
     */
    public function inject_js_config() {
        $profileFields = $this->fields->get_fields_for('profile');
        $signupFields = $this->fields->get_fields_for('signup');

        // Build minimal config for frontend (no meta_keys or sanitize callbacks)
        $frontendFields = [];
        foreach ($profileFields as $key => $field) {
            $frontendFields[$key] = [
                'label'        => $field['label'],
                'type'         => $field['type'],
                'placeholder'  => $field['placeholder'] ?? '',
                'instructions' => $field['instructions'] ?? '',
                'required'     => !empty($field['required']),
                'options'      => Fields::get_field_options($field),
            ];
        }

        // Build signup field instructions for JS (keyed by field slug)
        $signupInstructions = [];
        foreach ($signupFields as $key => $field) {
            if (!empty($field['instructions'])) {
                $signupInstructions[$key] = $field['instructions'];
            }
        }

        ?>
        <script>
            var tbcRegConfig = <?php echo wp_json_encode([
                'fields'              => $frontendFields,
                'signupInstructions'  => $signupInstructions,
                'restUrl'             => rest_url('fluent-community/v2/'),
                'nonce'               => wp_create_nonce('wp_rest'),
                'ajaxUrl'             => admin_url('admin-ajax.php'),
                'ajaxNonce'           => wp_create_nonce('tbc_reg_nonce'),
                'version'             => TBC_REG_VERSION,
            ]); ?>;
        </script>
        <?php
    }

    /**
     * Inject main JavaScript module into the portal page footer.
     */
    public function inject_js() {
        ?>
        <script src="<?php echo esc_url(TBC_REG_URL . 'assets/js/profile-fields.js'); ?>?v=<?php echo esc_attr(TBC_REG_VERSION); ?>" defer="defer"></script>
        <?php
    }

    // -------------------------------------------------------------------------
    // Auth page hooks (registration) — portal hooks don't fire on auth pages
    // -------------------------------------------------------------------------

    /**
     * Check if we're on FC's auth registration page.
     */
    private function is_registration_page() {
        // phpcs:ignore WordPress.Security.NonceVerification.Recommended
        return isset($_GET['fcom_action']) && $_GET['fcom_action'] === 'auth'
            // phpcs:ignore WordPress.Security.NonceVerification.Recommended
            && isset($_GET['form']) && $_GET['form'] === 'register';
    }

    /**
     * Inject CSS on the auth registration page via wp_head.
     */
    public function maybe_inject_auth_css() {
        if (!$this->is_registration_page()) return;
        $this->inject_css();
    }

    /**
     * Inject JS config + script on the auth registration page via wp_footer.
     */
    public function maybe_inject_auth_js() {
        if (!$this->is_registration_page()) return;
        $this->inject_js_config();
        $this->inject_js();
    }
}
