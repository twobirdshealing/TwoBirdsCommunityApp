<?php
/**
 * Frontend dashboard for Checkout Prerequisites
 */
class TBC_CP_Dashboard {
    
    private static ?array $cached_cart_categories = null;

    private int $user_id;
    private array $steps;
    private int $current_step;
    private array $cart_categories = [];
    private array $completion_cache = [];
    private array $form_status_cache = [];

    public static function init(): void {
        add_action('woocommerce_before_checkout_form', [__CLASS__, 'render_checkout_prerequisites'], 10);
    }

    public static function render_checkout_prerequisites(): void {
        if (!self::should_display()) {
            return;
        }

        $dashboard = new self();

        if ($dashboard->current_step !== count($dashboard->steps)) {
            echo '<style>
                form.checkout.woocommerce-checkout,
                .wp-block-woocommerce-checkout.wc-block-checkout,
                .gamipress-wc-partial-payments-form-toggle {
                    display: none;
                }
            </style>';
        }

        echo $dashboard->render();
    }

    private static function should_display(): bool {
        if (!function_exists('WC') || !WC()->cart) {
            return false;
        }

        self::$cached_cart_categories = self::get_cart_categories();
        $steps = tbc_cp_get_steps();

        foreach ($steps as $step) {
            if (empty($step['categories']) || array_intersect($step['categories'], self::$cached_cart_categories)) {
                return true;
            }
        }

        return false;
    }

    private static function get_cart_categories(): array {
        $categories = [];
        
        foreach (WC()->cart->get_cart() as $item) {
            $product = $item['data'];
            $product_id = $product->is_type('variation') ? $product->get_parent_id() : $product->get_id();
            $terms = get_the_terms($product_id, 'product_cat');
            
            if ($terms && !is_wp_error($terms)) {
                $categories = array_merge($categories, wp_list_pluck($terms, 'term_id'));
            }
        }
        
        return array_unique($categories);
    }

    public function __construct() {
        $this->user_id = get_current_user_id();
        $this->cart_categories = self::$cached_cart_categories ?? self::get_cart_categories();
        $this->steps = $this->build_steps();
        $this->current_step = isset($_GET['step']) ? (int) $_GET['step'] : $this->get_first_incomplete_step();
    }

    private function build_steps(): array {
        $saved_steps = tbc_cp_get_steps();
        $visible = [];
        
        foreach ($saved_steps as $step) {
            if (empty($step['categories']) || array_intersect($step['categories'], $this->cart_categories)) {
                $visible[] = $step;
            }
        }

        $visible[] = [
            'title' => __('Donate', 'tbc-checkout-prerequisites'),
            'description' => __('Complete your donation', 'tbc-checkout-prerequisites'),
            'type' => 'checkout',
            'is_checkout' => true,
        ];

        return $visible;
    }

    public function render(): string {
        if (!$this->user_id) {
            return '<p>' . esc_html__('Please login to view your progress.', 'tbc-checkout-prerequisites') . '</p>';
        }

        if (empty($this->steps)) {
            return '<p>' . esc_html__('No steps have been configured.', 'tbc-checkout-prerequisites') . '</p>';
        }

        $total = count($this->steps);
        $current_data = $this->steps[$this->current_step - 1] ?? null;

        ob_start();
        ?>
        <div class="tbc-cp-checkout">
            <div class="tbc-cp-header">
                <div class="tbc-cp-header-static">
                    <h2 class="tbc-cp-title"><?php esc_html_e('Donation Checkout', 'tbc-checkout-prerequisites'); ?></h2>
                    <div class="tbc-cp-stats">
                        <div class="tbc-cp-step-count">
                            <?php echo esc_html(sprintf(__('Step %d of %d', 'tbc-checkout-prerequisites'), $this->current_step, $total)); ?>
                        </div>
                    </div>
                </div>
                <?php $this->render_progress(); ?>
            </div>

            <?php $this->render_nav(); ?>

            <div class="tbc-cp-content">
                <div class="tbc-cp-body">
                    <?php if ($current_data) : ?>
                        <div class="tbc-cp-step-header">
                            <h3 class="tbc-cp-step-title"><?php echo esc_html($current_data['title']); ?></h3>
                            <?php if (!empty($current_data['description'])) : ?>
                                <p class="tbc-cp-step-desc"><?php echo esc_html($current_data['description']); ?></p>
                            <?php endif; ?>
                        </div>
                    <?php endif; ?>
                    <?php $this->render_step_content(); ?>
                </div>
            </div>
        </div>
        <?php
        return ob_get_clean();
    }

