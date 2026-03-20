<?php
/**
 * Deep Links - Serves .well-known files for Universal Links (iOS) and App Links (Android),
 * and injects Smart App Banner on the website.
 *
 * .well-known requests are intercepted early on the `init` hook and served as raw JSON.
 * This works on any web server (OpenLiteSpeed, nginx, Apache) without rewrite rules.
 * The REST API endpoints remain available as a fallback.
 */

if (!defined('ABSPATH')) {
    exit;
}

class TBC_CA_Deep_Links {

    private static $instance = null;

    public static function get_instance() {
        if (null === self::$instance) {
            self::$instance = new self();
        }
        return self::$instance;
    }

    private function __construct() {
        // Intercept .well-known requests early (works on any web server)
        add_action('init', [$this, 'intercept_well_known'], 1);

        // Also register as REST endpoints (fallback / direct access)
        add_action('rest_api_init', [$this, 'register_routes']);

        // Smart App Banner — use Fluent Community's portal_head (fires regardless of headless mode)
        // wp_head does NOT fire when Fluent Community renders in headless mode
        add_action('fluent_community/portal_head', [$this, 'render_smart_banner'], 1);
    }

    // =========================================================================
    // Early interception of .well-known requests
    // =========================================================================

    public function intercept_well_known() {
        $uri = isset($_SERVER['REQUEST_URI']) ? $_SERVER['REQUEST_URI'] : '';
        $path = parse_url($uri, PHP_URL_PATH);

        if ($path === '/.well-known/apple-app-site-association') {
            $this->serve_aasa_json();
        } elseif ($path === '/.well-known/assetlinks.json') {
            $this->serve_asset_links_json();
        }
    }

    /**
     * Serve AASA as raw JSON and exit
     */
    private function serve_aasa_json() {
        $result = $this->build_aasa_data();

        header('Content-Type: application/json');
        if ($result['error']) {
            status_header(503);
            echo json_encode(['error' => $result['error']]);
        } else {
            echo json_encode($result['data'], JSON_UNESCAPED_SLASHES);
        }
        exit;
    }

    /**
     * Serve Asset Links as raw JSON and exit
     */
    private function serve_asset_links_json() {
        $result = $this->build_asset_links_data();

        header('Content-Type: application/json');
        if ($result['error']) {
            status_header(503);
            echo json_encode(['error' => $result['error']]);
        } else {
            echo json_encode($result['data'], JSON_UNESCAPED_SLASHES);
        }
        exit;
    }

    // =========================================================================
    // REST Routes (fallback)
    // =========================================================================

    public function register_routes() {
        register_rest_route(TBC_CA_REST_NAMESPACE, '/.well-known/apple-app-site-association', [
            'methods'             => 'GET',
            'callback'            => [$this, 'get_aasa'],
            'permission_callback' => '__return_true',
        ]);

        register_rest_route(TBC_CA_REST_NAMESPACE, '/.well-known/assetlinks.json', [
            'methods'             => 'GET',
            'callback'            => [$this, 'get_asset_links'],
            'permission_callback' => '__return_true',
        ]);
    }

    public function get_aasa() {
        $result = $this->build_aasa_data();

        if ($result['error']) {
            return new WP_REST_Response(['error' => $result['error']], 503);
        }

        $response = new WP_REST_Response($result['data'], 200);
        $response->header('Content-Type', 'application/json');
        return $response;
    }

    public function get_asset_links() {
        $result = $this->build_asset_links_data();

        if ($result['error']) {
            return new WP_REST_Response(['error' => $result['error']], 503);
        }

        $response = new WP_REST_Response($result['data'], 200);
        $response->header('Content-Type', 'application/json');
        return $response;
    }

    // =========================================================================
    // Data Builders (shared by early-intercept and REST fallback)
    // =========================================================================

    /**
     * Build AASA payload for iOS Universal Links.
     * @return array{data: array|null, error: string|null}
     */
    private function build_aasa_data() {
        $settings  = TBC_CA_Core::get_settings();
        $team_id   = $settings['apple_team_id'] ?? '';
        $bundle_id = $settings['bundle_id'] ?? '';

        if (empty($team_id) || empty($bundle_id)) {
            return ['data' => null, 'error' => 'Apple Team ID or Bundle Identifier not configured'];
        }

        return [
            'error' => null,
            'data'  => [
                'applinks' => [
                    'apps'    => [],
                    'details' => [
                        [
                            'appID' => "{$team_id}.{$bundle_id}",
                            'paths' => $this->get_portal_paths(),
                        ],
                    ],
                ],
            ],
        ];
    }

    /**
     * Build Asset Links payload for Android App Links.
     * @return array{data: array|null, error: string|null}
     */
    private function build_asset_links_data() {
        $settings     = TBC_CA_Core::get_settings();
        $sha256       = $settings['android_sha256'] ?? '';
        $package_name = $settings['package_name'] ?? '';

        if (empty($sha256) || empty($package_name)) {
            return ['data' => null, 'error' => 'Android SHA256 fingerprint or Package Name not configured'];
        }

        return [
            'error' => null,
            'data'  => [
                [
                    'relation' => ['delegate_permission/common.handle_all_urls'],
                    'target'   => [
                        'namespace'                => 'android_app',
                        'package_name'             => $package_name,
                        'sha256_cert_fingerprints' => [$sha256],
                    ],
                ],
            ],
        ];
    }

