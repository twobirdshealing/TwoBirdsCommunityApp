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
    private array $form_instance_cache = [];

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

    public function __construct(?int $step = null) {
        $this->user_id = get_current_user_id();
        $this->cart_categories = self::$cached_cart_categories ?? self::get_cart_categories();
        $this->steps = $this->build_steps();
        $raw_step = $step ?? (isset($_GET['step']) ? (int) $_GET['step'] : $this->get_first_incomplete_step());
        $this->current_step = max(1, min($raw_step, count($this->steps)));
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
                    <?php $this->render_step_header(); ?>
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
                        <?php if ($is_checkout) : ?>
                            <ion-icon name="cart-outline"></ion-icon>
                        <?php else : ?>
                            <?php echo esc_html($num); ?>
                        <?php endif; ?>
                    </div>
                    <div class="tbc-cp-indicator-info">
                        <div class="tbc-cp-indicator-title"><?php echo esc_html($step['title']); ?></div>
                        <div class="tbc-cp-indicator-status">
                            <?php
                            $step_form_status = ($step['type'] === 'form') ? $this->get_cached_form_status($step) : null;
                            ?>
                            <?php if ($is_complete) : ?>
                                <span class="tbc-cp-status-complete"><ion-icon name="checkmark-circle"></ion-icon> <?php esc_html_e('Step Completed', 'tbc-checkout-prerequisites'); ?></span>
                            <?php elseif ($step_form_status && !empty($step_form_status['spirit_pharmacist_required'])) : ?>
                                <span class="tbc-cp-status-spirit-pharmacist"><ion-icon name="medkit-outline"></ion-icon> <?php esc_html_e('Pharmacist Consult', 'tbc-checkout-prerequisites'); ?></span>
                            <?php elseif ($step_form_status && !empty($step_form_status['phone_screening_required'])) : ?>
                                <span class="tbc-cp-status-phone-screening"><ion-icon name="call-outline"></ion-icon> <?php esc_html_e('New Member', 'tbc-checkout-prerequisites'); ?></span>
                            <?php elseif ($step_form_status && !empty($step_form_status['pending_approval'])) : ?>
                                <span class="tbc-cp-status-pending"><ion-icon name="hourglass-outline"></ion-icon> <?php esc_html_e('Awaiting Review', 'tbc-checkout-prerequisites'); ?></span>
                            <?php else : ?>
                                <span class="tbc-cp-status-incomplete"><ion-icon name="ellipse-outline"></ion-icon> <?php esc_html_e('Step Incomplete', 'tbc-checkout-prerequisites'); ?></span>
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
        $current_step_data = $this->steps[$this->current_step - 1];
        $current_submitted = $this->is_step_submitted($current_step_data);

        $next_is_checkout = $next && !empty($this->steps[$next - 1]['is_checkout']);
        $can_proceed = false;

        if ($next && $next_is_checkout) {
            $can_proceed = $this->all_prerequisites_complete();
        } elseif ($next) {
            $can_proceed = $current_submitted;
        }
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
                <?php if ($next && $can_proceed) : ?>
                    <a href="?step=<?php echo esc_attr($next); ?>" class="tbc-cp-nav-btn tbc-cp-nav-next">
                        <?php echo $next_is_checkout
                            ? esc_html__('Proceed to Donate', 'tbc-checkout-prerequisites')
                            : esc_html__('Next Step', 'tbc-checkout-prerequisites');
                        ?> →
                    </a>
                <?php endif; ?>
            </div>
        </div>
        <?php
    }

    private function all_prerequisites_complete(): bool {
        foreach ($this->steps as $step) {
            if (!empty($step['is_checkout'])) {
                continue;
            }
            if (!$this->is_step_complete($step)) {
                return false;
            }
        }
        return true;
    }

    private function render_step_header(): void {
        $current_data = $this->steps[$this->current_step - 1] ?? null;
        if ($current_data) : ?>
            <div class="tbc-cp-step-header">
                <h3 class="tbc-cp-step-title"><?php echo esc_html($current_data['title']); ?></h3>
                <?php if (!empty($current_data['description'])) : ?>
                    <p class="tbc-cp-step-desc"><?php echo esc_html($current_data['description']); ?></p>
                <?php endif; ?>
            </div>
        <?php endif;
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
                echo $this->get_form_instance($step)->render_form();
                break;
                
            case 'checkout':
                break;
        }
    }

    private function get_first_incomplete_step(): int {
        $first_unsubmitted = null;
        $first_unapproved = null;

        foreach ($this->steps as $index => $step) {
            if (!empty($step['is_checkout'])) {
                if ($this->all_prerequisites_complete()) {
                    return $index + 1;
                }
                break;
            }
            if ($first_unsubmitted === null && !$this->is_step_submitted($step)) {
                $first_unsubmitted = $index + 1;
            }
            if ($first_unapproved === null && !$this->is_step_complete($step)) {
                $first_unapproved = $index + 1;
            }
        }

        return $first_unsubmitted ?? $first_unapproved ?? 1;
    }

    private function get_step_cache_key(array $step): string {
        return ($step['id'] ?? '') ?: ($step['type'] . '_' . ($step['course_id'] ?? $step['form_id'] ?? ''));
    }

    private function get_form_instance(array $step): TBC_CP_Form_Status {
        $cache_key = $this->get_step_cache_key($step);
        if (!isset($this->form_instance_cache[$cache_key])) {
            $this->form_instance_cache[$cache_key] = new TBC_CP_Form_Status($this->user_id, $step['form_id'], $step);
        }
        return $this->form_instance_cache[$cache_key];
    }

    private function get_cached_form_status(array $step): array {
        $cache_key = $this->get_step_cache_key($step);
        if (!isset($this->form_status_cache[$cache_key])) {
            $this->form_status_cache[$cache_key] = $this->get_form_instance($step)->get_form_status();
        }
        return $this->form_status_cache[$cache_key];
    }

    private function is_step_complete(array $step): bool {
        if (!empty($step['is_checkout'])) {
            return false;
        }

        $cache_key = $this->get_step_cache_key($step);
        if (isset($this->completion_cache[$cache_key])) {
            return $this->completion_cache[$cache_key];
        }

        $complete = false;

        if ($step['type'] === 'course') {
            $complete = TBC_CP_Course_Status::is_fluent_community_active()
                ? \FluentCommunity\Modules\Course\Services\CourseHelper::getCourseProgress($step['course_id'], $this->user_id) >= 100
                : false;
        } elseif ($step['type'] === 'form') {
            $status = $this->get_cached_form_status($step);
            $complete = $status['completed'];
        }

        $this->completion_cache[$cache_key] = $complete;
        return $complete;
    }

    private function is_step_submitted(array $step): bool {
        if (!empty($step['is_checkout'])) {
            return false;
        }

        if ($this->is_step_complete($step)) {
            return true;
        }

        if ($step['type'] === 'form') {
            $status = $this->get_cached_form_status($step);
            return $status['has_entry'] && !$status['expired'] && !$status['form_changed'];
        }

        return false;
    }

    /**
     * Render individual parts for AJAX step navigation.
     */
    public function render_step_parts(): array {
        $total = count($this->steps);

        ob_start();
        $this->render_step_header();
        $this->render_step_content();
        $body_html = ob_get_clean();

        ob_start();
        $this->render_progress();
        $progress_html = ob_get_clean();

        ob_start();
        $this->render_nav();
        $nav_html = ob_get_clean();

        return [
            'body'     => $body_html,
            'progress' => $progress_html,
            'nav'      => $nav_html,
            'step'     => $this->current_step,
            'total'    => $total,
            'step_count_label' => sprintf(__('Step %d of %d', 'tbc-checkout-prerequisites'), $this->current_step, $total),
        ];
    }

    private function get_step_classes(int $num, array $step): string {
        $classes = [];

        if ($this->is_step_complete($step)) {
            $classes[] = 'completed';
        } elseif ($this->is_step_submitted($step)) {
            $classes[] = 'submitted';
        }

        if ($num === $this->current_step) {
            $classes[] = 'current';
        }

        if ($step['type'] === 'form') {
            $classes[] = 'tbc-cp-form-step';
        }

        if (!empty($step['is_checkout'])) {
            $classes[] = 'tbc-cp-checkout-step';
        }

        return implode(' ', $classes);
    }
}