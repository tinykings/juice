import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseThemeChoice, resolveTheme, themeBootScript, THEMES } from './theme';

const css = readFileSync(new URL('../app/globals.css', import.meta.url), 'utf8');

type Rgb = [number, number, number];

function tokensFor(id: string): Record<string, string> {
  const block = css.match(new RegExp(`\\[data-theme="${id}"\\] \\{([^}]*)\\}`));
  if (!block) throw new Error(`No color block for theme "${id}"`);
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
  it.each(THEMES.map(theme => [theme.id, theme] as const))('%s has readable text on every surface', (id, theme) => {
    const tokens = tokensFor(id);
    const background = parseColor(tokens['--background'], [0, 0, 0]);
    expect(tokens['--background'].toLowerCase()).toBe(theme.background.toLowerCase());
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
  it('follows the system by default: Parchment in light mode, Material in dark', () => {
    expect(resolveTheme('system', false)).toBe('parchment');
    expect(resolveTheme('system', true)).toBe('material');
  });

  it('keeps a picked theme whatever the system says', () => {
    expect(resolveTheme('dracula', false)).toBe('dracula');
    expect(resolveTheme('github-light', true)).toBe('github-light');
  });

  it('reads stored values, including older ones', () => {
    expect(parseThemeChoice(null)).toBe('system');
    expect(parseThemeChoice('light')).toBe('parchment');
    expect(parseThemeChoice('dark')).toBe('material');
    expect(parseThemeChoice('matrix')).toBe('matrix');
    expect(parseThemeChoice('nonsense')).toBe('system');
    expect(parseThemeChoice('constructor')).toBe('system');
  });

  it('boot script knows every theme', () => {
    for (const theme of THEMES) expect(themeBootScript).toContain(`"${theme.id}"`);
  });
});
