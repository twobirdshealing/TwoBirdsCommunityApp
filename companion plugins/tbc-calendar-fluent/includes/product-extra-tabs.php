<?php
/**
 * TBC WooCommerce Calendar - FAQ & Tabs (Product Extra Tabs)
 *
 * Replaces the standalone plugins `tbc-custom-woo-tabs` and `tbc-woocommerce-faq`
 * with a single unified product data tab on every WooCommerce product.
 *
 * Admin: one sortable repeater. Each item is either a Content tab (single
 * wp_editor) or an FAQ tab (nested sortable Q&A list, teeny editor lazy-init).
 * Frontend: items render via `woocommerce_product_tabs` filter; FAQ tabs render
 * as an accordion.
 *
 * Meta key: `_tbc_wc_product_tabs` (array of items, see schema below).
 *
 * @package TBC_WC_Calendar
 */

if (!defined('ABSPATH')) {
    exit;
}

const TBC_WC_EXTRA_TABS_META_KEY = '_tbc_wc_product_tabs';
const TBC_WC_EXTRA_TABS_NONCE    = 'tbc_wc_save_extra_tabs';
const TBC_WC_EXTRA_TABS_FIELD    = 'tbc_wc_extra_tabs_nonce';

/**
 * Load saved tabs for a product.
 *
 * @param int $product_id
 * @return array
 */
function tbc_wc_get_product_tabs($product_id) {
    $raw = get_post_meta($product_id, TBC_WC_EXTRA_TABS_META_KEY, true);
    return is_array($raw) ? $raw : [];
}

/**
 * =============================================================================
 * ADMIN: PRODUCT DATA TAB REGISTRATION
 * =============================================================================
 */

function tbc_wc_extra_tabs_add_data_tab($tabs) {
    $tabs['tbc_wc_extra_tabs'] = [
        'label'    => __('FAQ & Tabs', 'tbc-wc-calendar'),
        'target'   => 'tbc_wc_extra_tabs_data',
        'class'    => [],
        'priority' => 99,
    ];
    return $tabs;
}
add_filter('woocommerce_product_data_tabs', 'tbc_wc_extra_tabs_add_data_tab');

function tbc_wc_extra_tabs_data_tab_icon() {
    ?>
    <style>
        #woocommerce-product-data ul.wc-tabs li.tbc_wc_extra_tabs_options a::before {
            font-family: Dashicons;
            content: "\f333";
        }
    </style>
    <?php
}
add_action('admin_head', 'tbc_wc_extra_tabs_data_tab_icon');

/**
 * =============================================================================
 * ADMIN: PANEL RENDERING
 * =============================================================================
 */

function tbc_wc_extra_tabs_render_panel() {
    global $post;
    if (!$post instanceof WP_Post) {
        return;
    }

    $items = tbc_wc_get_product_tabs($post->ID);
    ?>
    <div id="tbc_wc_extra_tabs_data" class="panel woocommerce_options_panel">
        <div class="tbc-wc-extra-tabs-intro">
            <p class="description">
                <?php esc_html_e('Add content tabs or FAQ tabs that will appear on the product page alongside Description and Reviews. Drag to reorder.', 'tbc-wc-calendar'); ?>
            </p>
        </div>

        <div class="tbc-wc-extra-tabs-container">
            <?php
            if (!empty($items)) {
                foreach ($items as $index => $item) {
                    tbc_wc_extra_tabs_render_item((int) $index, $item);
                }
            }
            ?>
        </div>

        <p class="tbc-wc-extra-tabs-actions">
            <button type="button" class="button button-primary tbc-wc-add-tab">
                <?php esc_html_e('Add Tab', 'tbc-wc-calendar'); ?>
            </button>
        </p>

        <?php wp_nonce_field(TBC_WC_EXTRA_TABS_NONCE, TBC_WC_EXTRA_TABS_FIELD); ?>

        <script type="text/html" id="tbc-wc-tab-template">
            <?php tbc_wc_extra_tabs_render_item('__INDEX__', [], true); ?>
        </script>

        <script type="text/html" id="tbc-wc-faq-row-template">
            <?php tbc_wc_extra_tabs_render_faq_row('__INDEX__', '__FAQINDEX__', [], true); ?>
        </script>
    </div>
    <?php
}
add_action('woocommerce_product_data_panels', 'tbc_wc_extra_tabs_render_panel');

/**
 * Render a single tab item.
 *
 * @param int|string $index     Numeric index for existing items, placeholder for template.
 * @param array      $item      Saved data (empty for new/template rows).
 * @param bool       $is_template Whether this is being rendered into a <script> template.
 */
