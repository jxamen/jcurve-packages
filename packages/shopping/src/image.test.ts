import { expect, it } from 'vitest';
import { productImage } from './image';
it('requests measured width at 2–3x for the verified Toss optimizer only', () => {
  const uri = 'https://resources-fe.toss.im/image-optimize/width=160,quality=75/https%3A%2F%2Fshopping.toss.im%2Fexample.jpg';
  expect(productImage(uri, 189, 3)).toBe(uri.replace('width=160', 'width=567'));
  expect(productImage(uri, 189, 1)).toContain('width=378');
  expect(productImage(uri.replace('width=160', 'width=800'), 189, 4)).toContain('width=800');
  expect(productImage('https://other.example/thumb/160.jpg', 189, 3)).toBe('https://other.example/thumb/160.jpg');
  expect(productImage(uri, 0, 3)).toBe(uri);
});
