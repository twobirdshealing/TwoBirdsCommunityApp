<?php
/**
 * Book Club REST API — endpoints for the mobile app audiobook player
 *
 * Reads from the plugin's own database tables (wp_tbc_bc_books,
 * wp_tbc_bc_bookmarks) to provide book data, chapters, and bookmark
 * management via JWT-authenticated requests.
 *
 * JWT auth is handled globally by TBC_CA_Auth (determine_current_user filter),
 * so is_user_logged_in() works for any plugin's REST endpoints.
 */

if (!defined('ABSPATH')) {
    exit;
}

class Tbc_Bc_Rest_API {

    private static $instance = null;

    public static function get_instance() {
        if (null === self::$instance) {
            self::$instance = new self();
        }
        return self::$instance;
    }

    private function __construct() {
        add_action('rest_api_init', [$this, 'register_routes']);
    }

    /**
     * Register REST routes
     */
    public function register_routes() {
        // GET /tbc-bc/v1/books  (?current=1 returns only the current book)
        register_rest_route('tbc-bc/v1', '/books', [
            'methods'             => 'GET',
            'callback'            => [$this, 'get_books'],
            'permission_callback' => [$this, 'check_auth'],
            'args'                => [
                'current' => [
                    'default'           => 0,
                    'validate_callback' => function ($value) {
                        return is_numeric($value);
                    },
                    'sanitize_callback' => 'absint',
                ],
            ],
        ]);

        // GET /tbc-bc/v1/books/{id}
        register_rest_route('tbc-bc/v1', '/books/(?P<id>\d+)', [
            'methods'             => 'GET',
            'callback'            => [$this, 'get_book'],
            'permission_callback' => [$this, 'check_auth'],
            'args'                => [
                'id' => [
                    'validate_callback' => function ($value) {
                        return is_numeric($value) && $value > 0;
                    },
                ],
            ],
        ]);

        // POST /tbc-bc/v1/books/{id}/bookmarks
        register_rest_route('tbc-bc/v1', '/books/(?P<id>\d+)/bookmarks', [
            'methods'             => 'POST',
            'callback'            => [$this, 'create_bookmark'],
            'permission_callback' => [$this, 'check_auth'],
            'args'                => [
                'id' => [
                    'validate_callback' => function ($value) {
                        return is_numeric($value) && $value > 0;
                    },
                ],
                'timestamp' => [
                    'required'          => true,
                    'validate_callback' => function ($value) {
                        return is_numeric($value) && $value >= 0;
                    },
                    'sanitize_callback' => function ($value) { return floatval($value); },
                ],
                'title' => [
                    'default'           => '',
                    'sanitize_callback' => 'sanitize_text_field',
                ],
            ],
        ]);

        // DELETE /tbc-bc/v1/books/{id}/bookmarks/{bookmark_id}
        register_rest_route('tbc-bc/v1', '/books/(?P<id>\d+)/bookmarks/(?P<bookmark_id>\d+)', [
            'methods'             => 'DELETE',
            'callback'            => [$this, 'delete_bookmark'],
            'permission_callback' => [$this, 'check_auth'],
            'args'                => [
                'id' => [
                    'validate_callback' => function ($value) {
                        return is_numeric($value) && $value > 0;
                    },
                ],
                'bookmark_id' => [
                    'validate_callback' => function ($value) {
                        return is_numeric($value) && $value > 0;
                    },
                ],
            ],
        ]);
    }

    /**
     * Permission callback — requires authenticated user
     */
    public function check_auth(WP_REST_Request $request) {
        return is_user_logged_in();
    }

