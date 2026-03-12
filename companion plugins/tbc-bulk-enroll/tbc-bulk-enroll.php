<?php
/**
 * Plugin Name: TBC - Bulk Course Enrollment
 * Plugin URI: https://twobirdschurch.com
 * Description: Admin tool to bulk enroll users by role into Fluent Community courses
 * Version: 1.0.0
 * Author: Two Birds Church
 * Author URI: https://twobirdschurch.com
 * Text Domain: tbc-bulk-enroll
 * Requires at least: 6.0
 * Requires PHP: 7.4
 *
 * CHANGELOG
 * ---------
 * 1.0.0 - Initial release: bulk enroll users by WordPress role into Fluent Community courses
 */

if (!defined('ABSPATH')) {
    exit;
}

define('TBC_BE_VERSION', '1.0.0');

use FluentCommunity\Modules\Course\Services\CourseHelper;
use FluentCommunity\Modules\Course\Model\Course;

// ---------------------------------------------------------------------------
// Admin menu
// ---------------------------------------------------------------------------
add_action('admin_menu', function () {
    add_management_page(
        __('Bulk Course Enrollment', 'tbc-bulk-enroll'),
        __('Bulk Enroll', 'tbc-bulk-enroll'),
        'manage_options',
        'tbc-bulk-enroll',
        'tbc_be_render_page'
    );
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function tbc_be_has_courses(): bool {
    return defined('FLUENT_COMMUNITY_PLUGIN_VERSION')
        && class_exists('FluentCommunity\Modules\Course\Services\CourseHelper');
}

function tbc_be_get_courses(): array {
    if (!tbc_be_has_courses()) {
        return [];
    }
    return Course::where('status', 'published')
        ->where('type', 'course')
        ->orderBy('title', 'ASC')
        ->get()
        ->toArray();
}

function tbc_be_get_roles(): array {
    global $wp_roles;
    $roles = [];
    foreach ($wp_roles->roles as $slug => $details) {
        $roles[$slug] = $details['name'];
    }
    asort($roles);
    return $roles;
}

// ---------------------------------------------------------------------------
// AJAX: preview count
// ---------------------------------------------------------------------------
add_action('wp_ajax_tbc_be_preview', function () {
    check_ajax_referer('tbc_be_nonce', 'nonce');

    if (!current_user_can('manage_options')) {
        wp_send_json_error('Unauthorized');
    }

    $role      = sanitize_text_field($_POST['role'] ?? '');
    $course_id = absint($_POST['course_id'] ?? 0);

    if (!$role || !$course_id) {
        wp_send_json_error('Missing role or course.');
    }

    if (!tbc_be_has_courses()) {
        wp_send_json_error('Fluent Community course module not found.');
    }

    $users = get_users(['role' => $role, 'fields' => 'ID']);
    $total = count($users);
    $already_enrolled = 0;

    foreach ($users as $uid) {
        if (CourseHelper::isEnrolled($course_id, (int) $uid)) {
            $already_enrolled++;
        }
    }

    wp_send_json_success([
        'total'            => $total,
        'already_enrolled' => $already_enrolled,
        'to_enroll'        => $total - $already_enrolled,
    ]);
});

// ---------------------------------------------------------------------------
// AJAX: run enrollment
// ---------------------------------------------------------------------------
add_action('wp_ajax_tbc_be_enroll', function () {
    check_ajax_referer('tbc_be_nonce', 'nonce');

    if (!current_user_can('manage_options')) {
        wp_send_json_error('Unauthorized');
    }

    $role      = sanitize_text_field($_POST['role'] ?? '');
    $course_id = absint($_POST['course_id'] ?? 0);

    if (!$role || !$course_id) {
        wp_send_json_error('Missing role or course.');
    }

    if (!tbc_be_has_courses()) {
        wp_send_json_error('Fluent Community course module not found.');
    }

    $course = Course::find($course_id);
    if (!$course) {
        wp_send_json_error('Course not found.');
    }

    $users    = get_users(['role' => $role, 'fields' => 'ID']);
    $enrolled = 0;
    $skipped  = 0;
    $errors   = 0;

    foreach ($users as $uid) {
        $uid = (int) $uid;

        if (CourseHelper::isEnrolled($course_id, $uid)) {
            $skipped++;
            continue;
        }

        try {
            CourseHelper::enrollCourse($course, $uid, 'admin_bulk');
            $enrolled++;
        } catch (\Throwable $e) {
            $errors++;
            error_log("[TBC Bulk Enroll] Failed to enroll user {$uid}: " . $e->getMessage());
        }
    }

    wp_send_json_success([
        'enrolled' => $enrolled,
        'skipped'  => $skipped,
        'errors'   => $errors,
        'total'    => count($users),
    ]);
});

// ---------------------------------------------------------------------------
// Admin page
// ---------------------------------------------------------------------------
function tbc_be_render_page() {
    if (!tbc_be_has_courses()) {
        echo '<div class="wrap"><h1>' . esc_html__('Bulk Course Enrollment', 'tbc-bulk-enroll') . '</h1>';
        echo '<div class="notice notice-error"><p>' . esc_html__('Fluent Community with the Course module is required.', 'tbc-bulk-enroll') . '</p></div></div>';
        return;
    }

    $courses = tbc_be_get_courses();
    $roles   = tbc_be_get_roles();
    $nonce   = wp_create_nonce('tbc_be_nonce');
    ?>
    <div class="wrap">
        <h1><?php esc_html_e('Bulk Course Enrollment', 'tbc-bulk-enroll'); ?></h1>
        <p class="description"><?php esc_html_e('Enroll all users with a specific role into a Fluent Community course.', 'tbc-bulk-enroll'); ?></p>

        <table class="form-table" role="presentation">
            <tr>
                <th scope="row"><label for="tbc-be-course"><?php esc_html_e('Course', 'tbc-bulk-enroll'); ?></label></th>
                <td>
                    <select id="tbc-be-course" style="min-width:300px">
                        <option value=""><?php esc_html_e('-- Select course --', 'tbc-bulk-enroll'); ?></option>
                        <?php foreach ($courses as $c) : ?>
                            <option value="<?php echo esc_attr($c['id']); ?>">
                                <?php echo esc_html($c['title']); ?> (ID: <?php echo esc_html($c['id']); ?>)
                            </option>
                        <?php endforeach; ?>
                    </select>
                </td>
            </tr>
            <tr>
                <th scope="row"><label for="tbc-be-role"><?php esc_html_e('User Role', 'tbc-bulk-enroll'); ?></label></th>
                <td>
                    <select id="tbc-be-role" style="min-width:300px">
                        <option value=""><?php esc_html_e('-- Select role --', 'tbc-bulk-enroll'); ?></option>
                        <?php foreach ($roles as $slug => $name) : ?>
                            <option value="<?php echo esc_attr($slug); ?>">
                                <?php echo esc_html($name); ?> (<?php echo esc_html($slug); ?>)
                            </option>
                        <?php endforeach; ?>
                    </select>
                </td>
            </tr>
        </table>

        <p>
            <button type="button" id="tbc-be-preview" class="button button-secondary"><?php esc_html_e('Preview', 'tbc-bulk-enroll'); ?></button>
            <button type="button" id="tbc-be-enroll" class="button button-primary" disabled><?php esc_html_e('Enroll Users', 'tbc-bulk-enroll'); ?></button>
        </p>

        <div id="tbc-be-results" style="margin-top:15px"></div>
    </div>

    <style>
        .tbc-be-card{background:#fff;border:1px solid #c3c4c7;border-left:4px solid #2271b1;padding:12px 16px;margin:10px 0;max-width:500px}
        .tbc-be-card.success{border-left-color:#00a32a}
        .tbc-be-card.error{border-left-color:#d63638}
        .tbc-be-card strong{display:block;margin-bottom:4px}
        .tbc-be-card .detail{color:#50575e;margin:2px 0}
        #tbc-be-enroll:disabled{opacity:.5;cursor:not-allowed}
    </style>

    <script>
    (function($){
        var nonce='<?php echo esc_js($nonce); ?>';
        var $course=$('#tbc-be-course'),$role=$('#tbc-be-role');
        var $preview=$('#tbc-be-preview'),$enroll=$('#tbc-be-enroll');
        var $results=$('#tbc-be-results');

        $course.add($role).on('change',function(){
            $enroll.prop('disabled',true);
            $results.empty();
        });

        $preview.on('click',function(){
            var cid=$course.val(),r=$role.val();
            if(!cid||!r){alert('Select both a course and a role.');return;}

            $preview.prop('disabled',true).text('Checking...');
            $enroll.prop('disabled',true);
            $results.empty();

            $.post(ajaxurl,{action:'tbc_be_preview',nonce:nonce,course_id:cid,role:r},function(res){
                $preview.prop('disabled',false).text('Preview');
                if(!res.success){
                    $results.html('<div class="tbc-be-card error"><strong>Error</strong><div class="detail">'+( res.data||'Unknown error')+'</div></div>');
                    return;
                }
                var d=res.data;
                $results.html(
                    '<div class="tbc-be-card">'
                    +'<strong>Preview</strong>'
                    +'<div class="detail">Total users with role: <b>'+d.total+'</b></div>'
                    +'<div class="detail">Already enrolled: <b>'+d.already_enrolled+'</b></div>'
                    +'<div class="detail">Will be enrolled: <b>'+d.to_enroll+'</b></div>'
                    +'</div>'
                );
                if(d.to_enroll>0) $enroll.prop('disabled',false);
            }).fail(function(){
                $preview.prop('disabled',false).text('Preview');
                $results.html('<div class="tbc-be-card error"><strong>Request failed</strong></div>');
            });
        });

        $enroll.on('click',function(){
            var cid=$course.val(),r=$role.val();
            var cn=$course.find('option:selected').text().trim();
            var rn=$role.find('option:selected').text().trim();
            if(!confirm('Enroll all "'+rn+'" users into "'+cn+'"?\n\nThis cannot be easily undone.'))return;

            $enroll.prop('disabled',true).text('Enrolling...');
            $preview.prop('disabled',true);

            $.post(ajaxurl,{action:'tbc_be_enroll',nonce:nonce,course_id:cid,role:r},function(res){
                $enroll.text('Enroll Users');
                $preview.prop('disabled',false);
                if(!res.success){
                    $results.html('<div class="tbc-be-card error"><strong>Error</strong><div class="detail">'+(res.data||'Unknown error')+'</div></div>');
                    return;
                }
                var d=res.data;
                $results.html(
                    '<div class="tbc-be-card success">'
                    +'<strong>Done!</strong>'
                    +'<div class="detail">Enrolled: <b>'+d.enrolled+'</b></div>'
                    +'<div class="detail">Already enrolled (skipped): <b>'+d.skipped+'</b></div>'
                    +(d.errors>0?'<div class="detail" style="color:#d63638">Errors: <b>'+d.errors+'</b> (check error log)</div>':'')
                    +'<div class="detail">Total processed: <b>'+d.total+'</b></div>'
                    +'</div>'
                );
            }).fail(function(){
                $enroll.prop('disabled',false).text('Enroll Users');
                $preview.prop('disabled',false);
                $results.html('<div class="tbc-be-card error"><strong>Request failed</strong></div>');
            });
        });
    })(jQuery);
    </script>
    <?php
}
