<?php
/**
 * Helpers Class
 * Static utility methods for phone formatting, OTP sessions, duplicate checking, and logging.
 *
 * @package TBC_Fluent_Profiles
 */

declare(strict_types=1);

namespace TBCFluentProfiles;

defined('ABSPATH') || exit;

class Helpers {

    /**
     * Format a phone number to E.164 for Twilio.
     *
     * @param string $phone     Raw phone number.
     * @param bool   $clean_html Strip HTML tags and URL-decode first.
     * @return string E.164 formatted phone or empty string on failure.
     */
    public static function format_phone(string $phone, bool $clean_html = false): string {
        if (empty($phone)) {
            return '';
        }

        if ($clean_html) {
            $phone = strip_tags($phone);
            $phone = urldecode($phone);
        }

        // Keep only digits and leading +
        $phone = preg_replace('/[^0-9+]/', '', trim($phone));

        if (empty($phone)) {
            return '';
        }

        // Already E.164
        if (str_starts_with($phone, '+')) {
            return $phone;
        }

        // US: 10-digit -> +1
        if (strlen($phone) === 10) {
            return '+1' . $phone;
        }

        // US: 11-digit starting with 1 -> +
        if (strlen($phone) === 11 && str_starts_with($phone, '1')) {
            return '+' . $phone;
        }

        return '+' . $phone;
    }

    /**
     * Mask a phone number for display (e.g. +1214***1234).
     */
    public static function mask_phone(string $phone): string {
        $len = strlen($phone);
        if ($len <= 6) {
            return $phone;
        }
        return substr($phone, 0, 4) . str_repeat('*', $len - 8) . substr($phone, -4);
    }

    /**
     * Check if a phone number is already used by another user.
     *
     * @param string $phone           E.164 phone number.
     * @param int    $exclude_user_id User ID to exclude (for profile updates).
     */
    public static function is_duplicate(string $phone, int $exclude_user_id = 0): bool {
        if (!self::get_option('restrict_duplicates', false) || empty($phone)) {
            return false;
        }

        global $wpdb;

        $meta_key   = self::get_phone_meta_key();
        $digits     = preg_replace('/[^0-9]/', '', $phone);
        $last_10    = substr($digits, -10);

        if (strlen($last_10) !== 10) {
            return false;
        }

        $query  = "SELECT user_id FROM {$wpdb->usermeta}
                   WHERE meta_key = %s
                     AND meta_value IS NOT NULL
                     AND meta_value != ''
                     AND SUBSTRING(REGEXP_REPLACE(meta_value, '[^0-9]', ''), -10) = %s";
        $params = [$meta_key, $last_10];

        if ($exclude_user_id > 0) {
            $query   .= ' AND user_id != %d';
            $params[] = $exclude_user_id;
        }

        $query .= ' LIMIT 1';

        $existing = $wpdb->get_var($wpdb->prepare($query, $params));

        if ($existing) {
            self::log("Duplicate phone detected: {$phone} (last 10: {$last_10}) used by user #{$existing}");
            return true;
        }

        return false;
    }

    /**
     * Check if a phone number is in the blocked list.
     */
    public static function is_blocked(string $phone): bool {
        if (empty($phone)) {
            return false;
        }

        $blocked_raw = self::get_option('blocked_numbers', '');
        if (empty($blocked_raw)) {
            return false;
        }

        $blocked_list = array_filter(array_map('trim', explode("\n", $blocked_raw)));
        if (empty($blocked_list)) {
            return false;
        }

        $formatted = self::format_phone($phone);

        foreach ($blocked_list as $blocked) {
            if (self::format_phone($blocked) === $formatted) {
                self::log("Blocked phone detected: {$formatted}");
                return true;
            }
        }

        return false;
    }

    /**
     * Get the usermeta key used for phone storage.
     *
     * Reads the selected phone field from settings. Values:
     *   - A meta key like '_tbc_fp_phone' — selected from phone fields dropdown.
     *   - 'custom' — use the manual `phone_meta_key_custom` value.
     *   - 'auto' or empty — fallback: first phone-type field from Profile Fields.
     */
    public static function get_phone_meta_key(): string {
        $setting = (string) self::get_option('phone_meta_key', 'auto');

        if ($setting === 'custom') {
            $custom = trim((string) self::get_option('phone_meta_key_custom', ''));
            if ($custom !== '') {
                return $custom;
            }
        }

        // Specific meta key selected from dropdown
        if ($setting !== '' && $setting !== 'auto' && $setting !== 'custom') {
            return $setting;
        }

        // Fallback: first phone-type field
        $phone_fields = self::get_phone_fields();
        return !empty($phone_fields) ? array_key_first($phone_fields) : TBC_FP_META_PREFIX . 'phone';
    }