    /**
     * GET /books — List all books (lightweight, no audio URLs or full chapters)
     */
    public function get_books(WP_REST_Request $request) {
        global $wpdb;
        $table       = $wpdb->prefix . 'tbc_bc_books';
        $current_only = (bool) $request->get_param('current');

        $sql = "SELECT id, title, author, description, cover_image, chapters,
                       is_current, display_order, schedule_data, meeting_link
                FROM {$table}";

        if ($current_only) {
            $sql .= " WHERE is_current = 1";
        }

        $sql .= " ORDER BY display_order ASC";

        if ($current_only) {
            $sql .= " LIMIT 1";
        }

        $books = $wpdb->get_results($sql);

        if ($books === null) {
            return new WP_REST_Response([
                'success' => false,
                'error'   => 'Failed to fetch books',
            ], 500);
        }

        $result = [];
        foreach ($books as $book) {
            $chapters = json_decode($book->chapters, true);
            $entry = [
                'id'            => (int) $book->id,
                'title'         => $book->title,
                'author'        => $book->author,
                'description'   => $book->description,
                'cover_image'   => $book->cover_image ?: null,
                'chapter_count' => is_array($chapters) ? count($chapters) : 0,
                'is_current'    => (bool) $book->is_current,
                'display_order' => (int) $book->display_order,
            ];

            // For the current book, calculate next upcoming meeting
            if ($book->is_current && !empty($book->schedule_data)) {
                $schedule = json_decode($book->schedule_data, true) ?: [];
                $today = current_time('Y-m-d');
                foreach ($schedule as $meeting) {
                    if (!empty($meeting['date']) && $meeting['date'] >= $today) {
                        if (!empty($book->meeting_link)) {
                            $entry['next_meeting'] = [
                                'date'           => $meeting['date'],
                                'time'           => $meeting['time'] ?? '18:00',
                                'chapters'       => $meeting['chapters'] ?? '',
                                'formatted_date' => date('l, M j', strtotime($meeting['date'])),
                                'meeting_link'   => $book->meeting_link,
                            ];
                        }
                        break;
                    }
                }
            }

            $result[] = $entry;
        }

        return new WP_REST_Response([
            'success' => true,
            'books'   => $result,
        ], 200);
    }

    /**
     * GET /books/{id} — Full book detail with chapters, bookmarks, and meeting info
     */
    public function get_book(WP_REST_Request $request) {
        global $wpdb;
        $book_id = (int) $request->get_param('id');
        $user_id = get_current_user_id();

        $books_table     = $wpdb->prefix . 'tbc_bc_books';
        $bookmarks_table = $wpdb->prefix . 'tbc_bc_bookmarks';

        // Get book
        $book = $wpdb->get_row($wpdb->prepare(
            "SELECT * FROM {$books_table} WHERE id = %d",
            $book_id
        ));

        if (!$book) {
            return new WP_REST_Response([
                'success' => false,
                'error'   => 'Book not found',
            ], 404);
        }

        // Get user's bookmarks for this book
        $bookmarks = $wpdb->get_results($wpdb->prepare(
            "SELECT id, timestamp, title, created_at
             FROM {$bookmarks_table}
             WHERE book_id = %d AND user_id = %d
             ORDER BY created_at DESC",
            $book_id,
            $user_id
        ));

        $chapters      = json_decode($book->chapters, true) ?: [];
        $schedule_data = json_decode($book->schedule_data, true) ?: [];

        $result = [
            'id'               => (int) $book->id,
            'title'            => $book->title,
            'author'           => $book->author,
            'description'      => $book->description,
            'cover_image'      => $book->cover_image ?: null,
            'single_audio_url' => $book->single_audio_url ?: null,
            'chapters'         => $chapters,
            'is_current'       => (bool) $book->is_current,
            'bookmarks'        => array_map(function ($bm) {
                return [
                    'id'         => (int) $bm->id,
                    'timestamp'  => (float) $bm->timestamp,
                    'title'      => $bm->title,
                    'created_at' => $bm->created_at,
                ];
            }, $bookmarks ?: []),
        ];

        // Include meeting info only if present
        if (!empty($schedule_data)) {
            $result['schedule_data'] = $schedule_data;
        }
        if (!empty($book->meeting_link)) {
            $result['meeting_link']     = $book->meeting_link;
            $result['meeting_id']       = $book->meeting_id ?: null;
            $result['meeting_passcode'] = $book->meeting_passcode ?: null;
        }

        // Include moderator profile if assigned
        if (!empty($book->moderator_data)) {
            $mod = json_decode($book->moderator_data, true);
            if (!empty($mod['user_id'])) {
                $mod_user = get_userdata($mod['user_id']);
                if ($mod_user) {
                    $mod_profile = [
                        'user_id'      => (int) $mod['user_id'],
                        'display_name' => $mod_user->display_name,
                        'username'     => $mod_user->user_login,
                        'avatar'       => get_avatar_url($mod['user_id']),
                        'is_verified'  => 0,
                    ];

                    // Use Fluent Community xprofile for richer data if available
                    if (class_exists('\FluentCommunity\App\Models\XProfile')) {
                        $xprofile = \FluentCommunity\App\Models\XProfile::where('user_id', $mod['user_id'])->first();
                        if ($xprofile) {
                            $mod_profile['username']    = $xprofile->username ?: $mod_profile['username'];
                            $mod_profile['avatar']      = $xprofile->photo ?: $mod_profile['avatar'];
                            $mod_profile['is_verified'] = (int) ($xprofile->is_verified ?? 0);
                        }
                    }

                    $result['moderator'] = $mod_profile;
                }
            }
        }

        return new WP_REST_Response([
            'success' => true,
            'book'    => $result,
        ], 200);
    }

