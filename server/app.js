// 后端爬虫服务 - 通过环境变量 SOURCE_BASE 指定数据源站点
const dotenv = require('dotenv');
dotenv.config({ path: '.env.example' });

const express = require('express');
const morgan = require('morgan');
const axios = require('axios');
const cheerio = require('cheerio');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

// 数据源站点地址，通过环境变量配置（必须设置，否则无法工作）
const SOURCE_BASE = process.env.SOURCE_BASE;
if (!SOURCE_BASE) {
  console.warn('[WARNING] 环境变量 SOURCE_BASE 未设置，后端爬虫接口将无法正常工作。');
}

// 日志
app.use(morgan(process.env.NODE_ENV === 'development' ? 'combined' : 'common'));

// 统一的返回包装
function wrap(code, data, msg = '') {
  return {
    code,
    message: msg,
    data
  };
}

/**
 * 搜索接口
 * GET /api/search/:name?page=1
 * 返回结构与前端 api/type.ts 中 Search 一致
 */
app.get('/api/search/:name', async (req, res) => {
  const name = req.params.name;
  const page = parseInt(req.query.page || '1');
  try {
    const url = `${SOURCE_BASE}/index.php/vod/search.html?wd=${encodeURIComponent(name)}&page=${page}`;
    const r = await axios.get(url);
    const $ = cheerio.load(r.data);
    const results = [];
    // 观察页面发现搜索结果在 .stui-vodlist li
    $('.stui-vodlist li').each((i, el) => {
      const el$ = $(el);
      const title = el$.find('h4 a').text().trim();
      const href = el$.find('h4 a').attr('href') || '';
      const idMatch = href.match(/id\/(\d+)/);
      const id = idMatch ? idMatch[1] : '';
      const cover = el$.find('img').attr('data-original') || el$.find('img').attr('src') || '';
      const season = el$.find('.pic-tag').text().trim(); // 可能有更新集数等信息
      results.push({ id, title, cover, season, category: '', date: '', description: '' });
    });
    // 总页数暂时提现 1，需要根据分页元素解析
    const pagetotal = 1;
    res.json(wrap(200, { pageindex: page, pagetotal, results }));
  } catch (e) {
    console.error(e);
    res.json(wrap(500, null, 'search failed'));
  }
});

/**
 * 动漫详情
 * GET /api/getAnime/:id
 */
app.get('/api/getAnime/:id', async (req, res) => {
  const id = req.params.id;
  try {
    const url = `${SOURCE_BASE}/index.php/vod/detail/id/${id}.html`;
    const r = await axios.get(url);
    const $ = cheerio.load(r.data);
    const title = $('.vodh').find('h1').text().trim();
    const cover = $('.vodImg img').attr('src') || '';
    const actors = [];
    $('.vodh .actor a').each((i, el) => actors.push($(el).text().trim()));
    const categories = [];
    $('.vodh .tag a').each((i, el) => categories.push($(el).text().trim()));
    const first_date = $('.vodh .other span').eq(0).text().trim();
    const lang = ''; // 页面可能没有
    const master = ''; // 同上
    const rank = '';
    const region = '';
    const season = ''; // 状态信息

    const playlist = {};
    // 假设播放列表采用 #playlist 内多个 ul
    $('.vodplayinfo .playlist').each((i, ul) => {
      const name = $(ul).find('h3').text().trim() || i.toString();
      playlist[i] = [];
      $(ul)
        .find('li a')
        .each((j, a) => {
          playlist[i].push({ link: $(a).attr('href') || '', title: $(a).text().trim() });
        });
    });

    res.json(
      wrap(200, {
        actors,
        categories,
        cover,
        first_date,
        lang,
        master,
        playlist,
        rank,
        region,
        season,
        title
      })
    );
  } catch (e) {
    console.error(e);
    res.json(wrap(500, null, 'getAnime failed'));
  }
});

/**
 * 从 HTML 中深度提取真实视频地址（m3u8 / mp4）
 * 支持多种常见源站加密方式
 */
