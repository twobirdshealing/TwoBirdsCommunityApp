<?php
/**
 * Post Settings Display
 * 
 * @package TBC_Participant_Frontend
 * @since 3.0.0
 */

if (!defined('ABSPATH')) {
    exit;
}

/**
 * Display the post settings section
 */
function tbc_pf_display_post_settings() {
    $templates = tbc_pf_ps_get_all_post_types();
    $schedule_options = tbc_pf_ps_get_schedule_options();
    $author_options = tbc_pf_ps_get_author_options();
    
    echo '<div class="tbc-pf-post-settings-content">';
    
    echo '<div class="tbc-pf-post-settings-header-actions">';
    echo '<button type="button" id="tbc-pf-add-new-template" class="tbc-pf-add-template-btn">+ Add New Template</button>';
    echo '</div>';
    
    if (empty($templates)) {
        echo '<p class="tbc-pf-no-templates-message">No post templates found. Create your first template above.</p>';
    } else {
        echo '<div class="tbc-pf-templates-table-container">';
        echo '<table class="tbc-pf-templates-table">';
        echo '<thead><tr>';
        echo '<th>Template Name</th>';
        echo '<th>Author</th>';
        echo '<th>Schedule</th>';
        echo '<th>Actions</th>';
        echo '</tr></thead>';
        echo '<tbody>';
        
        foreach ($templates as $template) {
            $author_name = $author_options[$template['author_user_id']] ?? 'Unknown';
            $schedule_label = $schedule_options[$template['schedule_timing']] ?? $template['schedule_timing'];
            
            echo '<tr>';
            echo '<td>' . esc_html($template['title']) . '</td>';
            echo '<td>' . esc_html($author_name) . '</td>';
            echo '<td>' . esc_html($schedule_label) . '</td>';
            echo '<td class="tbc-pf-actions-cell">';
            echo '<button type="button" class="tbc-pf-edit-template-btn" data-template-id="' . esc_attr($template['id']) . '">Edit</button>';
            echo '<button type="button" class="tbc-pf-delete-template-btn" data-template-id="' . esc_attr($template['id']) . '">Delete</button>';
            echo '</td>';
            echo '</tr>';
        }
        
        echo '</tbody></table></div>';
    }
    
    echo '</div>';
    
    tbc_pf_ps_render_template_modal();
}

/**
 * Render modal for creating/editing templates
 */
function tbc_pf_ps_render_template_modal() {
    $schedule_options = tbc_pf_ps_get_schedule_options();
    $author_options = tbc_pf_ps_get_author_options();
    ?>
    <div class="tbc-pf-modal" id="tbc-pf-modal-template">
        <div class="tbc-pf-modal-content tbc-pf-template-modal">
            <button type="button" class="tbc-pf-close-modal-top">X</button>
            <h3 id="tbc-pf-template-modal-title">Add New Template</h3>
            
            <form id="tbc-pf-template-form">
                <input type="hidden" id="tbc-pf-template-id" name="id" value="">
                
                <div class="tbc-pf-form-group">
                    <label for="tbc-pf-template-title">Template Name: <small>(Admin label only)</small></label>
                    <input type="text" id="tbc-pf-template-title" name="title" placeholder="e.g., Welcome Post - Admin" required>
                </div>
                
                <div class="tbc-pf-form-group">
                    <label for="tbc-pf-template-post-title">Post Title: <small>(Shown in chat)</small></label>
                    <input type="text" id="tbc-pf-template-post-title" name="post_title" placeholder="e.g., 🌿 Welcome to the Event Chat Group! 🌿" required>
                </div>
                
                <div class="tbc-pf-form-group">
                    <label for="tbc-pf-template-content">Post Content:</label>
                    <?php
                    wp_editor('', 'tbc-pf-template-content', [
                        'textarea_name' => 'content',
                        'textarea_rows' => 15,
                        'teeny'         => false,
                        'media_buttons' => false,
                        'tinymce'       => [
                            'toolbar1' => 'formatselect,bold,italic,underline,bullist,numlist,link,unlink,removeformat',
                            'toolbar2' => '',
                            'content_css' => false,
                            'content_style' => 'body#tinymce { font-family: Arial, Helvetica, sans-serif; font-size: 14px; line-height: 1.6; color: #333; background: #fff; } body#tinymce p, body#tinymce li, body#tinymce div, body#tinymce strong, body#tinymce a { color: #333; } img.emoji { height: 1em; width: 1em; margin: 0 0.05em 0 0.1em; vertical-align: -0.1em; display: inline-block; }'
                        ],
                        'quicktags' => ['buttons' => 'strong,em,link,ul,ol,li']
                    ]);
                    ?>
                </div>
                
                <div class="tbc-pf-form-group">
                    <label for="tbc-pf-template-author">Author:</label>
                    <select id="tbc-pf-template-author" name="author_user_id">
                        <?php foreach ($author_options as $id => $name): ?>
                            <option value="<?php echo esc_attr($id); ?>"><?php echo esc_html($name); ?></option>
                        <?php endforeach; ?>
                    </select>
                </div>
                
                <div class="tbc-pf-form-group">
                    <label for="tbc-pf-template-schedule">Schedule:</label>
                    <select id="tbc-pf-template-schedule" name="schedule_timing">
                        <?php foreach ($schedule_options as $value => $label): ?>
                            <option value="<?php echo esc_attr($value); ?>"><?php echo esc_html($label); ?></option>
                        <?php endforeach; ?>
                    </select>
                </div>
                
                <div class="tbc-pf-form-group">
                    <label>Images:</label>
                    <button type="button" class="tbc-pf-add-media-btn" data-media-type="image">Add Image</button>
                    <div id="tbc-pf-image-previews" class="tbc-pf-media-previews"></div>
                </div>
                
                <div class="tbc-pf-form-group">
                    <label>Videos:</label>
                    <button type="button" class="tbc-pf-add-media-btn" data-media-type="video">Add Video</button>
                    <div id="tbc-pf-video-previews" class="tbc-pf-media-previews"></div>
                </div>
                
                <div class="tbc-pf-form-actions">
                    <button type="submit" class="tbc-pf-save-template">Save</button>
                    <button type="button" class="tbc-pf-close-modal">Cancel</button>
                </div>
            </form>
        </div>
    </div>
    <?php
}