<?php
/**
 * The template for displaying single posts
 *
 * Modern single post with full-width hero image
 * Clean, focused reading experience
 *
 * @package Fluent_Starter
 * @since 1.0.0
 */

if (!defined('ABSPATH')) {
    exit;
}

get_header();
?>

<article id="post-<?php the_ID(); ?>" <?php post_class('fs-single-post'); ?>>

    <?php if (has_post_thumbnail()) : ?>
        <!-- Full Width Hero Image -->
        <header class="fs-single-hero">
            <div class="fs-single-hero-image">
                <?php the_post_thumbnail('full', ['class' => 'fs-single-hero-img']); ?>
                <div class="fs-single-hero-overlay"></div>
            </div>

            <div class="fs-single-hero-content">
                <div class="fs-single-meta-top">
                    <?php
                    $categories = get_the_category();
                    if (!empty($categories)) :
                    ?>
                        <a href="<?php echo esc_url(get_category_link($categories[0]->term_id)); ?>" class="fs-single-category">
                            <?php echo esc_html($categories[0]->name); ?>
                        </a>
                    <?php endif; ?>
                </div>

                <?php the_title('<h1 class="fs-single-title">', '</h1>'); ?>

                <div class="fs-single-meta">
                    <div class="fs-single-author">
                        <?php echo get_avatar(get_the_author_meta('ID'), 40, '', '', ['class' => 'fs-single-avatar']); ?>
                        <div class="fs-single-author-info">
                            <span class="fs-single-author-name"><?php the_author(); ?><?php echo fluent_starter_author_badges(get_the_author_meta('ID')); ?></span>
                            <span class="fs-single-date-read">
                                <time datetime="<?php echo esc_attr(get_the_date('c')); ?>"><?php echo esc_html(get_the_date()); ?></time>
                            </span>
                        </div>
                    </div>
                </div>
            </div>
        </header>
    <?php else : ?>
        <!-- Header without image -->
        <header class="fs-single-header-simple">
            <div class="fs-single-header-inner">
                <div class="fs-single-meta-top">
                    <?php
                    $categories = get_the_category();
                    if (!empty($categories)) :
                    ?>
                        <a href="<?php echo esc_url(get_category_link($categories[0]->term_id)); ?>" class="fs-single-category">
                            <?php echo esc_html($categories[0]->name); ?>
                        </a>
                    <?php endif; ?>
                </div>

                <?php the_title('<h1 class="fs-single-title-simple">', '</h1>'); ?>

                <div class="fs-single-meta-simple">
                    <div class="fs-single-author">
                        <?php echo get_avatar(get_the_author_meta('ID'), 40, '', '', ['class' => 'fs-single-avatar']); ?>
                        <div class="fs-single-author-info">
                            <span class="fs-single-author-name"><?php the_author(); ?><?php echo fluent_starter_author_badges(get_the_author_meta('ID')); ?></span>
                            <span class="fs-single-date-read">
                                <time datetime="<?php echo esc_attr(get_the_date('c')); ?>"><?php echo esc_html(get_the_date()); ?></time>
                            </span>
                        </div>
                    </div>
                </div>
            </div>
        </header>
    <?php endif; ?>

    <!-- Post Content -->
    <div class="fs-single-content">
        <div class="fs-single-content-inner">
            <?php
            the_content();

            wp_link_pages(array(
                'before' => '<div class="fs-page-links"><span class="fs-page-links-title">' . esc_html__('Pages:', 'fluent-starter') . '</span>',
                'after'  => '</div>',
                'link_before' => '<span class="fs-page-link">',
                'link_after'  => '</span>',
            ));
            ?>
        </div>

        <!-- Tags -->
        <?php
        $tags = get_the_tags();
        if ($tags) :
        ?>
            <div class="fs-single-tags">
                <?php foreach ($tags as $tag) : ?>
                    <a href="<?php echo esc_url(get_tag_link($tag->term_id)); ?>" class="fs-tag">
                        #<?php echo esc_html($tag->name); ?>
                    </a>
                <?php endforeach; ?>
            </div>
        <?php endif; ?>

        <!-- Share Section -->
        <div class="fs-single-share">
            <span class="fs-share-label"><?php esc_html_e('Share this article', 'fluent-starter'); ?></span>
            <div class="fs-share-buttons">
                <a href="https://twitter.com/intent/tweet?url=<?php echo urlencode(get_permalink()); ?>&text=<?php echo urlencode(get_the_title()); ?>" target="_blank" rel="noopener noreferrer" class="fs-share-btn fs-share-twitter" aria-label="Share on Twitter">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                    </svg>
                </a>
                <a href="https://www.facebook.com/sharer/sharer.php?u=<?php echo urlencode(get_permalink()); ?>" target="_blank" rel="noopener noreferrer" class="fs-share-btn fs-share-facebook" aria-label="Share on Facebook">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                    </svg>
                </a>
                <a href="https://www.linkedin.com/shareArticle?mini=true&url=<?php echo urlencode(get_permalink()); ?>&title=<?php echo urlencode(get_the_title()); ?>" target="_blank" rel="noopener noreferrer" class="fs-share-btn fs-share-linkedin" aria-label="Share on LinkedIn">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
                    </svg>
                </a>
                <button class="fs-share-btn fs-share-copy" data-copy-url="<?php echo esc_url(get_permalink()); ?>" aria-label="<?php esc_attr_e('Copy link', 'fluent-starter'); ?>">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
                        <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
                    </svg>
                </button>
            </div>
        </div>

        <!-- Author Bio -->
        <?php if (get_the_author_meta('description')) : ?>
            <div class="fs-author-bio">
                <?php echo get_avatar(get_the_author_meta('ID'), 64, '', '', ['class' => 'fs-author-bio-avatar']); ?>
                <div class="fs-author-bio-content">
                    <span class="fs-author-bio-label"><?php esc_html_e('Written by', 'fluent-starter'); ?></span>
                    <h3 class="fs-author-bio-name"><?php the_author(); ?><?php echo fluent_starter_author_badges(get_the_author_meta('ID')); ?></h3>
                    <p class="fs-author-bio-desc"><?php the_author_meta('description'); ?></p>
                </div>
            </div>
        <?php endif; ?>
    </div>

    <!-- Post Navigation -->
    <nav class="fs-post-nav">
        <?php
        $prev_post = get_previous_post();
        $next_post = get_next_post();
        ?>

        <?php if ($prev_post) : ?>
            <a href="<?php echo esc_url(get_permalink($prev_post)); ?>" class="fs-post-nav-link fs-post-nav-prev">
                <span class="fs-post-nav-label">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 18l-6-6 6-6"/></svg>
                    <?php esc_html_e('Previous', 'fluent-starter'); ?>
                </span>
                <span class="fs-post-nav-title"><?php echo esc_html(get_the_title($prev_post)); ?></span>
            </a>
        <?php else : ?>
            <div class="fs-post-nav-link fs-post-nav-empty"></div>
        <?php endif; ?>

        <?php if ($next_post) : ?>
            <a href="<?php echo esc_url(get_permalink($next_post)); ?>" class="fs-post-nav-link fs-post-nav-next">
                <span class="fs-post-nav-label">
                    <?php esc_html_e('Next', 'fluent-starter'); ?>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18l6-6-6-6"/></svg>
                </span>
                <span class="fs-post-nav-title"><?php echo esc_html(get_the_title($next_post)); ?></span>
            </a>
        <?php else : ?>
            <div class="fs-post-nav-link fs-post-nav-empty"></div>
        <?php endif; ?>
    </nav>

    <!-- Comments -->
    <?php if (comments_open() || get_comments_number()) : ?>
        <div class="fs-comments-section">
            <?php comments_template(); ?>
        </div>
    <?php endif; ?>

</article>

<?php get_footer(); ?>
