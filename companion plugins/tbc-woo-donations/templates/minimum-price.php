<?php
/**
 * Minimum Price Template
 *
 * Override by copying to yourtheme/woocommerce/minimum-price.php
 *
 * @package TBC\WooDonations\Templates
 * @version 1.0.0
 */

declare(strict_types=1);

use TBC\WooDonations\Helpers;

defined( 'ABSPATH' ) || exit;
?>
<p id="tbc-don-minimum-price-<?php echo esc_attr( $counter ); ?>" class="tbc-don-minimum-price tbc-don-terms">
	<?php echo wp_kses_post( Helpers::get_minimum_price_html( $product ) ); ?>
</p>
