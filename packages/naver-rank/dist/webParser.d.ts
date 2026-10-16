import type { WebRow } from './webQueue';
export declare function shoppingLinkId(link: string): string | undefined;
/** Only result links inside result cards; never count arbitrary page navigation links. */
export declare function parseCollectorHtml(html: string, channel: 'shopping' | 'place', page: number): WebRow[];
