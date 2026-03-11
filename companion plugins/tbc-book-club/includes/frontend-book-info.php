<?php
if (!defined('ABSPATH')) {
    exit;
}

global $wpdb;

$current_book = $wpdb->get_row("
    SELECT * FROM {$wpdb->prefix}tbc_bc_books 
    WHERE is_current = 1 
    LIMIT 1
");

if (!$current_book) {
    ?>
    <div class="tbc-bc-info-voting">
        <div class="tbc-bc-voting-icon">&#128218;&#10024;</div>
        <h2 class="tbc-bc-voting-title">Currently Voting on New Book!</h2>
        <p class="tbc-bc-voting-message">
            Help choose our next book club selection and stay connected with fellow readers.
        </p>
        <div class="tbc-bc-voting-actions">
            <a href="https://community.twobirdschurch.com/groups/book-club/" 
               target="_blank" 
               class="tbc-bc-voting-link">
                <span class="tbc-bc-link-icon">&#128172;</span>
                <span class="tbc-bc-link-text">
                    <strong>Join Community Chat</strong>
                    <small>Vote on books &#8226; Get meeting reminders &#8226; Connect with members</small>
                </span>
            </a>
        </div>
    </div>
    <?php
    return;
}

$chapters = json_decode($current_book->chapters ?? '[]', true);
$schedule = json_decode($current_book->schedule_data ?? '[]', true);
$audio_link = home_url('/book-club/?book_id=' . $current_book->id);

/**
 * Parse chapter range string and return array of chapter indices (0-based)
 */
function tbc_bc_parse_chapter_range($range_str) {
    $range_str = trim($range_str);
    $indices = array();
    
    if (strpos($range_str, '-') !== false) {
        $parts = explode('-', $range_str);
        if (count($parts) === 2) {
            $start = intval(trim($parts[0])) - 1;
            $end = intval(trim($parts[1])) - 1;
            for ($i = $start; $i <= $end; $i++) {
                $indices[] = $i;
            }
        }
    } else {
        $num = intval($range_str) - 1;
        if ($num >= 0) {
            $indices[] = $num;
        }
    }
    
    return $indices;
}

/**
 * Get chapters for a meeting based on range string
 */
function tbc_bc_get_meeting_chapters($chapters, $range_str) {
    $indices = tbc_bc_parse_chapter_range($range_str);
    $meeting_chapters = array();
    
    foreach ($indices as $idx) {
        if (isset($chapters[$idx])) {
            $meeting_chapters[] = $chapters[$idx];
        }
    }
    
    return $meeting_chapters;
}

/**
 * Calculate duration for a set of chapters
 */
function tbc_bc_calculate_meeting_duration($meeting_chapters, $all_chapters, $range_str) {
    if (empty($meeting_chapters)) {
        return '';
    }
    
    $indices = tbc_bc_parse_chapter_range($range_str);
    $first_idx = min($indices);
    $last_idx = max($indices);
    
    $start_time = $meeting_chapters[0]['time'] ?? 0;
    
    if (isset($all_chapters[$last_idx + 1])) {
        $end_time = $all_chapters[$last_idx + 1]['time'];
    } else {
        $last_chapter = end($meeting_chapters);
        $end_time = $last_chapter['time'] ?? 0;
        $end_time += 1800;
    }
    
    $duration = $end_time - $start_time;
    
    if ($duration <= 0) {
        return '';
    }
    
    $hours = floor($duration / 3600);
    $minutes = floor(($duration % 3600) / 60);
    
    if ($hours > 0 && $minutes > 0) {
        return $hours . 'h ' . $minutes . 'm';
    } elseif ($hours > 0) {
        return $hours . 'h';
    } else {
        return $minutes . 'm';
    }
}

/**
 * Group chapters by their label (section)
 */
function tbc_bc_group_chapters_by_label($meeting_chapters) {
    $groups = array();
    
    foreach ($meeting_chapters as $chapter) {
        $label = $chapter['label'] ?? '';
        $title = $chapter['title'] ?? '';
        
        if ($label === $title) {
            if (!isset($groups[$label])) {
                $groups[$label] = array();
            }
        } else {
            if (!isset($groups[$label])) {
                $groups[$label] = array();
            }
            $groups[$label][] = $title;
        }
    }
    
    return $groups;
}
?>

<div class="tbc-bc-info">
    <div class="tbc-bc-info-section">
        <h2 class="tbc-bc-info-title">&#128218;&#10024; <strong><?php echo esc_html($current_book->title); ?></strong> &#10024;&#128218;</h2>
        
        <?php if ($current_book->cover_image): ?>
        <div class="tbc-bc-info-cover">
            <img src="<?php echo esc_url($current_book->cover_image); ?>" 
                 alt="<?php echo esc_attr($current_book->title); ?> cover"
                 class="tbc-bc-cover-image">
        </div>
        <?php endif; ?>
        
        <h3 class="tbc-bc-info-author"><strong>By: <?php echo esc_html($current_book->author); ?></strong></h3>
    </div>

    <?php if ($current_book->description): ?>
    <div class="tbc-bc-info-section">
        <div class="tbc-bc-book-description">
            <?php echo wpautop(wp_kses_post($current_book->description)); ?>
        </div>
    </div>
    <?php endif; ?>

    <div class="tbc-bc-info-section">
        <h3>&#127911; <strong>Free Audio Book:</strong></h3>
        <ul>
            <li><strong><a href="<?php echo esc_url($audio_link); ?>">Click Here for Audio</a></strong>
            <?php 
            if ($chapters && count($chapters) > 0) {
                $last_chapter = end($chapters);
                $total_duration = $last_chapter['time'] ?? 0;
                if ($total_duration > 0) {
                    $hours = floor($total_duration / 3600);
                    $minutes = floor(($total_duration % 3600) / 60);
                    echo ' <strong>(Length: ' . $hours . ' hrs and ' . $minutes . ' mins)</strong>';
                }
            }
            ?>
            </li>
        </ul>
    </div>

    <div class="tbc-bc-info-section">
        <h3>&#128172; <strong>Book Club Community:</strong></h3>
        <ul>
            <li><strong><a href="https://community.twobirdschurch.com/groups/book-club/" target="_blank">Join Community Chat</a></strong> - Vote on future books, connect with members between meetings, and get automatic SMS reminders</li>
        </ul>
    </div>

    <?php if ($current_book->meeting_link || $current_book->meeting_id): ?>
    <div class="tbc-bc-info-section">
        <h3><strong>&#128421; Join Virtual Meeting:</strong></h3>
        <ul>
            <?php if ($current_book->meeting_link): ?>
            <li><strong>Quick Join Link: <a href="<?php echo esc_url($current_book->meeting_link); ?>" target="_blank">Click Here</a></strong> (Requires Zoom)</li>
            <?php endif; ?>
            <?php if ($current_book->meeting_id): ?>
            <li><strong>Meeting ID:</strong> <?php echo esc_html($current_book->meeting_id); ?></li>
            <?php endif; ?>
            <?php if ($current_book->meeting_passcode): ?>
            <li><strong>Passcode:</strong> <?php echo esc_html($current_book->meeting_passcode); ?></li>
            <?php endif; ?>
        </ul>
    </div>
    <?php endif; ?>

    <?php if ($schedule && count($schedule) > 0): ?>
    <div class="tbc-bc-info-section">
        <h3>&#128197; <strong>Virtual Meeting Schedule:</strong></h3>
        
        <div class="tbc-bc-schedule-cards">
            <?php 
            $week_num = 1;
            foreach ($schedule as $meeting): 
                $date = new DateTime($meeting['date']);
                $formatted_date = $date->format('M j');
                $day_name = $date->format('l');
                $time_obj = new DateTime($meeting['time']);
                $formatted_time = $time_obj->format('g:i A');
                
                $meeting_chapters = tbc_bc_get_meeting_chapters($chapters, $meeting['chapters']);
                $duration = tbc_bc_calculate_meeting_duration($meeting_chapters, $chapters, $meeting['chapters']);
                $grouped = tbc_bc_group_chapters_by_label($meeting_chapters);
            ?>
            <div class="tbc-bc-week-card">
                <div class="tbc-bc-week-header">
                    <span class="tbc-bc-week-number">Week <?php echo $week_num; ?></span>
                    <span class="tbc-bc-week-date"><?php echo esc_html($day_name); ?>, <?php echo esc_html($formatted_date); ?> @ <?php echo esc_html($formatted_time); ?></span>
                </div>
                
                <div class="tbc-bc-week-content">
                    <?php if (!empty($grouped)): ?>
                        <?php foreach ($grouped as $section_label => $titles): ?>
                            <div class="tbc-bc-week-section">
                                <div class="tbc-bc-section-label"><?php echo esc_html($section_label); ?></div>
                                <?php if (!empty($titles)): ?>
                                    <ul class="tbc-bc-chapter-list">
                                        <?php foreach ($titles as $title): ?>
                                            <li><?php echo esc_html($title); ?></li>
                                        <?php endforeach; ?>
                                    </ul>
                                <?php endif; ?>
                            </div>
                        <?php endforeach; ?>
                    <?php else: ?>
                        <div class="tbc-bc-week-section">
                            <div class="tbc-bc-section-label">Chapters <?php echo esc_html($meeting['chapters']); ?></div>
                        </div>
                    <?php endif; ?>
                </div>
                
                <?php if ($duration): ?>
                <div class="tbc-bc-week-footer">
                    <span class="tbc-bc-week-duration">&#9201; ~<?php echo esc_html($duration); ?></span>
                </div>
                <?php endif; ?>
            </div>
            <?php 
            $week_num++;
            endforeach; 
            ?>
        </div>
    </div>
    <?php endif; ?>
</div>