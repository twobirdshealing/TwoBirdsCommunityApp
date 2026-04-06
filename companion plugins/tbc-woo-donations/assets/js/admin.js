/**
 * TBC WooCommerce Donations — Admin Script
 *
 * Simple list-based suggested amounts manager + deposit field toggle.
 *
 * @package TBC\WooDonations
 */
(function ($) {
	'use strict';

	const params = window.TBC_DON_ADMIN || {};

	// =========================================================================
	// Suggested Amounts — Simple List
	// =========================================================================
	const Amounts = {

		init() {
			this.$list = $('#tbc_don_amounts_list');
			this.$data = $('#tbc_don_suggested_amounts_data');
			this.$input = $('#tbc_don_add_amount_input');
			this.$customEnabled = $('#tbc_don_custom_enabled');
			this.$toggle = $('.tbc_don_use_suggested_amounts');

			if (!this.$list.length) return;

			// Preserve custom button label from saved data.
			this._customLabel = 'Custom Amount';
			try {
				const existing = JSON.parse(this.$data.val() || '[]');
				const cb = existing.find(a => a.type === 'custom_button');
				if (cb && cb.label) this._customLabel = cb.label;
			} catch (e) { /* ignore */ }

			this.setup_sortable();
			this.bind_events();
		},

		setup_sortable() {
			this.$list.sortable({
				handle: '.tbc-don-drag',
				cursor: 'move',
				axis: 'y',
				placeholder: 'tbc-don-sort-placeholder',
				update: () => this.sync(),
			});
		},

		bind_events() {
			// Add amount — Enter key.
			this.$input.on('keypress', (e) => {
				if (e.which === 13) {
					e.preventDefault();
					this.add();
				}
			});

			// Add amount — button click.
			$('.tbc-don-add-amount').on('click', () => this.add());

			// Remove amount.
			this.$list.on('click', '.tbc-don-remove-amount', (e) => {
				if (confirm(params.i18n_remove_amount || 'Remove this amount?')) {
					$(e.target).closest('li').remove();
					this.sync();
				}
			});

			// Default radio change.
			this.$list.on('change', 'input[type="radio"]', () => this.sync());

			// Label edits.
			this.$list.on('change', '.tbc-don-amount-label', () => this.sync());

			// Custom button toggle.
			this.$customEnabled.on('change', () => this.sync());

			// Show/hide amounts section.
			this.$toggle.on('change', () => {
				$('.tbc-don-amounts-ui').toggleClass('hidden', !this.$toggle.is(':checked'));
			});
		},

		add() {
			const raw = this.$input.val().trim();
			if (!raw) return;

			const amount = parseFloat(raw.replace(/[^0-9.]/g, ''));
			if (isNaN(amount) || amount <= 0) return;

			const formatted = accounting.formatMoney(
				amount,
				params.currency_format_symbol || '$',
				params.currency_format_num_decimals || 2,
				params.currency_format_thousand_sep || ',',
				params.currency_format_decimal_sep || '.'
			);

			// Check for duplicates.
			let exists = false;
			this.$list.find('li').each(function () {
				if (parseFloat($(this).data('amount')) === amount) {
					exists = true;
					return false;
				}
			});
			if (exists) {
				this.$input.val('');
				return;
			}

			const $li = $(`
				<li data-amount="${amount}" data-label="">
					<span class="dashicons dashicons-menu tbc-don-drag"></span>
					<strong>${formatted}</strong>
					<input type="text" class="tbc-don-amount-label" value="" placeholder="Label (optional)" />
					<label class="tbc-don-default-label">
						<input type="radio" name="tbc_don_default_amount" value="${amount}" />
						Default
					</label>
					<button type="button" class="tbc-don-remove-amount" title="Remove">&times;</button>
				</li>
			`);

			this.$list.append($li);
			this.$input.val('');
			this.sync();
		},

		sync() {
			const amounts = [];
			const defaultVal = this.$list.find('input[type="radio"]:checked').val() || '';

			this.$list.find('li').each(function () {
				const amt = $(this).data('amount');
				const label = $(this).find('.tbc-don-amount-label').val() || '';
				amounts.push({
					amount: amt,
					label: label,
					default: String(amt) === defaultVal ? 'yes' : 'no',
				});
			});

			// Custom button — preserve saved label.
			amounts.push({
				type: 'custom_button',
				amount: 'custom',
				label: this._customLabel,
				enabled: this.$customEnabled.is(':checked'),
				default: 'no',
			});

			// Ensure one default.
			if (!amounts.some(a => a.default === 'yes') && amounts.length > 0) {
				amounts[0].default = 'yes';
			}

			this.$data.val(JSON.stringify(amounts));
		},
	};

	// =========================================================================
	// Deposit Fields Toggle
	// =========================================================================
	function initDepositToggle() {
		const $enable = $('#_tbc_don_deposit_enabled');
		if (!$enable.length) return;

		function toggle() {
			const show = $enable.is(':checked');
			$('#_tbc_don_deposit_amount, #_tbc_don_cancellation_policy')
				.closest('.form-field')
				.toggle(show);
		}

		$enable.on('change', toggle);
		toggle();
	}

	// =========================================================================
	// Name Your Price toggle — show/hide pricing fields
	// =========================================================================
	function initNypToggle() {
		const $checkbox = $('#_tbc_don_enabled');
		if (!$checkbox.length) return;

		function toggle() {
			const show = $checkbox.is(':checked');
			$('#_tbc_don_suggested_price, #_tbc_don_min_price, #_tbc_don_hide_minimum, #_tbc_don_max_price')
				.closest('.form-field')
				.toggle(show);
		}

		$checkbox.on('change', toggle);
		toggle();
	}

	// =========================================================================
	// Init
	// =========================================================================
	$(function () {
		Amounts.init();
		initDepositToggle();
		initNypToggle();
	});

})(jQuery);
