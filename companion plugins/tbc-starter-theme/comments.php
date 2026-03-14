<?php
/**
 * Custom Comments Template
 *
 * Uses Fluent Community CSS classes for consistent styling
 *
 * @package Fluent_Starter
 * @since 1.0.0
 */

if (!defined('ABSPATH')) {
    exit;
}

// Don't load if password required
if (post_password_required()) {
    return;
}
?>

<div id="comments" class="comments-area">
    <?php if (have_comments()) : ?>
        <h3 class="comments-title">
            <?php
            $comment_count = get_comments_number();
            printf(
                /* translators: 1: number of comments */
                _n(
                    '%1$s Comment',
                    '%1$s Comments',
                    $comment_count,
                    'fluent-starter'
                ),
                number_format_i18n($comment_count)
            );
            ?>
        </h3>

        <ol class="comment-list">
            <?php
            wp_list_comments(array(
                'style'       => 'ol',
                'short_ping'  => true,
                'callback'    => 'fluent_starter_comment_callback',
                'avatar_size' => 40,
            ));
            ?>
        </ol>

        <?php if (get_comment_pages_count() > 1 && get_option('page_comments')) : ?>
            <nav class="comment-navigation">
                <div class="nav-previous"><?php previous_comments_link(esc_html__('Older Comments', 'fluent-starter')); ?></div>
                <div class="nav-next"><?php next_comments_link(esc_html__('Newer Comments', 'fluent-starter')); ?></div>
            </nav>
        <?php endif; ?>

    <?php endif; ?>

    <?php if (!comments_open() && get_comments_number() && post_type_supports(get_post_type(), 'comments')) : ?>
        <p class="no-comments"><?php esc_html_e('Comments are closed.', 'fluent-starter'); ?></p>
    <?php endif; ?>

    <?php
    // Comment form with Fluent Community classes
    comment_form(array(
        'class_form'         => 'comment-form feed_comment_input',
        'class_submit'       => 'submit fcom_primary_button',
        'title_reply'        => __('Leave a Comment', 'fluent-starter'),
        'title_reply_to'     => __('Reply to %s', 'fluent-starter'),
        'cancel_reply_link'  => __('Cancel Reply', 'fluent-starter'),
        'label_submit'       => __('Post Comment', 'fluent-starter'),
        'comment_field'      => '<p class="comment-form-comment"><label for="comment" class="screen-reader-text">' . __('Comment', 'fluent-starter') . '</label><textarea id="comment" name="comment" class="fcom_input" rows="2" placeholder="' . esc_attr__('Write a comment...', 'fluent-starter') . '" required></textarea></p>',
        'fields'             => array(
            'author' => '<p class="comment-form-author"><label for="author">' . __('Name', 'fluent-starter') . ' <span class="required">*</span></label><input id="author" name="author" type="text" class="fcom_input" required /></p>',
            'email'  => '<p class="comment-form-email"><label for="email">' . __('Email', 'fluent-starter') . ' <span class="required">*</span></label><input id="email" name="email" type="email" class="fcom_input" required /></p>',
            'url'    => '<p class="comment-form-url"><label for="url">' . __('Website', 'fluent-starter') . '</label><input id="url" name="url" type="url" class="fcom_input" /></p>',
        ),
    ));
    ?>
</div>

<?php
/**
 * Custom comment callback using Fluent Community CSS classes
 */
function fluent_starter_comment_callback($comment, $args, $depth) {
    $tag = ($args['style'] === 'div') ? 'div' : 'li';
    ?>
    <<?php echo $tag; ?> id="comment-<?php comment_ID(); ?>" <?php comment_class('each_comment'); ?>>
        <article class="comment_wrap">
            <div class="person_avatar">
                <?php echo get_avatar($comment, $args['avatar_size']); ?>
            </div>
            <div class="comment_text">
                <div class="comment_text_head">
                    <span class="comment_text_head_name"><?php comment_author(); ?><?php echo fluent_starter_verified_mark($comment->user_id); ?><?php echo fluent_starter_author_badges($comment->user_id); ?></span>
                    <span class="comment_text_head_time">
                        <time datetime="<?php comment_time('c'); ?>">
                            <?php
                            printf(
                                /* translators: 1: date, 2: time */
                                __('%1$s at %2$s', 'fluent-starter'),
                                get_comment_date(),
                                get_comment_time()
                            );
                            ?>
                        </time>
                    </span>
                </div>

                <?php if ($comment->comment_approved == '0') : ?>
                    <p class="comment-awaiting-moderation"><?php esc_html_e('Your comment is awaiting moderation.', 'fluent-starter'); ?></p>
                <?php endif; ?>

                <div class="comment_text_body">
                    <?php comment_text(); ?>
                </div>

                <div class="comment_actions">
                    <?php
                    comment_reply_link(array_merge($args, array(
                        'reply_text' => __('Reply', 'fluent-starter'),
                        'depth'      => $depth,
                        'max_depth'  => $args['max_depth'],
                        'before'     => '<span class="reply_btn">',
                        'after'      => '</span>',
                    )));

                    edit_comment_link(__('Edit', 'fluent-starter'), '<span class="edit-link">', '</span>');
                    ?>
                </div>
            </div>
        </article>
    <?php
}
