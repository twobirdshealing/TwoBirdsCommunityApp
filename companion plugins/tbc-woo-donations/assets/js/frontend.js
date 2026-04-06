/**
 * TBC WooCommerce Donations — Frontend Script
 *
 * Handles: price input, fee calculator, give extra toggle,
 * suggested amounts, one-time donation, cancellation policy popup.
 *
 * Vanilla JS — no jQuery dependency.
 *
 * @package TBC\WooDonations
 */
(function () {
	'use strict';

	const params = window.tbc_don_params || {};
	const FEE_RATE = parseFloat(params.fee_recovery_rate) || 0.035;

	// =========================================================================
	// Utility: Format a number as a currency string
	// =========================================================================
	function formatPrice(price) {
		const decimals = parseInt(params.currency_format_num_decimals, 10) || 2;
		const decSep = params.currency_format_decimal_sep || '.';
		const thousandSep = params.currency_format_thousand_sep || ',';
		const symbol = params.currency_format_symbol || '$';
		const position = params.currency_format_position || 'left';

		let formatted = price.toFixed(decimals);
		const parts = formatted.split('.');
		parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, thousandSep);
		if (decSep !== '.') {
			formatted = parts.join(decSep);
		} else {
			formatted = parts.join('.');
		}

		switch (position) {
			case 'left':        return symbol + formatted;
			case 'right':       return formatted + symbol;
			case 'left_space':  return symbol + ' ' + formatted;
			case 'right_space': return formatted + ' ' + symbol;
			default:            return symbol + formatted;
		}
	}

	// =========================================================================
	// Utility: Parse a price string to a float
	// =========================================================================
	function parsePrice(value) {
		if (typeof value === 'number') return value;
		value = String(value);
		const thousandSep = params.currency_format_thousand_sep || ',';
		const decSep = params.currency_format_decimal_sep || '.';
		value = value.replace(new RegExp('[^0-9\\' + decSep + '\\-]', 'g'), '');
		if (decSep !== '.') {
			value = value.replace(decSep, '.');
		}
		return parseFloat(value) || 0;
	}

	// =========================================================================
	// DONATION PRICE INPUT — format on blur, fire custom event on change
	// =========================================================================
	function initPriceInputs() {
		document.querySelectorAll('.tbc-don-input').forEach(input => {
			input.addEventListener('change', () => {
				const val = parsePrice(input.value);
				if (val > 0) {
					input.value = formatPrice(val);
				}
				document.dispatchEvent(new CustomEvent('tbc-don-price-changed', { detail: { input, price: val } }));
			});

			input.addEventListener('focus', () => {
				// Switch to raw number on focus for easier editing.
				const val = parsePrice(input.value);
				if (val > 0) {
					input.value = val.toFixed(parseInt(params.currency_format_num_decimals, 10) || 2);
				}
			});
		});
	}

	// =========================================================================
	// SUGGESTED AMOUNTS — radio button selection updates price input
	// =========================================================================
	function initSuggestedAmounts() {
		const decimals = parseInt(params.currency_format_num_decimals, 10) || 2;
		const symbol = params.currency_format_symbol || '$';

		document.querySelectorAll('.tbc-don-suggested-amounts').forEach(fieldset => {
			const container = fieldset.closest('.tbc-don') || fieldset.closest('form') || document;
			const priceInput = container.querySelector('.tbc-don-input');
			const customLabel = fieldset.querySelector('input[value="custom"]')?.nextElementSibling;
			let customInlineInput = null;

			// Create the inline input inside the custom button label with currency prefix.
			if (customLabel) {
				const customWrap = document.createElement('span');
				customWrap.className = 'tbc-don-custom-wrap';
				customWrap.style.display = 'none';

				const symbolSpan = document.createElement('span');
				symbolSpan.className = 'tbc-don-custom-symbol';
				symbolSpan.textContent = symbol;

				customInlineInput = document.createElement('input');
				customInlineInput.type = 'text';
				customInlineInput.className = 'tbc-don-custom-input';
				customInlineInput.placeholder = '0.00';
				customInlineInput.inputMode = 'decimal';
				customInlineInput.pattern = '[0-9.]*';

				customWrap.appendChild(symbolSpan);
				customWrap.appendChild(customInlineInput);

				// Auto-size input to content width.
				function autoSize() {
					const len = customInlineInput.value.length || customInlineInput.placeholder.length || 3;
					customInlineInput.style.width = Math.max(3, len + 1) + 'ch';
				}

				// Sync typed value to the hidden form input.
				customInlineInput.addEventListener('input', () => {
					autoSize();
					const val = parseFloat(customInlineInput.value) || 0;
					if (priceInput) {
						priceInput.value = val.toFixed(decimals);
						priceInput.dispatchEvent(new Event('change'));
					}
				});

				// Prevent radio deselection when clicking inside the input.
				customWrap.addEventListener('click', (e) => e.stopPropagation());

				customLabel.querySelector('span')?.after(customWrap);
			}

			fieldset.addEventListener('change', (e) => {
				const radio = e.target;
				if (radio.type !== 'radio') return;

				const amount = radio.value;

				if (amount === 'custom') {
					// Show inline input inside the custom button.
					const customWrap = customLabel?.querySelector('.tbc-don-custom-wrap');
					if (customWrap) {
						customWrap.style.display = 'inline-flex';
						// Hide the label text.
						const labelSpan = customLabel?.querySelector('span:not(.tbc-don-custom-wrap):not(.tbc-don-custom-symbol)');
						if (labelSpan) labelSpan.style.display = 'none';
						customInlineInput?.focus();
					}
				} else {
					// Hide inline input, restore label text.
					const customWrap = customLabel?.querySelector('.tbc-don-custom-wrap');
					if (customWrap) {
						customWrap.style.display = 'none';
						const labelSpan = customLabel?.querySelector('span:not(.tbc-don-custom-wrap):not(.tbc-don-custom-symbol)');
						if (labelSpan) labelSpan.style.display = '';
					}
					// Set the hidden input value.
					if (priceInput) {
						priceInput.value = parseFloat(amount).toFixed(decimals);
						priceInput.dispatchEvent(new Event('change'));
					}
				}
			});

			// Set initial value from the default-checked radio.
			const defaultRadio = fieldset.querySelector('input[type="radio"]:checked');
			if (defaultRadio && priceInput && defaultRadio.value !== 'custom') {
				priceInput.value = parseFloat(defaultRadio.value).toFixed(decimals);
				priceInput.dispatchEvent(new Event('change'));
			}
		});
	}

	// =========================================================================
	// FEE RECOVERY — update fee display when price changes
	// =========================================================================
	function initFeeRecovery() {
		const container = document.querySelector('.tbc-don-fee-recovery');
		if (!container) return;

		const feeDisplay = container.querySelector('.tbc-don-fee-amount');
		if (!feeDisplay) return;

		const deposit = parseFloat(container.dataset.deposit) || 0;

		function updateFee() {
			const form = container.closest('form') || document;
			const priceInput = form.querySelector('.tbc-don-input');
			const qtyInput = form.querySelector('input.qty');

			let price = priceInput ? parsePrice(priceInput.value) : parseFloat(container.dataset.basePrice) || 0;
			const qty = qtyInput ? parseInt(qtyInput.value, 10) || 1 : 1;

			const fee = (price + deposit) * FEE_RATE * qty;
			feeDisplay.textContent = formatPrice(fee);
		}

		document.addEventListener('tbc-don-price-changed', updateFee);

		// Listen for quantity changes (input for spinners, change for manual entry).
		const form = container.closest('form');
		if (form) {
			form.addEventListener('input', (e) => {
				if (e.target.classList.contains('qty')) updateFee();
			});
			form.addEventListener('change', (e) => {
				if (e.target.classList.contains('qty')) updateFee();
			});
		}

		// Variation changes — WC fires found_variation as a jQuery event,
		// so we need jQuery to listen for it.
		if (window.jQuery) {
			jQuery('.variations_form').on('found_variation', function (e, variation) {
				if (variation && variation.display_price !== undefined) {
					container.dataset.basePrice = variation.display_price;
					updateFee();
				}
			});
		}

		// Initial calculation.
		updateFee();
	}

	// =========================================================================
	// GIVE EXTRA — toggle amount field visibility
	// =========================================================================
	function initGiveExtra() {
		const checkbox = document.getElementById('tbc_don_give_extra_checkbox');
		if (!checkbox) return;

		const inputSpan = document.querySelector('.tbc-don-give-extra-input');
		if (!inputSpan) return;

		checkbox.addEventListener('change', () => {
			inputSpan.style.display = checkbox.checked ? 'inline-flex' : 'none';
			if (checkbox.checked) {
				const input = document.getElementById('tbc_don_extra_amount');
				if (input) input.focus();
			}
		});
	}

	// =========================================================================
	// ONE-TIME DONATION — update price labels for one-time vs recurring
	// =========================================================================
	function initOneTime() {
		const container = document.querySelector('.tbc-don-frequency');
		if (!container) return;

		const oneTimePrice = container.querySelector('.tbc-don-one-time-price');
		const recurringPrice = container.querySelector('.tbc-don-recurring-price');

		if (!oneTimePrice || !recurringPrice) return;

		function updatePrices() {
			const form = container.closest('form') || document;
			const priceInput = form.querySelector('.tbc-don-input');
			const price = priceInput ? parsePrice(priceInput.value) : 0;

			oneTimePrice.textContent = price > 0 ? formatPrice(price) : '';
			recurringPrice.textContent = price > 0 ? formatPrice(price) : '';
		}

		document.addEventListener('tbc-don-price-changed', updatePrices);
		updatePrices();
	}

	// =========================================================================
	// CANCELLATION POLICY POPUP
	// =========================================================================
	function initPolicyPopup() {
		document.addEventListener('click', (e) => {
			const link = e.target.closest('.tbc-don-policy-link');
			if (!link) return;

			e.preventDefault();
			const policy = link.dataset.policy || '';
			if (policy) {
				alert(policy); // Simple alert — could be upgraded to a modal.
			}
		});
	}

	// =========================================================================
	// GUEST QUANTITY LABEL — updates "Please select # of Guests — $X.XX each"
	// =========================================================================
	function initGuestLabel() {
		const card = document.querySelector('.tbc-don-guest-card');
		if (!card) return;

		const label = card.querySelector('.tbc-don-guest-label');
		const priceSpan = card.querySelector('.tbc-don-guest-price');
		if (!label || !priceSpan) return;

		// Move the WC quantity selector inside our guest card.
		// WC may render .quantity after our hook, so observe for it.
		const form = card.closest('form') || document;
		const qtyDiv = form.querySelector('div.quantity');
		if (qtyDiv) {
			card.insertBefore(qtyDiv, label);
		} else {
			const observer = new MutationObserver(() => {
				const qty = form.querySelector('div.quantity');
				if (qty && !card.contains(qty)) {
					card.insertBefore(qty, label);
					observer.disconnect();
				}
			});
			observer.observe(form, { childList: true, subtree: true });
		}

		function update() {
			// Get current price from the donation input or the variation price.
			const form = label.closest('form') || document;
			const donInput = form.querySelector('.tbc-don-input');
			const variationPrice = form.querySelector('.woocommerce-variation-price .woocommerce-Price-amount');

			let price = 0;
			if (donInput) {
				price = parsePrice(donInput.value);
			} else if (variationPrice) {
				price = parsePrice(variationPrice.textContent);
			} else {
				const mainPrice = document.querySelector('.woocommerce-Price-amount');
				if (mainPrice) price = parsePrice(mainPrice.textContent);
			}

			priceSpan.textContent = price > 0 ? ' \u2014 ' + formatPrice(price) + ' each' : '';
		}

		// Listen for price changes from donation input.
		document.addEventListener('tbc-don-price-changed', update);

		// Listen for variation changes (jQuery event).
		if (window.jQuery) {
			jQuery('form.variations_form').on('found_variation', function (e, variation) {
				setTimeout(update, 50);
			});
		}

		// Listen for quantity changes.
		const qtyForm = card.closest('form');
		if (qtyForm) {
			qtyForm.addEventListener('input', (e) => {
				if (e.target.classList.contains('qty')) update();
			});
			qtyForm.addEventListener('change', (e) => {
				if (e.target.classList.contains('qty')) update();
			});
		}

		update();
	}

	// =========================================================================
	// INIT
	// =========================================================================
	function init() {
		initPriceInputs();
		initSuggestedAmounts();
		initFeeRecovery();
		initGiveExtra();
		initOneTime();
		initPolicyPopup();
		initGuestLabel();
	}

	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', init);
	} else {
		init();
	}
})();
