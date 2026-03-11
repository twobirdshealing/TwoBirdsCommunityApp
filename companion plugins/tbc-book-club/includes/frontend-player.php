<?php
if (!defined('ABSPATH')) {
    exit;
}

$current_book = get_query_var('tbc_bc_current_book');

if (!$current_book) {
    echo '<div class="tbc-bc-no-book-error">Book not found</div>';
    return;
}

$user_bookmarks = [];
$is_logged_in = is_user_logged_in();

if ($current_book && $is_logged_in) {
    global $wpdb;
    $user_id = get_current_user_id();
    $user_bookmarks = $wpdb->get_results($wpdb->prepare("
        SELECT * FROM {$wpdb->prefix}tbc_bc_bookmarks 
        WHERE user_id = %d AND book_id = %d
        ORDER BY timestamp DESC
    ", $user_id, $current_book->id));
}

$chapters = json_decode($current_book->chapters ?? '[]', true);
$plugin_url = plugin_dir_url(dirname(__FILE__)) . 'assets/';
?>

<div class="tbc-bc-book-info">
    <button class="tbc-bc-back-to-books" onclick="TbcBcPlayer.backToBooks()">
        <svg viewBox="0 0 24 24" class="tbc-bc-back-icon" width="24" height="24">
            <path fill="currentColor" d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/>
        </svg>
        Back to Books
    </button>
    <h2 class="tbc-bc-book-title"><?php echo esc_html($current_book->title); ?></h2>
    <p class="tbc-bc-book-author">by <?php echo esc_html($current_book->author); ?></p>
</div>

<div class="tbc-bc-player" data-book-id="<?php echo esc_attr($current_book->id); ?>">
    <div class="tbc-bc-current-book">
        <div class="tbc-bc-book-cover">
            <?php if ($current_book->cover_image): ?>
                <img src="<?php echo esc_url($current_book->cover_image); ?>" 
                     alt="<?php echo esc_attr($current_book->title); ?>">
            <?php else: ?>
                <div class="tbc-bc-default-cover">
                    <span class="tbc-bc-book-icon"></span>
                </div>
            <?php endif; ?>
        </div>

        <div class="tbc-bc-book-info">
            <div class="tbc-bc-player-container">
                <audio id="tbc-bc-audio" preload="auto" playsinline>
                    <source src="<?php echo esc_url($current_book->single_audio_url); ?>">
                </audio>
                
                <div class="tbc-bc-custom-player-ui">
                    <div class="tbc-bc-player-info">
                        <?php if ($chapters): ?>
                            <div class="tbc-bc-current-chapter">
                                <span class="tbc-bc-chapter-icon">
                                    <span class="dashicons dashicons-book"></span>
                                </span>
                                <div class="tbc-bc-marquee">
                                    <div class="tbc-bc-scroll-text">
                                        <span class="tbc-bc-chapter-content"></span>
                                    </div>
                                </div>
                            </div>
                        <?php endif; ?>
                    </div>

                    <div class="tbc-bc-progress-section">
                        <div class="tbc-bc-time tbc-bc-current-time">00:00:00</div>
                        <div class="tbc-bc-progress-bar">
                            <input type="range" min="0" max="100" value="0" class="tbc-bc-progress-seek">
                            <div class="tbc-bc-progress-loaded"></div>
                            <div class="tbc-bc-progress-played"></div>
                        </div>
                        <div class="tbc-bc-time tbc-bc-time-remaining">-00:00:00</div>
                    </div>

                    <div class="tbc-bc-main-controls">
                        <?php if ($chapters): ?>
                            <button class="tbc-bc-control-button tbc-bc-chapter-skip tbc-bc-previous-chapter" title="Previous Chapter">
                                <img class="tbc-bc-chapter-skip-icon" src="<?php echo $plugin_url; ?>chapter-skip-previous.svg" alt="Previous">
                            </button>
                        <?php endif; ?>
                        
                        <button class="tbc-bc-control-button tbc-bc-skip-button tbc-bc-rewind-30" title="Rewind 30 seconds">
                            <img class="tbc-bc-skip-icon" src="<?php echo $plugin_url; ?>rewind-30.svg" alt="Rewind">
                        </button>
                        
                        <button class="tbc-bc-control-button tbc-bc-play-large" title="Play">
                            <img class="tbc-bc-play-icon" src="<?php echo $plugin_url; ?>play-icon.svg" alt="Play">
                            <img class="tbc-bc-pause-icon" src="<?php echo $plugin_url; ?>pause-icon.svg" alt="Pause" style="display: none;">
                        </button>
                        
                        <button class="tbc-bc-control-button tbc-bc-skip-button tbc-bc-forward-30" title="Forward 30 seconds">
                            <img class="tbc-bc-skip-icon" src="<?php echo $plugin_url; ?>forward-30.svg" alt="Forward">
                        </button>
                        
                        <?php if ($chapters): ?>
                            <button class="tbc-bc-control-button tbc-bc-chapter-skip tbc-bc-next-chapter" title="Next Chapter">
                                <img class="tbc-bc-chapter-skip-icon" src="<?php echo $plugin_url; ?>chapter-skip-next.svg" alt="Next">
                            </button>
                        <?php endif; ?>
                    </div>

                    <div class="tbc-bc-player-toolbar">
                        <?php if ($chapters): ?>
                            <button class="tbc-bc-toolbar-button tbc-bc-chapters-toggle" title="Chapters">
                                <img class="tbc-bc-chapters-icon" src="<?php echo $plugin_url; ?>chapters-icon.svg" alt="Chapters">
                                <span class="tbc-bc-toolbar-label">Chapters</span>
                            </button>
                        <?php endif; ?>

                        <?php if ($is_logged_in): ?>
                            <button class="tbc-bc-toolbar-button tbc-bc-bookmark-toggle" title="Bookmarks">
                                <img class="tbc-bc-bookmark-icon" src="<?php echo $plugin_url; ?>bookmark-icon.svg" alt="Bookmarks">
                                <span class="tbc-bc-toolbar-label">Bookmarks</span>
                            </button>
                        <?php endif; ?>

                        <button class="tbc-bc-toolbar-button tbc-bc-volume-toggle" title="Volume">
                            <img class="tbc-bc-volume-on-icon" src="<?php echo $plugin_url; ?>volume-on-icon.svg" alt="Volume">
                            <img class="tbc-bc-volume-off-icon" src="<?php echo $plugin_url; ?>volume-off-icon.svg" alt="Mute" style="display: none;">
                            <span class="tbc-bc-toolbar-label">Volume</span>
                        </button>

                        <button class="tbc-bc-toolbar-button tbc-bc-speed-toggle" title="Playback Speed">
                            <div class="tbc-bc-speed-button-container">
                                <img class="tbc-bc-speed-toggle-icon" src="<?php echo $plugin_url; ?>speed-toggle-icon.svg" alt="Speed">
                                <span class="tbc-bc-speed-indicator">1x</span>
                            </div>
                            <span class="tbc-bc-toolbar-label">Speed</span>
                        </button>
                    </div>

                    <div class="tbc-bc-expandable-controls">
                        <?php if ($chapters): ?>
                        <div class="tbc-bc-chapters-controls">
                            <h3 class="tbc-bc-control-section-title">Chapters</h3>
                            <div class="tbc-bc-chapters-list">
                                <?php foreach ($chapters as $index => $chapter): ?>
                                    <button class="tbc-bc-chapter-item" data-time="<?php echo esc_attr($chapter['time']); ?>">
                                        <span class="tbc-bc-chapter-icon-wrapper">
                                            <img class="tbc-bc-chapters-icon" src="<?php echo $plugin_url; ?>chapters-icon.svg" alt="Chapter">
                                        </span>
                                        <div class="tbc-bc-chapter-content">
                                            <span class="tbc-bc-chapter-label"><?php echo esc_html($chapter['label']); ?></span>
                                            <span class="tbc-bc-separator"> - </span>
                                            <span class="tbc-bc-chapter-title"><?php echo esc_html($chapter['title']); ?></span>
                                        </div>
                                        <span class="tbc-bc-chapter-timestamp">
                                            <?php echo esc_html(gmdate("H:i:s", $chapter['time'])); ?>
                                        </span>
                                    </button>
                                <?php endforeach; ?>
                            </div>
                        </div>
                        <?php endif; ?>

                        <?php if ($is_logged_in): ?>
                        <div class="tbc-bc-bookmark-controls">
                            <h3 class="tbc-bc-control-section-title">Bookmarks</h3>
                            <form class="tbc-bc-bookmark-form">
                                <input type="text" class="tbc-bc-bookmark-title-input" placeholder="Enter bookmark title">
                                <button type="submit" class="tbc-bc-bookmark-submit" title="Add Bookmark">
                                    <span class="dashicons dashicons-plus-alt2"></span>
                                </button>
                            </form>
                            <div class="tbc-bc-bookmarks-list">
                                <?php foreach ($user_bookmarks as $bookmark): ?>
                                    <div class="tbc-bc-bookmark-item" data-time="<?php echo esc_attr($bookmark->timestamp); ?>">
                                        <button class="tbc-bc-bookmark-jump">
                                            <span class="tbc-bc-bookmark-icon-wrapper">
                                                <img class="tbc-bc-bookmark-icon" src="<?php echo $plugin_url; ?>bookmark-icon.svg" alt="Bookmark">
                                            </span>
                                            <span class="tbc-bc-bookmark-title">
                                                <?php echo $bookmark->title ? esc_html($bookmark->title) : '(Untitled)'; ?>
                                            </span>
                                            <span class="tbc-bc-bookmark-timestamp">
                                                <?php echo esc_html(gmdate("H:i:s", (int)$bookmark->timestamp)); ?>
                                            </span>
                                        </button>
                                        <button class="tbc-bc-remove-bookmark" data-id="<?php echo esc_attr($bookmark->id); ?>" title="Remove">
                                            <span class="dashicons dashicons-no-alt"></span>
                                        </button>
                                    </div>
                                <?php endforeach; ?>
                            </div>
                        </div>
                        <?php endif; ?>

                        <div class="tbc-bc-volume-controls">
                            <h3 class="tbc-bc-control-section-title">Volume</h3>
                            <input type="range" class="tbc-bc-volume-slider" min="0" max="1" step="0.1" value="1">
                        </div>

                        <div class="tbc-bc-speed-controls">
                            <h3 class="tbc-bc-control-section-title">Playback Speed</h3>
                            <div class="tbc-bc-speed-options">
                                <button class="tbc-bc-speed-option" data-speed="0.75">0.75x</button>
                                <button class="tbc-bc-speed-option" data-speed="1">1x</button>
                                <button class="tbc-bc-speed-option" data-speed="1.25">1.25x</button>
                                <button class="tbc-bc-speed-option" data-speed="1.5">1.5x</button>
                                <button class="tbc-bc-speed-option" data-speed="1.75">1.75x</button>
                                <button class="tbc-bc-speed-option" data-speed="2">2x</button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <div class="tbc-bc-messages-container"></div>
</div>