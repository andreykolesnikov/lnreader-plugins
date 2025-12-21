import { fetchApi } from '@libs/fetch';
import { Filters, FilterTypes } from '@libs/filterInputs';
import { Plugin } from '@/types/plugin';
import { NovelStatus } from '@libs/novelStatus';
import { load as parseHTML } from 'cheerio';
import dayjs from 'dayjs';

export type IfreedomMetadata = {
  id: string;
  sourceSite: string;
  sourceName: string;
  filters?: Filters;
};

class IfreedomPlugin implements Plugin.PluginBase {
  id: string;
  name: string;
  icon: string;
  site: string;
  version: string;
  filters?: Filters;

  constructor(metadata: IfreedomMetadata) {
    this.id = metadata.id;
    this.name = metadata.sourceName;
    this.icon = `multisrc/ifreedom/${metadata.id.toLowerCase()}/icon.png`;
    this.site = metadata.sourceSite;
    this.version = '1.0.3';
    this.filters = metadata.filters;
  }

  get headers() {
    return {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36',
      Referer: this.site + '/vse-knigi/',
    };
  }

  // Геттер для определения сайта
  get isBookhamster() {
    return this.site.includes('bookhamster.ru');
  }

  async popularNovels(
    page: number,
    {
      filters,
      showLatestNovels,
    }: Plugin.PopularNovelsOptions<typeof this.filters>,
  ): Promise<Plugin.NovelItem[]> {
    let url =
      this.site +
      '/vse-knigi/?sort=' +
      (showLatestNovels
        ? 'По дате обновления'
        : filters?.sort?.value || 'По рейтингу');

    Object.entries(filters || {}).forEach(([type, { value }]) => {
      if (value instanceof Array && value.length) {
        url += '&' + type + '[]=' + value.join('&' + type + '[]=');
      }
    });

    url += '&bpage=' + page;

    const body = await fetchApi(url, { headers: this.headers }).then(res =>
      res.text(),
    );
    const loadedCheerio = parseHTML(body);

    // Разделение логики парсинга
    if (this.isBookhamster) {
      return loadedCheerio('div.one-book-home.rnew')
        .map((_, element) => {
          const el = loadedCheerio(element);
          const link = el.find('.img-home a').first();
          const href = link.attr('href') || '';
          const cover = link.find('img').attr('src') || '';
          const name =
            el.find('.title-home a').text().trim() ||
            link.attr('title') ||
            link.text().trim();
          return {
            name,
            cover,
            path: href.replace(this.site, ''),
          };
        })
        .get()
        .filter(novel => novel.name && novel.path);
    }

    // Логика ifreedom
    return loadedCheerio('div.item-book-slide')
      .map((index, element) => {
        const el = loadedCheerio(element);
        const linkEl = el.find('a.link-book-slide').first();
        const href = linkEl.attr('href') || '';
        const cover = el.find('.block-book-slide-img img').attr('src') || '';
        const name =
          el.find('.block-book-slide-title').text().trim() ||
          linkEl.attr('title') ||
          linkEl.text().trim();
        return {
          name,
          cover,
          path: href.replace(this.site, ''),
        };
      })
      .get()
      .filter(novel => novel.name && novel.path);
  }

  async parseNovel(novelPath: string): Promise<Plugin.SourceNovel> {
    const body = await fetchApi(this.site + novelPath, {
      headers: this.headers,
    }).then(res => res.text());
    const $ = parseHTML(body);

    if (this.isBookhamster) {
      const novel: Plugin.SourceNovel = {
        path: novelPath,
        name: $('h1.entry-title.ranobe').text().trim(),
        cover: $('.ranobe-book .column1 .img-ranobe img').attr('src') || '',
        summary: $('div.ranobe-desc, .entry-content').first().text().trim(),
      };

      const genres: string[] = [];
      $('.data-ranobe')
        .filter((_, el) => $(el).find('.data-key b').text().includes('Жанры'))
        .find('.data-value a')
        .each((_, a) => genres.push($(a).text().trim()));
      if (genres.length) novel.genres = genres.join(',');

      const authorText = $('.data-ranobe')
        .filter((_, el) => $(el).find('.data-key b').text().includes('Автор'))
        .find('.data-value')
        .text()
        .trim();
      if (authorText && authorText !== 'Не указан' && authorText !== 'Не указано') {
        novel.author = authorText;
      }

      const statusText = $('.data-ranobe')
        .filter((_, el) =>
          $(el).find('.data-key b').text().includes('Статус книги'),
        )
        .find('.data-value')
        .text()
        .trim();
      if (statusText) {
        novel.status = statusText.includes('завершен')
          ? NovelStatus.Completed
          : NovelStatus.Ongoing;
      }

      // ВМЕСТО текущего универсального блока глав вставь это:
      const chapters: Plugin.ChapterItem[] = [];
      const chapterNodes = $('.li-ranobe'); // контейнер одной главы[file:249]
      const totalChapters = chapterNodes.length;

      chapterNodes.each((index, el) => {
        const node = $(el);
        const link = node.find('.li-col1-ranobe a').first();
        const name = link.text().trim();
        const href = link.attr('href') || '';

        const dateText = node
          .find('.li-col2-ranobe')
          .text()
          .trim(); // "21 декабря" и т.п.[file:249]

        if (!name || !href) return;

        chapters.push({
          name,
          path: href.replace(this.site, ''),
          releaseTime: this.parseDate(dateText),
          chapterNumber: totalChapters - index,
        });
      });

      if (chapters.length) {
        novel.chapters = chapters.reverse();
      }

      return novel;
    }

    // Ifreedom логика
    const novel: Plugin.SourceNovel = {
      path: novelPath,
      name: $('.book-info > h1').text().trim(),
      cover: $('.book-img.block-book-slide-img img').attr('src') || '',
      summary: $('.tab-content [data-name="Описание"]').text().trim(),
    };

    const genres: string[] = [];
    $('.book-info .genreslist a').each((_, el) =>
      genres.push($(el).text().trim()),
    );
    if (genres.length) novel.genres = genres.join(',');

    const authorText = $('.group-book-info-list .book-info-list')
      .eq(1)
      .find('div, a')
      .first()
      .text()
      .trim();
    if (authorText && authorText !== 'Не указан') novel.author = authorText;

    const statusText = $('.group-book-info-list .book-info-list')
      .filter((_, el) => $(el).text().includes('Книга завершена'))
      .text();
    if (statusText) {
      novel.status = statusText.includes('завершена')
        ? NovelStatus.Completed
        : NovelStatus.Ongoing;
    }

    const chapters: Plugin.ChapterItem[] = [];
    const chapterNodes = $('.tab-content [data-name="Главы"] .chapterinfo');
    const totalChapters = chapterNodes.length;

    chapterNodes.each((index, el) => {
      const node = $(el);
      const link = node.find('a').first();
      const name = link.text().trim();
      const href = link.attr('href') || '';
      const dateText = node.find('.timechapter').text().trim();
      if (name && href) {
        chapters.push({
          name,
          path: href.replace(this.site, ''),
          releaseTime: this.parseDate(dateText),
          chapterNumber: totalChapters - index,
        });
      }
    });
    novel.chapters = chapters.reverse();
    return novel;
  }

