<?php
if (!defined('ABSPATH')) {
    exit;
}

$book_id = isset($_GET['id']) ? intval($_GET['id']) : 0;
$book = null;
$moderator = null;
$moderator_data = null;

if ($book_id) {
    global $wpdb;
    $book = $wpdb->get_row($wpdb->prepare("
        SELECT * FROM {$wpdb->prefix}tbc_bc_books 
        WHERE id = %d
    ", $book_id));
    
    if ($book) {
        $moderator_data = tbc_bc_get_moderator_data($book);
        if ($moderator_data && !empty($moderator_data['user_id'])) {
            $moderator = get_userdata($moderator_data['user_id']);
        }
    }
}

$page_title = $book_id ? 'Edit Book' : 'Add New Book';
$chapters = $book && $book->chapters ? json_decode($book->chapters, true) : array();
$schedule = $book && $book->schedule_data ? json_decode($book->schedule_data, true) : array();
$schedule_auto = true;
if ($schedule && isset($schedule[0]['auto'])) {
    $schedule_auto = (bool)$schedule[0]['auto'];
}
?>

<div class="wrap tbc-bc-admin">
    <div class="tbc-bc-edit-header">
        <a href="?page=tbc-bc-manager" class="tbc-bc-back-link">
            <span class="dashicons dashicons-arrow-left-alt2"></span>
            Back to Books
        </a>
        <h1><?php echo esc_html($page_title); ?></h1>
    </div>

    <form id="tbc-bc-edit-form" class="tbc-bc-edit-form">
        <?php wp_nonce_field('tbc_bc_edit_book', 'tbc_bc_nonce'); ?>
        <input type="hidden" name="book_id" value="<?php echo esc_attr($book_id); ?>">

        <div class="tbc-bc-tabs">
            <button type="button" class="tbc-bc-tab tbc-bc-tab-active" data-tab="book-info">
                <span class="dashicons dashicons-book-alt"></span>
                Book Info
            </button>
            <button type="button" class="tbc-bc-tab" data-tab="chapters">
                <span class="dashicons dashicons-playlist-audio"></span>
                Chapters
                <span class="tbc-bc-tab-count" id="tbc-bc-chapter-count"><?php echo count($chapters); ?></span>
            </button>
            <button type="button" class="tbc-bc-tab" data-tab="schedule">
                <span class="dashicons dashicons-calendar-alt"></span>
                Schedule
                <span class="tbc-bc-tab-count" id="tbc-bc-schedule-count"><?php echo count($schedule); ?></span>
            </button>
            <button type="button" class="tbc-bc-tab" data-tab="meeting">
                <span class="dashicons dashicons-groups"></span>
                Moderator &amp; Zoom
            </button>
        </div>

        <div class="tbc-bc-tab-panels">
            <!-- Book Info Tab -->
            <div class="tbc-bc-tab-panel tbc-bc-tab-panel-active" data-panel="book-info">
                <div class="tbc-bc-form-field">
                    <label for="tbc_bc_title">Book Title <span class="tbc-bc-required">*</span></label>
                    <input type="text" 
                           id="tbc_bc_title" 
                           name="title" 
                           value="<?php echo $book ? esc_attr($book->title) : ''; ?>" 
                           required>
                </div>

                <div class="tbc-bc-form-field">
                    <label for="tbc_bc_author">Author <span class="tbc-bc-required">*</span></label>
                    <input type="text" 
                           id="tbc_bc_author" 
                           name="author" 
                           value="<?php echo $book ? esc_attr($book->author) : ''; ?>" 
                           required>
                </div>

                <div class="tbc-bc-form-field">
                    <label for="tbc_bc_description">Description</label>
                    <?php 
                    $description_content = $book ? $book->description : '';
                    wp_editor($description_content, 'tbc_bc_description', array(
                        'textarea_name' => 'description',
                        'textarea_rows' => 6,
                        'media_buttons' => false,
                        'teeny' => true,
                        'quicktags' => true,
                    ));
                    ?>
                </div>

                <div class="tbc-bc-form-field">
                    <label for="tbc_bc_cover_image">Cover Image</label>
                    <div class="tbc-bc-cover-image-control">
                        <input type="url" 
                               id="tbc_bc_cover_image" 
                               name="cover_image" 
                               value="<?php echo $book ? esc_attr($book->cover_image) : ''; ?>"
                               placeholder="Enter image URL or upload">
                        <button type="button" class="button tbc-bc-upload-cover">Upload Image</button>
                    </div>
                    <div class="tbc-bc-cover-preview">
                        <?php if ($book && $book->cover_image): ?>
                            <img src="<?php echo esc_url($book->cover_image); ?>" alt="Cover preview">
                        <?php endif; ?>
                    </div>
                </div>

                <div class="tbc-bc-form-field">
                    <label for="tbc_bc_audio">Audio File URL <span class="tbc-bc-required">*</span></label>
                    <input type="url" 
                           id="tbc_bc_audio" 
                           name="single_audio_url" 
                           value="<?php echo $book ? esc_attr($book->single_audio_url) : ''; ?>"
                           required
                           placeholder="Enter the URL for the audiobook file">
                </div>
            </div>

            <!-- Chapters Tab -->
            <div class="tbc-bc-tab-panel" data-panel="chapters">
                <div class="tbc-bc-import-section">
                    <button type="button" class="button tbc-bc-import-toggle">
                        <span class="dashicons dashicons-upload"></span>
                        Import from MediaInfo JSON
                    </button>
                    
                    <div class="tbc-bc-import-container" style="display: none;">
                        <label for="tbc-bc-mediainfo-input">Paste MediaInfo JSON below:</label>
                        <textarea id="tbc-bc-mediainfo-input" 
                                  class="tbc-bc-mediainfo-textarea" 
                                  placeholder='{"media": {"track": [...]}}'
                                  rows="8"></textarea>
                        <div class="tbc-bc-import-actions">
                            <button type="button" class="button button-primary tbc-bc-parse-json">
                                <span class="dashicons dashicons-yes"></span>
                                Parse &amp; Import Chapters
                            </button>
                            <button type="button" class="button tbc-bc-import-cancel">Cancel</button>
                        </div>
                        <div class="tbc-bc-import-message"></div>
                    </div>
                </div>

                <div id="tbc-bc-chapters-container" class="tbc-bc-sortable-chapters">
                    <?php if ($chapters): ?>
                        <?php $chapter_index = 1; ?>
                        <?php foreach ($chapters as $chapter): ?>
                            <div class="tbc-bc-chapter-item">
                                <div class="tbc-bc-chapter-handle">
                                    <span class="tbc-bc-chapter-index"><?php echo $chapter_index; ?></span>
                                    <span class="dashicons dashicons-menu"></span>
                                </div>
                                <div class="tbc-bc-chapter-fields">
                                    <input type="text" 
                                           name="chapter_labels[]" 
                                           value="<?php echo esc_attr($chapter['label']); ?>" 
                                           placeholder="Chapter label (e.g. Chapter 1)"
                                           class="tbc-bc-chapter-label"
                                           required>
                                    <input type="text" 
                                           name="chapter_titles[]" 
                                           value="<?php echo esc_attr($chapter['title']); ?>" 
                                           placeholder="Chapter title"
                                           required>
                                    <input type="text" 
                                           name="chapter_times[]" 
                                           value="<?php echo isset($chapter['time']) ? gmdate("H:i:s", $chapter['time']) : ''; ?>" 
                                           placeholder="Time (HH:MM:SS)"
                                           pattern="^([0-9]{1,2}):([0-5][0-9]):([0-5][0-9])$"
                                           required
                                           class="tbc-bc-chapter-time">
                                    <button type="button" class="button tbc-bc-remove-chapter">
                                        <span class="dashicons dashicons-trash"></span>
                                    </button>
                                </div>
                            </div>
                        <?php $chapter_index++; ?>
                        <?php endforeach; ?>
                    <?php endif; ?>
                </div>

                <div class="tbc-bc-chapter-controls">
                    <button type="button" id="tbc-bc-add-chapter" class="button">
                        <span class="dashicons dashicons-plus-alt2"></span>
                        Add Chapter
                    </button>
                </div>
            </div>

            <!-- Schedule Tab -->
            <div class="tbc-bc-tab-panel" data-panel="schedule">
                <div id="tbc-bc-schedule-no-chapters" class="tbc-bc-schedule-notice" style="<?php echo count($chapters) > 0 ? 'display:none;' : ''; ?>">
                    <span class="dashicons dashicons-info"></span>
                    <p>Add chapters first to set up a meeting schedule.</p>
                    <button type="button" class="button" data-goto-tab="chapters">Go to Chapters</button>
                </div>

                <div id="tbc-bc-schedule-content" style="<?php echo count($chapters) === 0 ? 'display:none;' : ''; ?>">
                    <div class="tbc-bc-schedule-header">
                        <p class="description">Set meeting dates and chapter assignments for each week.</p>
                        <label class="tbc-bc-toggle-label">
                            <input type="checkbox" 
                                   id="tbc-bc-schedule-auto" 
                                   <?php echo $schedule_auto ? 'checked' : ''; ?>>
                            <span class="tbc-bc-toggle-switch"></span>
                            <span class="tbc-bc-toggle-text">Auto-distribute chapters</span>
                        </label>
                    </div>
                    
                    <div id="tbc-bc-schedule-container" class="tbc-bc-sortable-schedule">
                        <?php if ($schedule): ?>
                            <?php foreach ($schedule as $meeting): ?>
                                <div class="tbc-bc-schedule-item">
                                    <div class="tbc-bc-schedule-handle">
                                        <span class="dashicons dashicons-menu"></span>
                                    </div>
                                    <div class="tbc-bc-schedule-fields">
                                        <input type="date" 
                                               name="meeting_dates[]" 
                                               value="<?php echo esc_attr($meeting['date']); ?>" 
                                               required>
                                        <input type="time" 
                                               name="meeting_times[]" 
                                               value="<?php echo esc_attr($meeting['time'] ?? '18:00'); ?>" 
                                               required>
                                        <input type="text" 
                                               name="meeting_chapters[]" 
                                               class="tbc-bc-chapter-range"
                                               value="<?php echo esc_attr($meeting['chapters']); ?>" 
                                               <?php echo $schedule_auto ? 'readonly' : ''; ?>
                                               placeholder="e.g. 1-7">
                                        <button type="button" class="button tbc-bc-remove-schedule">
                                            <span class="dashicons dashicons-trash"></span>
                                        </button>
                                    </div>
                                </div>
                            <?php endforeach; ?>
                        <?php endif; ?>
                    </div>

                    <div class="tbc-bc-schedule-controls">
                        <button type="button" id="tbc-bc-add-schedule" class="button">
                            <span class="dashicons dashicons-plus-alt2"></span>
                            Add Meeting
                        </button>
                    </div>

                    <div id="tbc-bc-schedule-validation" class="tbc-bc-schedule-validation"></div>
                </div>
            </div>

            <!-- Moderator & Zoom Tab -->
            <div class="tbc-bc-tab-panel" data-panel="meeting">
                <div class="tbc-bc-form-field">
                    <label>Book Club Moderator</label>
                    <p class="description">Assign a moderator for this book club session. Award achievement when complete.</p>
                    
                    <div class="tbc-bc-moderator-section">
                        <div class="tbc-bc-moderator-search">
                            <input type="text" 
                                   id="tbc-bc-moderator-search" 
                                   placeholder="Search users by name or email..."
                                   autocomplete="off">
                            <div id="tbc-bc-user-results" class="tbc-bc-user-results"></div>
                        </div>
                        
                        <div class="tbc-bc-moderator-selected">
                            <input type="hidden" 
                                   id="tbc-bc-moderator-id" 
                                   name="moderator_user_id" 
                                   value="<?php echo $moderator_data ? esc_attr($moderator_data['user_id']) : ''; ?>">
                            
                            <div id="tbc-bc-moderator-display" class="<?php echo ($moderator ? '' : 'tbc-bc-hidden'); ?>">
                                <span class="dashicons dashicons-admin-users"></span>
                                <span id="tbc-bc-moderator-name"><?php echo $moderator ? esc_html($moderator->display_name) : ''; ?></span>
                                <button type="button" id="tbc-bc-clear-moderator" class="button-link">
                                    <span class="dashicons dashicons-no-alt"></span>
                                </button>
                            </div>
                        </div>

                        <?php if ($book_id && $moderator): ?>
                            <div class="tbc-bc-award-section">
                                <?php if (!empty($moderator_data['awarded'])): ?>
                                    <div class="tbc-bc-award-complete">
                                        <span class="dashicons dashicons-yes-alt"></span>
                                        <span>
                                            Achievement awarded to <?php echo esc_html($moderator->display_name); ?> 
                                            on <?php echo date('M j, Y', strtotime($moderator_data['awarded_at'])); ?>
                                        </span>
                                    </div>
                                <?php else: ?>
                                    <button type="button" 
                                            id="tbc-bc-award-points" 
                                            class="button button-secondary"
                                            data-book-id="<?php echo esc_attr($book_id); ?>">
                                        <span class="dashicons dashicons-awards"></span>
                                        Award Moderator Achievement
                                    </button>
                                <?php endif; ?>
                            </div>
                        <?php endif; ?>
                    </div>
                </div>

                <div class="tbc-bc-form-field">
                    <label>Virtual Meeting Information</label>
                    <p class="description">Default Zoom meeting info is pre-filled but can be edited if needed.</p>
                    <div class="tbc-bc-meeting-fields">
                        <div class="tbc-bc-meeting-field">
                            <label for="tbc_bc_meeting_link">Meeting Link</label>
                            <input type="url" 
                                   id="tbc_bc_meeting_link" 
                                   name="meeting_link" 
                                   value="<?php echo $book ? esc_attr($book->meeting_link) : 'https://us02web.zoom.us/j/9301696301?pwd=VzFsdndNcFJiblRsZ2pJMFlKOC9qdz09'; ?>"
                                   placeholder="Zoom meeting link">
                        </div>

                        <div class="tbc-bc-meeting-field">
                            <label for="tbc_bc_meeting_id">Meeting ID</label>
                            <input type="text" 
                                   id="tbc_bc_meeting_id" 
                                   name="meeting_id" 
                                   value="<?php echo $book ? esc_attr($book->meeting_id) : '930 169 6301'; ?>"
                                   placeholder="e.g. 930 169 6301">
                        </div>

                        <div class="tbc-bc-meeting-field">
                            <label for="tbc_bc_meeting_passcode">Meeting Passcode</label>
                            <input type="text" 
                                   id="tbc_bc_meeting_passcode" 
                                   name="meeting_passcode" 
                                   value="<?php echo $book ? esc_attr($book->meeting_passcode) : 'love'; ?>"
                                   placeholder="e.g. love">
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <div class="tbc-bc-form-actions">
            <div class="tbc-bc-publishing-actions">
                <?php if ($book_id && !$book->is_current): ?>
                    <button type="button" 
                            class="tbc-bc-set-current" 
                            data-id="<?php echo esc_attr($book_id); ?>">
                        <span class="dashicons dashicons-star-empty"></span>
                        Set as Current Book
                    </button>
                <?php endif; ?>
            </div>
            
            <div class="tbc-bc-major-actions">
                <a href="?page=tbc-bc-manager" class="button button-secondary">Cancel</a>
                <button type="submit" class="button button-primary">
                    <?php echo $book_id ? 'Update Book' : 'Create Book'; ?>
                </button>
            </div>
        </div>
    </form>
</div>

<script type="text/template" id="tbc-bc-chapter-template">
    <div class="tbc-bc-chapter-item">
        <div class="tbc-bc-chapter-handle">
            <span class="tbc-bc-chapter-index"></span>
            <span class="dashicons dashicons-menu"></span>
        </div>
        <div class="tbc-bc-chapter-fields">
            <input type="text" 
                   name="chapter_labels[]" 
                   placeholder="Chapter label (e.g. Chapter 1)"
                   class="tbc-bc-chapter-label"
                   required>
            <input type="text" 
                   name="chapter_titles[]" 
                   placeholder="Chapter title"
                   required>
            <input type="text" 
                   name="chapter_times[]" 
                   placeholder="Time (HH:MM:SS)"
                   pattern="^([0-9]{1,2}):([0-5][0-9]):([0-5][0-9])$"
                   required
                   class="tbc-bc-chapter-time">
            <button type="button" class="button tbc-bc-remove-chapter">
                <span class="dashicons dashicons-trash"></span>
            </button>
        </div>
    </div>
</script>

<script type="text/template" id="tbc-bc-schedule-template">
    <div class="tbc-bc-schedule-item">
        <div class="tbc-bc-schedule-handle">
            <span class="dashicons dashicons-menu"></span>
        </div>
        <div class="tbc-bc-schedule-fields">
            <input type="date" 
                   name="meeting_dates[]" 
                   required>
            <input type="time" 
                   name="meeting_times[]" 
                   value="18:00"
                   required>
            <input type="text" 
                   name="meeting_chapters[]" 
                   class="tbc-bc-chapter-range"
                   placeholder="e.g. 1-7">
            <button type="button" class="button tbc-bc-remove-schedule">
                <span class="dashicons dashicons-trash"></span>
            </button>
        </div>
    </div>
</script>