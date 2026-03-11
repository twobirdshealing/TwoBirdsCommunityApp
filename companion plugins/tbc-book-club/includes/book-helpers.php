<?php
/**
 * Book Club Helper Functions
 */

if (!defined('ABSPATH')) {
    exit;
}

function tbc_bc_get_chapter_summary($chapters) {
    if (empty($chapters) || !is_array($chapters)) {
        return '';
    }
    
    $chapter_types = array();
    
    foreach ($chapters as $chapter) {
        $label = isset($chapter['label']) ? trim($chapter['label']) : '';
        if (empty($label)) continue;
        
        $baseType = preg_match('/^(.*?)\s*\d+/', $label, $matches) 
            ? trim($matches[1]) 
            : $label;
        
        $chapter_types[$baseType] = ($chapter_types[$baseType] ?? 0) + 1;
    }
    
    $summary_parts = array();
    foreach ($chapter_types as $type => $count) {
        $summary_parts[] = $count . ' ' . $type;
    }
    
    return implode(' + ', $summary_parts);
}

function tbc_bc_format_duration($seconds) {
    if ($seconds < 1) {
        return 'N/A';
    }
    
    $hours = floor($seconds / 3600);
    $minutes = floor(($seconds % 3600) / 60);
    
    $parts = [];
    if ($hours > 0) {
        $parts[] = $hours . 'h';
    }
    if ($minutes > 0 || empty($parts)) {
        $parts[] = $minutes . 'm';
    }
    
    return implode(' ', $parts);
}

function tbc_bc_time_to_seconds($timeStr) {
    $parts = explode(':', $timeStr);
    $hours = (int)($parts[0] ?? 0);
    $minutes = (int)($parts[1] ?? 0);
    $seconds = (int)($parts[2] ?? 0);
    
    return ($hours * 3600) + ($minutes * 60) + $seconds;
}

function tbc_bc_seconds_to_time($seconds) {
    $hours = floor($seconds / 3600);
    $minutes = floor(($seconds % 3600) / 60);
    $secs = $seconds % 60;
    
    return sprintf('%02d:%02d:%02d', $hours, $minutes, $secs);
}

function tbc_bc_get_moderator_data($book) {
    if (empty($book->moderator_data)) {
        return null;
    }
    return json_decode($book->moderator_data, true);
}