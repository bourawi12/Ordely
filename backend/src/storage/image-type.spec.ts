import { detectImageType } from './image-type';

describe('detectImageType', () => {
  it('recognises JPEG, PNG and WebP by their first bytes', () => {
    expect(detectImageType(Buffer.from([0xff, 0xd8, 0xff, 0xe0]))?.mime).toBe(
      'image/jpeg',
    );
    expect(
      detectImageType(
        Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      )?.mime,
    ).toBe('image/png');
    expect(
      detectImageType(
        Buffer.from('RIFF\u0000\u0000\u0000\u0000WEBPVP8 ', 'binary'),
      )?.mime,
    ).toBe('image/webp');
  });

  it('rejects anything else, including SVG and GIF', () => {
    expect(
      detectImageType(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>')),
    ).toBeNull();
    expect(detectImageType(Buffer.from('GIF89a'))).toBeNull();
    expect(detectImageType(Buffer.alloc(0))).toBeNull();
  });
});