    // =========================================================================
    // Smart App Banner (wp_head)
    // =========================================================================

    public function render_smart_banner() {
        $settings = TBC_CA_Core::get_settings();

        if (empty($settings['smart_banner_enabled'])) {
            return;
        }

        $current_uri  = isset($_SERVER['REQUEST_URI']) ? $_SERVER['REQUEST_URI'] : '';
        $current_url  = home_url($current_uri);
        $package_name = $settings['package_name'] ?? '';
        $app_name     = $settings['app_name'] ?? get_bloginfo('name');
        $url_scheme   = $settings['url_scheme'] ?? '';
        $app_store_id = $settings['app_store_id'] ?? '';
        $store_urls   = $settings['store_urls'] ?? [];
        $android_url  = $store_urls['android'] ?? '';
        $version      = defined('TBC_CA_VERSION') ? TBC_CA_VERSION : '1.0.0';

        // iOS native smart banner
        if (!empty($app_store_id)) {
            printf(
                '<meta name="apple-itunes-app" content="app-id=%s, app-argument=%s">%s',
                esc_attr($app_store_id),
                esc_url($current_url),
                "\n"
            );
        }

        // Android custom banner
        ?>
<!-- TBC Smart Banner v<?php echo esc_html($version); ?> -->
<style>
.tbc-app-banner{display:none;position:fixed;top:0;left:0;right:0;z-index:99999;background:var(--fcom-primary-bg,#fff);border-bottom:1px solid var(--fcom-primary-border,#ddd);padding:10px 16px;align-items:center;gap:12px;font-family:-apple-system,BlinkMacSystemFont,sans-serif;box-shadow:0 2px 8px rgba(0,0,0,.1)}
.tbc-app-banner.show{display:flex}
.tbc-app-banner-close{background:none;border:none;font-size:20px;color:var(--fcom-text-off,#999);cursor:pointer;padding:0 4px}
.tbc-app-banner-icon{width:40px;height:40px;border-radius:8px}
.tbc-app-banner-info{flex:1;min-width:0}
.tbc-app-banner-name{font-weight:600;font-size:14px;color:var(--fcom-primary-text,#333)}
.tbc-app-banner-desc{font-size:12px;color:var(--fcom-secondary-text,#888);margin-top:1px}
.tbc-app-banner-btn{background:var(--fcom-primary-button,#2196F3);color:var(--fcom-primary-button-text,#fff);border:none;border-radius:6px;padding:8px 16px;font-size:13px;font-weight:600;cursor:pointer;white-space:nowrap;text-decoration:none}
</style>
<script>
(function(){
  if(!/Android/i.test(navigator.userAgent))return;
  var d=localStorage.getItem('tbc_banner_dismissed');
  if(d&&(Date.now()-parseInt(d,10))<7*86400000)return;
  document.addEventListener('DOMContentLoaded',function(){
    var b=document.createElement('div');
    b.className='tbc-app-banner show';
    b.innerHTML='<button class="tbc-app-banner-close" aria-label="Close">&times;</button>'
      +'<img class="tbc-app-banner-icon" src="<?php echo esc_url(get_site_icon_url(96)); ?>" alt="">'
      +'<div class="tbc-app-banner-info"><div class="tbc-app-banner-name"><?php echo esc_js($app_name); ?></div><div class="tbc-app-banner-desc">Open in the app</div></div>'
      +'<a class="tbc-app-banner-btn" id="tbc-app-open" href="#">Open</a>';
    var storeUrl='<?php echo esc_js($android_url ?: 'https://play.google.com/store/apps/details?id=' . $package_name); ?>';
    b.querySelector('#tbc-app-open').addEventListener('click',function(e){
      e.preventDefault();
      var appUrl='<?php echo esc_js($url_scheme ? $url_scheme . '://' : ''); ?>';
      var opened=false;
      window.location=appUrl;
      setTimeout(function(){if(!opened)window.location=storeUrl;},1500);
      window.addEventListener('blur',function(){opened=true;},{once:true});
    });
    document.body.appendChild(b);
    b.querySelector('.tbc-app-banner-close').addEventListener('click',function(){
      b.remove();
      localStorage.setItem('tbc_banner_dismissed',String(Date.now()));
    });
  });
})();
</script>
        <?php
    }

    // =========================================================================
    // Helpers
    // =========================================================================

    /**
     * Get portal paths for AASA.
     * When portal is at root (empty slug), use specific community path prefixes.
     * Otherwise use the slug prefix + portal fallback.
     */
    private function get_portal_paths() {
        $slug = $this->get_portal_slug();

        // Portal at root — list specific community paths to avoid claiming the entire domain
        if (empty($slug)) {
            return [
                '/spaces/*',
                '/u/*',
                '/courses/*',
                '/notifications',
                '/leaderboard',
            ];
        }

        $paths = ["/{$slug}/*"];

        // Include default 'portal' path as fallback if slug is different
        if ($slug !== 'portal') {
            $paths[] = '/portal/*';
        }

        return $paths;
    }

    /**
     * Get Fluent Community portal slug
     */
    private function get_portal_slug() {
        if (class_exists('FluentCommunity\App\Services\Helper')) {
            return \FluentCommunity\App\Services\Helper::getPortalSlug();
        }
        return 'portal';
    }
}
