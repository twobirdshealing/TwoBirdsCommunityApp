<?php
/**
 * TBC WooCommerce Calendar - RSVP Functions
 * 
 * Handles RSVP deadline calculations, status checking, and date-specific settings.
 * 
 * @package TBC_WC_Calendar
 */

if (!defined('ABSPATH')) {
    exit;
}

/**
 * Calculate deadline date based on a rule
 * 
 * @param string $event_date Event date
 * @param string $rule Rule to apply (1_day, 3_days, 1_week, etc.)
 * @return string Calculated deadline date in YYYY-MM-DD format
 */
function tbc_wc_calculate_deadline_from_rule($event_date, $rule) {
    if (empty($event_date) || empty($rule)) {
        return '';
    }
    
    $timestamp = strtotime($event_date);
    
    switch ($rule) {
        case '1_day':
            return date('Y-m-d', strtotime('-1 day', $timestamp));
        case '3_days':
            return date('Y-m-d', strtotime('-3 days', $timestamp));
        case '1_week':
            return date('Y-m-d', strtotime('-1 week', $timestamp));
        case '2_weeks':
            return date('Y-m-d', strtotime('-2 weeks', $timestamp));
        case '1_month':
            return date('Y-m-d', strtotime('-1 month', $timestamp));
        default:
            return date('Y-m-d', strtotime('-1 week', $timestamp));
    }
}

/**
 * Check if RSVP deadline has passed for a specific event date
 * 
 * @param int $product_id Product ID
 * @param string $event_date Event date to check
 * @return bool True if deadline has passed
 */
function tbc_wc_is_rsvp_deadline_passed($product_id, $event_date) {
    $current_date = current_time('Y-m-d');
    
    $rsvp_enabled = tbc_wc_is_rsvp_enabled($product_id, $event_date);
    if (!$rsvp_enabled) {
        return false;
    }
    
    $date_settings = tbc_wc_get_rsvp_settings($product_id, $event_date);
    
    $deadline = '';
    if ($date_settings['deadline_type'] === 'date') {
        if (empty($date_settings['deadline'])) {
            return false;
        }
        $deadline = $date_settings['deadline'];
    } else {
        $deadline = tbc_wc_calculate_deadline_from_rule($event_date, $date_settings['deadline_rule']);
    }
    
    if (empty($deadline)) {
        return false;
    }
    
    return ($current_date > $deadline);
}

/**
 * Get date-specific RSVP settings
 * 
 * @param int $product_id Product ID
 * @param string $event_date Event date in Y-m-d format
 * @return array RSVP settings
 */
function tbc_wc_get_rsvp_settings($product_id, $event_date) {
    $settings = tbc_wc_get_event_settings($product_id);
    $rsvp = isset($settings['rsvp']) ? $settings['rsvp'] : [];
    
    $date_settings = [
        'deadline_type' => isset($rsvp['deadline_type']) ? $rsvp['deadline_type'] : 'date',
        'deadline' => isset($rsvp['deadline']) ? $rsvp['deadline'] : '',
        'deadline_rule' => isset($rsvp['deadline_rule']) ? $rsvp['deadline_rule'] : '1_week'
    ];
    
    if ($event_date === $settings['dates']['start_date']) {
        return $date_settings;
    }
    
    if (!empty($settings['recurring']['individual_dates'])) {
        foreach ($settings['recurring']['individual_dates'] as $date_pair) {
            if ($date_pair['start'] === $event_date) {
                if (isset($date_pair['rsvp_mode']) && $date_pair['rsvp_mode'] === 'custom') {
                    $date_settings = [
                        'deadline_type' => isset($date_pair['deadline_type']) ? $date_pair['deadline_type'] : 'date',
                        'deadline' => isset($date_pair['rsvp_deadline']) ? $date_pair['rsvp_deadline'] : $date_settings['deadline'],
                        'deadline_rule' => isset($date_pair['deadline_rule']) ? $date_pair['deadline_rule'] : $date_settings['deadline_rule']
                    ];
                }
                break;
            }
        }
    }
    
    if ($settings['recurring']['type'] === 'interval' && !empty($settings['recurring']['interval']['exceptions'])) {
        foreach ($settings['recurring']['interval']['exceptions'] as $exception) {
            if ($exception['date'] === $event_date) {
                if (isset($exception['rsvp_mode']) && $exception['rsvp_mode'] === 'custom') {
                    $date_settings = [
                        'deadline_type' => isset($exception['deadline_type']) ? $exception['deadline_type'] : 'date',
                        'deadline' => isset($exception['rsvp_deadline']) ? $exception['rsvp_deadline'] : $date_settings['deadline'],
                        'deadline_rule' => isset($exception['deadline_rule']) ? $exception['deadline_rule'] : $date_settings['deadline_rule']
                    ];
                }
                break;
            }
        }
    }
    
    return $date_settings;
}