function extractVideoUrl(html) {
  const $ = cheerio.load(html);
  let videoUrl = '';

  // ---- 策略1：script 中的 player_aaaa / player_data 变量 ----
  $('script').each((i, el) => {
    if (videoUrl) return;
    const text = $(el).html() || '';
    // player_aaaa={"url":"...", ...}
    const varMatch = text.match(/player_(?:aaaa|data)\s*=\s*(\{[^;]+\})/s);
    if (varMatch) {
      try {
        const obj = JSON.parse(varMatch[1]);
        if (obj.url) videoUrl = decodeURIComponent(obj.url);
      } catch {}
    }
  });

  // ---- 策略2：正则直接匹配 m3u8 / mp4 地址 ----
  if (!videoUrl) {
    const m3u8 = html.match(/(https?:\/\/[^\s"'<>]+\.m3u8[^\s"'<>]*)/i);
    if (m3u8) videoUrl = m3u8[1];
  }
  if (!videoUrl) {
    const mp4 = html.match(/(https?:\/\/[^\s"'<>]+\.mp4[^\s"'<>]*)/i);
    if (mp4) videoUrl = mp4[1];
  }

  return videoUrl;
}

/**
 * 获取视频真实播放地址
 * GET /api/getVideo/:key
 * 深度解析：播放页 → script变量 / iframe → 真实 m3u8/mp4
 */
app.get('/api/getVideo/:key', async (req, res) => {
  const key = req.params.key;
  // sid 和 nid 可通过 query 传入，支持多线路多集
  const sid = req.query.sid || 1;
  const nid = req.query.nid || 1;
  try {
    const url = `${SOURCE_BASE}/index.php/vod/play/id/${key}/sid/${sid}/nid/${nid}.html`;
    const r = await axios.get(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
    });

    // 先从播放页 HTML 直接提取
    let videoUrl = extractVideoUrl(r.data);

    // 如果没找到，尝试解析 iframe src 并二次请求
    if (!videoUrl) {
      const $ = cheerio.load(r.data);
      const iframeSrc = $('iframe').attr('src') || '';
      if (iframeSrc) {
        try {
          const fullIframeSrc = iframeSrc.startsWith('http') ? iframeSrc : `${SOURCE_BASE}${iframeSrc}`;
          const r2 = await axios.get(fullIframeSrc, {
            headers: {
              'Referer': SOURCE_BASE,
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
          });
          videoUrl = extractVideoUrl(r2.data);
        } catch (e2) {
          console.error('iframe parse failed:', e2.message);
        }
      }
    }

    // 返回格式保持与前端兼容: { 1: ["url"] }
    res.json(wrap(200, { 1: videoUrl ? [videoUrl] : [] }));
  } catch (e) {
    console.error(e);
    res.json(wrap(500, null, 'getVideo failed'));
  }
});

/**
 * 视频流反向代理（解决防盗链 / 跨域问题）
 * GET /api/proxy?url=xxx
 *
 * 使用 stream pipe，数据直接流到用户浏览器，不占服务器磁盘
 * 内存占用极低（每连接仅几百 KB），适合 2GB 内存服务器
 */
app.get('/api/proxy', async (req, res) => {
  const targetUrl = req.query.url;
  if (!targetUrl) {
    return res.status(400).json(wrap(400, null, 'missing url parameter'));
  }

  try {
    const response = await axios({
      method: 'get',
      url: targetUrl,
      responseType: 'stream',
      headers: {
        'Referer': SOURCE_BASE,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Origin': SOURCE_BASE
      },
      timeout: 15000
    });

    // 透传关键响应头
    const contentType = response.headers['content-type'];
    if (contentType) res.set('Content-Type', contentType);
    const contentLength = response.headers['content-length'];
    if (contentLength) res.set('Content-Length', contentLength);
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Cache-Control', 'public, max-age=3600');

    // 流式转发
    response.data.pipe(res);

    // 用户断开时销毁上游连接，避免内存泄漏
    req.on('close', () => {
      response.data.destroy();
    });
  } catch (e) {
    console.error('proxy error:', e.message);
    if (!res.headersSent) {
      res.status(502).json(wrap(502, null, 'proxy failed'));
    }
  }
});

/**
 * 首页混合数据（推荐/最新/轮播等）暂时做简单抽取
 */
app.get('/api/getIndex', async (req, res) => {
  try {
    const resp = await axios.get(SOURCE_BASE);
    const $resp = cheerio.load(resp.data);

    /* 轮播 */
    const slideData = [];
    const $swiperBig = $resp(".swiper-big");
    const $swiperWrapper = $swiperBig.find(".swiper-wrapper");
    $swiperWrapper.find(".swiper-slide").each((index, el) => {
      const $slideItem = $swiperWrapper.find(el);
      slideData.push({
        cover: $slideItem.find("a").attr("style").split("(")[1].split(")")[0],
        id: $slideItem.find("a").attr("href").match(/id\/(\d+)\.html/)[1],
        title: $slideItem.find("span").text().trim()
      })
    })

    /* 热门 */

    res.json(
      wrap(
        200, "success",
        {
          banner: slideData
        }
      )
    )
  } catch (e) {
    console.error(e);
    res.json(wrap(500, null, 'getIndex failed'));
  }
});

/**
 * 筛选条件
 */
app.get('/api/getConfig', async (req, res) => {
  // 可从源站解析或硬编码筛选条件
  res.json(wrap(200, { filtersConfig: [] }));
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`backend listening on ${port}`);
});
