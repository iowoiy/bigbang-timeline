/**
 * Instagram Media Scraper - Cloudflare Worker v9
 * 使用多種 GraphQL API doc_id 嘗試 - 基於 ahmedrangel/instagram-media-scraper
 * https://github.com/ahmedrangel/instagram-media-scraper
 *
 * 更新日期: 2025-02
 */

const ALLOWED_ORIGINS = [
  'http://localhost:5173',
  'http://localhost:3000',
  'https://bigbang-timeline.vercel.app',
  'https://iowoiy.github.io',
];

// Instagram GraphQL doc_id 列表（會定期更換，需要更新）
// 來源: https://github.com/ahmedrangel/instagram-media-scraper
const DOC_IDS = [
  '8845758582119845',   // 2025 新版
  '9496398023731588',   // 備用
  '7153639614715901',   // 備用 2
  '10015901848480474',  // 舊版（可能已失效）
];

function extractShortcode(url) {
  const patterns = [
    /instagram\.com\/p\/([a-zA-Z0-9_-]+)/,
    /instagram\.com\/reel\/([a-zA-Z0-9_-]+)/,
    /instagram\.com\/reels\/([a-zA-Z0-9_-]+)/,
    /instagram\.com\/tv\/([a-zA-Z0-9_-]+)/,
  ];
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}

function getPostType(url) {
  if (url.includes('/reel/') || url.includes('/reels/')) return 'reels';
  if (url.includes('/tv/')) return 'igtv';
  return 'post';
}

// 生成隨機 LSD token
function generateLSD() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
  let result = '';
  for (let i = 0; i < 10; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// GraphQL 方法 - 嘗試多個 doc_id
async function fetchViaGraphQL(shortcode) {
  const lsd = generateLSD();

  for (const docId of DOC_IDS) {
    try {
      // 使用 POST body 而不是 URL 參數
      const body = new URLSearchParams();
      body.append('variables', JSON.stringify({ shortcode }));
      body.append('doc_id', docId);
      body.append('lsd', lsd);

      const response = await fetch('https://www.instagram.com/api/graphql', {
        method: 'POST',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
          'Content-Type': 'application/x-www-form-urlencoded',
          'X-IG-App-ID': '936619743392459',
          'X-FB-LSD': lsd,
          'X-ASBD-ID': '129477',
          'X-CSRFToken': 'missing',
          'Origin': 'https://www.instagram.com',
          'Referer': 'https://www.instagram.com/',
          'Sec-Fetch-Dest': 'empty',
          'Sec-Fetch-Mode': 'cors',
          'Sec-Fetch-Site': 'same-origin',
          'Accept': '*/*',
          'Accept-Language': 'en-US,en;q=0.9',
        },
        body: body.toString(),
      });

      if (!response.ok) {
        continue; // 嘗試下一個 doc_id
      }

      const text = await response.text();

      // 檢查是否為 JSON
      if (!text.startsWith('{')) {
        continue; // 返回了 HTML，嘗試下一個
      }

      const data = JSON.parse(text);

      // 檢查是否有有效資料
      if (data?.data?.xdt_shortcode_media) {
        return { data, docId };
      }
    } catch (e) {
      // 繼續嘗試下一個 doc_id
      continue;
    }
  }

  throw new Error('All GraphQL doc_ids failed');
}