function tbc_wc_extra_tabs_render_item($index, $item = [], $is_template = false) {
    $enabled  = !empty($item['enabled']);
    $type     = isset($item['type']) && $item['type'] === 'faq' ? 'faq' : 'content';
    $title    = isset($item['title']) ? (string) $item['title'] : '';
    $content  = isset($item['content']) ? (string) $item['content'] : '';
    $faqs     = isset($item['faqs']) && is_array($item['faqs']) ? $item['faqs'] : [];

    $display_title = $title !== '' ? $title : __('New Tab', 'tbc-wc-calendar');

    $field_name_prefix = 'tbc_wc_extra_tabs[' . $index . ']';
    $editor_id         = 'tbc_wc_extra_tabs_' . $index . '_content';
    ?>
    <div class="tbc-wc-extra-tab-item" data-index="<?php echo esc_attr((string) $index); ?>" data-type="<?php echo esc_attr($type); ?>">
        <div class="tbc-wc-extra-tab-handle">
            <span class="tbc-wc-extra-tab-drag dashicons dashicons-menu" title="<?php esc_attr_e('Drag to reorder', 'tbc-wc-calendar'); ?>"></span>
            <span class="tbc-wc-extra-tab-title-display"><?php echo esc_html($display_title); ?></span>
            <span class="tbc-wc-extra-tab-type-badge" data-content-label="<?php esc_attr_e('Content', 'tbc-wc-calendar'); ?>" data-faq-label="<?php esc_attr_e('FAQ', 'tbc-wc-calendar'); ?>">
                <?php echo $type === 'faq' ? esc_html__('FAQ', 'tbc-wc-calendar') : esc_html__('Content', 'tbc-wc-calendar'); ?>
            </span>
            <span class="tbc-wc-extra-tab-toggle dashicons dashicons-arrow-down-alt2" title="<?php esc_attr_e('Expand / collapse', 'tbc-wc-calendar'); ?>"></span>
        </div>

        <div class="tbc-wc-extra-tab-body">
            <p class="form-field">
                <label><?php esc_html_e('Enabled', 'tbc-wc-calendar'); ?></label>
                <input type="checkbox" name="<?php echo esc_attr($field_name_prefix); ?>[enabled]" value="1" <?php checked($enabled); ?>>
                <span class="description"><?php esc_html_e('Show this tab on the product page.', 'tbc-wc-calendar'); ?></span>
            </p>

            <p class="form-field">
                <label><?php esc_html_e('Type', 'tbc-wc-calendar'); ?></label>
                <select name="<?php echo esc_attr($field_name_prefix); ?>[type]" class="tbc-wc-tab-type">
                    <option value="content" <?php selected($type, 'content'); ?>><?php esc_html_e('Content (rich text)', 'tbc-wc-calendar'); ?></option>
                    <option value="faq" <?php selected($type, 'faq'); ?>><?php esc_html_e('FAQ (questions &amp; answers)', 'tbc-wc-calendar'); ?></option>
                </select>
            </p>

            <p class="form-field">
                <label><?php esc_html_e('Title', 'tbc-wc-calendar'); ?></label>
                <input type="text" name="<?php echo esc_attr($field_name_prefix); ?>[title]" value="<?php echo esc_attr($title); ?>" class="tbc-wc-tab-title" placeholder="<?php esc_attr_e('e.g. Shipping, FAQ, Itinerary', 'tbc-wc-calendar'); ?>">
            </p>

            <div class="tbc-wc-tab-content-pane" <?php echo $type !== 'content' ? 'style="display:none;"' : ''; ?>>
                <div class="tbc-wc-tab-editor-wrap">
                    <?php
                    if ($is_template) {
                        // Template rows get a plain textarea; JS will wp.editor.initialize() it when
                        // the tab is added. Using wp_editor() inside a <script> block breaks escaping.
                        printf(
                            '<textarea name="%1$s" id="%2$s" rows="8" class="tbc-wc-tab-content-textarea"></textarea>',
                            esc_attr($field_name_prefix . '[content]'),
                            esc_attr($editor_id)
                        );
                    } else {
                        wp_editor(
                            $content,
                            $editor_id,
                            [
                                'textarea_name' => $field_name_prefix . '[content]',
                                'textarea_rows' => 10,
                                'media_buttons' => false,
                                'teeny'         => true,
                                'quicktags'     => true,
                            ]
                        );
                    }
                    ?>
                </div>
            </div>

            <div class="tbc-wc-tab-faq-pane" <?php echo $type !== 'faq' ? 'style="display:none;"' : ''; ?>>
                <div class="tbc-wc-faq-rows">
                    <?php
                    if (!$is_template && !empty($faqs)) {
                        foreach ($faqs as $faq_index => $faq) {
                            tbc_wc_extra_tabs_render_faq_row($index, (int) $faq_index, $faq);
                        }
                    }
                    ?>
                </div>
                <p>
                    <button type="button" class="button tbc-wc-add-faq">
                        <?php esc_html_e('Add Question', 'tbc-wc-calendar'); ?>
                    </button>
                </p>
            </div>

            <p class="tbc-wc-extra-tab-footer">
                <button type="button" class="button-link-delete tbc-wc-remove-tab">
                    <?php esc_html_e('Remove tab', 'tbc-wc-calendar'); ?>
                </button>
            </p>
        </div>
    </div>
    <?php
}