    /**
     * Get all phone-type fields from Profile Fields.
     *
     * @return array<string, string> Meta key => label pairs.
     */
    public static function get_phone_fields(): array {
        $fields = (new Fields())->get_fields();
        $phone_fields = [];

        foreach ($fields as $key => $field) {
            if (($field['type'] ?? '') === 'phone') {
                $phone_fields[Fields::meta_key($key)] = $field['label'] ?? $key;
            }
        }

        return $phone_fields;
    }

    /**
     * Get a plugin option.
     *
     * @param mixed $default Default value.
     * @return mixed
     */
    public static function get_option(string $key, $default = false) {
        return get_option('tbc_fp_' . $key, $default);
    }

    /**
     * Update a plugin option.
     *
     * @param mixed $value Value to store.
     */
    public static function update_option(string $key, $value): bool {
        return update_option('tbc_fp_' . $key, $value);
    }

    /**
     * Log a message when WP_DEBUG is enabled.
     */
    public static function log(string $message, string $level = 'info'): void {
        if (defined('WP_DEBUG') && WP_DEBUG) {
            error_log("[TBC FP][{$level}] {$message}");
        }
    }

    /**
     * Generate a unique session key with the given prefix.
     */
    public static function generate_session_key(string $prefix = 'tbc_fp_session_'): string {
        return $prefix . wp_generate_uuid4();
    }

    /**
     * Store an OTP session in a transient.
     *
     * @param array $data Session data.
     */
    public static function store_session(string $key, array $data, int $ttl = 600): void {
        $data['created_at'] = $data['created_at'] ?? time();
        $data['verified']   = $data['verified'] ?? false;
        set_transient($key, $data, $ttl);
        self::log("Session stored: {$key}");
    }

    /**
     * Retrieve an OTP session.
     *
     * @return array<string, mixed>|false
     */
    public static function get_session(string $key) {
        if (empty($key)) {
            return false;
        }

        $data = get_transient($key);
        if ($data === false) {
            self::log("Session expired or missing: {$key}");
            return false;
        }

        return $data;
    }

    /**
     * Mark a session as verified.
     */
    public static function mark_verified(string $key, int $ttl = 600): bool {
        $data = self::get_session($key);
        if (!$data) {
            return false;
        }

        $data['verified'] = true;
        set_transient($key, $data, $ttl);
        self::log("Session verified: {$key}");
        return true;
    }

    /**
     * Check if a session is verified.
     */
    public static function is_verified(string $key): bool {
        $data = self::get_session($key);
        return is_array($data) && ($data['verified'] ?? false) === true;
    }

    /**
     * Delete a session.
     */
    public static function delete_session(string $key): void {
        delete_transient($key);
        self::log("Session deleted: {$key}");
    }

    // =========================================================================
    // Bot Protection
    // =========================================================================

    /**
     * Validate a Cloudflare Turnstile token.
     *
     * @param string $token  The cf-turnstile-response token from the client.
     * @param string $remote_ip  Optional client IP for extra validation.
     * @return true|\WP_Error  True on success, WP_Error on failure.
     */
    public static function validate_turnstile(string $token, string $remote_ip = '') {
        $secret = self::get_option('turnstile_secret_key', '');
        if (empty($secret)) {
            // Misconfigured — secret key missing. Fail open with a log warning.
            self::log('Turnstile secret key not configured — skipping validation', 'warn');
            return true;
        }

        if (empty($token)) {
            return new \WP_Error('turnstile_missing', 'Bot verification failed. Please try again.');
        }

        $body = [
            'secret'   => $secret,
            'response' => $token,
        ];

        if (!empty($remote_ip)) {
            $body['remoteip'] = $remote_ip;
        }

        $response = wp_remote_post('https://challenges.cloudflare.com/turnstile/v0/siteverify', [
            'body'    => $body,
            'timeout' => 10,
        ]);

        if (is_wp_error($response)) {
            self::log('Turnstile API request failed: ' . $response->get_error_message(), 'error');
            // Fail open on network error so real users aren't blocked
            return true;
        }

        $result = json_decode(wp_remote_retrieve_body($response), true);

        if (empty($result['success'])) {
            $codes = implode(', ', $result['error-codes'] ?? ['unknown']);
            self::log("Turnstile validation failed: {$codes}", 'warn');
            return new \WP_Error('turnstile_failed', 'Bot verification failed. Please try again.');
        }

        return true;
    }