// 解析 GraphQL 回應
function parseGraphQLResponse(data, originalUrl) {
  const media = data?.data?.xdt_shortcode_media;

  if (!media) {
    return { success: false, error: 'No media data found' };
  }

  const result = {
    success: true,
    type: getPostType(originalUrl),
    shortcode: media.shortcode,
    caption: media.edge_media_to_caption?.edges?.[0]?.node?.text || '',
    timestamp: media.taken_at_timestamp,
    date: media.taken_at_timestamp ? new Date(media.taken_at_timestamp * 1000).toISOString() : null,
    owner: {
      username: media.owner?.username,
      fullName: media.owner?.full_name,
      profilePic: media.owner?.profile_pic_url,
    },
    likeCount: media.edge_media_preview_like?.count || 0,
    commentCount: media.edge_media_preview_comment?.count || 0,
    media: [],
    isCarousel: media.product_type === 'carousel_container' || !!media.edge_sidecar_to_children,
  };

  // 處理輪播貼文
  if (media.edge_sidecar_to_children?.edges) {
    for (const edge of media.edge_sidecar_to_children.edges) {
      const node = edge.node;

      if (node.is_video) {
        result.media.push({
          type: 'video',
          url: node.video_url,
          thumbnail: node.display_url,
          width: node.dimensions?.width,
          height: node.dimensions?.height,
        });
      } else {
        result.media.push({
          type: 'image',
          url: node.display_url,
          width: node.dimensions?.width,
          height: node.dimensions?.height,
        });
      }
    }
  } else if (media.is_video) {
    // 單一影片
    result.media.push({
      type: 'video',
      url: media.video_url,
      thumbnail: media.display_url,
      width: media.dimensions?.width,
      height: media.dimensions?.height,
    });
  } else {
    // 單一圖片
    result.media.push({
      type: 'image',
      url: media.display_url,
      width: media.dimensions?.width,
      height: media.dimensions?.height,
    });
  }

  return result;
}

// 備用方法 2: 使用 Instagram 的 __a=1 端點（需要特定 User-Agent）
async function fetchViaJsonEndpoint(shortcode) {
  const url = `https://www.instagram.com/p/${shortcode}/?__a=1&__d=dis`;

  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Instagram 275.0.0.27.98 Android (33/13; 420dpi; 1080x2400; samsung; SM-G991B; o1s; exynos2100; en_US; 458229258)',
      'Accept': 'application/json',
      'X-IG-App-ID': '936619743392459',
    },
  });

  if (!response.ok) {
    throw new Error(`JSON endpoint failed: ${response.status}`);
  }

  const text = await response.text();
  if (!text.startsWith('{')) {
    throw new Error('Not JSON response');
  }

  return JSON.parse(text);
}

// 備用方法 3: embed 頁面
async function fetchViaEmbed(shortcode) {
  const url = `https://www.instagram.com/p/${shortcode}/embed/captioned/`;

  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
      'Accept': 'text/html,application/xhtml+xml',
    },
  });

  if (!response.ok) {
    throw new Error(`Embed failed: ${response.status}`);
  }

  return await response.text();
}

function parseEmbed(html, shortcode) {
  const result = {
    success: false,
    shortcode,
    caption: '',
    media: [],
    owner: {},
  };

  // 嘗試多種正則匹配
  const patterns = [
    /window\.__additionalDataLoaded\s*\(\s*['"][^'"]*['"]\s*,\s*(\{[\s\S]*?\})\s*\)\s*;?\s*<\/script>/,
    /"shortcode_media"\s*:\s*(\{[\s\S]*?\})\s*,?\s*"extensions"/,
    /window\._sharedData\s*=\s*(\{[\s\S]*?\})\s*;?\s*<\/script>/,
  ];

  for (const pattern of patterns) {
    const dataMatch = html.match(pattern);
    if (dataMatch) {
      try {
        const data = JSON.parse(dataMatch[1]);
        const media = data.shortcode_media || data?.entry_data?.PostPage?.[0]?.graphql?.shortcode_media;

        if (media) {
          result.success = true;
          result.caption = media.edge_media_to_caption?.edges?.[0]?.node?.text || '';
          result.owner.username = media.owner?.username;
          result.timestamp = media.taken_at_timestamp;

          if (media.edge_sidecar_to_children?.edges) {
            for (const edge of media.edge_sidecar_to_children.edges) {
              const node = edge.node;
              result.media.push({
                type: node.is_video ? 'video' : 'image',
                url: node.is_video ? node.video_url : node.display_url,
              });
            }
          } else {
            result.media.push({
              type: media.is_video ? 'video' : 'image',
              url: media.is_video ? media.video_url : media.display_url,
            });
          }
          return result;
        }
      } catch (e) {
        // 繼續嘗試下一個 pattern
      }
    }
  }

  // 備用：從 img/video src 提取
  const mediaUrls = [];

  // 尋找所有圖片
  const imgMatches = html.matchAll(/src="(https:\/\/[^"]*(?:cdninstagram|fbcdn)[^"]*\.(?:jpg|webp)[^"]*)"/g);
  for (const match of imgMatches) {
    const url = match[1].replace(/&amp;/g, '&');
    if (!mediaUrls.some(m => m.url === url)) {
      mediaUrls.push({ type: 'image', url });
    }
  }

  // 尋找影片
  const videoMatches = html.matchAll(/src="(https:\/\/[^"]*(?:cdninstagram|fbcdn)[^"]*\.mp4[^"]*)"/g);
  for (const match of videoMatches) {
    const url = match[1].replace(/&amp;/g, '&');
    if (!mediaUrls.some(m => m.url === url)) {
      mediaUrls.push({ type: 'video', url });
    }
  }

  if (mediaUrls.length > 0) {
    result.success = true;
    result.media = mediaUrls;
  }

  return result;
}