/**
 * Render one FAQ Q&A row inside an FAQ-type tab.
 *
 * The answer textarea is NOT wrapped in wp_editor() at render time — JS lazy-initializes
 * a teeny editor when the row is first expanded. This keeps initial admin load light
 * even when a product has many FAQs.
 */
function tbc_wc_extra_tabs_render_faq_row($tab_index, $faq_index, $faq = [], $is_template = false) {
    $question = isset($faq['question']) ? (string) $faq['question'] : '';
    $answer   = isset($faq['answer']) ? (string) $faq['answer'] : '';

    $display_question = $question !== '' ? $question : __('New question', 'tbc-wc-calendar');

    $name_prefix = 'tbc_wc_extra_tabs[' . $tab_index . '][faqs][' . $faq_index . ']';
    $answer_id   = 'tbc_wc_extra_tabs_' . $tab_index . '_faqs_' . $faq_index . '_answer';
    ?>
    <div class="tbc-wc-faq-row" data-faq-index="<?php echo esc_attr((string) $faq_index); ?>">
        <div class="tbc-wc-faq-row-handle">
            <span class="tbc-wc-faq-row-drag dashicons dashicons-menu" title="<?php esc_attr_e('Drag to reorder', 'tbc-wc-calendar'); ?>"></span>
            <span class="tbc-wc-faq-row-title-display"><?php echo esc_html($display_question); ?></span>
            <span class="tbc-wc-faq-row-toggle dashicons dashicons-arrow-down-alt2"></span>
        </div>
        <div class="tbc-wc-faq-row-body">
            <p class="form-field">
                <label><?php esc_html_e('Question', 'tbc-wc-calendar'); ?></label>
                <input type="text" name="<?php echo esc_attr($name_prefix . '[question]'); ?>" value="<?php echo esc_attr($question); ?>" class="tbc-wc-faq-question-input" placeholder="<?php esc_attr_e('What time does the event start?', 'tbc-wc-calendar'); ?>">
            </p>
            <div class="form-field tbc-wc-faq-answer-field">
                <label><?php esc_html_e('Answer', 'tbc-wc-calendar'); ?></label>
                <textarea
                    name="<?php echo esc_attr($name_prefix . '[answer]'); ?>"
                    id="<?php echo esc_attr($answer_id); ?>"
                    rows="10"
                    class="tbc-wc-faq-answer-textarea"
                ><?php echo esc_textarea($answer); ?></textarea>
            </div>
            <p>
                <button type="button" class="button-link-delete tbc-wc-remove-faq">
                    <?php esc_html_e('Remove question', 'tbc-wc-calendar'); ?>
                </button>
            </p>
        </div>
    </div>
    <?php
}

/**
 * =============================================================================
 * ADMIN: SAVE
 * =============================================================================
 */

