<?php
/**
 * Admin Settings Page Template
 *
 * @package TBC_Multi_Reactions
 * @var array $settings
 */

defined('ABSPATH') || exit;

$tbc_mr_reaction_types = isset($settings['reaction_types']) ? $settings['reaction_types'] : [];

// Sort by order
uasort($tbc_mr_reaction_types, function($a, $b) {
    return ($a['order'] ?? 999) - ($b['order'] ?? 999);
});
?>
<div class="wrap tbc-mr-admin">
    <h1><?php esc_html_e('TBC Multi Reactions', 'tbc-multi-reactions'); ?></h1>

    <?php settings_errors('tbc_mr_settings'); ?>

    <form method="post" action="options.php" id="tbc-mr-settings-form">
        <?php settings_fields('tbc_mr_settings'); ?>

        <!-- Global Settings -->
        <div class="tbc-mr-section">
            <h2><?php esc_html_e('Settings', 'tbc-multi-reactions'); ?></h2>
            <div class="tbc-mr-settings-grid">
                <div class="tbc-mr-setting-row">
                    <label class="tbc-mr-toggle-label">
                        <input type="hidden" name="tbc_mr_settings[enabled]" value="0" />
                        <input type="checkbox" name="tbc_mr_settings[enabled]" value="1"
                            class="tbc-mr-toggle" <?php checked(!empty($settings['enabled'])); ?> />
                        <span class="tbc-mr-toggle-switch"></span>
                        <span><?php esc_html_e('Enable Multi-Reactions', 'tbc-multi-reactions'); ?></span>
                    </label>
                </div>
                <div class="tbc-mr-setting-row">
                    <label class="tbc-mr-toggle-label">
                        <input type="hidden" name="tbc_mr_settings[delete_data_on_uninstall]" value="0" />
                        <input type="checkbox" name="tbc_mr_settings[delete_data_on_uninstall]" value="1"
                            class="tbc-mr-toggle" <?php checked(!empty($settings['delete_data_on_uninstall'])); ?> />
                        <span class="tbc-mr-toggle-switch"></span>
                        <span><?php esc_html_e('Delete all reaction data when plugin is uninstalled', 'tbc-multi-reactions'); ?></span>
                    </label>
                    <p class="description" style="margin-left: 52px; margin-top: 4px;"><?php esc_html_e('When enabled, uninstalling this plugin will permanently remove all reaction data, custom icons, and settings. Leave unchecked to preserve data if reinstalling later.', 'tbc-multi-reactions'); ?></p>
                </div>
            </div>
        </div>

        <!-- Reactions -->
        <div class="tbc-mr-section">
            <h2><?php esc_html_e('Reactions', 'tbc-multi-reactions'); ?></h2>
            <p class="description"><?php esc_html_e('Drag to reorder. Click the edit icon to configure each reaction.', 'tbc-multi-reactions'); ?></p>

            <div id="tbc-mr-reactions-grid" class="tbc-mr-reactions-grid">
                <?php $tbc_mr_order = 0; foreach ($tbc_mr_reaction_types as $id => $tbc_mr_reaction): $tbc_mr_order++;
                    $tbc_mr_icon_url = $tbc_mr_reaction['icon_url'] ?? '';
                    $tbc_mr_emoji = isset($tbc_mr_reaction['emoji']) ? html_entity_decode($tbc_mr_reaction['emoji'], ENT_QUOTES | ENT_HTML5, 'UTF-8') : '';
                    $tbc_mr_is_enabled = !empty($tbc_mr_reaction['enabled']);
                ?>
                <div class="tbc-mr-card<?php echo $tbc_mr_is_enabled ? '' : ' tbc-mr-card-disabled'; ?>" data-id="<?php echo esc_attr($id); ?>">
                    <!-- Hidden form fields -->
                    <input type="hidden" name="tbc_mr_settings[reaction_types][<?php echo esc_attr($id); ?>][order]" class="tbc-mr-order" value="<?php echo esc_attr($tbc_mr_order); ?>" />
                    <input type="hidden" name="tbc_mr_settings[reaction_types][<?php echo esc_attr($id); ?>][name]" class="tbc-mr-data-name" value="<?php echo esc_attr($tbc_mr_reaction['name'] ?? ''); ?>" />
                    <input type="hidden" name="tbc_mr_settings[reaction_types][<?php echo esc_attr($id); ?>][emoji]" class="tbc-mr-data-emoji" value="<?php echo esc_attr($tbc_mr_emoji); ?>" />
                    <input type="hidden" name="tbc_mr_settings[reaction_types][<?php echo esc_attr($id); ?>][color]" class="tbc-mr-data-color" value="<?php echo esc_attr($tbc_mr_reaction['color'] ?? '#1877F2'); ?>" />
                    <input type="hidden" name="tbc_mr_settings[reaction_types][<?php echo esc_attr($id); ?>][media_id]" class="tbc-mr-data-media-id" value="<?php echo esc_attr($tbc_mr_reaction['media_id'] ?? 0); ?>" />
                    <input type="hidden" name="tbc_mr_settings[reaction_types][<?php echo esc_attr($id); ?>][icon_url]" class="tbc-mr-data-icon-url" value="<?php echo esc_attr($tbc_mr_icon_url); ?>" />
                    <input type="hidden" name="tbc_mr_settings[reaction_types][<?php echo esc_attr($id); ?>][enabled]" class="tbc-mr-data-enabled" value="<?php echo $tbc_mr_is_enabled ? '1' : '0'; ?>" />

                    <?php if ($tbc_mr_is_enabled): ?>
                        <span class="tbc-mr-card-badge tbc-mr-badge-on"></span>
                    <?php else: ?>
                        <span class="tbc-mr-card-badge tbc-mr-badge-off"></span>
                    <?php endif; ?>

                    <button type="button" class="tbc-mr-card-edit" title="<?php esc_attr_e('Edit', 'tbc-multi-reactions'); ?>">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                    </button>

                    <div class="tbc-mr-card-icon">
                        <?php if ($tbc_mr_icon_url): ?>
                            <img src="<?php echo esc_url($tbc_mr_icon_url); ?>" alt="" />
                        <?php elseif ($tbc_mr_emoji): ?>
                            <span class="tbc-mr-card-emoji"><?php echo esc_html($tbc_mr_emoji); ?></span>
                        <?php else: ?>
                            <span class="tbc-mr-card-empty">?</span>
                        <?php endif; ?>
                    </div>
                    <div class="tbc-mr-card-name"><?php echo esc_html($tbc_mr_reaction['name'] ?? ''); ?></div>
                </div>
                <?php endforeach; ?>

            </div>
        </div>

        <div class="tbc-mr-actions">
            <?php submit_button(__('Save Changes', 'tbc-multi-reactions'), 'primary', 'submit', false); ?>
        </div>
    </form>

