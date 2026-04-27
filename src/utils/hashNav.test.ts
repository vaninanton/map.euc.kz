import { describe, expect, it } from 'vitest';
import { buildHash, parseHash } from '@/utils/hashNav';

describe('hashNav smoke', () => {
  it('парсит валидный hash с нормализацией регистра типа', () => {
    expect(parseHash('BikeLane=alm84')).toEqual({ type: 'bikeLane', id: 'alm84' });
  });

  it('корректно декодирует id из hash', () => {
    expect(parseHash('route=abc%20123')).toEqual({ type: 'route', id: 'abc 123' });
  });

  it('возвращает null для невалидных строк', () => {
    expect(parseHash('')).toBeNull();
    expect(parseHash('unknown=1')).toBeNull();
    expect(parseHash('point=')).toBeNull();
    expect(parseHash('point')).toBeNull();
  });

  it('строит hash с encodeURIComponent', () => {
    expect(buildHash('socket', 'id with space')).toBe('socket=id%20with%20space');
  });
});
