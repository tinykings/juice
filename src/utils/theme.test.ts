import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseThemeChoice, resolveTheme, themeBootScript, THEME_COLORS } from './theme';

const css = readFileSync(new URL('../app/globals.css', import.meta.url), 'utf8');

type Rgb = [number, number, number];

const MODES = [
  { id: 'light', selector: '[data-theme="light"]', background: THEME_COLORS.light },
  { id: 'dark', selector: '[data-theme="dark"]', background: THEME_COLORS.dark },
] as const;

function tokensFor(selector: string): Record<string, string> {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const block = css.match(new RegExp(`${escaped} \\{([^}]*)\\}`));
  if (!block) throw new Error(`No color block for "${selector}"`);
  return Object.fromEntries(
    Array.from(block[1].matchAll(/(--[\w-]+):\s*([^;]+);/g), match => [match[1], match[2].trim()])
  );
}

function parseColor(value: string, over: Rgb): Rgb {
  const hex = value.match(/^#([0-9a-f]{6})$/i);
  if (hex) return [0, 2, 4].map(i => parseInt(hex[1].slice(i, i + 2), 16)) as Rgb;
  const rgba = value.match(/^rgba\((\d+), (\d+), (\d+), ([\d.]+)\)$/);
  if (!rgba) throw new Error(`Unexpected color: ${value}`);
  const alpha = Number(rgba[4]);
  return [1, 2, 3].map((n, i) => Number(rgba[n]) * alpha + over[i] * (1 - alpha)) as Rgb;
}

function contrast(a: Rgb, b: Rgb): number {
  const luminance = (color: Rgb) => {
    const [r, g, b] = color.map(channel => {
      const value = channel / 255;
      return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (light + 0.05) / (dark + 0.05);
}

describe('theme palettes', () => {
  it.each(MODES.map(mode => [mode.id, mode] as const))('%s has readable text on every surface', (_id, mode) => {
    const tokens = tokensFor(mode.selector);
    const background = parseColor(tokens['--background'], [0, 0, 0]);
    expect(tokens['--background'].toLowerCase()).toBe(mode.background.toLowerCase());
    const card = parseColor(tokens['--card'], background);
    const surfaces = {
      background,
      card,
      task: parseColor(tokens['--task-surface'], background),
      inset: parseColor(tokens['--surface-inset'], card),
    };

    for (const text of ['--foreground', '--muted', '--accent', '--red', '--event']) {
      for (const [name, surface] of Object.entries(surfaces)) {
        const ratio = contrast(parseColor(tokens[text], surface), surface);
        expect(ratio, `${text} on ${name}: ${ratio.toFixed(2)}`).toBeGreaterThanOrEqual(4.5);
      }
    }

    // Text on solid accent and red buttons uses the page background.
    for (const fill of ['--accent', '--red']) {
      expect(contrast(background, parseColor(tokens[fill], background))).toBeGreaterThanOrEqual(4.5);
    }
  });
});

describe('theme choice', () => {
  it('follows the system by default', () => {
    expect(resolveTheme('system', false)).toBe('light');
    expect(resolveTheme('system', true)).toBe('dark');
  });

  it('keeps a picked mode whatever the system says', () => {
    expect(resolveTheme('dark', false)).toBe('dark');
    expect(resolveTheme('light', true)).toBe('light');
  });

  it('reads stored values, including older named themes', () => {
    expect(parseThemeChoice(null)).toBe('system');
    expect(parseThemeChoice('light')).toBe('light');
    expect(parseThemeChoice('dark')).toBe('dark');
    expect(parseThemeChoice('parchment')).toBe('light');
    expect(parseThemeChoice('matrix')).toBe('dark');
    expect(parseThemeChoice('nonsense')).toBe('system');
    expect(parseThemeChoice('constructor')).toBe('system');
  });

  it('boot script knows light and dark', () => {
    expect(themeBootScript).toContain("'light'");
    expect(themeBootScript).toContain("'dark'");
  });
});