    /**
     * Validate the mobile app token header.
     *
     * @param string $token  The X-App-Token header value.
     * @return bool  True if the token matches the configured app token.
     */
    public static function validate_app_token(string $token): bool {
        $configured = self::get_option('app_token', '');
        if (empty($configured)) {
            return false;
        }
        return hash_equals($configured, $token);
    }

    /**
     * Check if an email address is blocked.
     *
     * Checks against: (1) built-in disposable domain list, (2) admin-configured
     * blocked emails and domains (supports full emails and domain-only entries).
     *
     * @param string $email  Email address to check.
     * @return bool  True if the email should be blocked.
     */
    public static function is_disposable_email(string $email): bool {
        $email_lower = strtolower(trim($email));
        $domain = strtolower(substr(strrchr($email_lower, '@'), 1));
        if (empty($domain)) {
            return false;
        }

        $disposable_domains = [
            // Major disposable email services
            'tempmail.com', 'temp-mail.org', 'temp-mail.io', 'tempmailo.com',
            'guerrillamail.com', 'guerrillamail.net', 'guerrillamail.org', 'guerrillamail.de',
            'guerrillamailblock.com', 'grr.la', 'sharklasers.com', 'guerrilla.ml',
            'mailinator.com', 'mailinator2.com', 'mailinater.com',
            'yopmail.com', 'yopmail.fr', 'yopmail.net',
            'throwaway.email', 'throwawaymail.com',
            'dispostable.com', 'disposableemailaddresses.emailmiser.com',
            'mailnesia.com', 'maildrop.cc', 'discard.email',
            'fakeinbox.com', 'guerrillamail.info',
            'trashmail.com', 'trashmail.me', 'trashmail.net', 'trashmail.org',
            'trashymail.com', 'trashymail.net',
            'mailcatch.com', 'mailexpire.com', 'mailmoat.com',
            'mytemp.email', 'mytrashmail.com',
            'getnada.com', 'nada.email', 'nada.ltd',
            'tempail.com', 'tempr.email', 'temptami.co',
            'harakirimail.com', 'tmail.ws',
            '10minutemail.com', '10minutemail.net', '10minutemail.org',
            '20minutemail.com', '20minutemail.it',
            'mohmal.com', 'mohmal.in', 'mohmal.im',
            'emailondeck.com', 'emailfake.com',
            'crazymailing.com', 'crazy.ml',
            'mailsac.com', 'inboxkitten.com',
            'burnermail.io', 'burnmail.ca',
            'jetable.org', 'jetable.net', 'jetable.com',
            'spamgourmet.com', 'spamgourmet.net',
            'mintemail.com', 'flirtto.gq',
            'safetymail.info', 'safetypost.de',
            'receiveee.com', 'mailtemp.top',
            'tempinbox.com', 'tempinbox.xyz',
            'tempomail.fr', 'temporaryemail.net', 'temporaryemail.us',
            'tmpmail.net', 'tmpmail.org',
            'emailna.co', 'emailna.life',
            'emltmp.com', 'ezztt.com',
            'fixmail.tk', 'flurred.com',
            'getairmail.com', 'getonemail.com', 'getonemail.net',
            'imgof.com', 'incognitomail.org', 'infocom.zp.ua',
            'instantemailaddress.com', 'ipoo.org',
            'irish2me.com', 'jetable.pp.ua',
            'kasmail.com', 'koszmail.pl',
            'kurzepost.de', 'lackmail.net', 'lackmail.ru',
            'laoho.com', 'lastmail.co',
            'link2mail.net', 'litedrop.com',
            'lol.ovpn.to', 'lookugly.com',
            'lortemail.dk', 'lr78.com',
            'mailbidon.com', 'maileater.com',
            'mailforspam.com', 'mailfree.ga',
            'mailhz.me', 'mailimate.com',
            'mailismagic.com', 'mailmate.com',
            'mailme.ir', 'mailme.lv',
            'mailmetrash.com', 'mailnull.com',
            'mailox.fun', 'mailpick.biz',
            'mailrock.biz', 'mailscrap.com',
            'mailshell.com', 'mailsiphon.com',
            'mailslite.com', 'mailtemp.info',
            'mailzilla.com', 'mailzilla.org',
            'meltmail.com', 'messagebeamer.de',
            'mezimages.net', 'mfsa.ru',
            'misterpinball.de',
            'mt2015.com', 'mx0.wwwnew.eu',
            'mypartyclip.de', 'myzx.com',
            'nervmich.net', 'nervtansen.de',
            'netmails.com', 'netmails.net',
            'neverbox.com', 'no-spam.ws',
            'nobulk.com', 'noclickemail.com',
            'nogmailspam.info', 'nomail.xl.cx',
            'nomail2me.com', 'nomorespamemails.com',
            'nonspam.eu', 'nonspammer.de',
            'noref.in', 'nothingtoseehere.ca',
            'nowmymail.com', 'nurfuerspam.de',
            'objectmail.com', 'obobbo.com',
            'oneoffemail.com', 'onewaymail.com',
            'online.ms', 'oopi.org',
            'ordinaryamerican.net', 'owlpic.com',
            'pancakemail.com', 'pimpedupmyspace.com',
            'pjjkp.com', 'plexolan.de',
            'pookmail.com', 'privacy.net',
            'privy-mail.com', 'proxymail.eu',
            'prtnx.com', 'putthisinyourspamdatabase.com',
            'quickinbox.com', 'rcpt.at',
            'reallymymail.com', 'recode.me',
            'regbypass.com', 'rejectmail.com',
            'rhyta.com', 'rklips.com',
            'rmqkr.net', 'royal.net',
            'rppkn.com', 'rtrtr.com',
            's0ny.net', 'safe-mail.net',
            'safersignup.de',
            'sandelf.de', 'saynotospams.com',
            'scatmail.com', 'schafmail.de',
            'selfdestructingmail.com', 'sendspamhere.com',
            'shiftmail.com', 'shitmail.me',
            'shortmail.net', 'sibmail.com',
            'skeefmail.com', 'slaskpost.se',
            'slipry.net', 'slopsbox.com',
            'smashmail.de', 'snoopmail.com',
            'sofimail.com', 'sofort-mail.de',
            'softpls.asia', 'sogetthis.com',
            'soodonims.com', 'spam.la',
            'spam.su', 'spam4.me',
            'spamavert.com', 'spambob.com',
            'spambob.net', 'spambob.org',
            'spambog.com', 'spambog.de',
            'spambog.ru', 'spambox.info',
            'spambox.irishspringrealty.com', 'spambox.us',
            'spamcannon.com', 'spamcannon.net',
            'spamcero.com', 'spamcorptastic.com',
            'spamcowboy.com', 'spamcowboy.net',
            'spamcowboy.org', 'spamday.com',
            'spamex.com', 'spamfighter.cf',
            'spamfighter.ga', 'spamfighter.gq',
            'spamfighter.ml', 'spamfighter.tk',
            'spamfree24.com', 'spamfree24.de',
            'spamfree24.eu', 'spamfree24.info',
            'spamfree24.net', 'spamfree24.org',
            'spamgoes.in', 'spamherelots.com',
            'spamhereplease.com', 'spamhole.com',
            'spamify.com', 'spaminator.de',
            'spamkill.info', 'spaml.com',
            'spaml.de', 'spammotel.com',
            'spamobox.com', 'spamoff.de',
            'spamslicer.com', 'spamspot.com',
            'spamstack.net', 'spamthis.co.uk',
            'spamtrail.com', 'spamtrap.ro',
            'speed.1s.fr', 'spoofmail.de',
            'stuffmail.de', 'supergreatmail.com',
            'supermailer.jp', 'superrito.com',
            'superstachel.de', 'suremail.info',
            'svk.jp', 'sweetxxx.de',
            'tafmail.com', 'tagyoureit.com',
            'talkinator.com', 'tapchicuoihoi.com',
            'teewars.org', 'teleworm.com', 'teleworm.us',
            'temp.emeraldcraft.com', 'temp.headstrong.de',
            'tempemail.biz', 'tempemail.co.za',
            'tempemail.com', 'tempemail.net',
            'tempmailer.com', 'tempmailer.de',
        ];

        if (in_array($domain, $disposable_domains, true)) {
            return true;
        }

        // Admin-configured blocked emails and domains
        $blocked_raw = self::get_option('blocked_emails', '');
        if (!empty($blocked_raw)) {
            $blocked_list = array_filter(array_map('trim', explode("\n", strtolower($blocked_raw))));
            foreach ($blocked_list as $entry) {
                // Full email match (e.g. spammer@gmail.com)
                if (strpos($entry, '@') !== false && $entry === $email_lower) {
                    return true;
                }
                // Domain match (e.g. sketchy.com)
                if (strpos($entry, '@') === false && $entry === $domain) {
                    return true;
                }
            }
        }

        return false;
    }
}