</div>

<!-- Reaction Editor Modal -->
<div id="tbc-mr-modal" class="tbc-mr-modal" style="display:none;">
    <div class="tbc-mr-modal-overlay"></div>
    <div class="tbc-mr-modal-panel">
        <div class="tbc-mr-modal-header">
            <h2><?php esc_html_e('Reaction Editor', 'tbc-multi-reactions'); ?></h2>
            <button type="button" class="tbc-mr-modal-close">&times;</button>
        </div>
        <div class="tbc-mr-modal-body">
            <div class="tbc-mr-modal-left">
                <!-- Tabs -->
                <div class="tbc-mr-tabs">
                    <button type="button" class="tbc-mr-tab tbc-mr-tab-active" data-tab="emoji"><?php esc_html_e('Emoji', 'tbc-multi-reactions'); ?></button>
                    <button type="button" class="tbc-mr-tab" data-tab="custom"><?php esc_html_e('Custom', 'tbc-multi-reactions'); ?></button>
                </div>

                <!-- Emoji Tab -->
                <div class="tbc-mr-tab-content tbc-mr-tab-emoji tbc-mr-tab-visible">
                    <p class="description"><?php esc_html_e('Paste or type an emoji character.', 'tbc-multi-reactions'); ?></p>
                    <input type="text" id="tbc-mr-modal-emoji" class="tbc-mr-modal-emoji-input" placeholder="<?php esc_attr_e('Paste emoji here...', 'tbc-multi-reactions'); ?>" />
                </div>

                <!-- Custom Tab -->
                <div class="tbc-mr-tab-content tbc-mr-tab-custom">
                    <div class="tbc-mr-upload-area" id="tbc-mr-upload-area">
                        <div class="tbc-mr-upload-preview" id="tbc-mr-upload-preview">
                            <span class="tbc-mr-upload-placeholder"><?php esc_html_e('No custom icon', 'tbc-multi-reactions'); ?></span>
                        </div>
                        <div class="tbc-mr-upload-actions">
                            <button type="button" class="button" id="tbc-mr-modal-upload"><?php esc_html_e('Upload Icon', 'tbc-multi-reactions'); ?></button>
                            <button type="button" class="button" id="tbc-mr-modal-remove-icon" style="display:none;"><?php esc_html_e('Remove', 'tbc-multi-reactions'); ?></button>
                        </div>
                        <p class="description"><?php esc_html_e('PNG, JPG, SVG, GIF, WEBP. Max 2MB. Auto-resized to 128x128px.', 'tbc-multi-reactions'); ?></p>
                    </div>
                </div>
            </div>

            <div class="tbc-mr-modal-right">
                <!-- Preview -->
                <div class="tbc-mr-modal-preview-box">
                    <div class="tbc-mr-modal-preview-icon" id="tbc-mr-modal-preview-icon"></div>
                    <div class="tbc-mr-modal-preview-name" id="tbc-mr-modal-preview-name"></div>
                </div>

                <!-- Settings -->
                <div class="tbc-mr-modal-settings">
                    <div class="tbc-mr-modal-field">
                        <label><?php esc_html_e('Label', 'tbc-multi-reactions'); ?> <span class="tbc-mr-char-count" id="tbc-mr-char-count">0/12</span></label>
                        <input type="text" id="tbc-mr-modal-name" maxlength="12" placeholder="<?php esc_attr_e('Reaction name', 'tbc-multi-reactions'); ?>" />
                    </div>
                    <div class="tbc-mr-modal-field">
                        <label><?php esc_html_e('Active Color', 'tbc-multi-reactions'); ?></label>
                        <input type="text" id="tbc-mr-modal-color" value="#1877F2" />
                    </div>
                    <div class="tbc-mr-modal-field">
                        <label class="tbc-mr-toggle-label">
                            <input type="checkbox" id="tbc-mr-modal-enabled" class="tbc-mr-toggle" />
                            <span class="tbc-mr-toggle-switch"></span>
                            <span><?php esc_html_e('Enabled', 'tbc-multi-reactions'); ?></span>
                        </label>
                    </div>
                </div>

                <div class="tbc-mr-modal-footer-actions"></div>
            </div>
        </div>
        <div class="tbc-mr-modal-footer">
            <button type="button" class="button button-primary" id="tbc-mr-modal-save"><?php esc_html_e('Done', 'tbc-multi-reactions'); ?></button>
        </div>
    </div>
</div>