    /**
     * POST /books/{id}/bookmarks — Create a bookmark
     */
    public function create_bookmark(WP_REST_Request $request) {
        global $wpdb;
        $book_id   = (int) $request->get_param('id');
        $timestamp = (float) $request->get_param('timestamp');
        $title     = $request->get_param('title') ?: '';
        $user_id   = get_current_user_id();

        // Verify book exists
        $books_table = $wpdb->prefix . 'tbc_bc_books';
        $book_exists = $wpdb->get_var($wpdb->prepare(
            "SELECT COUNT(*) FROM {$books_table} WHERE id = %d",
            $book_id
        ));

        if (!$book_exists) {
            return new WP_REST_Response([
                'success' => false,
                'error'   => 'Book not found',
            ], 404);
        }

        // Insert bookmark
        $bookmarks_table = $wpdb->prefix . 'tbc_bc_bookmarks';
        $result = $wpdb->insert(
            $bookmarks_table,
            [
                'user_id'   => $user_id,
                'book_id'   => $book_id,
                'timestamp' => $timestamp,
                'title'     => $title,
            ]
        );

        if ($result === false) {
            return new WP_REST_Response([
                'success' => false,
                'error'   => 'Failed to create bookmark',
            ], 500);
        }

        return new WP_REST_Response([
            'success'  => true,
            'bookmark' => [
                'id'         => (int) $wpdb->insert_id,
                'timestamp'  => $timestamp,
                'title'      => $title,
                'created_at' => current_time('mysql'),
            ],
        ], 201);
    }

    /**
     * DELETE /books/{id}/bookmarks/{bookmark_id} — Delete user's own bookmark
     */
    public function delete_bookmark(WP_REST_Request $request) {
        global $wpdb;
        $book_id     = (int) $request->get_param('id');
        $bookmark_id = (int) $request->get_param('bookmark_id');
        $user_id     = get_current_user_id();

        $bookmarks_table = $wpdb->prefix . 'tbc_bc_bookmarks';

        // Delete only if owned by current user and belongs to the specified book
        $result = $wpdb->delete(
            $bookmarks_table,
            [
                'id'      => $bookmark_id,
                'user_id' => $user_id,
                'book_id' => $book_id,
            ],
            ['%d', '%d', '%d']
        );

        if ($result === false) {
            return new WP_REST_Response([
                'success' => false,
                'error'   => 'Failed to delete bookmark',
            ], 500);
        }

        if ($result === 0) {
            return new WP_REST_Response([
                'success' => false,
                'error'   => 'Bookmark not found or not owned by you',
            ], 404);
        }

        return new WP_REST_Response([
            'success' => true,
        ], 200);
    }
}
