// =============================================================================
// BLOG TYPES - WordPress REST API post and comment types
// =============================================================================
// Used by: services/api/blog.ts, components/blog/*, app/blog/*
// API: /wp-json/wp/v2/posts, /wp-json/wp/v2/comments
// =============================================================================

// -----------------------------------------------------------------------------
// WordPress Rendered Field
// -----------------------------------------------------------------------------

export interface WPRendered {
  rendered: string;
  protected?: boolean;
}

// -----------------------------------------------------------------------------
// Embedded Author (from ?_embed)
// -----------------------------------------------------------------------------

export interface WPAuthorEmbedded {
  id: number;
  name: string;
  slug: string;
  description?: string;
  link?: string;
  avatar_urls: {
    '24'?: string;
    '48'?: string;
    '96'?: string;
  };
}

// -----------------------------------------------------------------------------
// Embedded Featured Media (from ?_embed)
// -----------------------------------------------------------------------------

export interface WPFeaturedMediaEmbedded {
  id: number;
  source_url: string;
  alt_text?: string;
  media_type?: string;
  mime_type?: string;
  media_details?: {
    width: number;
    height: number;
    sizes?: {
      medium?: { source_url: string; width: number; height: number };
      large?: { source_url: string; width: number; height: number };
      full?: { source_url: string; width: number; height: number };
      thumbnail?: { source_url: string; width: number; height: number };
      'post-thumbnail'?: { source_url: string; width: number; height: number };
    };
  };
}

// -----------------------------------------------------------------------------
// Category / Tag (from ?_embed wp:term)
// -----------------------------------------------------------------------------

export interface WPCategory {
  id: number;
  name: string;
  slug: string;
  count?: number;
}

// -----------------------------------------------------------------------------
// WordPress Post
// -----------------------------------------------------------------------------

export interface WPPost {
  id: number;
  date: string;
  date_gmt: string;
  modified: string;
  modified_gmt: string;
  slug: string;
  status: string;
  type: string;
  link: string;
  title: WPRendered;
  content: WPRendered;
  excerpt: WPRendered;
  author: number;
  featured_media: number;
  comment_status: 'open' | 'closed';
  categories: number[];
  tags: number[];
  _embedded?: {
    author?: WPAuthorEmbedded[];
    'wp:featuredmedia'?: WPFeaturedMediaEmbedded[];
    'wp:term'?: WPCategory[][];
    replies?: WPComment[][];
  };
}

// -----------------------------------------------------------------------------
// WordPress Comment
// -----------------------------------------------------------------------------

export interface WPComment {
  id: number;
  post: number;
  parent: number;
  author: number;
  author_name: string;
  author_url?: string;
  author_avatar_urls: {
    '24'?: string;
    '48'?: string;
    '96'?: string;
  };
  date: string;
  content: WPRendered;
  link?: string;
  type?: string;
  status?: string;
}

// -----------------------------------------------------------------------------
// API Response Wrappers
// -----------------------------------------------------------------------------

export interface WPListMeta {
  total: number;
  totalPages: number;
}

export interface WPPostsResponse {
  posts: WPPost[];
  meta: WPListMeta;
}

export interface WPCommentsResponse {
  comments: WPComment[];
  meta: WPListMeta;
}

// -----------------------------------------------------------------------------
// Create Comment Payload
// -----------------------------------------------------------------------------

export interface CreateWPCommentData {
  post: number;
  content: string;
  parent?: number;
}
