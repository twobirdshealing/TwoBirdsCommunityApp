<?php
if ( ! defined( 'ABSPATH' ) ) exit; // Exit if accessed directly

/**
 * @var string $permalink
 * @var string $user_avatar
 * @var string $user_name
 * @var string $community_name
 * @var string $content
 */

?>
<table width="100%" cellspacing="0" cellpadding="0" border="0">
    <tr>
        <td style="text-align: left; font-family: Arial, sans-serif; font-size: 16px; line-height: 1.4; color: #333;">
            <table style="background-color: #f7f7f7; margin: 10px 0" bgcolor="#f7f7f7" cellspacing="0" cellpadding="0" border="0" width="100%">
                <tr>
                    <td align="left">
                        <table style="margin-bottom: 0px 10px; padding: 10px;" cellspacing="0" cellpadding="0" border="0">
                            <tr>
                                <td valign="top" style="border-radius: 50%; padding: 0px; vertical-align: top;">
                                    <a href="<?php echo esc_url($permalink); ?>">
                                        <img alt="" src="<?php echo esc_url($user_avatar); ?>" width="32" height="32" style="border-radius: 50%; display: block;">
                                    </a>
                                </td>
                                <td style="font-family: Arial, sans-serif; font-size: 16px;color: #333; padding-left: 5px; vertical-align: middle;">
                                    <a style="text-decoration: none; color: #333;" href="<?php echo esc_url($permalink); ?>">
                                        <span style="font-weight: bold;"><?php echo esc_html($user_name); ?></span>
                                    </a>
                                    <?php if(!empty($timestamp)): ?>
                                        <p style="font-family: Arial, sans-serif; font-size: 12px; font-weight: normal; margin: 0; margin-bottom: 0px;"><?php echo esc_html(sprintf(__('%s ago', 'fluent-community'), $timestamp)); ?></p>
                                    <?php endif; ?>
                                </td>
                            </tr>
                        </table>
                    </td>
                </tr>
                <tr>
                    <td style="padding: 0px 10px 10px; line-height: 1.4;font-family: Helvetica, sans-serif;">
                        <?php \FluentCommunity\App\Services\CustomSanitizer::sanitizeRichText($content, true); ?>
                    </td>
                </tr>
            </table>
        </td>
    </tr>
</table>
