import type { Product, ProductPage, ProductQuery } from './types';

type State = { items: Product[] | null; loadingMore: boolean };
/** A generation owns its cursor and request lock; stale responses cannot publish. */
export class ProductPager {
  private generation = 0;
  private query: ProductQuery = { partnerId: 'all' };
  private next: string | null = null;
  private busy = false;
  private items: Product[] | null = null;
  constructor(private fetch: (query: ProductQuery) => Promise<ProductPage>, private publish: (state: State) => void) {}
  cancel() { ++this.generation; this.busy = false; this.next = null; }
  reset(query: ProductQuery) {
    this.cancel();
    this.query = query;
    this.items = null;
    return this.load(false);
  }
  more() {
    if (this.busy || !this.next || !this.items) return Promise.resolve();
    return this.load(true);
  }
  private async load(append: boolean) {
    const generation = this.generation;
    const cursor = append ? this.next : null;
    this.busy = true;
    this.publish({ items: this.items, loadingMore: append });
    try {
      const page = await this.fetch({ ...this.query, ...(append ? { cursor } : {}) });
      if (generation !== this.generation) return;
      const merged = append ? [...this.items!, ...page.items] : page.items;
      const seen = new Set<string>();
      this.items = merged.filter(p => { const key = JSON.stringify([p.partnerId, p.id]); if (seen.has(key)) return false; seen.add(key); return true; });
      this.next = page.next && page.next !== cursor ? page.next : null;
    } catch {
      if (generation !== this.generation) return;
      if (!append) this.items = [];
    } finally {
      if (generation === this.generation) {
        this.busy = false;
        this.publish({ items: this.items, loadingMore: false });
      }
    }
  }
}
