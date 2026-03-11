<?php
if (!defined('ABSPATH')) {
    exit;
}

global $wpdb;
$books = $wpdb->get_results("
    SELECT * FROM {$wpdb->prefix}tbc_bc_books 
    ORDER BY display_order ASC
");

$current_book_id = $wpdb->get_var("SELECT id FROM {$wpdb->prefix}tbc_bc_books WHERE is_current = 1");

if (empty($books)) {
    return;
}
?>

<div class="tbc-bc-selector">
    <div class="swiper tbc-bc-main-swiper">
        <div class="swiper-wrapper">
            <?php foreach ($books as $book): ?>
            <div class="swiper-slide">
                <div class="tbc-bc-preview">
                    <div class="tbc-bc-preview-image">
                        <?php if ($book->cover_image): ?>
                            <img src="<?php echo esc_url($book->cover_image); ?>" 
                                 alt="<?php echo esc_attr($book->title); ?>"
                                 loading="lazy">
                        <?php else: ?>
                            <div class="tbc-bc-default-cover">
                                <svg viewBox="0 0 24 24" class="tbc-bc-book-icon">
                                    <path fill="currentColor" d="M18 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 18H6V4h2v7l2.5-1.5L13 11V4h5v16z"/>
                                </svg>
                            </div>
                        <?php endif; ?>
                        
                        <?php if ($book->id === $current_book_id): ?>
                            <div class="tbc-bc-ribbon">
                                <span>Current Book</span>
                            </div>
                        <?php endif; ?>
                    </div>

                    <div class="tbc-bc-preview-content">
                        <h2 class="tbc-bc-title"><?php echo esc_html($book->title); ?></h2>
                        <p class="tbc-bc-author">by <?php echo esc_html($book->author); ?></p>
                        
                        <?php if ($book->description): ?>
                            <div class="tbc-bc-description">
                                <?php echo wpautop(wp_kses_post($book->description)); ?>
                            </div>
                        <?php endif; ?>

                        <div class="tbc-bc-meta">
                            <?php
                            $chapters = json_decode($book->chapters, true);
                            $chapter_summary = tbc_bc_get_chapter_summary($chapters);
                            $chapter_count = is_array($chapters) ? count($chapters) : 0;
                            
                            if ($chapter_summary): 
                            ?>
                            <div class="tbc-bc-meta-item">
                                <svg class="tbc-bc-meta-icon" viewBox="0 0 24 24">
                                    <path fill="currentColor" d="M3 7V5h2V4c0-1.1.9-2 2-2h6v7l2.5-1.5L18 9V2h2c1.1 0 2 .9 2 2v16c0 1.1-.9 2-2 2H7c-1.1 0-2-.9-2-2v-1H3v-2h2v-4H3v-2h2V7H3zm4 10h10v2H7v-2zm0-4h10v2H7v-2zm0-4h10v2H7V9z"/>
                                </svg>
                                <?php echo esc_html($chapter_summary); ?>
                            </div>
                            <?php endif; ?>

                            <div class="tbc-bc-meta-item">
                                <svg class="tbc-bc-meta-icon" viewBox="0 0 24 24">
                                    <path fill="currentColor" d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8z"/>
                                    <path fill="currentColor" d="M12.5 7H11v6l5.25 3.15.75-1.23-4.5-2.67z"/>
                                </svg>
                                <?php 
                                $total_duration = 0;
                                if ($chapter_count > 0) {
                                    $last_chapter = end($chapters);
                                    $total_duration = $last_chapter['time'] ?? 0;
                                }
                                echo esc_html(tbc_bc_format_duration($total_duration));
                                ?>
                            </div>
                        </div>

                        <button class="tbc-bc-listen-button" data-book-id="<?php echo esc_attr($book->id); ?>">
                            <svg class="tbc-bc-listen-icon" viewBox="0 0 24 24">
                                <path fill="currentColor" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 14.5v-9l6 4.5-6 4.5z"/>
                            </svg>
                            Listen to Book
                        </button>
                    </div>
                </div>
            </div>
            <?php endforeach; ?>
        </div>
    </div>

    <div class="swiper tbc-bc-thumbs-swiper">
        <div class="swiper-wrapper">
            <?php foreach ($books as $book): ?>
            <div class="swiper-slide">
                <div class="tbc-bc-thumb">
                    <?php if ($book->cover_image): ?>
                        <img src="<?php echo esc_url($book->cover_image); ?>" 
                             alt="<?php echo esc_attr($book->title); ?>"
                             loading="lazy">
                    <?php else: ?>
                        <div class="tbc-bc-default-cover">
                            <svg viewBox="0 0 24 24" class="tbc-bc-book-icon">
                                <path fill="currentColor" d="M18 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 18H6V4h2v7l2.5-1.5L13 11V4h5v16z"/>
                            </svg>
                        </div>
                    <?php endif; ?>
                    <div class="tbc-bc-thumb-title"><?php echo esc_html($book->title); ?></div>
                    <?php if ($book->id === $current_book_id): ?>
                        <div class="tbc-bc-ribbon">
                            <span>Current Book</span>
                        </div>
                    <?php endif; ?>
                </div>
            </div>
            <?php endforeach; ?>
        </div>
        
        <div class="swiper-button-next"></div>
        <div class="swiper-button-prev"></div>
    </div>
</div>

<div class="tbc-bc-player-container" style="display: none;"></div>