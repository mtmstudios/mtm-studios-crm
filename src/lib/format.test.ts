import { describe, expect, it } from 'vitest';
import { avatarTone, displayName, growth, initials, money, toDomain } from './format';

describe('money', () => {
  it('formatiert deutsch mit Euro-Zeichen', () => {
    // Zwischen Betrag und Währung steht ein geschütztes Leerzeichen
    expect(money(1500)).toMatch(/^1\.500\s€$/u);
  });

  it('behandelt null wie null Euro', () => {
    expect(money(null)).toMatch(/^0\s€$/u);
  });
});

describe('growth', () => {
  it('rechnet den Zuwachs in Prozent', () => {
    expect(growth(150, 100)).toBe(50);
    expect(growth(50, 100)).toBe(-50);
  });

  it('gibt null zurück, wenn der Vorzeitraum leer war', () => {
    // "+100 %" gegenüber 0 wäre eine Falschaussage
    expect(growth(100, 0)).toBeNull();
  });
});

describe('initials', () => {
  it('nimmt den ersten und letzten Namensteil', () => {
    expect(initials('Anna Beispiel')).toBe('AB');
    expect(initials('Anna Maria Beispiel')).toBe('AB');
  });

  it('kommt mit einem einzelnen Namen aus', () => {
    expect(initials('Anna')).toBe('A');
  });

  it('fällt bei fehlendem Namen auf ein Fragezeichen zurück', () => {
    expect(initials(null)).toBe('?');
    expect(initials('')).toBe('?');
  });
});

describe('displayName', () => {
  it('bevorzugt full_name aus der Datenbank', () => {
    expect(displayName({ full_name: 'Anna Beispiel', first_name: 'X' })).toBe('Anna Beispiel');
  });

  it('setzt sonst aus Vor- und Nachname zusammen', () => {
    expect(displayName({ first_name: 'Anna', last_name: 'Beispiel' })).toBe('Anna Beispiel');
  });

  it('kommt mit nur einem Teil aus', () => {
    expect(displayName({ last_name: 'Beispiel' })).toBe('Beispiel');
  });

  it('zeigt einen Platzhalter statt eines leeren Namens', () => {
    expect(displayName({})).toBe('Ohne Namen');
  });
});

describe('toDomain', () => {
  it('ergänzt ein fehlendes Protokoll', () => {
    expect(toDomain('musterbau.de')).toBe('musterbau.de');
  });

  it('entfernt www und den Pfad', () => {
    expect(toDomain('https://www.musterbau.de/kontakt')).toBe('musterbau.de');
  });

  it('gibt bei Unbrauchbarem null zurück', () => {
    expect(toDomain(null)).toBeNull();
    expect(toDomain('   ')).toBeNull();
  });
});

describe('avatarTone', () => {
  it('liefert für dieselbe ID immer dieselbe Farbe', () => {
    expect(avatarTone('abc-123')).toBe(avatarTone('abc-123'));
  });

  it('bleibt innerhalb der vorgegebenen Palette', () => {
    for (const seed of ['a', 'b', 'c', 'lange-uuid-mit-zeichen', '']) {
      expect(avatarTone(seed)).toMatch(/^bg-\w+-100 text-\w+-700$/);
    }
  });
});
