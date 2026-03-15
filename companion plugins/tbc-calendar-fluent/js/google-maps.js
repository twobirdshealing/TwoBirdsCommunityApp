/**
 * TBC WooCommerce Calendar - Google Maps Integration
 * 
 * @package TBC_WC_Calendar
 */
let map;

async function initMap() {
    try {
        const [{ Map, InfoWindow }, { AdvancedMarkerElement }, { Place }] =
            await Promise.all([
                google.maps.importLibrary("maps"),
                google.maps.importLibrary("marker"),
                google.maps.importLibrary("places")
            ]);

        const mapElements = document.querySelectorAll('.tbc-wc-google-map');
        if (!mapElements.length) return;

        for (const element of mapElements) {
            const { business, address } = JSON.parse(element.dataset.mapInfo);
            if (!business && !address) continue;

            try {
                // Create map with default center
                map = new Map(element, {
                    zoom: 16,
                    center: { lat: 0, lng: 0 },
                    mapId: 'DEMO_MAP_ID',
                    mapTypeControl: false,
                    streetViewControl: false,
                    fullscreenControl: false,
                });

                // New API: Use Place class instead of PlacesService
                const query = `${business} ${address}`.trim();
                if (!query) continue;

                const place = new Place({
                    id: query,
                    requestedLanguage: "en"
                });

                // Use Text Search with new Places API
                const request = {
                    textQuery: query,
                    fields: ['id', 'displayName', 'formattedAddress', 'location'],
                };

                const { places } = await Place.searchByText(request);
                if (!places || !places.length) continue;

                const found = places[0];
                const location = found.location;

                // Center map and add marker
                map.setCenter(location);

                const marker = new AdvancedMarkerElement({
                    map,
                    position: location,
                    title: business || found.displayName || 'Location',
                });

                // Add info window
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

function setupMapToggle() {
    document.querySelectorAll('.tbc-wc-map-toggle-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const mapContainer = this.closest('.tbc-wc-event-details-location').nextElementSibling;
            const icon = this.querySelector('.tbc-wc-toggle-icon');
            const isVisible = mapContainer.classList.toggle('show');

            icon.textContent = isVisible ? '−' : '+';
            this.setAttribute('aria-expanded', isVisible);

            if (isVisible) initMap();
        });
    });
}

document.addEventListener('DOMContentLoaded', setupMapToggle);
window.initMap = initMap;