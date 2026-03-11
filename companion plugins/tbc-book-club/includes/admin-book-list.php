<?php
if (!defined('ABSPATH')) {
    exit;
}

global $wpdb;
$books = $wpdb->get_results("
    SELECT * FROM {$wpdb->prefix}tbc_bc_books
    ORDER BY display_order ASC
");

$book_club_url = home_url('/book-club/');
?>

<div class="wrap tbc-bc-admin">
    <div class="tbc-bc-list-header">
        <h1>Book Club Manager</h1>
        <a href="?page=tbc-bc-manager&action=add" class="button button-primary">
            <span class="dashicons dashicons-plus-alt2"></span>
            Add New Book
        </a>
    </div>

    <?php if (empty($books)): ?>
        <div class="tbc-bc-empty-state">
            <span class="dashicons dashicons-book-alt"></span>
            <p>No books have been added yet.</p>
            <a href="?page=tbc-bc-manager&action=add" class="button button-primary">Add Your First Book</a>
        </div>
    <?php else: ?>
        <div id="tbc-bc-book-list" class="tbc-bc-sortable-books">
            <?php foreach ($books as $book): ?>
                <div class="tbc-bc-book-item" data-id="<?php echo esc_attr($book->id); ?>">
                    <div class="tbc-bc-book-handle">
                        <span class="dashicons dashicons-menu"></span>
                    </div>
                    
                    <div class="tbc-bc-book-cover">
                        <?php if ($book->cover_image): ?>
                            <img src="<?php echo esc_url($book->cover_image); ?>" 
                                 alt="<?php echo esc_attr($book->title); ?>" />
                        <?php else: ?>
                            <div class="tbc-bc-no-cover">
                                <span class="dashicons dashicons-book"></span>
                            </div>
                        <?php endif; ?>
                    </div>

                    <div class="tbc-bc-book-info">
                        <h3 class="tbc-bc-book-title">
                            <?php echo esc_html($book->title); ?>
                            <?php if ($book->is_current): ?>
                                <span class="tbc-bc-current-badge">Current Book</span>
                            <?php endif; ?>
                        </h3>
                        <p class="tbc-bc-book-author"><?php echo esc_html($book->author); ?></p>
                        <?php if ($book->description): ?>
                            <p class="tbc-bc-book-description"><?php echo wp_trim_words($book->description, 20); ?></p>
                        <?php endif; ?>
                        
                        <?php 
                        $chapters = json_decode($book->chapters, true);
                        $chapter_summary = tbc_bc_get_chapter_summary($chapters);
                        if ($chapter_summary): 
                        ?>
                            <div class="tbc-bc-chapter-count">
                                <span class="dashicons dashicons-playlist-audio"></span>
                                <?php echo esc_html($chapter_summary); ?>
                            </div>
                        <?php endif; ?>
                    </div>

                    <div class="tbc-bc-book-actions">
                        <a href="<?php echo esc_url($book_club_url . '?book_id=' . $book->id); ?>" 
                           class="button button-primary"
                           target="_blank">
                            <span class="dashicons dashicons-visibility"></span>
                            View
                        </a>
                        
                        <a href="?page=tbc-bc-manager&action=edit&id=<?php echo esc_attr($book->id); ?>" 
                           class="button">
                            <span class="dashicons dashicons-edit"></span>
                            Edit
                        </a>
                        
                        <button type="button" class="button tbc-bc-set-current" 
                                data-id="<?php echo esc_attr($book->id); ?>"
                                data-current="<?php echo $book->is_current ? '1' : '0'; ?>">
                            <?php if ($book->is_current): ?>
                                <span class="dashicons dashicons-star-filled"></span>
                                Unset Current
                            <?php else: ?>
                                <span class="dashicons dashicons-star-empty"></span>
                                Set Current
                            <?php endif; ?>
                        </button>
                        
                        <button type="button" class="button button-link-delete tbc-bc-delete-book" 
                                data-id="<?php echo esc_attr($book->id); ?>">
                            <span class="dashicons dashicons-trash"></span>
                            Delete
                        </button>
                    </div>
                </div>
            <?php endforeach; ?>
        </div>
    <?php endif; ?>
</div>