function tbc_wc_extra_tabs_save($post_id) {
    if (!isset($_POST[TBC_WC_EXTRA_TABS_FIELD])) {
        return;
    }
    if (!wp_verify_nonce(sanitize_text_field(wp_unslash($_POST[TBC_WC_EXTRA_TABS_FIELD])), TBC_WC_EXTRA_TABS_NONCE)) {
        return;
    }
    if (!current_user_can('edit_post', $post_id)) {
        return;
    }

    if (empty($_POST['tbc_wc_extra_tabs']) || !is_array($_POST['tbc_wc_extra_tabs'])) {
        delete_post_meta($post_id, TBC_WC_EXTRA_TABS_META_KEY);
        return;
    }

    $submitted = wp_unslash($_POST['tbc_wc_extra_tabs']);
    $clean     = [];

    foreach ($submitted as $row) {
        if (!is_array($row)) {
            continue;
        }

        $type = isset($row['type']) && in_array($row['type'], ['content', 'faq'], true) ? $row['type'] : 'content';

        $item = [
            'enabled' => !empty($row['enabled']),
            'type'    => $type,
            'title'   => isset($row['title']) ? sanitize_text_field($row['title']) : '',
            'content' => '',
            'faqs'    => [],
        ];

        if ($type === 'content') {
            $item['content'] = isset($row['content']) ? wp_kses_post($row['content']) : '';
        } else {
            $faqs_in = isset($row['faqs']) && is_array($row['faqs']) ? $row['faqs'] : [];
            $faqs_out = [];
            foreach ($faqs_in as $faq) {
                if (!is_array($faq)) {
                    continue;
                }
                $question = isset($faq['question']) ? sanitize_text_field($faq['question']) : '';
                $answer   = isset($faq['answer']) ? wp_kses_post($faq['answer']) : '';

                if ($question === '' && trim(wp_strip_all_tags($answer)) === '') {
                    continue;
                }

                $faqs_out[] = [
                    'question' => $question,
                    'answer'   => $answer,
                ];
            }
            $item['faqs'] = array_values($faqs_out);
        }

        // Drop entirely empty rows.
        if (
            $item['title'] === ''
            && $item['content'] === ''
            && empty($item['faqs'])
            && !$item['enabled']
        ) {
            continue;
        }

        $clean[] = $item;
    }

    if (empty($clean)) {
        delete_post_meta($post_id, TBC_WC_EXTRA_TABS_META_KEY);
        return;
    }

    update_post_meta($post_id, TBC_WC_EXTRA_TABS_META_KEY, array_values($clean));
}
add_action('woocommerce_process_product_meta', 'tbc_wc_extra_tabs_save', 10, 1);

/**
 * =============================================================================
 * FRONTEND: PRODUCT TABS RENDERING
 * =============================================================================
 */

function tbc_wc_extra_tabs_register_frontend_tabs($tabs) {
    global $product;

    $product_id = 0;
    if ($product instanceof WC_Product) {
        $product_id = $product->get_id();
    } elseif (function_exists('get_the_ID')) {
        $product_id = (int) get_the_ID();
    }

    if (!$product_id) {
        return $tabs;
    }

    $items = tbc_wc_get_product_tabs($product_id);
    if (empty($items)) {
        return $tabs;
    }

    foreach ($items as $index => $item) {
        if (empty($item['enabled'])) {
            continue;
        }

        $type = isset($item['type']) && $item['type'] === 'faq' ? 'faq' : 'content';

        // Skip tabs that have nothing to show.
        if ($type === 'content' && trim((string) ($item['content'] ?? '')) === '') {
            continue;
        }
        if ($type === 'faq' && empty($item['faqs'])) {
            continue;
        }

        $title = isset($item['title']) && $item['title'] !== ''
            ? $item['title']
            : ($type === 'faq' ? __('FAQ', 'tbc-wc-calendar') : __('Details', 'tbc-wc-calendar'));

        $tabs['tbc_wc_extra_' . $index] = [
            'title'    => $title,
            'priority' => 60 + (int) $index,
            'callback' => 'tbc_wc_extra_tabs_render_frontend_tab',
            'tbc_data' => $item,
        ];
    }

    return $tabs;
}
add_filter('woocommerce_product_tabs', 'tbc_wc_extra_tabs_register_frontend_tabs');

/**
 * Render a single extra tab on the product frontend.
 *
 * @param string $key Tab key.
 * @param array  $tab Tab data (includes our 'tbc_data' payload).
 */
function tbc_wc_extra_tabs_render_frontend_tab($key, $tab) {
    $item = isset($tab['tbc_data']) && is_array($tab['tbc_data']) ? $tab['tbc_data'] : [];
    $type = isset($item['type']) && $item['type'] === 'faq' ? 'faq' : 'content';

    if ($type === 'content') {
        $content = isset($item['content']) ? $item['content'] : '';
        echo '<div class="tbc-wc-extra-tab-content">' . wp_kses_post(wpautop($content)) . '</div>';
        return;
    }

    $faqs = isset($item['faqs']) && is_array($item['faqs']) ? $item['faqs'] : [];
    if (empty($faqs)) {
        return;
    }

    echo '<div class="tbc-wc-faq-container">';
    foreach ($faqs as $faq) {
        $question = isset($faq['question']) ? $faq['question'] : '';
        $answer   = isset($faq['answer']) ? $faq['answer'] : '';
        ?>
        <div class="tbc-wc-faq-item">
            <h3 class="tbc-wc-faq-question"><?php echo esc_html($question); ?></h3>
            <div class="tbc-wc-faq-answer"><?php echo wpautop(wp_kses_post($answer)); ?></div>
        </div>
        <?php
    }
    echo '</div>';
}
