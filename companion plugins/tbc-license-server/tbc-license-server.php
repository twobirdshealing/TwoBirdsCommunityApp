<?php
/**
 * Plugin Name: TBC - License Server
 * Plugin URI: https://twobirdscode.com
 * Description: Bridge between the TBC Community App dashboard and FluentCart Pro licensing. Validates licenses and serves core updates.
 * Version: 2.2.0
 * Author: Two Birds Code
 * Author URI: https://twobirdscode.com
 * License: GPL v2 or later
 * License URI: https://www.gnu.org/licenses/gpl-2.0.html
 * Text Domain: tbc-license
 *
 * Requires: FluentCart Pro (with Licensing module enabled)
 *
 * This is a thin bridge plugin — FluentCart Pro handles all license management
 * (key generation, subscription sync, admin UI, customer portal). This plugin
 * only exposes the REST endpoint that the buyer's dashboard calls.
 *
 * @see CHANGELOG.md for version history
 */

if (!defined('ABSPATH')) exit;

define('TBC_LICENSE_VERSION', '2.2.0');
define('TBC_LICENSE_REST_NAMESPACE', 'tbc-license/v1');

// Allow tar.gz/gz uploads in WordPress (needed for FluentCart update packages)
// upload_mimes: registers the MIME types so WordPress recognizes them
// wp_check_filetype_and_ext: fixes detection for .tar.gz double extension
add_filter('upload_mimes', function ($mimes) {
    $mimes['gz']     = 'application/gzip';
    $mimes['tar.gz'] = 'application/gzip';
    return $mimes;
});

add_filter('wp_check_filetype_and_ext', function ($data, $file, $filename) {
    if (str_ends_with($filename, '.tar.gz')) {
        $data['ext']  = 'tar.gz';
        $data['type'] = 'application/gzip';
    } elseif (str_ends_with($filename, '.gz')) {
        $data['ext']  = 'gz';
        $data['type'] = 'application/gzip';
    }
    return $data;
}, 10, 3);

// Register REST routes
add_action('rest_api_init', function () {
    require_once __DIR__ . '/includes/class-license-api.php';
    $api = new TBC_License_API();
    $api->register_routes();
});
