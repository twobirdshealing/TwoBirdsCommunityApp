/**
 * TBC WooCommerce Donations — Donor Wall Script
 *
 * Renders donor cards and handles tab switching. Vanilla JS, no jQuery.
 *
 * @package TBC\WooDonations
 */
(function () {
	'use strict';

	const donorsData = window.tbcDonDonorsData;
	if (!donorsData) return;

	function renderDonors(monthKey) {
		const grid = document.querySelector('.tbc-don-donor-grid');
		if (!grid) return;

		grid.innerHTML = '';

		const donors = donorsData[monthKey];
		if (!donors || !donors.length) {
			grid.innerHTML = '<p>No donors for this month.</p>';
			return;
		}

		donors.forEach((donor) => {
			const card = document.createElement('div');
			card.className = 'tbc-don-donor-card';

			// Avatar (trusted WP HTML from get_avatar).
			const avatarDiv = document.createElement('div');
			avatarDiv.className = 'tbc-don-donor-avatar';
			avatarDiv.innerHTML = donor.avatar || '';
			card.appendChild(avatarDiv);

			const infoDiv = document.createElement('div');
			infoDiv.className = 'tbc-don-donor-info';

			// Name — use textContent to prevent XSS.
			if (donor.profile_link) {
				const nameLink = document.createElement('a');
				nameLink.className = 'tbc-don-donor-name';
				nameLink.href = donor.profile_link;
				nameLink.textContent = donor.name;
				infoDiv.appendChild(nameLink);
			} else {
				const nameSpan = document.createElement('span');
				nameSpan.className = 'tbc-don-donor-name';
				nameSpan.textContent = donor.name;
				infoDiv.appendChild(nameSpan);
			}

			// Badge.
			const badge = document.createElement('span');
			badge.className = (donor.is_subscription || donor.is_renewal)
				? 'tbc-don-badge tbc-don-badge--recurring'
				: 'tbc-don-badge tbc-don-badge--onetime';
			badge.textContent = (donor.is_subscription || donor.is_renewal) ? 'Recurring' : 'One-Time';
			infoDiv.appendChild(badge);

			// Date.
			const dateSpan = document.createElement('span');
			dateSpan.className = 'tbc-don-donor-date';
			dateSpan.textContent = donor.donation_date;
			infoDiv.appendChild(dateSpan);

			card.appendChild(infoDiv);
			grid.appendChild(card);
		});
	}

	function initTabs() {
		const tabs = document.querySelectorAll('.tbc-don-donor-tab');
		if (!tabs.length) return;

		tabs.forEach((tab) => {
			tab.addEventListener('click', () => {
				tabs.forEach((t) => t.classList.remove('active'));
				tab.classList.add('active');
				renderDonors(tab.dataset.key);
			});
		});

		// Render first tab.
		const firstKey = tabs[0]?.dataset.key;
		if (firstKey) renderDonors(firstKey);
	}

	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', initTabs);
	} else {
		initTabs();
	}
})();