// 備用方法 4: 頁面 og:image（只能獲取第一張）
async function fetchViaPage(shortcode) {
  const url = `https://www.instagram.com/p/${shortcode}/`;

  const response = await fetch(url, {
    headers: {
      'User-Agent': 'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)',
      'Accept': 'text/html',
    },
  });

  if (!response.ok) {
    throw new Error(`Page failed: ${response.status}`);
  }

  return await response.text();
}

function parsePage(html, shortcode) {
  const result = { success: false, shortcode, caption: '', media: [], owner: {}, timestamp: null };

  // 嘗試從 script 中提取完整資料
  const scriptMatch = html.match(/<script[^>]*>window\._sharedData\s*=\s*(\{[\s\S]*?\});<\/script>/);
  if (scriptMatch) {
    try {
      const data = JSON.parse(scriptMatch[1]);
      const media = data?.entry_data?.PostPage?.[0]?.graphql?.shortcode_media;
      if (media) {
        result.success = true;
        result.caption = media.edge_media_to_caption?.edges?.[0]?.node?.text || '';
        result.owner.username = media.owner?.username;
        result.timestamp = media.taken_at_timestamp;

        if (media.edge_sidecar_to_children?.edges) {
          for (const edge of media.edge_sidecar_to_children.edges) {
            const node = edge.node;
            result.media.push({
              type: node.is_video ? 'video' : 'image',
              url: node.is_video ? node.video_url : node.display_url,
            });
          }
        } else {
          result.media.push({
            type: media.is_video ? 'video' : 'image',
            url: media.is_video ? media.video_url : media.display_url,
          });
        }
        return result;
      }
    } catch (e) {
      // 繼續使用 og:image
    }
  }

  // 提取 og:image
  const ogImage = html.match(/<meta property="og:image" content="([^"]+)"/);
  if (ogImage) {
    result.success = true;
    result.media.push({ type: 'image', url: ogImage[1].replace(/&amp;/g, '&') });
  }

  // 提取時間
  const timeMatch = html.match(/<time[^>]*datetime="([^"]+)"/);
  if (timeMatch) {
    result.timestamp = Math.floor(new Date(timeMatch[1]).getTime() / 1000);
  }

  // 提取描述
  const ogDesc = html.match(/<meta property="og:description" content="([^"]+)"/);
  if (ogDesc) {
    const desc = ogDesc[1].replace(/&amp;/g, '&').replace(/&quot;/g, '"');
    const captionMatch = desc.match(/: "(.+)"$/);
    if (captionMatch) result.caption = captionMatch[1];
    const userMatch = desc.match(/- ([^\s]+) on Instagram/);
    if (userMatch) result.owner.username = userMatch[1];
  }

  return result;
}

function corsHeaders(origin) {
  return {
    'Access-Control-Allow-Origin': ALLOWED_ORIGINS.includes(origin) ? origin : '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json',
  };
}

