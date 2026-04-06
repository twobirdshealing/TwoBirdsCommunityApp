/**
 * TBC WooCommerce Calendar - Google Maps Integration
 *
 * @package TBC_WC_Calendar
 */

async function initMap() {
    try {
        if (typeof google === 'undefined' || !google.maps) {
            console.warn('Google Maps API not yet loaded');
            return;
        }

        const [{ Map, InfoWindow }, { AdvancedMarkerElement }, { Place }] =
            await Promise.all([
                google.maps.importLibrary("maps"),
                google.maps.importLibrary("marker"),
                google.maps.importLibrary("places")
            ]);

        const mapElements = document.querySelectorAll('.tbc-wc-google-map');
        if (!mapElements.length) return;

        for (const element of mapElements) {
            if (element.dataset.initialized) continue;
            element.dataset.initialized = 'true';

            const { business, address } = JSON.parse(element.dataset.mapInfo);
            if (!business && !address) continue;

            try {
                const map = new Map(element, {
                    zoom: 16,
                    center: { lat: 0, lng: 0 },
                    mapId: 'DEMO_MAP_ID',
                    mapTypeControl: false,
                    streetViewControl: false,
                    fullscreenControl: false,
                });

                const query = `${business} ${address}`.trim();
                if (!query) continue;

                const request = {
                    textQuery: query,
                    fields: ['id', 'displayName', 'formattedAddress', 'location'],
                };

                const { places } = await Place.searchByText(request);
                if (!places || !places.length) continue;

                const found = places[0];
                const location = found.location;

                map.setCenter(location);

                const marker = new AdvancedMarkerElement({
                    map,
                    position: location,
                    title: business || found.displayName || 'Location',
                });

                const infoWindow = new InfoWindow({
                    content: `
                        <strong>${business || found.displayName || 'Location'}</strong><br>
                        ${found.formattedAddress || ''}<br>
                        <a href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}" target="_blank">
                            View on Google Maps
                        </a>
                    `
                });

                infoWindow.open(map, marker);
            } catch (error) {
                console.error('Map initialization failed:', error);
            }
        }
    } catch (error) {
        console.error('Google Maps failed to load:', error);
    }
}

document.body.addEventListener('click', function(e) {
    const btn = e.target.closest('.tbc-wc-map-toggle-btn');
    if (!btn) return;

    const locationDiv = btn.closest('.tbc-wc-event-details-location');
    if (!locationDiv) return;

    const mapContainer = locationDiv.parentElement.querySelector('.tbc-wc-map-container');
    if (!mapContainer) return;

    const icon = btn.querySelector('.tbc-wc-toggle-icon');
    const isVisible = mapContainer.classList.toggle('show');

    icon.textContent = isVisible ? '\u2212' : '+';
    btn.setAttribute('aria-expanded', isVisible);

    if (isVisible) initMap();
});
