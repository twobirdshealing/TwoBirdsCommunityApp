/**
 * TBC WooCommerce Calendar - Recurring Dates Admin
 * 
 * @package TBC_WC_Calendar
 */
;(function($) {
  "use strict";

  $(function() {
    // Cache frequently used elements
    const $recurringType = $('#_tbc_wc_recurring_type');
    const $recurringFreq = $('#_tbc_wc_recurring_frequency');
    const $monthlyType = $('#_tbc_wc_recurring_monthly_type');
    const $endType = $('#_tbc_wc_recurring_end_type');

    // Initialize datepicker on element
    const initDatepicker = el => {
      $(el).datepicker({
        dateFormat: "yy-mm-dd",
        changeMonth: true,
        changeYear: true
      });
    };

    // Generic settings toggle handler for both RSVP and Progress
    const bindSettingsToggle = ($container, type) => {
      const isException = $container.closest('.tbc-wc-exception-settings-row').length > 0;
      
      // Radio button change handler  
      $container.find(`input[type="radio"][data-target="${type}"]`).off('change').on('change', function() {
        const $group = $(this).closest(`.tbc-wc-${type}-combined-group`);
        const mode = $(this).val();
        
        if (mode === 'custom') {
          $group.find(`.tbc-wc-${type}-option:not(.tbc-wc-${type}-toggle-options)`).show();
          
          // Special handling for progress goal type
          if (type === 'progress') {
            const showTimeframe = $group.find('.tbc-wc-progress-goal-type').val() === 'subscribers';
            $group.find('.tbc-wc-subscriber-timeframe-field').toggle(showTimeframe);
          }
          
          // Special handling for RSVP deadline type
          if (type === 'rsvp') {
            $group.find('.tbc-wc-rsvp-deadline-type').trigger('change.rsvpToggle');
          }
        } else {
          $group.find(`.tbc-wc-${type}-option:not(.tbc-wc-${type}-toggle-options)`).hide();
        }

        // Update hidden field
        $group.find(`.tbc-wc-${type}-mode-field`).val(mode);
      });

      // Type-specific handlers
      if (type === 'rsvp') {
        $container.find('.tbc-wc-rsvp-deadline-type')
          .off('change.rsvpToggle')
          .on('change.rsvpToggle', function() {
            const $group = $(this).closest('.tbc-wc-rsvp-combined-group');
            const isDate = $(this).val() === 'date';
            $group.find('.tbc-wc-rsvp-deadline-date-container').toggle(isDate);
            $group.find('.tbc-wc-rsvp-deadline-rule-container').toggle(!isDate);
          })
          .trigger('change.rsvpToggle');
      }

      if (type === 'progress') {
        $container.find('.tbc-wc-progress-goal-type')
          .off('change.goalTypeChange')
          .on('change.goalTypeChange', function() {
            const $group = $(this).closest('.tbc-wc-progress-combined-group');
            const isSubs = $(this).val() === 'subscribers';
            const mode = $group.find('.tbc-wc-progress-mode-field').val();
            
            if (mode === 'custom') {
              $group.find('.tbc-wc-subscriber-timeframe-field').toggle(isSubs);
            }
          });
      }

      // Initialize from saved value
      const savedMode = $container.find(`.tbc-wc-${type}-mode-field`).val() || 'global';
      $container.find(`input[type="radio"][data-target="${type}"][value="${savedMode}"]`)
        .prop('checked', true)
        .trigger('change');
    };

    // Toggle settings panel
    const toggleDateSettings = e => {
      e.preventDefault();
      const $btn = $(e.currentTarget);
      const rowId = $btn.closest('tr').attr('data-row-id');
      const $settings = $(`.tbc-wc-date-settings-row[data-row-id="${rowId}"]`);
      const expanded = $btn.attr('aria-expanded') === 'true';

      $btn.attr('aria-expanded', !expanded);
      if (expanded) {
        $settings.slideUp(200);
        $btn.removeClass('tbc-wc-settings-expanded');
      } else {
        $settings.slideDown(200);
        $btn.addClass('tbc-wc-settings-expanded');
        bindSettingsToggle($settings, 'rsvp');
        bindSettingsToggle($settings, 'progress');
      }
    };

    // Generate status group HTML
    const generateStatusGroup = (checkboxPrefix, index) => `
      <div class="tbc-wc-setting-group tbc-wc-status-combined-group">
        <span class="tbc-wc-setting-label">Status:</span>
        <div class="tbc-wc-status-option">
          <label class="tbc-wc-event-close-toggle">
            <input type="checkbox" name="${checkboxPrefix}_closed[]" value="${index}" />
            Close Event
          </label>
        </div>
        <div class="tbc-wc-status-option">
          <label class="tbc-wc-event-hide-toggle">
            <input type="checkbox" name="${checkboxPrefix}_hidden[]" value="${index}" />
            Hide Event
          </label>
        </div>
      </div>
    `;

    // Generate settings group HTML
    const generateSettingsGroup = (type, checkboxPrefix, rowId, index) => {
      const typeUpper = type.charAt(0).toUpperCase() + type.slice(1);
      const label = type === 'rsvp' ? 'RSVP Settings' : 'Donation Goal';
      
      let specificOptions = '';
      
      if (type === 'rsvp') {
        specificOptions = `
          <div class="tbc-wc-${type}-option" style="display:none;">
            <select name="${checkboxPrefix}_deadline_type[]" class="tbc-wc-${type}-deadline-type">
              <option value="date">Specific Date</option>
              <option value="rule">Time Before Event</option>
            </select>
          </div>
          <div class="tbc-wc-${type}-option tbc-wc-${type}-deadline-date-container" style="display:none;">
            <input type="text" class="tbc-wc-date-picker tbc-wc-${type}-deadline-date"
                   name="${checkboxPrefix}_${type}_deadline[]" placeholder="YYYY-MM-DD" />
          </div>
          <div class="tbc-wc-${type}-option tbc-wc-${type}-deadline-rule-container" style="display:none;">
            <select name="${checkboxPrefix}_deadline_rule[]" class="tbc-wc-${type}-deadline-rule">
              <option value="1_day">1 Day Before</option>
              <option value="3_days">3 Days Before</option>
              <option value="1_week">1 Week Before</option>
              <option value="2_weeks">2 Weeks Before</option>
              <option value="1_month">1 Month Before</option>
            </select>
          </div>
        `;
      } else {
        specificOptions = `
          <div class="tbc-wc-${type}-option" style="display:none;">
            <select name="${checkboxPrefix}_${type}_goal_type[]" class="tbc-wc-${type}-goal-type">
              <option value="revenue">Amount Raised</option>
              <option value="sales">Number of Donors</option>
              <option value="subscribers">Number of Subscribers</option>
            </select>
          </div>
          <div class="tbc-wc-${type}-option tbc-wc-subscriber-timeframe-field" style="display:none;">
            <select name="${checkboxPrefix}_subscriber_timeframe[]" class="tbc-wc-subscriber-timeframe">
              <option value="all_time">All Time</option>
              <option value="current_month">Current Month</option>
              <option value="current_year">Current Year</option>
              <option value="last_30_days">Last 30 Days</option>
              <option value="last_90_days">Last 90 Days</option>
            </select>
          </div>
          <div class="tbc-wc-${type}-option" style="display:none;">
            <label>Goal: <input type="number" name="${checkboxPrefix}_${type}_goal[]" value="0" min="0" step="1"></label>
          </div>
          <div class="tbc-wc-${type}-option" style="display:none;">
            <label>Threshold: <input type="number" name="${checkboxPrefix}_${type}_inventory_threshold[]" value="0" min="0" step="1"></label>
          </div>
          <div class="tbc-wc-${type}-option" style="display:none;">
            <label><input type="checkbox" name="${checkboxPrefix}_${type}_show_percentage[]" value="${index}" />Show %</label>
          </div>
          <div class="tbc-wc-${type}-option" style="display:none;">
            <label>BG: <input type="color" name="${checkboxPrefix}_${type}_background_color[]" value="#F0F0F0"></label>
            <label>Fill: <input type="color" name="${checkboxPrefix}_${type}_fill_color[]" value="#007CFF"></label>
            <label>Text: <input type="color" name="${checkboxPrefix}_${type}_text_color[]" value="#000000"></label>
          </div>
        `;
      }

      return `
        <div class="tbc-wc-setting-group tbc-wc-${type}-combined-group">
          <span class="tbc-wc-setting-label">${label}:</span>
          <div class="tbc-wc-${type}-option tbc-wc-${type}-toggle-options">
            <label><input type="radio" name="${checkboxPrefix}_${type}_toggle_mode_${rowId}" data-target="${type}" value="global" checked /> Use Global Settings</label>
            <label><input type="radio" name="${checkboxPrefix}_${type}_toggle_mode_${rowId}" data-target="${type}" value="custom" /> Custom Settings</label>
            <label><input type="radio" name="${checkboxPrefix}_${type}_toggle_mode_${rowId}" data-target="${type}" value="off" /> Off</label>
          </div>
          ${specificOptions}
          <input type="hidden" name="${checkboxPrefix}_${type}_mode[]" value="global" class="tbc-wc-${type}-mode-field" />
        </div>
      `;
    };

    // Generate actions group HTML
    const generateActionsGroup = (rowType, startDate) => `
      <div class="tbc-wc-setting-group">
        <span class="tbc-wc-setting-label">Actions:</span>
        <a href="/wp-admin/admin.php?page=wc-orders&event_date_filter=${startDate}&filter_action=Filter" class="tbc-wc-view-orders button">View Orders</a>
        <a href="#" class="tbc-wc-remove-${rowType}-date button">Remove</a>
      </div>
    `;

    // Generate complete row HTML with proper field names
    const generateRowHTML = ({ rowId, rowType, colSpan, checkboxPrefix, datePrefix }) => {
      const index = rowType === 'individual' ? 
        $('.tbc-wc-individual-date-row:not(.tbc-wc-main-date)').length : 
        $('.tbc-wc-exception-date-row').length;

      let dateRow = `
        <tr class="tbc-wc-date-row tbc-wc-${rowType}-date-row" data-row-id="${rowId}">
          <td class="tbc-wc-sort"><span class="dashicons dashicons-menu"></span></td>
          <td class="tbc-wc-date-field">`;
      
      if (rowType === 'individual') {
        dateRow += `<input type="text" class="tbc-wc-date-picker" name="${datePrefix}_start[]" />`;
      } else {
        dateRow += `<input type="text" class="tbc-wc-date-picker" name="${datePrefix}[]" />`;
      }
      
      dateRow += `</td>`;
      
      if (rowType === 'individual') {
        dateRow += `
          <td class="tbc-wc-end-date-field">
            <input type="text" class="tbc-wc-date-picker" name="${datePrefix}_end[]" />
          </td>`;
      }
      
      dateRow += `
          <td class="tbc-wc-sales-count">0</td>
          <td class="tbc-wc-settings-cell">
            <a href="#" class="tbc-wc-toggle-date-settings dashicons dashicons-admin-generic"
               aria-expanded="false" aria-controls="settings-${rowId}"></a>
          </td>
        </tr>`;

      // Settings row
      const settingsRow = `
        <tr id="settings-${rowId}" class="tbc-wc-date-settings-row tbc-wc-${rowType}-settings-row" data-row-id="${rowId}" style="display:none;">
          <td colspan="${colSpan}" class="tbc-wc-settings-panel">
            <div class="tbc-wc-date-settings-panel">
              ${generateStatusGroup(checkboxPrefix, index)}
              ${generateSettingsGroup('rsvp', checkboxPrefix, rowId, index)}
              ${generateSettingsGroup('progress', checkboxPrefix, rowId, index)}
              ${generateActionsGroup(rowType, '')}
            </div>
          </td>
        </tr>`;

      return { dateRow, settingsRow };
    };

    // Initialize widgets for a row
    const initRowWidgets = rowId => {
      const sel = `[data-row-id="${rowId}"]`;
      $(`.tbc-wc-date-row${sel} .tbc-wc-date-picker, .tbc-wc-date-settings-row${sel} .tbc-wc-date-picker`).each((_, el) => initDatepicker(el));
      bindSettingsToggle($(`.tbc-wc-date-settings-row${sel}`), 'rsvp');
      bindSettingsToggle($(`.tbc-wc-date-settings-row${sel}`), 'progress');

      // Update View Orders link on date change
      const updateOrdersLink = () => {
        const startDate = $(`.tbc-wc-date-row${sel} [name$="_start[]"], .tbc-wc-date-row${sel} [name$="[]"]`).val();
        if (startDate) {
          $(`.tbc-wc-date-settings-row${sel} .tbc-wc-view-orders`).attr(
            'href',
            `/wp-admin/admin.php?page=wc-orders&event_date_filter=${startDate}&filter_action=Filter`
          );
        }
      };
      
      $(`.tbc-wc-date-row${sel} [name$="_start[]"], .tbc-wc-date-row${sel} [name$="[]"]`).on('change', updateOrdersLink);
    };

    // Update checkbox indexes
    const updateCheckboxValues = rowType => {
      const selector = rowType === 'individual' ? 
        '.tbc-wc-individual-date-row:not(.tbc-wc-main-date)' : 
        '.tbc-wc-exception-date-row';
      
      $(selector).each(function(idx) {
        const id = $(this).data('row-id');
        const sel = `[data-row-id="${id}"]`;
        const prefix = rowType === 'individual' ? '_tbc_wc_individual_date' : '_tbc_wc_interval_exception';
        
        $(`.tbc-wc-date-settings-row${sel} input[name="${prefix}_closed[]"], input[name="${prefix}_hidden[]"], input[name="${prefix}_progress_show_percentage[]"]`).val(idx);
        $(`.tbc-wc-date-settings-row${sel} input[data-target="rsvp"], input[data-target="progress"]`).attr('data-index', idx);
      });
    };

    // Generic row adder
    const addDateRow = (config, tableSelector) => {
      const { dateRow, settingsRow } = generateRowHTML(config);
      $(`${tableSelector} tbody`).append(dateRow, settingsRow);
      initRowWidgets(config.rowId);
      updateCheckboxValues(config.rowType);
    };

    // Row adder functions
    const addIndividualDateRow = () => addDateRow({
      rowId: `individual-${Date.now()}`,
      rowType: 'individual',
      colSpan: 5,
      checkboxPrefix: '_tbc_wc_individual_date',
      datePrefix: '_tbc_wc_individual_dates'
    }, '#tbc-wc-individual-dates-table');

    const addExceptionRow = () => addDateRow({
      rowId: `exception-${Date.now()}`,
      rowType: 'exception',
      colSpan: 4,
      checkboxPrefix: '_tbc_wc_interval_exception',
      datePrefix: '_tbc_wc_interval_exception_dates'
    }, '#tbc-wc-interval-exceptions-table');

    // Initialize row IDs
    const initializeRowIds = () => {
      $('.tbc-wc-main-date, .tbc-wc-main-date-settings-row').attr('data-row-id', 'main-date');
      
      $('.tbc-wc-individual-date-row:not(.tbc-wc-main-date)').each((i, el) => {
        const id = `individual-${i + 1}`;
        $(el).attr('data-row-id', id);
        $(el).next('.tbc-wc-individual-settings-row').attr('data-row-id', id);
      });
      
      $('.tbc-wc-exception-date-row').each((i, el) => {
        const id = `exception-${i + 1}`;
        $(el).attr('data-row-id', id);
        $(el).next('.tbc-wc-exception-settings-row').attr('data-row-id', id);
      });
    };

    // Initialize everything
    initializeRowIds();

    $('.tbc-wc-individual-settings-row, .tbc-wc-exception-settings-row').each(function() {
      $(this).find('.tbc-wc-date-picker').each((_, el) => initDatepicker(el));
      bindSettingsToggle($(this), 'rsvp');
      bindSettingsToggle($(this), 'progress');
      
      const rowId = $(this).data('row-id');
      const startDate = $(`.tbc-wc-date-row[data-row-id="${rowId}"] [name$="_start[]"], .tbc-wc-date-row[data-row-id="${rowId}"] [name$="[]"]`).val();
      if (startDate) {
        $(this).find('.tbc-wc-view-orders').attr(
          'href',
          `/wp-admin/admin.php?page=wc-orders&event_date_filter=${startDate}&filter_action=Filter`
        );
      }
    });

    // Recurring type toggles
    $recurringType.on('change', function() {
      const t = $(this).val();
      $('#tbc-wc-interval-settings').toggle(t === 'interval');
      $('#tbc-wc-individual-dates-container').toggle(t === 'individual');
    });
    
    $recurringFreq.on('change', function() {
      const f = $(this).val();
      $('.tbc-wc-interval-options').hide();
      $(`#tbc-wc-${f}-options`).show();
      const units = { daily: 'day(s)', weekly: 'week(s)', monthly: 'month(s)', yearly: 'year(s)' };
      $('#tbc-wc-every-unit-label').text(units[f] || '');
    });
    
    $monthlyType.on('change', function() {
      const m = $(this).val();
      $('#tbc-wc-monthly-day,#tbc-wc-monthly-week').hide();
      $(`#tbc-wc-monthly-${m}`).show();
    });
    
    $endType.on('change', function() {
      const e = $(this).val();
      $('#tbc-wc-recurring-end-date,#tbc-wc-end-count').hide();
      if (e === 'date') $('#tbc-wc-recurring-end-date').show();
      else if (e === 'occurrences') $('#tbc-wc-end-count').show();
    });
    
    // Trigger initial display
    $recurringType.add($recurringFreq).add($monthlyType).add($endType).trigger('change');

    // Make rows sortable
    $('.tbc-wc-individual-dates').sortable({
      items: '.tbc-wc-individual-date-row:not(.tbc-wc-main-date)',
      handle: '.tbc-wc-sort',
      axis: 'y',
      helper: (e, ui) => {
        ui.children().each((_, c) => $(c).width($(c).width()));
        return ui;
      },
      stop: () => $('.tbc-wc-main-date').prependTo('.tbc-wc-individual-dates'),
      update: () => updateCheckboxValues('individual')
    });

    $('.tbc-wc-interval-exceptions').sortable({
      items: '.tbc-wc-exception-date-row',
      handle: '.tbc-wc-sort',
      axis: 'y',
      helper: (e, ui) => {
        ui.children().each((_, c) => $(c).width($(c).width()));
        return ui;
      },
      update: () => updateCheckboxValues('exception')
    });

    // Sync end date for single-day events
    $(document).on('change', '[name="_tbc_wc_individual_dates_start[]"]', function() {
      if ($('#_tbc_wc_single_day_event').is(':checked')) {
        $(this).closest('tr').find('[name="_tbc_wc_individual_dates_end[]"]').val($(this).val());
      }
    });

    // Event handlers
    $('#tbc-wc-individual-dates-table, #tbc-wc-interval-exceptions-table')
      .on('click', '.tbc-wc-toggle-date-settings', toggleDateSettings)
      .on('click', '.tbc-wc-remove-individual-date, .tbc-wc-remove-exception-date', function(e) {
        e.preventDefault();
        const $btn = $(this);
        const isIndividual = $btn.hasClass('tbc-wc-remove-individual-date');
        const id = $btn.closest('tr').data('row-id');
        const $dr = $(`.tbc-wc-date-row[data-row-id="${id}"]`);
        const $sr = $(`.tbc-wc-date-settings-row[data-row-id="${id}"]`);
        const sales = parseInt($dr.find('.tbc-wc-sales-count').text(), 10) || 0;
        
        if (sales > 0 && !confirm(`This ${isIndividual ? 'date' : 'exception'} has ${sales} donation(s). Remove anyway?`)) return;
        
        $dr.fadeOut(300, () => {
          $sr.fadeOut(300, () => {
            $dr.remove();
            $sr.remove();
            updateCheckboxValues(isIndividual ? 'individual' : 'exception');
          });
        });
      });

    // Add row buttons
    $('.tbc-wc-add-individual-date').on('click', e => { e.preventDefault(); addIndividualDateRow(); });
    $('.tbc-wc-add-exception-date').on('click', e => { e.preventDefault(); addExceptionRow(); });
  });

})(jQuery);