export default {
  async fetch(request) {
    const origin = request.headers.get('Origin') || '';
    const headers = corsHeaders(origin);

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers });
    }

    try {
      const url = new URL(request.url);

      if (url.pathname === '/') {
        return new Response(JSON.stringify({
          name: 'Instagram Scraper',
          version: '9.0',
          usage: 'GET /scrape?url=<instagram_url>',
          features: ['Carousel support', 'Video support', 'Multiple fallback methods'],
          doc_ids: DOC_IDS,
          credit: 'Based on ahmedrangel/instagram-media-scraper',
        }), { headers });
      }

      if (url.pathname === '/scrape') {
        const igUrl = url.searchParams.get('url');
        if (!igUrl) {
          return new Response(JSON.stringify({ success: false, error: 'Missing url' }), { status: 400, headers });
        }

        const shortcode = extractShortcode(igUrl);
        if (!shortcode) {
          return new Response(JSON.stringify({ success: false, error: 'Invalid URL' }), { status: 400, headers });
        }

        const errors = [];

        // 方法 1: GraphQL API（嘗試多個 doc_id）
        try {
          const { data, docId } = await fetchViaGraphQL(shortcode);
          const result = parseGraphQLResponse(data, igUrl);

          if (result.success && result.media.length > 0) {
            result.method = 'graphql';
            result.docId = docId;
            return new Response(JSON.stringify(result), { headers });
          }
          errors.push('graphql: no media');
        } catch (e) {
          errors.push(`graphql: ${e.message}`);
        }

        // 方法 2: JSON 端點
        try {
          const data = await fetchViaJsonEndpoint(shortcode);
          if (data?.items?.[0]) {
            const item = data.items[0];
            const result = {
              success: true,
              type: getPostType(igUrl),
              shortcode,
              caption: item.caption?.text || '',
              timestamp: item.taken_at,
              date: item.taken_at ? new Date(item.taken_at * 1000).toISOString() : null,
              owner: {
                username: item.user?.username,
                fullName: item.user?.full_name,
              },
              media: [],
              method: 'json_endpoint',
            };

            // 處理輪播
            if (item.carousel_media) {
              for (const m of item.carousel_media) {
                if (m.video_versions) {
                  result.media.push({ type: 'video', url: m.video_versions[0].url });
                } else if (m.image_versions2) {
                  result.media.push({ type: 'image', url: m.image_versions2.candidates[0].url });
                }
              }
            } else if (item.video_versions) {
              result.media.push({ type: 'video', url: item.video_versions[0].url });
            } else if (item.image_versions2) {
              result.media.push({ type: 'image', url: item.image_versions2.candidates[0].url });
            }

            if (result.media.length > 0) {
              return new Response(JSON.stringify(result), { headers });
            }
          }
          errors.push('json_endpoint: no media');
        } catch (e) {
          errors.push(`json_endpoint: ${e.message}`);
        }

        // 方法 3: Embed 頁面
        try {
          const html = await fetchViaEmbed(shortcode);
          const result = parseEmbed(html, shortcode);

          if (result.success && result.media.length > 0) {
            return new Response(JSON.stringify({
              success: true,
              type: getPostType(igUrl),
              shortcode,
              caption: result.caption,
              owner: result.owner,
              media: result.media,
              timestamp: result.timestamp,
              date: result.timestamp ? new Date(result.timestamp * 1000).toISOString() : null,
              method: 'embed',
            }), { headers });
          }
          errors.push('embed: no media');
        } catch (e) {
          errors.push(`embed: ${e.message}`);
        }

        // 方法 4: Page og:image
        try {
          const html = await fetchViaPage(shortcode);
          const result = parsePage(html, shortcode);

          if (result.success && result.media.length > 0) {
            return new Response(JSON.stringify({
              success: true,
              type: getPostType(igUrl),
              shortcode,
              caption: result.caption,
              owner: result.owner,
              media: result.media,
              timestamp: result.timestamp,
              date: result.timestamp ? new Date(result.timestamp * 1000).toISOString() : null,
              method: 'page',
              note: result.media.length === 1 ? 'Only first image (carousel may not be fully supported)' : undefined,
            }), { headers });
          }
        } catch (e) {
          errors.push(`page: ${e.message}`);
        }

        return new Response(JSON.stringify({
          success: false,
          error: errors.join('; '),
          shortcode,
          hint: 'Instagram API may have changed. Try manual input.',
        }), { status: 404, headers });
      }

      return new Response(JSON.stringify({ success: false, error: 'Not found' }), { status: 404, headers });

    } catch (error) {
      return new Response(JSON.stringify({ success: false, error: error.message }), { status: 500, headers });
    }
  },
};