  async parseChapter(chapterPath: string): Promise<string> {
    const body = await fetchApi(this.site + chapterPath, {
      headers: this.headers,
    }).then(res => res.text());
    const $ = parseHTML(body);

    let chapterHtml = '';

    if (this.isBookhamster) {
      chapterHtml =
        $('article .entry-content').html() ||
        $('.entry-content').html() ||
        '';
    } else {
      chapterHtml = $('.chapter-content').html() || '';
    }

    if (!chapterHtml) return '';

    chapterHtml = chapterHtml.replace(
      /<script[^>]*>[\s\S]*?<\/script>/gim,
      '',
    );
    chapterHtml = chapterHtml.replace(
      /<div class="pc-adv">[\s\S]*?<\/div>/gim,
      '',
    );
    chapterHtml = chapterHtml.replace(
      /<div class="mob-adv">[\s\S]*?<\/div>/gim,
      '',
    );

    if (chapterHtml.includes('<img')) {
      chapterHtml = chapterHtml.replace(
        /srcset="([^"]+)"/g,
        (match, src) => {
          if (!src) return match;
          const bestlink = src
            .split(' ')
            .filter((url: string) => url.startsWith('http'))
            .pop();
          return bestlink ? `src="${bestlink}"` : match;
        },
      );
    }
    return chapterHtml;
  }

  async searchNovels(
    searchTerm: string,
    page: number | undefined = 1,
  ): Promise<Plugin.NovelItem[]> {
    const url =
      this.site +
      '/vse-knigi/?searchname=' +
      encodeURIComponent(searchTerm) +
      '&bpage=' +
      page;
    const result = await fetchApi(url, { headers: this.headers }).then(res =>
      res.text(),
    );
    const loadedCheerio = parseHTML(result);

    if (this.isBookhamster) {
      return loadedCheerio('div.one-book-home.rnew')
        .map((_, element) => {
          const el = loadedCheerio(element);
          const link = el.find('.img-home a').first();
          const href = link.attr('href') || '';
          const cover = link.find('img').attr('src') || '';
          const name =
            el.find('.title-home a').text().trim() ||
            link.attr('title') ||
            link.text().trim();
          return {
            name,
            cover,
            path: href.replace(this.site, ''),
          };
        })
        .get()
        .filter(novel => novel.name && novel.path);
    }

    // ifreedom
    return loadedCheerio('div.item-book-slide')
      .map((index, element) => {
        const el = loadedCheerio(element);
        const linkEl = el.find('a.link-book-slide').first();
        const href = linkEl.attr('href') || '';
        const cover = el.find('.block-book-slide-img img').attr('src') || '';
        const name =
          el.find('.block-book-slide-title').text().trim() ||
          linkEl.attr('title') ||
          linkEl.text().trim();
        return {
          name,
          cover,
          path: href.replace(this.site, ''),
        };
      })
      .get()
      .filter(novel => novel.name && novel.path);
  }

  parseDate = (dateString: string | undefined = '') => {
    const months: Record<string, number> = {
      января: 1,
      февраля: 2,
      марта: 3,
      апреля: 4,
      мая: 5,
      июня: 6,
      июля: 7,
      августа: 8,
      сентября: 9,
      октября: 10,
      ноября: 11,
      декабря: 12,
    };

    if (dateString.includes('.')) {
      const [day, month, year] = dateString.split('.');
      if (day && month && year) {
        return dayjs(year + '-' + month + '-' + day).format('LL');
      }
    } else if (dateString.includes(' ')) {
      const [day, month] = dateString.split(' ');
      if (day && months[month]) {
        const year = new Date().getFullYear();
        return dayjs(year + '-' + months[month] + '-' + day).format('LL');
      }
    }
    return dateString || null;
  };
}
