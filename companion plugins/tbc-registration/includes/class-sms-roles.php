<?php
/**
 * SMS Roles Class
 * Automatically assigns sms_in / sms_out WordPress roles based on a
 * configurable profile field value. Replaces Uncanny Automator dependency.
 *
 * @package TBC_Registration
 */

namespace TBCRegistration;

defined('ABSPATH') || exit;

class SmsRoles {

    /**
     * Sync the sms_in / sms_out role for a user based on the configured
     * SMS opt-in profile field value (read from FC native custom_fields JSON).
     *
     * @param int    $user_id WordPress user ID.
     * @param string $context Where the sync was triggered from (for logging).
     */
    public function sync_sms_role( $user_id, $context = '' ) {
        Helpers::log( "[SMS Roles] sync_sms_role called — user_id=" . var_export( $user_id, true ) . ", context={$context}" );

        if ( empty( $user_id ) ) {
            Helpers::log( '[SMS Roles] Aborted — empty user_id.' );
            return;
        }

        $field_slug = Helpers::get_option( 'sms_optin_field', '' );
        if ( empty( $field_slug ) ) {
            Helpers::log( '[SMS Roles] Feature disabled — no field configured.' );
            return;
        }

        $optin_value = Helpers::get_option( 'sms_optin_value', 'Yes' );
        $current     = Helpers::get_fc_custom_field( (int) $user_id, $field_slug );

        $user = new \WP_User( $user_id );
        if ( ! $user->exists() ) {
            Helpers::log( "[SMS Roles] User {$user_id} not found." );
            return;
        }

        Helpers::log( "[SMS Roles] [{$context}] User {$user_id}: slug={$field_slug}, value='{$current}', optin_value='{$optin_value}'" );

        if ( strcasecmp( trim( $current ), trim( $optin_value ) ) === 0 ) {
            $user->add_role( 'sms_in' );
            $user->remove_role( 'sms_out' );
            Helpers::log( "[SMS Roles] User {$user_id} → sms_in" );
        } else {
            $user->add_role( 'sms_out' );
            $user->remove_role( 'sms_in' );
            Helpers::log( "[SMS Roles] User {$user_id} → sms_out (value='{$current}')" );
        }
    }

    /**
     * Hook: fluent_community/update_profile_data (priority 20, after ProfileApi saves at 10).
     *
     * FC filter signature: ($updateData, $rawRequestData, $xProfile)
     *   - $update_data = array being saved to xprofile (filterable)
     *   - $raw_data    = raw request data array
     *   - $xprofile    = XProfile model (has ->user_id, NOT ->ID)
     *
     * @param mixed  $update_data The data FC will save (passed through).
     * @param mixed  $raw_data    Raw request data array.
     * @param object $xprofile    XProfile model instance.
     * @return mixed
     */
    public function on_profile_update( $update_data, $raw_data = null, $xprofile = null ) {
        // Debug: dump what FC actually passes
        $arg_count = func_num_args();
        Helpers::log( "[SMS Roles] on_profile_update: arg_count={$arg_count}" );
        Helpers::log( "[SMS Roles]   arg1 type=" . gettype( $update_data ) . ( is_object( $update_data ) ? ' class=' . get_class( $update_data ) : '' ) );
        if ( $arg_count >= 2 ) {
            Helpers::log( "[SMS Roles]   arg2 type=" . gettype( $raw_data ) . ( is_object( $raw_data ) ? ' class=' . get_class( $raw_data ) : '' ) );
        }
        if ( $arg_count >= 3 ) {
            Helpers::log( "[SMS Roles]   arg3 type=" . gettype( $xprofile ) . ( is_object( $xprofile ) ? ' class=' . get_class( $xprofile ) : '' ) );
        }

        $user_id = 0;

        // Try all 3 args for an object with user_id
        foreach ( [ $xprofile, $raw_data, $update_data ] as $arg ) {
            if ( is_object( $arg ) && isset( $arg->user_id ) ) {
                $user_id = (int) $arg->user_id;
                break;
            }
        }

        // Fallback: current logged-in user
        if ( ! $user_id ) {
            $user_id = get_current_user_id();
            Helpers::log( "[SMS Roles]   get_current_user_id fallback = {$user_id}" );
        }

        if ( $user_id ) {
            $this->sync_sms_role( $user_id, 'fc_filter' );
        } else {
            Helpers::log( '[SMS Roles] on_profile_update: could not determine user_id' );
        }
        return $update_data;
    }

    /**
     * Hook: tbc_reg_registration_response (priority 5).
     * Custom fields are already saved before this filter fires.
     *
     * @param array            $response Response data (passed through).
     * @param int              $user_id  Newly created user ID.
     * @param \WP_REST_Request $request  REST request.
     * @return array
     */
    public function on_registration( $response, $user_id, $request ) {
        $this->sync_sms_role( $user_id, 'registration' );
        return $response;
    }
}
