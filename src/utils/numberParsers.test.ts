import { describe, expect, it } from 'vitest';
import { parsePositiveInt } from '@/utils/numberParsers';

describe('parsePositiveInt', () => {
  it('возвращает fallback для пустого и невалидного ввода', () => {
    expect(parsePositiveInt(undefined, 60)).toBe(60);
    expect(parsePositiveInt('', 60)).toBe(60);
    expect(parsePositiveInt('0', 60)).toBe(60);
    expect(parsePositiveInt('-5', 60)).toBe(60);
    expect(parsePositiveInt('abc', 60)).toBe(60);
  });

  it('парсит положительные целые', () => {
    expect(parsePositiveInt('1', 60)).toBe(1);
    expect(parsePositiveInt('120', 60)).toBe(120);
    expect(parsePositiveInt('  45  ', 60)).toBe(45);
  });
});
