<?php
/**
 * Navigation Component — Tabs and date range selection
 */

function tbc_nm_render_navigation($active_tab = 'dashboard') {
    $range = tbc_nm_get_request_date_range();
    $from_date = $range['from'];
    $to_date = $range['to'];

    ?>
    <div class="tbc-navigation-wrapper">
        <div class="tbc-tabs">
            <button class="tab-button <?php echo $active_tab === 'dashboard' ? 'active' : ''; ?>"
                    data-tab="dashboard">Dashboard</button>
            <button class="tab-button <?php echo $active_tab === 'members' ? 'active' : ''; ?>"
                    data-tab="members">New Members</button>
        </div>

        <div class="quick-ranges">
            <?php
            $ranges = tbc_nm_get_quick_date_ranges();
            foreach ($ranges as $key => $r):
                $is_active = $r['from'] === $from_date && $r['to'] === $to_date;
                $is_custom = empty($r['from']) && empty($r['to']);
            ?>
                <button type="button"
                        class="quick-range-btn <?php echo $is_custom ? 'custom' : ''; ?> <?php echo $is_active ? 'active' : ''; ?>"
                        data-from="<?php echo esc_attr($r['from']); ?>"
                        data-to="<?php echo esc_attr($r['to']); ?>">
                    <?php echo esc_html($r['label']); ?>
                </button>
            <?php endforeach; ?>
        </div>

        <div class="date-range-panel">
            <form class="date-range-form">
                <div class="date-inputs">
                    <div class="input-group">
                        <label for="from_date">From:</label>
                        <input type="date" id="from_date" name="from_date"
                               value="<?php echo esc_attr($from_date); ?>" required>
                    </div>
                    <div class="input-group">
                        <label for="to_date">To:</label>
                        <input type="date" id="to_date" name="to_date"
                               value="<?php echo esc_attr($to_date); ?>" required>
                    </div>
                </div>
                <button type="submit" class="btn-primary">Update Range</button>
            </form>
        </div>
    </div>
    <?php
}