/**
 * Check if RSVP is enabled for a specific event date
 * 
 * @param int $product_id Product ID
 * @param string $event_date Event date in Y-m-d format
 * @return bool True if RSVP is enabled
 */
function tbc_wc_is_rsvp_enabled($product_id, $event_date) {
    $settings = tbc_wc_get_event_settings($product_id);
    $rsvp = isset($settings['rsvp']) ? $settings['rsvp'] : [];
    
    if ($event_date === $settings['dates']['start_date']) {
        return isset($rsvp['enabled']) && $rsvp['enabled'];
    }
    
    if (!empty($settings['recurring']['individual_dates'])) {
        foreach ($settings['recurring']['individual_dates'] as $date_pair) {
            if ($date_pair['start'] === $event_date) {
                if (isset($date_pair['rsvp_mode'])) {
                    if ($date_pair['rsvp_mode'] === 'global') {
                        return isset($rsvp['enabled']) && $rsvp['enabled'];
                    } else if ($date_pair['rsvp_mode'] === 'custom') {
                        return true;
                    } else if ($date_pair['rsvp_mode'] === 'off') {
                        return false;
                    }
                }
                break;
            }
        }
    }
    
    if ($settings['recurring']['type'] === 'interval' && !empty($settings['recurring']['interval']['exceptions'])) {
        foreach ($settings['recurring']['interval']['exceptions'] as $exception) {
            if ($exception['date'] === $event_date) {
                if (isset($exception['rsvp_mode'])) {
                    if ($exception['rsvp_mode'] === 'global') {
                        return isset($rsvp['enabled']) && $rsvp['enabled'];
                    } else if ($exception['rsvp_mode'] === 'custom') {
                        return true;
                    } else if ($exception['rsvp_mode'] === 'off') {
                        return false;
                    }
                }
                break;
            }
        }
    }
    
    return isset($rsvp['enabled']) && $rsvp['enabled'];
}

/**
 * Get the number of days remaining until RSVP deadline
 * 
 * @param int $product_id Product ID
 * @param string $event_date Event date to check
 * @return int|null Number of days remaining or null if no deadline
 */
function tbc_wc_get_rsvp_days_remaining($product_id, $event_date) {
    if (!tbc_wc_is_rsvp_enabled($product_id, $event_date)) {
        return null;
    }
    
    $date_settings = tbc_wc_get_rsvp_settings($product_id, $event_date);
    
    $deadline = '';
    if ($date_settings['deadline_type'] === 'date') {
        $deadline = $date_settings['deadline'];
    } else {
        $deadline = tbc_wc_calculate_deadline_from_rule($event_date, $date_settings['deadline_rule']);
    }
    
    if (empty($deadline)) {
        return null;
    }
    
    $current_time = current_time('timestamp');
    $deadline_time = strtotime($deadline . ' 23:59:59');
    $days_remaining = floor(($deadline_time - $current_time) / (60 * 60 * 24));
    
    return max(0, $days_remaining);
}

/**
 * Get RSVP information for a specific event date
 * 
 * @param int $product_id Product ID
 * @param string $event_date Event date to check
 * @return array|null RSVP information or null if not enabled
 */
function tbc_wc_get_rsvp_information($product_id, $event_date = '') {
    $settings = tbc_wc_get_event_settings($product_id);
    $rsvp = isset($settings['rsvp']) ? $settings['rsvp'] : [];
    
    if (!tbc_wc_is_rsvp_enabled($product_id, $event_date)) {
        return null;
    }
    
    $date_settings = tbc_wc_get_rsvp_settings($product_id, $event_date);
    
    $deadline = '';
    if ($date_settings['deadline_type'] === 'date') {
        $deadline = $date_settings['deadline'];
    } else {
        $deadline = tbc_wc_calculate_deadline_from_rule($event_date, $date_settings['deadline_rule']);
    }
    
    if (empty($deadline)) {
        return null;
    }
    
    $days_remaining = tbc_wc_get_rsvp_days_remaining($product_id, $event_date);
    $deadline_passed = tbc_wc_is_rsvp_deadline_passed($product_id, $event_date);
    $show_countdown = isset($rsvp['show_countdown']) ? $rsvp['show_countdown'] : true;
    
    return [
        'deadline' => $deadline,
        'formatted_deadline' => date_i18n(get_option('date_format'), strtotime($deadline)),
        'days_remaining' => $days_remaining,
        'deadline_passed' => $deadline_passed,
        'show_countdown' => $show_countdown
    ];
}