    private function render_progress(): void {
        ?>
        <div class="tbc-cp-progress">
            <?php foreach ($this->steps as $index => $step) : ?>
                <?php
                $num = $index + 1;
                $class = $this->get_step_classes($num, $step);
                $is_checkout = !empty($step['is_checkout']);
                $is_complete = $this->is_step_complete($step);
                ?>
                <div class="tbc-cp-indicator <?php echo esc_attr($class); ?>" data-step="<?php echo esc_attr($num); ?>">
                    <div class="tbc-cp-indicator-num">
                        <?php if (!$is_checkout) : ?>
                            <?php echo esc_html($num); ?>
                        <?php endif; ?>
                    </div>
                    <div class="tbc-cp-indicator-info">
                        <div class="tbc-cp-indicator-title"><?php echo esc_html($step['title']); ?></div>
                        <div class="tbc-cp-indicator-status">
                            <?php
                            $form_cache_key = ($step['id'] ?? '') ?: ($step['type'] . '_' . ($step['course_id'] ?? $step['form_id'] ?? ''));
                            $step_form_status = $this->form_status_cache[$form_cache_key] ?? null;
                            ?>
                            <?php if ($is_complete) : ?>
                                <span class="tbc-cp-status-complete"><?php esc_html_e('Step Completed', 'tbc-checkout-prerequisites'); ?></span>
                            <?php elseif ($step_form_status && !empty($step_form_status['spirit_pharmacist_required'])) : ?>
                                <span class="tbc-cp-status-spirit-pharmacist"><?php esc_html_e('Pharmacist Consult', 'tbc-checkout-prerequisites'); ?></span>
                            <?php elseif ($step_form_status && !empty($step_form_status['phone_screening_required'])) : ?>
                                <span class="tbc-cp-status-phone-screening"><?php esc_html_e('New Member', 'tbc-checkout-prerequisites'); ?></span>
                            <?php elseif ($step_form_status && !empty($step_form_status['pending_approval'])) : ?>
                                <span class="tbc-cp-status-pending"><?php esc_html_e('Awaiting Review', 'tbc-checkout-prerequisites'); ?></span>
                            <?php else : ?>
                                <span class="tbc-cp-status-incomplete"><?php esc_html_e('Step Incomplete', 'tbc-checkout-prerequisites'); ?></span>
                            <?php endif; ?>
                        </div>
                    </div>
                </div>
            <?php endforeach; ?>
        </div>
        <?php
    }

    private function render_nav(): void {
        $prev = $this->current_step > 1 ? $this->current_step - 1 : null;
        $next = $this->current_step < count($this->steps) ? $this->current_step + 1 : null;
        $current_complete = $this->is_step_complete($this->steps[$this->current_step - 1]);
        ?>
        <div class="tbc-cp-nav">
            <div class="tbc-cp-nav-left">
                <?php if ($prev) : ?>
                    <a href="?step=<?php echo esc_attr($prev); ?>" class="tbc-cp-nav-btn tbc-cp-nav-prev">
                        ← <?php esc_html_e('Previous Step', 'tbc-checkout-prerequisites'); ?>
                    </a>
                <?php endif; ?>
            </div>
            <div class="tbc-cp-nav-right">
                <?php if ($next && $current_complete) : ?>
                    <a href="?step=<?php echo esc_attr($next); ?>" class="tbc-cp-nav-btn tbc-cp-nav-next">
                        <?php echo ($next === count($this->steps)) 
                            ? esc_html__('Proceed to Donate', 'tbc-checkout-prerequisites') 
                            : esc_html__('Next Step', 'tbc-checkout-prerequisites'); 
                        ?> →
                    </a>
                <?php endif; ?>
            </div>
        </div>
        <?php
    }

    private function render_step_content(): void {
        $step = $this->steps[$this->current_step - 1] ?? null;
        
        if (!$step) {
            return;
        }

        switch ($step['type']) {
            case 'course':
                $course = new TBC_CP_Course_Status($this->user_id, $step['course_id']);
                echo $course->render_course();
                break;
                
            case 'form':
                if (!class_exists('GFAPI')) {
                    echo '<p>' . esc_html__('Gravity Forms is not active.', 'tbc-checkout-prerequisites') . '</p>';
                    return;
                }
                $form = new TBC_CP_Form_Status($this->user_id, $step['form_id'], $step);
                echo $form->render_form();
                break;
                
            case 'checkout':
                break;
        }
    }

    private function get_first_incomplete_step(): int {
        foreach ($this->steps as $index => $step) {
            if (!$this->is_step_complete($step)) {
                return $index + 1;
            }
        }
        return 1;
    }

    private function is_step_complete(array $step): bool {
        if (!empty($step['is_checkout'])) {
            return false;
        }

        $cache_key = ($step['id'] ?? '') ?: ($step['type'] . '_' . ($step['course_id'] ?? $step['form_id'] ?? ''));
        if (isset($this->completion_cache[$cache_key])) {
            return $this->completion_cache[$cache_key];
        }

        $complete = false;

        if ($step['type'] === 'course') {
            $complete = TBC_CP_Course_Status::is_fluent_community_active()
                ? \FluentCommunity\Modules\Course\Services\CourseHelper::getCourseProgress($step['course_id'], $this->user_id) >= 100
                : false;
        } elseif ($step['type'] === 'form') {
            $form = new TBC_CP_Form_Status($this->user_id, $step['form_id'], $step);
            $status = $form->get_form_status();
            $this->form_status_cache[$cache_key] = $status;
            $complete = $status['completed'] && !$status['expired'] && !$status['form_changed'];
        }

        $this->completion_cache[$cache_key] = $complete;
        return $complete;
    }

    private function get_step_classes(int $num, array $step): string {
        $classes = [];

        if ($this->is_step_complete($step)) {
            $classes[] = 'completed';
        }
        
        if ($num === $this->current_step) {
            $classes[] = 'current';
        }
        
        if (!empty($step['is_checkout'])) {
            $classes[] = 'tbc-cp-checkout-step';
        }

        return implode(' ', $classes);
    }
}